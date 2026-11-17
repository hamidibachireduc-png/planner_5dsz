import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { FLOOR_STYLES } from '../data/catalog';
import {
  findWallsForRoom,
  moveRoomCascade,
  resizeRoomWithWalls,
} from '../utils/roomWallUtils';
import {
  DrawingSpacePreset,
  EditorTool,
  FloorPlanData,
  FurnitureItem,
  Opening,
  Room,
  SelectionTarget,
  SketchUnderlayConfig,
  StructuralBeam,
  StructuralColumn,
  UnitType,
  Wall,
} from '../types/planner';

interface Canvas2DProps {
  floorPlan: FloorPlanData;
  activeTool: EditorTool;
  roomPreset?: DrawingSpacePreset;
  selection: SelectionTarget;
  snapEnabled: boolean;
  autoMeasureEnabled?: boolean;
  isDarkTheme: boolean;
  sketchUnderlay?: SketchUnderlayConfig | null;
  onSelect: (target: SelectionTarget) => void;
  onChangeFloorPlan: (next: FloorPlanData, commitHistory?: boolean) => void;
  onToolResetToSelect: () => void;
  onCaptureReady?: (captureFn: () => string | null) => void;
}

function formatLen(meters: number, unit: UnitType): string {
  if (unit === 'ft') {
    return `${(meters * 3.28084).toFixed(1)} ft`;
  }
  return `${meters.toFixed(2)} m`;
}

function formatArea(sqm: number, unit: UnitType): string {
  if (unit === 'ft') {
    return `${(sqm * 10.7639).toFixed(0)} ft²`;
  }
  return `${sqm.toFixed(1)} م²`;
}

function distToSegment(
  px: number,
  pz: number,
  x1: number,
  z1: number,
  x2: number,
  z2: number
): { dist: number; t: number; projX: number; projZ: number } {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-6) return { dist: Math.hypot(px - x1, pz - z1), t: 0, projX: x1, projZ: z1 };
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / lenSq));
  const projX = x1 + t * dx;
  const projZ = z1 + t * dz;
  return { dist: Math.hypot(px - projX, pz - projZ), t, projX, projZ };
}

type DragState =
  | { kind: 'pan'; startScreenX: number; startScreenY: number; origPanX: number; origPanZ: number }
  | { kind: 'furniture_move'; id: string; offsetX: number; offsetZ: number; initial: FloorPlanData }
  | { kind: 'furniture_rotate'; id: string; centerX: number; centerZ: number; initial: FloorPlanData }
  | { kind: 'room_move'; id: string; offsetX: number; offsetZ: number; initial: FloorPlanData }
  | { kind: 'room_resize'; id: string; initial: FloorPlanData }
  | { kind: 'wall_point'; id: string; point: 'p1' | 'p2'; initial: FloorPlanData }
  | { kind: 'opening_slide'; id: string; wall: Wall; initial: FloorPlanData }
  | { kind: 'column_move'; id: string; offsetX: number; offsetZ: number; initial: FloorPlanData }
  | { kind: 'beam_point'; id: string; point: 'p1' | 'p2'; initial: FloorPlanData }
  | { kind: 'draw_room'; startX: number; startZ: number; curX: number; curZ: number }
  | null;

export const Canvas2D: React.FC<Canvas2DProps> = ({
  floorPlan,
  activeTool,
  roomPreset,
  selection,
  snapEnabled,
  autoMeasureEnabled = true,
  isDarkTheme,
  sketchUnderlay,
  onSelect,
  onChangeFloorPlan,
  onToolResetToSelect,
  onCaptureReady,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Camera transform: pixelsPerMeter, pan offset in world meters
  const [view, setView] = useState({ scale: 48, panX: 0, panZ: 0 });
  const [wallDraftStart, setWallDraftStart] = useState<{ x: number; z: number } | null>(null);
  const [beamDraftStart, setBeamDraftStart] = useState<{ x: number; z: number } | null>(null);
  const [hoverWorld, setHoverWorld] = useState<{ x: number; z: number } | null>(null);
  const dragRef = useRef<DragState>(null);
  const underlayImgRef = useRef<HTMLImageElement | null>(null);
  const [underlayRevision, setUnderlayRevision] = useState(0);
  const activePointersRef = useRef<Map<number, { clientX: number; clientY: number }>>(new Map());
  const pinchRef = useRef<{
    startDist: number;
    startScale: number;
    startPanX: number;
    startPanZ: number;
    midWorldX: number;
    midWorldZ: number;
  } | null>(null);
  const latestPlanRef = useRef<FloorPlanData>(floorPlan);
  latestPlanRef.current = floorPlan;

  useEffect(() => {
    if (!sketchUnderlay?.dataUrl) {
      underlayImgRef.current = null;
      return;
    }
    const img = new Image();
    img.onload = () => {
      underlayImgRef.current = img;
      setUnderlayRevision((n) => n + 1);
    };
    img.src = sketchUnderlay.dataUrl;
  }, [sketchUnderlay?.dataUrl]);

  useEffect(() => {
    if (!onCaptureReady) return;
    onCaptureReady(() => {
      const c = canvasRef.current;
      return c ? c.toDataURL('image/png') : null;
    });
  }, [onCaptureReady]);

  useEffect(() => {
    if (activeTool !== 'wall') setWallDraftStart(null);
    if (activeTool !== 'beam') setBeamDraftStart(null);
  }, [activeTool]);

  const snapVal = useCallback(
    (v: number) => (snapEnabled ? Math.round(v * 4) / 4 : Math.round(v * 20) / 20),
    [snapEnabled]
  );

  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, z: 0 };
      const rect = canvas.getBoundingClientRect();
      const sx = clientX - rect.left - rect.width / 2;
      const sy = clientY - rect.top - rect.height / 2;
      return {
        x: sx / view.scale + view.panX,
        z: sy / view.scale + view.panZ,
      };
    },
    [view]
  );

  const fitView = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    let minX = -5, maxX = 5, minZ = -4, maxZ = 4;
    if (floorPlan.rooms.length > 0 || floorPlan.walls.length > 0) {
      const xs: number[] = [];
      const zs: number[] = [];
      floorPlan.rooms.forEach((r) => {
        xs.push(r.x, r.x + r.width);
        zs.push(r.z, r.z + r.depth);
      });
      floorPlan.walls.forEach((w) => {
        xs.push(w.x1, w.x2);
        zs.push(w.z1, w.z2);
      });
      minX = Math.min(...xs);
      maxX = Math.max(...xs);
      minZ = Math.min(...zs);
      maxZ = Math.max(...zs);
    }
    const worldW = Math.max(4, maxX - minX + 3);
    const worldH = Math.max(4, maxZ - minZ + 3);
    const scale = Math.max(
      20,
      Math.min(90, Math.min((rect.width - 80) / worldW, (rect.height - 80) / worldH))
    );
    setView({
      scale,
      panX: (minX + maxX) / 2,
      panZ: (minZ + maxZ) / 2,
    });
  }, [floorPlan.rooms, floorPlan.walls]);

  // Reset draft wall when switching tools
  useEffect(() => {
    setWallDraftStart(null);
  }, [activeTool]);

  // Render Loop (re-draws cleanly whenever state/view changes)
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 600;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.save();
      ctx.scale(dpr, dpr);

      // Background
      ctx.fillStyle = isDarkTheme ? '#13161A' : '#FAF9F6';
      ctx.fillRect(0, 0, w, h);

      const toSX = (wx: number) => (wx - view.panX) * view.scale + w / 2;
      const toSY = (wz: number) => (wz - view.panZ) * view.scale + h / 2;

      // Grid lines
      const leftW = view.panX - w / (2 * view.scale);
      const rightW = view.panX + w / (2 * view.scale);
      const topW = view.panZ - h / (2 * view.scale);
      const botW = view.panZ + h / (2 * view.scale);

      const minorStep = 0.25;
      if (view.scale >= 28) {
        ctx.strokeStyle = isDarkTheme ? 'rgba(148,163,184,0.06)' : 'rgba(15,23,42,0.045)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let gx = Math.floor(leftW / minorStep) * minorStep; gx <= rightW; gx += minorStep) {
          const sx = toSX(gx);
          ctx.moveTo(sx, 0);
          ctx.lineTo(sx, h);
        }
        for (let gz = Math.floor(topW / minorStep) * minorStep; gz <= botW; gz += minorStep) {
          const sy = toSY(gz);
          ctx.moveTo(0, sy);
          ctx.lineTo(w, sy);
        }
        ctx.stroke();
      }

      // 1m Major Grid
      ctx.strokeStyle = isDarkTheme ? 'rgba(148,163,184,0.14)' : 'rgba(15,23,42,0.09)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let gx = Math.floor(leftW); gx <= rightW; gx += 1) {
        const sx = toSX(gx);
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, h);
      }
      for (let gz = Math.floor(topW); gz <= botW; gz += 1) {
        const sy = toSY(gz);
        ctx.moveTo(0, sy);
        ctx.lineTo(w, sy);
      }
      ctx.stroke();

      // Optional Pro Sketch Underlay Image (centered around 0,0)
      if (
        sketchUnderlay?.visible &&
        underlayImgRef.current &&
        underlayImgRef.current.complete &&
        underlayImgRef.current.naturalWidth > 0
      ) {
        ctx.save();
        ctx.globalAlpha = Math.max(0.08, Math.min(0.9, sketchUnderlay.opacity));
        const uw = sketchUnderlay.widthM * view.scale;
        const uh = sketchUnderlay.depthM * view.scale;
        ctx.drawImage(
          underlayImgRef.current,
          toSX(-sketchUnderlay.widthM / 2),
          toSY(-sketchUnderlay.depthM / 2),
          uw,
          uh
        );
        ctx.restore();
      }

      // 1. Rooms
      floorPlan.rooms.forEach((room) => {
        const rx = toSX(room.x);
        const rz = toSY(room.z);
        const rw = room.width * view.scale;
        const rd = room.depth * view.scale;
        const isSel = selection?.kind === 'room' && selection.id === room.id;
        const styleDef = FLOOR_STYLES.find((f) => f.id === room.floorStyle);

        ctx.save();
        ctx.fillStyle = styleDef ? `${styleDef.previewColor}38` : 'rgba(197,155,109,0.22)';
        ctx.fillRect(rx, rz, rw, rd);

        if (styleDef?.pattern === 'grid' || styleDef?.pattern === 'zellige' || styleDef?.pattern === 'hex') {
          ctx.save();
          ctx.beginPath();
          ctx.rect(rx, rz, rw, rd);
          ctx.clip();
          const tilePx = Math.max(12, view.scale * (styleDef.pattern === 'zellige' ? 0.45 : 0.6));
          ctx.strokeStyle = isDarkTheme ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';
          ctx.lineWidth = 1;
          for (let gx = rx + tilePx; gx < rx + rw; gx += tilePx) {
            ctx.beginPath();
            ctx.moveTo(gx, rz);
            ctx.lineTo(gx, rz + rd);
            ctx.stroke();
          }
          for (let gz = rz + tilePx; gz < rz + rd; gz += tilePx) {
            ctx.beginPath();
            ctx.moveTo(rx, gz);
            ctx.lineTo(rx + rw, gz);
            ctx.stroke();
          }
          ctx.restore();
        }

        if (isSel) {
          ctx.strokeStyle = '#2563EB';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 4]);
          ctx.strokeRect(rx, rz, rw, rd);
          ctx.setLineDash([]);
          // Resize corner handle (bottom-right)
          ctx.fillStyle = '#2563EB';
          ctx.beginPath();
          ctx.arc(rx + rw, rz + rd, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Room title & Area label
        const cx = rx + rw / 2;
        const cy = rz + rd / 2;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isDarkTheme ? 'rgba(241,245,249,0.85)' : 'rgba(15,23,42,0.82)';
        ctx.font = '600 13px "IBM Plex Sans Arabic", sans-serif';
        ctx.fillText(room.name, cx, cy - 9);

        ctx.fillStyle = isDarkTheme ? 'rgba(148,163,184,0.9)' : 'rgba(71,85,105,0.85)';
        ctx.font = '500 11px "IBM Plex Mono", monospace';
        const area = room.width * room.depth;
        ctx.fillText(
          `${formatLen(room.width, floorPlan.unit)} × ${formatLen(room.depth, floorPlan.unit)} · ${formatArea(area, floorPlan.unit)}`,
          cx,
          cy + 10
        );
        ctx.restore();
      });

      // 2. Furniture Items (CAD Top-Down Drawings)
      floorPlan.furniture.forEach((item) => {
        const fx = toSX(item.x);
        const fz = toSY(item.z);
        const fw = item.width * view.scale;
        const fd = item.depth * view.scale;
        const isSel = selection?.kind === 'furniture' && selection.id === item.id;

        ctx.save();
        ctx.translate(fx, fz);
        ctx.rotate(-item.rotation);

        // Base footprint
        ctx.fillStyle = item.primaryColor;
        ctx.strokeStyle = isSel ? '#2563EB' : isDarkTheme ? '#94A3B8' : '#334155';
        ctx.lineWidth = isSel ? 2.2 : 1.2;

        if (
          item.type === 'plant_olive' ||
          item.type === 'floor_lamp' ||
          item.type === 'ottoman' ||
          item.type === 'dining_round' ||
          item.type === 'vacuum_robot' ||
          item.type === 'chandelier' ||
          item.type === 'air_purifier' ||
          item.type === 'bean_bag' ||
          item.type === 'brass_tea_table' ||
          item.type === 'water_tank_pump' ||
          item.type === 'courtyard_fountain' ||
          item.type === 'maida_low_table' ||
          item.type === 'tabouna_bread_oven'
        ) {
          ctx.beginPath();
          ctx.arc(0, 0, Math.min(fw, fd) / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          if (
            item.type === 'plant_olive' ||
            item.type === 'chandelier' ||
            item.type === 'vacuum_robot' ||
            item.type === 'courtyard_fountain' ||
            item.type === 'brass_tea_table' ||
            item.type === 'maida_low_table'
          ) {
            ctx.fillStyle = item.accentColor;
            ctx.beginPath();
            ctx.arc(0, 0, Math.min(fw, fd) * 0.32, 0, Math.PI * 2);
            ctx.fill();
          } else if (item.type === 'tabouna_bread_oven') {
            ctx.strokeStyle = '#EA580C';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.arc(0, 0, Math.min(fw, fd) * 0.28, 0, Math.PI * 2);
            ctx.stroke();
          } else if (item.type === 'bean_bag' || item.type === 'water_tank_pump') {
            ctx.strokeStyle = isDarkTheme ? 'rgba(255,255,255,0.4)' : 'rgba(15,23,42,0.35)';
            ctx.beginPath();
            ctx.arc(0, 0, Math.min(fw, fd) * 0.25, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (item.type === 'potager_curved') {
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.moveTo(-fw / 2, -fd / 2);
          ctx.lineTo(fw / 2, -fd / 2);
          ctx.lineTo(fw / 2, fd * 0.24);
          ctx.quadraticCurveTo(0, fd * 0.66, -fw / 2, fd * 0.24);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.stroke();
          ctx.strokeStyle = isDarkTheme ? 'rgba(255,255,255,0.38)' : 'rgba(15,23,42,0.38)';
          ctx.lineWidth = 1;
          ctx.strokeRect(-fw * 0.18, -fd * 0.34, fw * 0.36, fd * 0.44);
        } else if (item.type === 'potager_corner') {
          const leg = Math.min(fw, fd) * 0.44;
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.moveTo(-fw / 2, -fd / 2);
          ctx.lineTo(fw / 2, -fd / 2);
          ctx.lineTo(fw / 2, -fd / 2 + leg);
          ctx.lineTo(-fw / 2 + leg, -fd / 2 + leg);
          ctx.lineTo(-fw / 2 + leg, fd / 2);
          ctx.lineTo(-fw / 2, fd / 2);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.stroke();
          ctx.strokeStyle = isDarkTheme ? 'rgba(255,255,255,0.38)' : 'rgba(15,23,42,0.38)';
          ctx.lineWidth = 1;
          ctx.strokeRect(fw * 0.05, -fd / 2 + leg * 0.18, fw * 0.3, leg * 0.64);
        } else {
          ctx.globalAlpha =
            item.type === 'rug' ? 0.45 : item.type === 'kitchen_wall_cupboard_dz' ? 0.66 : 0.88;
          if (item.type === 'kitchen_wall_cupboard_dz') ctx.setLineDash([4, 3]);
          ctx.fillRect(-fw / 2, -fd / 2, fw, fd);
          ctx.globalAlpha = 1;
          ctx.strokeRect(-fw / 2, -fd / 2, fw, fd);
          ctx.setLineDash([]);

          // Inner architectural CAD details
          ctx.strokeStyle = isDarkTheme ? 'rgba(255,255,255,0.35)' : 'rgba(15,23,42,0.35)';
          ctx.lineWidth = 1;
          if (
            item.type === 'sofa_3' ||
            item.type === 'sofa_l' ||
            item.type === 'sofa_2' ||
            item.type === 'armchair' ||
            item.type === 'outdoor_lounge' ||
            item.type === 'algerian_sedari' ||
            item.type === 'clic_clac_sofa'
          ) {
            ctx.strokeRect(-fw / 2 + 2, -fd / 2 + 2, fw - 4, fd * 0.24);
            if (item.type === 'clic_clac_sofa') {
              ctx.beginPath();
              ctx.moveTo(-fw / 2 + 2, fd * 0.08);
              ctx.lineTo(fw / 2 - 2, fd * 0.08);
              ctx.stroke();
            }
          } else if (item.type === 'algerian_salon_u') {
            ctx.strokeRect(-fw / 2 + 2, -fd / 2 + 2, fw - 4, fd * 0.26);
            ctx.strokeRect(-fw / 2 + 2, -fd / 2 + 2, fw * 0.24, fd - 4);
            ctx.strokeRect(fw / 2 - fw * 0.24 - 2, -fd / 2 + 2, fw * 0.24, fd - 4);
          } else if (item.type === 'garage_car') {
            ctx.beginPath();
            ctx.roundRect(-fw * 0.44, -fd * 0.46, fw * 0.88, fd * 0.92, 6);
            ctx.stroke();
            ctx.strokeRect(-fw * 0.34, -fd * 0.16, fw * 0.68, fd * 0.38);
            ctx.beginPath();
            ctx.moveTo(-fw * 0.34, -fd * 0.16);
            ctx.lineTo(-fw * 0.42, -fd * 0.28);
            ctx.moveTo(fw * 0.34, -fd * 0.16);
            ctx.lineTo(fw * 0.42, -fd * 0.28);
            ctx.stroke();
          } else if (item.type === 'laundry_sink_lavoir') {
            ctx.strokeRect(-fw * 0.38, -fd * 0.32, fw * 0.76, fd * 0.64);
            ctx.beginPath();
            ctx.arc(0, 0, Math.min(fw, fd) * 0.12, 0, Math.PI * 2);
            ctx.stroke();
          } else if (item.type === 'storage_rack') {
            ctx.beginPath();
            ctx.moveTo(-fw / 2, -fd / 2);
            ctx.lineTo(fw / 2, fd / 2);
            ctx.moveTo(fw / 2, -fd / 2);
            ctx.lineTo(-fw / 2, fd / 2);
            ctx.stroke();
          } else if (item.type === 'ac_armoire') {
            ctx.strokeRect(-fw * 0.38, -fd * 0.32, fw * 0.76, fd * 0.42);
            ctx.beginPath();
            ctx.arc(0, fd * 0.2, Math.min(fw, fd) * 0.16, 0, Math.PI * 2);
            ctx.stroke();
          } else if (item.type === 'chaudiere_boiler') {
            ctx.beginPath();
            ctx.arc(0, 0, Math.min(fw, fd) * 0.22, 0, Math.PI * 2);
            ctx.stroke();
          } else if (item.type === 'wall_mirror_arch') {
            ctx.beginPath();
            ctx.moveTo(-fw * 0.3, fd * 0.2);
            ctx.lineTo(fw * 0.2, -fd * 0.25);
            ctx.stroke();
          } else if (
            item.type === 'bed_double' ||
            item.type === 'bed_single' ||
            item.type === 'bunk_bed' ||
            item.type === 'underbed_storage_bed' ||
            item.type === 'matrah_traditional_bed'
          ) {
            ctx.fillStyle = '#FFFFFF';
            if (item.type === 'bed_double' || item.type === 'underbed_storage_bed') {
              ctx.fillRect(-fw * 0.4, -fd * 0.42, fw * 0.36, fd * 0.18);
              ctx.fillRect(fw * 0.04, -fd * 0.42, fw * 0.36, fd * 0.18);
              ctx.strokeRect(-fw * 0.4, -fd * 0.42, fw * 0.36, fd * 0.18);
              ctx.strokeRect(fw * 0.04, -fd * 0.42, fw * 0.36, fd * 0.18);
            } else {
              ctx.fillRect(-fw * 0.32, -fd * 0.42, fw * 0.64, fd * 0.18);
              ctx.strokeRect(-fw * 0.32, -fd * 0.42, fw * 0.64, fd * 0.18);
            }
            ctx.beginPath();
            ctx.moveTo(-fw / 2, -fd * 0.08);
            ctx.lineTo(fw / 2, -fd * 0.08);
            ctx.stroke();
            if (item.type === 'bunk_bed') {
              ctx.beginPath();
              ctx.moveTo(fw * 0.35, -fd * 0.45);
              ctx.lineTo(fw * 0.35, fd * 0.45);
              ctx.stroke();
            }
          } else if (item.type === 'stove' || item.type === 'gas_oven_5burner') {
            const r = Math.min(fw, fd) * 0.14;
            const burners: [number, number][] = [
              [-fw * 0.24, -fd * 0.22],
              [fw * 0.24, -fd * 0.22],
              [-fw * 0.24, fd * 0.22],
              [fw * 0.24, fd * 0.22],
            ];
            if (item.type === 'gas_oven_5burner') burners.push([0, 0]);
            burners.forEach(([bx, bz]) => {
              ctx.beginPath();
              ctx.arc(bx, bz, r, 0, Math.PI * 2);
              ctx.stroke();
            });
          } else if (item.type === 'washer' || item.type === 'dryer') {
            ctx.beginPath();
            ctx.arc(0, 0, Math.min(fw, fd) * 0.28, 0, Math.PI * 2);
            ctx.stroke();
          } else if (item.type === 'bathtub' || item.type === 'jacuzzi') {
            ctx.beginPath();
            ctx.roundRect(-fw * 0.42, -fd * 0.38, fw * 0.84, fd * 0.76, 10);
            ctx.stroke();
          } else if (
            item.type === 'kitchen_counter' ||
            item.type === 'couscous_prep_counter' ||
            item.type === 'potager_straight'
          ) {
            ctx.strokeRect(fw * 0.05, -fd * 0.3, fw * 0.28, fd * 0.6);
            ctx.beginPath();
            ctx.arc(fw * 0.19, 0, Math.min(fw, fd) * 0.08, 0, Math.PI * 2);
            ctx.stroke();
          } else if (item.type === 'dish_rack_counter_dz') {
            for (let i = -3; i <= 3; i++) {
              ctx.beginPath();
              ctx.moveTo((fw / 9) * i, -fd * 0.32);
              ctx.lineTo((fw / 9) * i, fd * 0.32);
              ctx.stroke();
            }
          } else if (item.type === 'kitchen_wall_cupboard_dz') {
            ctx.beginPath();
            ctx.moveTo(0, -fd / 2);
            ctx.lineTo(0, fd / 2);
            ctx.stroke();
          } else if (item.type === 'toilet_arabic') {
            ctx.strokeRect(-fw * 0.34, -fd * 0.32, fw * 0.22, fd * 0.64);
            ctx.strokeRect(fw * 0.12, -fd * 0.32, fw * 0.22, fd * 0.64);
            ctx.beginPath();
            ctx.arc(0, -fd * 0.16, Math.min(fw, fd) * 0.14, 0, Math.PI * 2);
            ctx.stroke();
          } else if (item.type === 'toilet_anglaise') {
            ctx.strokeRect(-fw * 0.36, -fd * 0.42, fw * 0.72, fd * 0.24);
            ctx.beginPath();
            ctx.ellipse(0, fd * 0.12, fw * 0.28, fd * 0.28, 0, 0, Math.PI * 2);
            ctx.stroke();
          } else if (item.type === 'shower_standard') {
            ctx.strokeRect(-fw * 0.42, -fd * 0.42, fw * 0.84, fd * 0.84);
            ctx.beginPath();
            ctx.arc(0, 0, Math.min(fw, fd) * 0.1, 0, Math.PI * 2);
            ctx.stroke();
          } else if (item.type === 'shower_italian') {
            ctx.strokeRect(-fw * 0.34, fd * 0.28, fw * 0.68, Math.max(2, fd * 0.08));
            ctx.beginPath();
            ctx.moveTo(-fw / 2, -fd / 2);
            ctx.lineTo(fw / 2, -fd / 2);
            ctx.stroke();
          } else if (item.type === 'shower_arabic_hammam') {
            ctx.strokeRect(-fw * 0.44, -fd * 0.4, fw * 0.34, fd * 0.8);
            ctx.beginPath();
            ctx.arc(fw * 0.2, fd * 0.1, Math.min(fw, fd) * 0.16, 0, Math.PI * 2);
            ctx.stroke();
          } else if (item.type === 'sewing_machine_table') {
            ctx.strokeRect(-fw * 0.28, -fd * 0.2, fw * 0.56, fd * 0.28);
          } else if (item.type === 'double_vanity') {
            ctx.beginPath();
            ctx.arc(-fw * 0.25, 0, Math.min(fw * 0.16, fd * 0.28), 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(fw * 0.25, 0, Math.min(fw * 0.16, fd * 0.28), 0, Math.PI * 2);
            ctx.stroke();
          } else if (item.type === 'ablution_station' || item.type === 'turkish_hammam_bench') {
            ctx.strokeRect(-fw * 0.42, -fd * 0.38, fw * 0.42, fd * 0.76);
            ctx.beginPath();
            ctx.arc(fw * 0.22, 0, Math.min(fw * 0.14, fd * 0.26), 0, Math.PI * 2);
            ctx.stroke();
          } else if (item.type === 'fireplace_modern' || item.type === 'gas_heater_algerian') {
            ctx.fillStyle = '#EA580C';
            ctx.fillRect(-fw * 0.34, -fd * 0.12, fw * 0.68, fd * 0.35);
          } else if (item.type === 'prayer_corner') {
            ctx.strokeRect(-fw * 0.42, -fd * 0.38, fw * 0.56, fd * 0.76);
          } else if (item.type === 'walk_in_closet') {
            ctx.strokeRect(-fw / 2 + 3, -fd / 2 + 3, fw - 6, fd * 0.28);
            ctx.strokeRect(-fw / 2 + 3, -fd / 2 + 3, fw * 0.28, fd - 6);
          } else if (item.type === 'bar_counter') {
            ctx.beginPath();
            ctx.arc(-fw * 0.24, fd * 0.26, Math.min(fw, fd) * 0.12, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(fw * 0.24, fd * 0.26, Math.min(fw, fd) * 0.12, 0, Math.PI * 2);
            ctx.stroke();
          } else if (item.type === 'pergola_swing') {
            ctx.strokeRect(-fw * 0.36, -fd * 0.26, fw * 0.72, fd * 0.52);
          } else if (item.type === 'islamic_screen' || item.type === 'privacy_partition') {
            ctx.beginPath();
            for (let i = -3; i <= 3; i++) {
              ctx.moveTo((fw / 8) * i, -fd / 2);
              ctx.lineTo((fw / 8) * i, fd / 2);
            }
            ctx.stroke();
          } else if (item.type === 'reading_nook') {
            ctx.strokeRect(-fw / 2 + 2, -fd / 2 + 2, fw - 4, fd * 0.32);
            ctx.beginPath();
            ctx.arc(0, fd * 0.18, Math.min(fw * 0.2, fd * 0.24), 0, Math.PI * 2);
            ctx.stroke();
          } else if (item.type === 'ac_split') {
            ctx.beginPath();
            ctx.moveTo(-fw * 0.42, fd * 0.2);
            ctx.lineTo(fw * 0.42, fd * 0.2);
            ctx.stroke();
          } else if (item.type === 'piano') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(-fw * 0.45, fd * 0.15, fw * 0.9, fd * 0.22);
            ctx.strokeRect(-fw * 0.45, fd * 0.15, fw * 0.9, fd * 0.22);
          }
        }

        // Rotation handle if selected
        if (isSel) {
          ctx.strokeStyle = '#2563EB';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(0, -fd / 2);
          ctx.lineTo(0, -fd / 2 - 20);
          ctx.stroke();

          ctx.fillStyle = '#2563EB';
          ctx.beginPath();
          ctx.arc(0, -fd / 2 - 20, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.restore();
      });

      // 3. Walls (with Auto-Measure dimension callouts on selected wall or selected room perimeter)
      const selectedRoomWallIds = new Set<string>();
      if (autoMeasureEnabled && selection?.kind === 'room') {
        const selRoom = floorPlan.rooms.find((r) => r.id === selection.id);
        if (selRoom) {
          findWallsForRoom(selRoom, floorPlan.walls).allMatchedIds.forEach((id) =>
            selectedRoomWallIds.add(id)
          );
        }
      }

      floorPlan.walls.forEach((wall) => {
        const x1 = toSX(wall.x1);
        const y1 = toSY(wall.z1);
        const x2 = toSX(wall.x2);
        const y2 = toSY(wall.z2);
        const thickPx = Math.max(5, (wall.thickness || 0.16) * view.scale);
        const isSel = selection?.kind === 'wall' && selection.id === wall.id;
        const isRoomWallHighlight = autoMeasureEnabled && selectedRoomWallIds.has(wall.id);

        ctx.save();
        ctx.lineCap = 'square';
        ctx.strokeStyle = isSel
          ? '#2563EB'
          : isRoomWallHighlight
            ? '#0284C7'
            : isDarkTheme
              ? '#E2E8F0'
              : '#1E293B';
        ctx.lineWidth = thickPx + 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.strokeStyle = isSel
          ? '#DBEAFE'
          : isRoomWallHighlight
            ? '#E0F2FE'
            : wall.color || '#F5F2EB';
        ctx.lineWidth = Math.max(2, thickPx - 2);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Wall length callout if selected OR auto-measure enabled on active room perimeter
        const showDimBadge = isSel || (autoMeasureEnabled && isRoomWallHighlight);
        if (showDimBadge) {
          const wallLen = Math.hypot(wall.x2 - wall.x1, wall.z2 - wall.z1);
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const segPx = Math.hypot(x2 - x1, y2 - y1) || 1;
          const nx = -(y2 - y1) / segPx;
          const ny = (x2 - x1) / segPx;
          const labelX = mx + nx * 16;
          const labelY = my + ny * 16;

          ctx.fillStyle = isSel ? '#2563EB' : '#0284C7';
          ctx.beginPath();
          ctx.roundRect(labelX - 30, labelY - 9, 60, 18, 4);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '600 10px "IBM Plex Mono", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(formatLen(wallLen, floorPlan.unit), labelX, labelY);
        }

        if (isSel) {
          // Endpoint handles
          [
            [x1, y1],
            [x2, y2],
          ].forEach(([px, py]) => {
            ctx.fillStyle = '#2563EB';
            ctx.beginPath();
            ctx.arc(px, py, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.stroke();
          });
        }
        ctx.restore();
      });

      // 4. Doors, Windows & Arches (CAD architectural symbols)
      floorPlan.openings.forEach((op) => {
        const wall = floorPlan.walls.find((w) => w.id === op.wallId);
        if (!wall) return;
        const dx = wall.x2 - wall.x1;
        const dz = wall.z2 - wall.z1;
        const wallLen = Math.hypot(dx, dz);
        if (wallLen < 0.1) return;
        const angle = Math.atan2(dz, dx);
        const cx = wall.x1 + dx * op.offsetRatio;
        const cz = wall.z1 + dz * op.offsetRatio;
        const sx = toSX(cx);
        const sy = toSY(cz);
        const opPx = op.width * view.scale;
        const thickPx = Math.max(6, (wall.thickness || 0.16) * view.scale);
        const isSel = selection?.kind === 'opening' && selection.id === op.id;

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(angle);

        // Clear wall background behind opening
        ctx.fillStyle = isDarkTheme ? '#13161A' : '#FAF9F6';
        ctx.fillRect(-opPx / 2, -thickPx / 2 - 2, opPx, thickPx + 4);

        if (op.type === 'door') {
          const swingDir = op.swing === 'out' ? -1 : 1;
          // Hinge jambs
          ctx.fillStyle = isSel ? '#2563EB' : '#8C6239';
          ctx.fillRect(-opPx / 2, -thickPx / 2, 4, thickPx);
          ctx.fillRect(opPx / 2 - 4, -thickPx / 2, 4, thickPx);
          // Door leaf open 90 deg
          ctx.strokeStyle = isSel ? '#2563EB' : '#8C6239';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-opPx / 2 + 2, 0);
          ctx.lineTo(-opPx / 2 + 2, swingDir * opPx);
          ctx.stroke();
          // Quarter swing arc
          ctx.strokeStyle = isSel ? '#3B82F6' : 'rgba(100,116,139,0.65)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          if (swingDir > 0) {
            ctx.arc(-opPx / 2 + 2, 0, opPx, 0, Math.PI / 2, false);
          } else {
            ctx.arc(-opPx / 2 + 2, 0, opPx, -Math.PI / 2, 0, false);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (op.type === 'window') {
          ctx.strokeStyle = isSel ? '#2563EB' : '#0284C7';
          ctx.lineWidth = 2;
          ctx.strokeRect(-opPx / 2, -thickPx / 2, opPx, thickPx);
          ctx.beginPath();
          ctx.moveTo(-opPx / 2, 0);
          ctx.lineTo(opPx / 2, 0);
          ctx.stroke();
        } else {
          // Arch opening
          ctx.strokeStyle = isSel ? '#2563EB' : '#94A3B8';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(-opPx / 2, -thickPx / 2, opPx, thickPx);
          ctx.setLineDash([]);
        }
        ctx.restore();
      });

      // 4.5 Structural Beams (السوانتر) & Columns (البيليات) when structural layer is enabled
      if (floorPlan.showStructureLayer !== false) {
        (floorPlan.beams || []).forEach((beam) => {
          const x1 = toSX(beam.x1);
          const y1 = toSY(beam.z1);
          const x2 = toSX(beam.x2);
          const y2 = toSY(beam.z2);
          const thickPx = Math.max(4, (beam.width || 0.24) * view.scale);
          const isSel = selection?.kind === 'beam' && selection.id === beam.id;

          ctx.save();
          ctx.strokeStyle = isSel ? 'rgba(37,99,235,0.42)' : 'rgba(71,85,105,0.32)';
          ctx.lineWidth = thickPx + 2;
          ctx.lineCap = 'butt';
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();

          ctx.strokeStyle = isSel ? '#2563EB' : '#D97706';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.setLineDash([]);

          if (isSel) {
            [
              [x1, y1],
              [x2, y2],
            ].forEach(([px, py]) => {
              ctx.fillStyle = '#2563EB';
              ctx.beginPath();
              ctx.arc(px, py, 6, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#FFFFFF';
              ctx.lineWidth = 2;
              ctx.stroke();
            });
          }

          if (isSel || autoMeasureEnabled) {
            const len = Math.hypot(beam.x2 - beam.x1, beam.z2 - beam.z1);
            if (isSel && len > 0.3) {
              const mx = (x1 + x2) / 2;
              const my = (y1 + y2) / 2;
              ctx.fillStyle = '#B45309';
              ctx.beginPath();
              ctx.roundRect(mx - 34, my - 9, 68, 18, 4);
              ctx.fill();
              ctx.fillStyle = '#FFFFFF';
              ctx.font = '600 10px "IBM Plex Mono", monospace';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(`S ${formatLen(len, floorPlan.unit)}`, mx, my);
            }
          }
          ctx.restore();
        });

        (floorPlan.columns || []).forEach((col, cIdx) => {
          const cx = toSX(col.x);
          const cy = toSY(col.z);
          const cw = Math.max(10, (col.width || 0.3) * view.scale);
          const cd = Math.max(10, (col.depth || 0.3) * view.scale);
          const isSel = selection?.kind === 'column' && selection.id === col.id;

          ctx.save();
          ctx.fillStyle = isSel ? '#2563EB' : col.color || '#334155';
          ctx.fillRect(cx - cw / 2, cy - cd / 2, cw, cd);
          ctx.strokeStyle = isSel ? '#93C5FD' : '#F8FAFC';
          ctx.lineWidth = isSel ? 2.5 : 1.3;
          ctx.strokeRect(cx - cw / 2, cy - cd / 2, cw, cd);

          // Concrete pillar diagonal X-hatch
          ctx.strokeStyle = 'rgba(255,255,255,0.65)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx - cw / 2 + 2, cy - cd / 2 + 2);
          ctx.lineTo(cx + cw / 2 - 2, cy + cd / 2 - 2);
          ctx.moveTo(cx + cw / 2 - 2, cy - cd / 2 + 2);
          ctx.lineTo(cx - cw / 2 + 2, cy + cd / 2 - 2);
          ctx.stroke();

          if (view.scale >= 34 || isSel) {
            ctx.fillStyle = isDarkTheme ? '#F8FAFC' : '#0F172A';
            ctx.font = '700 9px "IBM Plex Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(col.label || `P${cIdx + 1}`, cx, cy - cd / 2 - 2);
          }
          ctx.restore();
        });
      }

      // 5. Active Drawing Previews (Room or Wall)
      if (dragRef.current?.kind === 'draw_room') {
        const dr = dragRef.current;
        const x1 = toSX(Math.min(dr.startX, dr.curX));
        const y1 = toSY(Math.min(dr.startZ, dr.curZ));
        const rwM = Math.abs(dr.curX - dr.startX);
        const rdM = Math.abs(dr.curZ - dr.startZ);
        const rw = rwM * view.scale;
        const rd = rdM * view.scale;
        ctx.save();
        ctx.fillStyle = 'rgba(37, 99, 235, 0.14)';
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 2;
        ctx.fillRect(x1, y1, rw, rd);
        ctx.strokeRect(x1, y1, rw, rd);
        ctx.fillStyle = '#2563EB';
        ctx.font = '600 12px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
          `${roomPreset ? `${roomPreset.roomName} · ` : ''}${formatLen(rwM, floorPlan.unit)} × ${formatLen(rdM, floorPlan.unit)}`,
          x1 + rw / 2,
          y1 - 12
        );
        if (autoMeasureEnabled && rw > 35 && rd > 35) {
          ctx.fillStyle = '#0284C7';
          ctx.beginPath();
          ctx.roundRect(x1 + rw / 2 - 28, y1 + rd + 5, 56, 17, 4);
          ctx.roundRect(x1 + rw + 6, y1 + rd / 2 - 9, 56, 17, 4);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '600 10px "IBM Plex Mono", monospace';
          ctx.textBaseline = 'middle';
          ctx.fillText(formatLen(rwM, floorPlan.unit), x1 + rw / 2, y1 + rd + 13.5);
          ctx.fillText(formatLen(rdM, floorPlan.unit), x1 + rw + 34, y1 + rd / 2 - 0.5);
        }
        ctx.restore();
      }

      if (activeTool === 'wall' && wallDraftStart && hoverWorld) {
        const sx1 = toSX(wallDraftStart.x);
        const sy1 = toSY(wallDraftStart.z);
        const sx2 = toSX(hoverWorld.x);
        const sy2 = toSY(hoverWorld.z);
        const dxW = hoverWorld.x - wallDraftStart.x;
        const dzW = hoverWorld.z - wallDraftStart.z;
        const len = Math.hypot(dxW, dzW);
        const angleDeg = Math.round((Math.atan2(dzW, dxW) * 180) / Math.PI);
        ctx.save();
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 6;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();
        ctx.setLineDash([]);
        const labelText = autoMeasureEnabled
          ? `${formatLen(len, floorPlan.unit)} · ${angleDeg}°`
          : formatLen(len, floorPlan.unit);
        const mx = (sx1 + sx2) / 2;
        const my = (sy1 + sy2) / 2 - 16;
        ctx.fillStyle = '#2563EB';
        ctx.beginPath();
        ctx.roundRect(mx - 44, my - 10, 88, 20, 5);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '600 11px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, mx, my);
        ctx.restore();
      }

      if (activeTool === 'column' && hoverWorld) {
        const cx = toSX(hoverWorld.x);
        const cy = toSY(hoverWorld.z);
        const cw = Math.max(12, 0.3 * view.scale);
        ctx.save();
        ctx.fillStyle = 'rgba(37, 99, 235, 0.45)';
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 2;
        ctx.fillRect(cx - cw / 2, cy - cw / 2, cw, cw);
        ctx.strokeRect(cx - cw / 2, cy - cw / 2, cw, cw);
        ctx.restore();
      }

      if (activeTool === 'beam' && beamDraftStart && hoverWorld) {
        const sx1 = toSX(beamDraftStart.x);
        const sy1 = toSY(beamDraftStart.z);
        const sx2 = toSX(hoverWorld.x);
        const sy2 = toSY(hoverWorld.z);
        const len = Math.hypot(hoverWorld.x - beamDraftStart.x, hoverWorld.z - beamDraftStart.z);
        ctx.save();
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = Math.max(6, 0.24 * view.scale);
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#B45309';
        const mx = (sx1 + sx2) / 2;
        const my = (sy1 + sy2) / 2 - 14;
        ctx.beginPath();
        ctx.roundRect(mx - 42, my - 10, 84, 20, 5);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '600 10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`سانتر ${formatLen(len, floorPlan.unit)}`, mx, my);
        ctx.restore();
      }

      ctx.restore();
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    return () => ro.disconnect();
  }, [
    floorPlan,
    view,
    selection,
    isDarkTheme,
    activeTool,
    wallDraftStart,
    beamDraftStart,
    hoverWorld,
    sketchUnderlay,
    underlayRevision,
    roomPreset,
    autoMeasureEnabled,
  ]);

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setView((prev) => ({
      ...prev,
      scale: Math.max(18, Math.min(130, prev.scale * factor)),
    }));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // ignore synthetic pointer events
    }

    activePointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

    // Two-finger pinch-to-zoom & pan on touchscreens
    if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[1].clientX - pts[0].clientX, pts[1].clientY - pts[0].clientY);
      const midClientX = (pts[0].clientX + pts[1].clientX) / 2;
      const midClientY = (pts[0].clientY + pts[1].clientY) / 2;
      const midWorld = screenToWorld(midClientX, midClientY);
      dragRef.current = null;
      pinchRef.current = {
        startDist: Math.max(10, dist),
        startScale: view.scale,
        startPanX: view.panX,
        startPanZ: view.panZ,
        midWorldX: midWorld.x,
        midWorldZ: midWorld.z,
      };
      return;
    }

    // Middle mouse or Shift+drag pans
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      dragRef.current = {
        kind: 'pan',
        startScreenX: e.clientX,
        startScreenY: e.clientY,
        origPanX: view.panX,
        origPanZ: view.panZ,
      };
      return;
    }

    const isTouch = e.pointerType === 'touch';
    const handleHitPx = isTouch ? 28 : 14;
    const rawWorld = screenToWorld(e.clientX, e.clientY);
    const wx = snapVal(rawWorld.x);
    const wz = snapVal(rawWorld.z);

    if (activeTool === 'room') {
      dragRef.current = { kind: 'draw_room', startX: wx, startZ: wz, curX: wx, curZ: wz };
      return;
    }

    if (activeTool === 'wall') {
      if (!wallDraftStart) {
        setWallDraftStart({ x: wx, z: wz });
      } else {
        if (Math.hypot(wx - wallDraftStart.x, wz - wallDraftStart.z) >= 0.4) {
          const newWall: Wall = {
            id: `w_${Date.now()}`,
            x1: wallDraftStart.x,
            z1: wallDraftStart.z,
            x2: wx,
            z2: wz,
            thickness: 0.16,
            height: floorPlan.wallHeight,
            color: '#F5F2EB',
          };
          onChangeFloorPlan(
            { ...floorPlan, walls: [...floorPlan.walls, newWall] },
            true
          );
          onSelect({ kind: 'wall', id: newWall.id });
        }
        setWallDraftStart(null);
      }
      return;
    }

    if (activeTool === 'column') {
      const cols = floorPlan.columns || [];
      const newCol: StructuralColumn = {
        id: `col_${Date.now()}`,
        x: wx,
        z: wz,
        width: 0.3,
        depth: 0.3,
        height: floorPlan.wallHeight,
        label: `P${cols.length + 1}`,
        color: '#475569',
      };
      onChangeFloorPlan(
        {
          ...floorPlan,
          showStructureLayer: true,
          columns: [...cols, newCol],
        },
        true
      );
      onSelect({ kind: 'column', id: newCol.id });
      return;
    }

    if (activeTool === 'beam') {
      if (!beamDraftStart) {
        setBeamDraftStart({ x: wx, z: wz });
      } else {
        if (Math.hypot(wx - beamDraftStart.x, wz - beamDraftStart.z) >= 0.4) {
          const beams = floorPlan.beams || [];
          const newBeam: StructuralBeam = {
            id: `beam_${Date.now()}`,
            x1: beamDraftStart.x,
            z1: beamDraftStart.z,
            x2: wx,
            z2: wz,
            width: 0.24,
            height: 0.35,
            label: `S${beams.length + 1}`,
            color: '#475569',
          };
          onChangeFloorPlan(
            {
              ...floorPlan,
              showStructureLayer: true,
              beams: [...beams, newBeam],
            },
            true
          );
          onSelect({ kind: 'beam', id: newBeam.id });
        }
        setBeamDraftStart(null);
      }
      return;
    }

    if (activeTool === 'door' || activeTool === 'window' || activeTool === 'arch') {
      // Find closest wall (wider tolerance on touchscreens)
      let best: { wall: Wall; dist: number; t: number } | null = null;
      const wallSnapRadius = isTouch ? 0.85 : 0.55;
      for (const wall of floorPlan.walls) {
        const hit = distToSegment(rawWorld.x, rawWorld.z, wall.x1, wall.z1, wall.x2, wall.z2);
        if (hit.dist < wallSnapRadius && (!best || hit.dist < best.dist)) {
          best = { wall, dist: hit.dist, t: hit.t };
        }
      }
      if (best) {
        const wallLen = Math.hypot(best.wall.x2 - best.wall.x1, best.wall.z2 - best.wall.z1);
        if (wallLen >= 0.8) {
          const newOp: Opening = {
            id: `op_${Date.now()}`,
            wallId: best.wall.id,
            type: activeTool,
            offsetRatio: Math.max(0.15, Math.min(0.85, best.t)),
            width:
              activeTool === 'door'
                ? 0.95
                : activeTool === 'arch'
                  ? Math.min(1.6, Math.max(1.0, wallLen - 0.4))
                  : 1.5,
            height:
              activeTool === 'door'
                ? 2.1
                : activeTool === 'arch'
                  ? Math.min(2.45, Math.max(1.85, floorPlan.wallHeight - 0.25))
                  : 1.4,
            sillHeight: activeTool === 'window' ? 0.85 : 0,
            swing: 'in',
          };
          onChangeFloorPlan(
            { ...floorPlan, openings: [...floorPlan.openings, newOp] },
            true
          );
          onSelect({ kind: 'opening', id: newOp.id });
          onToolResetToSelect();
        }
      }
      return;
    }

    // SELECT TOOL HIT-TESTING
    // 1. Check rotation handle on selected furniture
    if (selection?.kind === 'furniture') {
      const selItem = floorPlan.furniture.find((f) => f.id === selection.id);
      if (selItem) {
        const handleDist = selItem.depth / 2 + 20 / view.scale;
        const hx = selItem.x - Math.sin(selItem.rotation) * handleDist;
        const hz = selItem.z - Math.cos(selItem.rotation) * handleDist;
        if (Math.hypot(rawWorld.x - hx, rawWorld.z - hz) < handleHitPx / view.scale) {
          dragRef.current = {
            kind: 'furniture_rotate',
            id: selItem.id,
            centerX: selItem.x,
            centerZ: selItem.z,
            initial: floorPlan,
          };
          return;
        }
      }
    }

    // 2. Check wall endpoint handles if a wall is selected
    if (selection?.kind === 'wall') {
      const selWall = floorPlan.walls.find((w) => w.id === selection.id);
      if (selWall) {
        if (Math.hypot(rawWorld.x - selWall.x1, rawWorld.z - selWall.z1) < handleHitPx / view.scale) {
          dragRef.current = { kind: 'wall_point', id: selWall.id, point: 'p1', initial: floorPlan };
          return;
        }
        if (Math.hypot(rawWorld.x - selWall.x2, rawWorld.z - selWall.z2) < handleHitPx / view.scale) {
          dragRef.current = { kind: 'wall_point', id: selWall.id, point: 'p2', initial: floorPlan };
          return;
        }
      }
    }

    // 3. Check room resize handle if a room is selected
    if (selection?.kind === 'room') {
      const selRoom = floorPlan.rooms.find((r) => r.id === selection.id);
      if (selRoom) {
        if (
          Math.hypot(
            rawWorld.x - (selRoom.x + selRoom.width),
            rawWorld.z - (selRoom.z + selRoom.depth)
          ) <
          handleHitPx / view.scale
        ) {
          dragRef.current = { kind: 'room_resize', id: selRoom.id, initial: floorPlan };
          return;
        }
      }
    }

    // 3.5. Check beam endpoint handles & hit-test structural columns/beams when visible
    if (floorPlan.showStructureLayer !== false) {
      if (selection?.kind === 'beam') {
        const selBeam = (floorPlan.beams || []).find((b) => b.id === selection.id);
        if (selBeam) {
          if (Math.hypot(rawWorld.x - selBeam.x1, rawWorld.z - selBeam.z1) < handleHitPx / view.scale) {
            dragRef.current = { kind: 'beam_point', id: selBeam.id, point: 'p1', initial: floorPlan };
            return;
          }
          if (Math.hypot(rawWorld.x - selBeam.x2, rawWorld.z - selBeam.z2) < handleHitPx / view.scale) {
            dragRef.current = { kind: 'beam_point', id: selBeam.id, point: 'p2', initial: floorPlan };
            return;
          }
        }
      }

      const colPad = isTouch ? 0.24 : 0.14;
      for (const col of [...(floorPlan.columns || [])].reverse()) {
        if (
          Math.abs(rawWorld.x - col.x) <= col.width / 2 + colPad &&
          Math.abs(rawWorld.z - col.z) <= col.depth / 2 + colPad
        ) {
          onSelect({ kind: 'column', id: col.id });
          dragRef.current = {
            kind: 'column_move',
            id: col.id,
            offsetX: col.x - rawWorld.x,
            offsetZ: col.z - rawWorld.z,
            initial: floorPlan,
          };
          return;
        }
      }
    }

    // 4. Hit-test furniture (topmost first, excluding rugs unless clicked away from items)
    const furnPad = isTouch ? 0.24 : 0.12;
    const sortedFurn = [...floorPlan.furniture].reverse().sort((a, b) => {
      if (a.type === 'rug' && b.type !== 'rug') return 1;
      if (b.type === 'rug' && a.type !== 'rug') return -1;
      return 0;
    });
    for (const item of sortedFurn) {
      const dx = rawWorld.x - item.x;
      const dz = rawWorld.z - item.z;
      const cos = Math.cos(item.rotation);
      const sin = Math.sin(item.rotation);
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      if (Math.abs(lx) <= item.width / 2 + furnPad && Math.abs(lz) <= item.depth / 2 + furnPad) {
        onSelect({ kind: 'furniture', id: item.id });
        dragRef.current = {
          kind: 'furniture_move',
          id: item.id,
          offsetX: item.x - rawWorld.x,
          offsetZ: item.z - rawWorld.z,
          initial: floorPlan,
        };
        return;
      }
    }

    // 5. Hit-test openings
    for (const op of floorPlan.openings) {
      const wall = floorPlan.walls.find((w) => w.id === op.wallId);
      if (!wall) continue;
      const ox = wall.x1 + (wall.x2 - wall.x1) * op.offsetRatio;
      const oz = wall.z1 + (wall.z2 - wall.z1) * op.offsetRatio;
      if (Math.hypot(rawWorld.x - ox, rawWorld.z - oz) < Math.max(isTouch ? 0.65 : 0.45, op.width / 2)) {
        onSelect({ kind: 'opening', id: op.id });
        dragRef.current = { kind: 'opening_slide', id: op.id, wall, initial: floorPlan };
        return;
      }
    }

    // 5.5. Hit-test beams when structural layer is visible
    if (floorPlan.showStructureLayer !== false) {
      for (const beam of floorPlan.beams || []) {
        const hit = distToSegment(rawWorld.x, rawWorld.z, beam.x1, beam.z1, beam.x2, beam.z2);
        if (hit.dist < Math.max(isTouch ? 0.34 : 0.22, (beam.width || 0.24) / 2 + 0.1)) {
          onSelect({ kind: 'beam', id: beam.id });
          return;
        }
      }
    }

    // 6. Hit-test walls
    for (const wall of floorPlan.walls) {
      const hit = distToSegment(rawWorld.x, rawWorld.z, wall.x1, wall.z1, wall.x2, wall.z2);
      if (hit.dist < Math.max(isTouch ? 0.34 : 0.22, (wall.thickness || 0.16) / 2 + (isTouch ? 0.2 : 0.1))) {
        onSelect({ kind: 'wall', id: wall.id });
        return;
      }
    }

    // 7. Hit-test rooms
    for (const room of [...floorPlan.rooms].reverse()) {
      if (
        rawWorld.x >= room.x &&
        rawWorld.x <= room.x + room.width &&
        rawWorld.z >= room.z &&
        rawWorld.z <= room.z + room.depth
      ) {
        onSelect({ kind: 'room', id: room.id });
        dragRef.current = {
          kind: 'room_move',
          id: room.id,
          offsetX: room.x - rawWorld.x,
          offsetZ: room.z - rawWorld.z,
          initial: floorPlan,
        };
        return;
      }
    }

    // Clicked empty space -> Deselect & start pan
    onSelect(null);
    dragRef.current = {
      kind: 'pan',
      startScreenX: e.clientX,
      startScreenY: e.clientY,
      origPanX: view.panX,
      origPanZ: view.panZ,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    }

    // Pinch-to-zoom and 2-finger pan
    if (activePointersRef.current.size === 2 && pinchRef.current && canvasRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[1].clientX - pts[0].clientX, pts[1].clientY - pts[0].clientY);
      const midClientX = (pts[0].clientX + pts[1].clientX) / 2;
      const midClientY = (pts[0].clientY + pts[1].clientY) / 2;
      const ratio = dist / pinchRef.current.startDist;
      const nextScale = Math.max(18, Math.min(130, pinchRef.current.startScale * ratio));
      const rect = canvasRef.current.getBoundingClientRect();
      const sx = midClientX - rect.left - rect.width / 2;
      const sy = midClientY - rect.top - rect.height / 2;
      setView({
        scale: nextScale,
        panX: pinchRef.current.midWorldX - sx / nextScale,
        panZ: pinchRef.current.midWorldZ - sy / nextScale,
      });
      return;
    }

    const rawWorld = screenToWorld(e.clientX, e.clientY);
    const sx = snapVal(rawWorld.x);
    const sz = snapVal(rawWorld.z);
    setHoverWorld({ x: sx, z: sz });

    const drag = dragRef.current;
    if (!drag) return;

    if (drag.kind === 'pan') {
      const dx = (e.clientX - drag.startScreenX) / view.scale;
      const dy = (e.clientY - drag.startScreenY) / view.scale;
      setView((prev) => ({
        ...prev,
        panX: drag.origPanX - dx,
        panZ: drag.origPanZ - dy,
      }));
      return;
    }

    if (drag.kind === 'draw_room') {
      drag.curX = sx;
      drag.curZ = sz;
      // Trigger subtle re-render via hoverWorld already updating
      return;
    }

    if (drag.kind === 'furniture_move') {
      const nx = snapVal(rawWorld.x + drag.offsetX);
      const nz = snapVal(rawWorld.z + drag.offsetZ);
      onChangeFloorPlan(
        {
          ...latestPlanRef.current,
          furniture: latestPlanRef.current.furniture.map((f) =>
            f.id === drag.id ? { ...f, x: nx, z: nz } : f
          ),
        },
        false
      );
      return;
    }

    if (drag.kind === 'furniture_rotate') {
      const angle = Math.atan2(drag.centerX - rawWorld.x, drag.centerZ - rawWorld.z);
      const snappedAngle = snapEnabled
        ? Math.round(angle / (Math.PI / 12)) * (Math.PI / 12)
        : angle;
      onChangeFloorPlan(
        {
          ...latestPlanRef.current,
          furniture: latestPlanRef.current.furniture.map((f) =>
            f.id === drag.id ? { ...f, rotation: snappedAngle } : f
          ),
        },
        false
      );
      return;
    }

    if (drag.kind === 'room_move') {
      const nx = snapVal(rawWorld.x + drag.offsetX);
      const nz = snapVal(rawWorld.z + drag.offsetZ);
      onChangeFloorPlan(moveRoomCascade(latestPlanRef.current, drag.id, nx, nz, true), false);
      return;
    }

    if (drag.kind === 'room_resize') {
      const target = latestPlanRef.current.rooms.find((r) => r.id === drag.id);
      if (!target) return;
      const nw = Math.max(1.5, snapVal(rawWorld.x - target.x));
      const nd = Math.max(1.5, snapVal(rawWorld.z - target.z));
      onChangeFloorPlan(resizeRoomWithWalls(latestPlanRef.current, drag.id, nw, nd), false);
      return;
    }

    if (drag.kind === 'wall_point') {
      onChangeFloorPlan(
        {
          ...latestPlanRef.current,
          walls: latestPlanRef.current.walls.map((w) => {
            if (w.id !== drag.id) return w;
            return drag.point === 'p1' ? { ...w, x1: sx, z1: sz } : { ...w, x2: sx, z2: sz };
          }),
        },
        false
      );
      return;
    }

    if (drag.kind === 'column_move') {
      const nx = snapVal(rawWorld.x + drag.offsetX);
      const nz = snapVal(rawWorld.z + drag.offsetZ);
      onChangeFloorPlan(
        {
          ...latestPlanRef.current,
          columns: (latestPlanRef.current.columns || []).map((c) =>
            c.id === drag.id ? { ...c, x: nx, z: nz } : c
          ),
        },
        false
      );
      return;
    }

    if (drag.kind === 'beam_point') {
      onChangeFloorPlan(
        {
          ...latestPlanRef.current,
          beams: (latestPlanRef.current.beams || []).map((b) => {
            if (b.id !== drag.id) return b;
            return drag.point === 'p1' ? { ...b, x1: sx, z1: sz } : { ...b, x2: sx, z2: sz };
          }),
        },
        false
      );
      return;
    }

    if (drag.kind === 'opening_slide') {
      const hit = distToSegment(
        rawWorld.x,
        rawWorld.z,
        drag.wall.x1,
        drag.wall.z1,
        drag.wall.x2,
        drag.wall.z2
      );
      const nextRatio = Math.max(0.12, Math.min(0.88, hit.t));
      onChangeFloorPlan(
        {
          ...latestPlanRef.current,
          openings: latestPlanRef.current.openings.map((op) =>
            op.id === drag.id ? { ...op, offsetRatio: nextRatio } : op
          ),
        },
        false
      );
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchRef.current = null;
    }

    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;

    if (drag.kind === 'draw_room') {
      const minX = Math.min(drag.startX, drag.curX);
      const minZ = Math.min(drag.startZ, drag.curZ);
      const rw = Math.abs(drag.curX - drag.startX);
      const rd = Math.abs(drag.curZ - drag.startZ);
      if (rw >= 1.5 && rd >= 1.5) {
        const roomId = `room_${Date.now()}`;
        const baseName = roomPreset?.roomName || 'غرفة';
        const sameCount = floorPlan.rooms.filter(
          (r) => r.name === baseName || r.name.startsWith(`${baseName} `)
        ).length;
        const roomName = roomPreset?.roomName
          ? sameCount === 0
            ? baseName
            : `${baseName} ${sameCount + 1}`
          : `غرفة ${floorPlan.rooms.length + 1}`;
        const newRoom: Room = {
          id: roomId,
          name: roomName,
          x: minX,
          z: minZ,
          width: rw,
          depth: rd,
          floorStyle: roomPreset?.floorStyle || 'oak',
        };
        const h = floorPlan.wallHeight;
        const ts = Date.now();
        const newWalls: Wall[] = [
          { id: `w_${ts}_1`, x1: minX, z1: minZ, x2: minX + rw, z2: minZ, thickness: 0.16, height: h, color: '#F5F2EB' },
          { id: `w_${ts}_2`, x1: minX + rw, z1: minZ, x2: minX + rw, z2: minZ + rd, thickness: 0.16, height: h, color: '#F5F2EB' },
          { id: `w_${ts}_3`, x1: minX + rw, z1: minZ + rd, x2: minX, z2: minZ + rd, thickness: 0.16, height: h, color: '#F5F2EB' },
          { id: `w_${ts}_4`, x1: minX, z1: minZ + rd, x2: minX, z2: minZ, thickness: 0.16, height: h, color: '#F5F2EB' },
        ];
        onChangeFloorPlan(
          {
            ...floorPlan,
            rooms: [...floorPlan.rooms, newRoom],
            walls: [...floorPlan.walls, ...newWalls],
          },
          true
        );
        onSelect({ kind: 'room', id: roomId });
        onToolResetToSelect();
      }
      return;
    }

    if (drag.kind !== 'pan') {
      // Commit final drag state to undo history
      onChangeFloorPlan(latestPlanRef.current, true);
    }
  };

  const handleDropCatalog = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/bachir5d-furniture');
    if (!raw) return;
    try {
      const def = JSON.parse(raw);
      const world = screenToWorld(e.clientX, e.clientY);
      const newItem: FurnitureItem = {
        id: `furn_${Date.now()}`,
        catalogId: typeof def.catalogId === 'string' ? def.catalogId : undefined,
        type: def.type,
        name: def.name,
        category: def.category,
        x: snapVal(world.x),
        z: snapVal(world.z),
        rotation: 0,
        width: def.width,
        depth: def.depth,
        height: def.height,
        primaryColor: def.defaultPrimary,
        accentColor: def.defaultAccent,
        ...(typeof def.defaultPriceDzd === 'number' && def.defaultPriceDzd >= 0
          ? { priceDzd: Math.round(def.defaultPriceDzd) }
          : {}),
      };
      onChangeFloorPlan(
        { ...floorPlan, furniture: [...floorPlan.furniture, newItem] },
        true
      );
      onSelect({ kind: 'furniture', id: newItem.id });
      onToolResetToSelect();
    } catch {
      // ignore invalid drag payload
    }
  };

  return (
    <div
      ref={containerRef}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDropCatalog}
      className="relative w-full h-full overflow-hidden select-none"
    >
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`w-full h-full block touch-none ${
          activeTool === 'select' ? 'cursor-default' : 'cursor-crosshair'
        }`}
      />

      {/* Tool instructional toast at top-center */}
      {activeTool !== 'select' && (
        <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 max-w-[92vw] text-center rounded-lg border border-blue-200 dark:border-blue-800 bg-white/95 dark:bg-slate-900/95 px-3 sm:px-4 py-1.5 text-[11px] sm:text-xs font-medium text-blue-700 dark:text-blue-300 shadow-sm">
          {activeTool === 'room' &&
            (roomPreset
              ? `اسحب على المخطط لرسم «${roomPreset.label}» بجدرانها الأربعة`
              : 'اسحب على المخطط لرسم غرفة جديدة بجدرانها الأربعة')}
          {activeTool === 'wall' &&
            (wallDraftStart
              ? 'انقر لتحديد نقطة نهاية الجدار'
              : 'انقر على المخطط لتحديد نقطة بداية الجدار')}
          {activeTool === 'door' && 'انقر على أي جدار لإضافة باب في الموضع المحدد'}
          {activeTool === 'window' && 'انقر على أي جدار لإضافة نافذة زجاجية'}
          {activeTool === 'arch' && 'انقر على أي جدار لفتح قوس معماري (بين الصالة والهول)'}
          {activeTool === 'column' && 'انقر على المخطط أو زوايا الجدران لوضع عمود خرساني (بيلي)'}
          {activeTool === 'beam' &&
            (beamDraftStart
              ? 'انقر لتحديد نقطة نهاية السانتر (الحزام الخرساني)'
              : 'انقر لتحديد نقطة بداية السانتر (الحزام الخرساني)')}
        </div>
      )}

      {/* Bottom Zoom Controls */}
      <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 flex items-center gap-0.5 sm:gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setView((v) => ({ ...v, scale: Math.min(130, v.scale * 1.15) }))}
          className="p-2 sm:p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
          title="تكبير"
        >
          <Plus className="w-4 h-4" />
        </button>
        <span className="px-1.5 sm:px-2 text-[11px] sm:text-xs font-mono-nums text-slate-600 dark:text-slate-300">
          {Math.round((view.scale / 48) * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setView((v) => ({ ...v, scale: Math.max(18, v.scale * 0.85) }))}
          className="p-2 sm:p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
          title="تصغير"
        >
          <Minus className="w-4 h-4" />
        </button>
        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />
        <button
          type="button"
          onClick={fitView}
          className="inline-flex items-center gap-1 px-2.5 sm:px-2 py-2 sm:py-1 rounded-md text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          title="ملاءمة المخطط"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>ملاءمة</span>
        </button>
      </div>
    </div>
  );
};
