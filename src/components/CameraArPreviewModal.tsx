import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Compass,
  Crown,
  Download,
  Eye,
  EyeOff,
  Grid3X3,
  Lock,
  Move,
  RefreshCw,
  RotateCcw,
  Sofa,
  Sparkles,
  SwitchCamera,
  X,
} from 'lucide-react';
import { FLOOR_STYLES, computeFloorPlanMetrics } from '../data/catalog';
import { FloorPlanData, FurnitureItem, UnitType } from '../types/planner';

interface CameraArPreviewModalProps {
  isOpen: boolean;
  projectTitle: string;
  floorPlan: FloorPlanData;
  isUserProActive: boolean;
  onClose: () => void;
  onOpenProUpgrade: () => void;
}

function formatLen(meters: number, unit: UnitType): string {
  if (unit === 'ft') {
    return `${(meters * 3.28084).toFixed(1)} ft`;
  }
  return `${meters.toFixed(2)} m`;
}

function drawFurnitureCadSymbol(
  ctx: CanvasRenderingContext2D,
  item: FurnitureItem,
  ppm: number
) {
  const fw = Math.max(4, item.width * ppm);
  const fd = Math.max(4, item.depth * ppm);

  ctx.save();
  ctx.translate(item.x * ppm, item.z * ppm);
  ctx.rotate(-item.rotation);

  ctx.fillStyle = item.primaryColor || '#CBD5E1';
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.lineWidth = 1.6;

  if (
    item.type === 'dining_round' ||
    item.type === 'ottoman' ||
    item.type === 'plant_olive' ||
    item.type === 'chandelier' ||
    item.type === 'bean_bag' ||
    item.type === 'vacuum_robot' ||
    item.type === 'water_tank_pump' ||
    item.type === 'courtyard_fountain' ||
    item.type === 'brass_tea_table' ||
    item.type === 'maida_low_table' ||
    item.type === 'tabouna_bread_oven'
  ) {
    const rad = Math.min(fw, fd) / 2;
    ctx.globalAlpha = 0.88;
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
  } else if (item.type === 'potager_curved') {
    ctx.globalAlpha = 0.88;
    ctx.beginPath();
    ctx.moveTo(-fw / 2, -fd / 2);
    ctx.lineTo(fw / 2, -fd / 2);
    ctx.lineTo(fw / 2, fd * 0.25);
    ctx.quadraticCurveTo(0, fd * 0.65, -fw / 2, fd * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
  } else if (item.type === 'potager_corner') {
    const leg = Math.min(fw, fd) * 0.44;
    ctx.globalAlpha = 0.88;
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
  } else {
    ctx.globalAlpha = item.type === 'rug' ? 0.4 : item.type === 'kitchen_wall_cupboard_dz' ? 0.65 : 0.85;
    if (item.type === 'kitchen_wall_cupboard_dz') ctx.setLineDash([4, 3]);
    ctx.fillRect(-fw / 2, -fd / 2, fw, fd);
    ctx.globalAlpha = 1;
    ctx.strokeRect(-fw / 2, -fd / 2, fw, fd);
    ctx.setLineDash([]);

    ctx.strokeStyle = 'rgba(15, 23, 42, 0.5)';
    ctx.lineWidth = 1;
    if (item.type === 'algerian_salon_u') {
      ctx.strokeRect(-fw / 2 + 2, -fd / 2 + 2, Math.max(2, fw - 4), fd * 0.25);
      ctx.strokeRect(-fw / 2 + 2, -fd / 2 + 2, fw * 0.24, Math.max(2, fd - 4));
      ctx.strokeRect(fw / 2 - fw * 0.24 - 2, -fd / 2 + 2, fw * 0.24, Math.max(2, fd - 4));
    } else if (
      item.type === 'sofa_3' ||
      item.type === 'sofa_l' ||
      item.type === 'sofa_2' ||
      item.type === 'armchair' ||
      item.type === 'outdoor_lounge' ||
      item.type === 'algerian_sedari' ||
      item.type === 'clic_clac_sofa'
    ) {
      ctx.strokeRect(-fw / 2 + 2, -fd / 2 + 2, Math.max(2, fw - 4), fd * 0.24);
    } else if (
      item.type === 'bed_double' ||
      item.type === 'bed_single' ||
      item.type === 'bunk_bed' ||
      item.type === 'underbed_storage_bed' ||
      item.type === 'matrah_traditional_bed'
    ) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-fw * 0.36, -fd * 0.42, fw * 0.72, fd * 0.18);
      ctx.strokeRect(-fw * 0.36, -fd * 0.42, fw * 0.72, fd * 0.18);
    } else if (item.type === 'potager_straight') {
      ctx.strokeRect(fw * 0.05, -fd * 0.3, fw * 0.28, fd * 0.6);
    } else if (item.type === 'toilet_arabic') {
      ctx.strokeRect(-fw * 0.34, -fd * 0.32, fw * 0.22, fd * 0.64);
      ctx.strokeRect(fw * 0.12, -fd * 0.32, fw * 0.22, fd * 0.64);
    } else if (item.type === 'toilet_anglaise') {
      ctx.strokeRect(-fw * 0.36, -fd * 0.42, fw * 0.72, fd * 0.24);
      ctx.beginPath();
      ctx.ellipse(0, fd * 0.12, fw * 0.28, fd * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (
      item.type === 'shower_standard' ||
      item.type === 'shower_italian' ||
      item.type === 'shower_arabic_hammam'
    ) {
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(fw, fd) * 0.12, 0, Math.PI * 2);
      ctx.stroke();
    } else if (item.type === 'garage_car') {
      ctx.beginPath();
      ctx.roundRect(-fw * 0.44, -fd * 0.46, fw * 0.88, fd * 0.92, 5);
      ctx.stroke();
    }
  }

  ctx.restore();
}

export const CameraArPreviewModal: React.FC<CameraArPreviewModalProps> = ({
  isOpen,
  projectTitle,
  floorPlan,
  isUserProActive,
  onClose,
  onOpenProUpgrade,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dragStartRef = useRef<{
    x: number;
    y: number;
    origOffX: number;
    origOffY: number;
  } | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'starting' | 'active' | 'error'>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [sandboxBackdrop, setSandboxBackdrop] = useState(false);

  // AR Perspective & Calibration states
  const [tiltDeg, setTiltDeg] = useState(52); // 0 = flat top-down, 72 = floor perspective
  const [rotationDeg, setRotationDeg] = useState(0);
  const [scaleMultiplier, setScaleMultiplier] = useState(1.0);
  const [planOpacity, setPlanOpacity] = useState(0.84);
  const [offsetPx, setOffsetPx] = useState({ x: 0, y: 20 });
  const [showFurniture, setShowFurniture] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showMeterGrid, setShowMeterGrid] = useState(true);
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const [capturedToast, setCapturedToast] = useState<string | null>(null);

  const metrics = useMemo(() => computeFloorPlanMetrics(floorPlan), [floorPlan]);

  // Compute plan bounding box in world meters
  const planBounds = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const r of floorPlan.rooms) {
      minX = Math.min(minX, r.x);
      maxX = Math.max(maxX, r.x + r.width);
      minZ = Math.min(minZ, r.z);
      maxZ = Math.max(maxZ, r.z + r.depth);
    }
    for (const w of floorPlan.walls) {
      minX = Math.min(minX, w.x1, w.x2);
      maxX = Math.max(maxX, w.x1, w.x2);
      minZ = Math.min(minZ, w.z1, w.z2);
      maxZ = Math.max(maxZ, w.z1, w.z2);
    }

    if (!Number.isFinite(minX)) {
      minX = -5;
      maxX = 5;
      minZ = -4;
      maxZ = 4;
    }

    const widthM = Math.max(2, maxX - minX);
    const depthM = Math.max(2, maxZ - minZ);
    return {
      minX,
      maxX,
      minZ,
      maxZ,
      centerX: (minX + maxX) / 2,
      centerZ: (minZ + maxZ) / 2,
      widthM,
      depthM,
    };
  }, [floorPlan]);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(
    async (mode: 'environment' | 'user') => {
      if (!isOpen || !isUserProActive) return;
      stopCameraStream();
      setCameraStatus('starting');
      setCameraError(null);
      setSandboxBackdrop(false);

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraStatus('error');
        setCameraError('المتصفح الحالي لا يدعم الوصول إلى الكاميرا المباشرة.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setCameraStatus('active');
      } catch (err) {
        setCameraStatus('error');
        const msg =
          err instanceof Error && err.name === 'NotAllowedError'
            ? 'تم رفض إذن الكاميرا. يرجى السماح بالوصول للكاميرا من إعدادات المتصفح.'
            : 'تعذر تشغيل الكاميرا (قد لا يتوفر جهاز كاميرا متصل أو الإذن مقيد).';
        setCameraError(msg);
      }
    },
    [isOpen, isUserProActive, stopCameraStream]
  );

  // Start / stop camera with modal open state
  useEffect(() => {
    if (isOpen && isUserProActive) {
      void startCamera(facingMode);
    } else {
      stopCameraStream();
      setCameraStatus('idle');
    }
    return () => {
      stopCameraStream();
    };
  }, [isOpen, isUserProActive, facingMode, startCamera, stopCameraStream]);

  // Optional DeviceOrientation gyro sync for realistic floor alignment on mobile phones
  useEffect(() => {
    if (!isOpen || !isUserProActive || !gyroEnabled) return;
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (typeof e.beta === 'number') {
        // When holding phone tilted down at floor (beta ~ 25..75 deg)
        const clampedTilt = Math.max(0, Math.min(72, Math.round(90 - Math.abs(e.beta))));
        setTiltDeg(clampedTilt);
      }
      if (typeof e.alpha === 'number') {
        const normalized = Math.round(((e.alpha + 180) % 360) - 180);
        setRotationDeg(normalized);
      }
    };
    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [isOpen, isUserProActive, gyroEnabled]);

  const toggleGyro = async () => {
    if (gyroEnabled) {
      setGyroEnabled(false);
      return;
    }
    const reqPerm = (
      DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      }
    )?.requestPermission;
    if (typeof reqPerm === 'function') {
      try {
        const res = await reqPerm();
        if (res !== 'granted') return;
      } catch {
        return;
      }
    }
    setGyroEnabled(true);
  };

  // Render high-DPI 2D architectural floorplan canvas for AR projection
  const drawOverlayPlan = useCallback(
    (
      canvas: HTMLCanvasElement,
      targetW: number,
      targetH: number,
      pixelRatio = 2
    ) => {
      canvas.width = Math.max(1, Math.floor(targetW * pixelRatio));
      canvas.height = Math.max(1, Math.floor(targetH * pixelRatio));
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.scale(pixelRatio, pixelRatio);
      ctx.clearRect(0, 0, targetW, targetH);

      const pad = 34;
      const ppm = Math.min(
        (targetW - pad * 2) / planBounds.widthM,
        (targetH - pad * 2) / planBounds.depthM
      );

      ctx.translate(
        targetW / 2 - planBounds.centerX * ppm,
        targetH / 2 - planBounds.centerZ * ppm
      );

      // Optional 1m x 1m AR calibration reference grid around the floor plan
      if (showMeterGrid) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 1;
        const gMinX = Math.floor(planBounds.minX) - 1;
        const gMaxX = Math.ceil(planBounds.maxX) + 1;
        const gMinZ = Math.floor(planBounds.minZ) - 1;
        const gMaxZ = Math.ceil(planBounds.maxZ) + 1;
        ctx.beginPath();
        for (let gx = gMinX; gx <= gMaxX; gx += 1) {
          ctx.moveTo(gx * ppm, gMinZ * ppm);
          ctx.lineTo(gx * ppm, gMaxZ * ppm);
        }
        for (let gz = gMinZ; gz <= gMaxZ; gz += 1) {
          ctx.moveTo(gMinX * ppm, gz * ppm);
          ctx.lineTo(gMaxX * ppm, gz * ppm);
        }
        ctx.stroke();
      }

      // Rooms
      for (const room of floorPlan.rooms) {
        const rx = room.x * ppm;
        const rz = room.z * ppm;
        const rw = room.width * ppm;
        const rd = room.depth * ppm;
        const styleMeta = FLOOR_STYLES.find((f) => f.id === room.floorStyle);

        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = styleMeta?.previewColor || '#E2E8F0';
        ctx.fillRect(rx, rz, rw, rd);
        ctx.restore();

        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2;
        ctx.strokeRect(rx, rz, rw, rd);

        if (showLabels) {
          ctx.save();
          ctx.fillStyle = '#FFFFFF';
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.lineWidth = 3.5;
          ctx.textAlign = 'center';
          ctx.font = '700 13px "IBM Plex Sans Arabic", sans-serif';
          const cx = rx + rw / 2;
          const cy = rz + rd / 2;
          ctx.strokeText(room.name, cx, cy - 4);
          ctx.fillText(room.name, cx, cy - 4);

          ctx.font = '600 11px "IBM Plex Mono", monospace';
          const dimText = `${formatLen(room.width, floorPlan.unit)} × ${formatLen(room.depth, floorPlan.unit)}`;
          ctx.strokeText(dimText, cx, cy + 13);
          ctx.fillText(dimText, cx, cy + 13);
          ctx.restore();
        }
      }

      // Furniture CAD footprints
      if (showFurniture) {
        for (const item of floorPlan.furniture) {
          drawFurnitureCadSymbol(ctx, item, ppm);
        }
      }

      // Walls (Architectural solid cyan-white glowing blueprint lines for camera contrast)
      for (const wall of floorPlan.walls) {
        const wx1 = wall.x1 * ppm;
        const wz1 = wall.z1 * ppm;
        const wx2 = wall.x2 * ppm;
        const wz2 = wall.z2 * ppm;
        const thickPx = Math.max(5, (wall.thickness || 0.16) * ppm);

        ctx.save();
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = thickPx + 3;
        ctx.beginPath();
        ctx.moveTo(wx1, wz1);
        ctx.lineTo(wx2, wz2);
        ctx.stroke();

        ctx.strokeStyle = '#F8FAFC';
        ctx.lineWidth = thickPx;
        ctx.beginPath();
        ctx.moveTo(wx1, wz1);
        ctx.lineTo(wx2, wz2);
        ctx.stroke();
        ctx.restore();
      }

      // Openings (Doors, Windows, Arches)
      for (const op of floorPlan.openings) {
        const wall = floorPlan.walls.find((w) => w.id === op.wallId);
        if (!wall) continue;
        const cx = (wall.x1 + (wall.x2 - wall.x1) * op.offsetRatio) * ppm;
        const cz = (wall.z1 + (wall.z2 - wall.z1) * op.offsetRatio) * ppm;
        const angle = Math.atan2(wall.z2 - wall.z1, wall.x2 - wall.x1);
        const opPx = op.width * ppm;
        const thickPx = Math.max(6, (wall.thickness || 0.16) * ppm);

        ctx.save();
        ctx.translate(cx, cz);
        ctx.rotate(angle);
        ctx.clearRect(-opPx / 2, -thickPx / 2 - 1, opPx, thickPx + 2);

        if (op.type === 'door') {
          const swingDir = op.swing === 'out' ? -1 : 1;
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(-opPx / 2, 0);
          ctx.lineTo(-opPx / 2, swingDir * opPx);
          ctx.stroke();
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          if (swingDir > 0) {
            ctx.arc(-opPx / 2, 0, opPx, 0, Math.PI / 2, false);
          } else {
            ctx.arc(-opPx / 2, 0, opPx, -Math.PI / 2, 0, false);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (op.type === 'window') {
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(-opPx / 2, -thickPx / 2, opPx, thickPx);
        } else {
          ctx.strokeStyle = '#A78BFA';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(-opPx / 2, -thickPx / 2, opPx, thickPx);
          ctx.setLineDash([]);
        }
        ctx.restore();
      }

      ctx.restore();
    },
    [floorPlan, planBounds, showFurniture, showLabels, showMeterGrid]
  );

  useEffect(() => {
    if (!isOpen || !isUserProActive) return;
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    drawOverlayPlan(canvas, 640, 480, 2);
  }, [isOpen, isUserProActive, drawOverlayPlan]);

  const handleCaptureSnapshot = () => {
    const out = document.createElement('canvas');
    const W = 1280;
    const H = 720;
    out.width = W;
    out.height = H;
    const ctx = out.getContext('2d');
    if (!ctx) return;

    // 1. Background: live video frame or calibration backdrop
    const vid = videoRef.current;
    if (cameraStatus === 'active' && vid && vid.videoWidth > 0 && vid.videoHeight > 0) {
      const vidAspect = vid.videoWidth / vid.videoHeight;
      const outAspect = W / H;
      let sx = 0;
      let sy = 0;
      let sw = vid.videoWidth;
      let sh = vid.videoHeight;
      if (vidAspect > outAspect) {
        sw = vid.videoHeight * outAspect;
        sx = (vid.videoWidth - sw) / 2;
      } else {
        sh = vid.videoWidth / outAspect;
        sy = (vid.videoHeight - sh) / 2;
      }
      ctx.drawImage(vid, sx, sy, sw, sh, 0, 0, W, H);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#1E293B');
      grad.addColorStop(1, '#0F172A');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // 2. Projected 2D floorplan matching tilt/rotation/scale/offset
    const planBuf = document.createElement('canvas');
    drawOverlayPlan(planBuf, 640, 480, 2);

    ctx.save();
    ctx.translate(W / 2 + offsetPx.x * 1.4, H / 2 + offsetPx.y * 1.4);
    const tiltFactor = Math.max(0.28, Math.cos((tiltDeg * Math.PI) / 180));
    ctx.scale(scaleMultiplier, scaleMultiplier * tiltFactor);
    ctx.rotate((rotationDeg * Math.PI) / 180);
    ctx.globalAlpha = planOpacity;
    ctx.drawImage(planBuf, -320, -240, 640, 480);
    ctx.restore();

    // 3. Architectural stamp watermark
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.fillRect(24, H - 64, 420, 42);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 15px "IBM Plex Sans Arabic", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(
      `${projectTitle} · ${metrics.totalAreaSqm.toFixed(1)} م² (${metrics.roomCount} غرف)`,
      430,
      H - 38
    );

    const url = out.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `ar_floorplan_${Date.now()}.png`;
    a.click();
    setCapturedToast('تم حفظ لقطة المعاينة في الفضاء الحقيقي');
    setTimeout(() => setCapturedToast(null), 2600);
  };

  const resetCalibration = () => {
    setTiltDeg(52);
    setRotationDeg(0);
    setScaleMultiplier(1.0);
    setPlanOpacity(0.84);
    setOffsetPx({ x: 0, y: 20 });
    setGyroEnabled(false);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="معاينة المخطط ثنائي الأبعاد في الفضاء الحقيقي بالكاميرا"
    >
      <div className="w-full max-w-5xl h-[92dvh] sm:h-[88dvh] rounded-2xl border border-slate-700 bg-slate-900 text-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0 bg-slate-950/70">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold truncate">
                  معاينة المخطط 2D في الفضاء الحقيقي (الكاميرا)
                </h2>
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 text-[10px] font-bold text-amber-300 shrink-0">
                  <Crown className="w-3 h-3" />
                  <span>نسخة برو</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                اسقاط المخطط مباشرة على أرضية الموقع أو الغرفة الحقيقية عبر الكاميرا مع ضبط المنظور والقياس
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق المعاينة بالكاميرا"
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {!isUserProActive ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-5 bg-gradient-to-b from-slate-900 to-slate-950">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Lock className="w-8 h-8" />
            </div>
            <div className="max-w-md space-y-2">
              <h3 className="text-lg font-bold text-white">
                أداة المعاينة الحية بالكاميرا متاحة لمشتركي نسخة برو
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                قم بإسقاط المخطط ثنائي الأبعاد مباشرة فوق أرضية البناء أو الغرفة الحقيقية باستخدام كاميرا الهاتف أو الحاسوب، مع التحكم في المنظور، التدوير، المقاس الحقيقي، والتقاط صور للمشاركة.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onOpenProUpgrade}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 px-5 py-2.5 text-sm font-bold shadow-lg transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                <span>الترقية إلى نسخة برو الآن</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-700 hover:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300"
              >
                إغلاق
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
            {/* Live Camera Stage */}
            <div
              className="relative flex-1 min-h-[280px] bg-black overflow-hidden select-none touch-none"
              onPointerDown={(e) => {
                dragStartRef.current = {
                  x: e.clientX,
                  y: e.clientY,
                  origOffX: offsetPx.x,
                  origOffY: offsetPx.y,
                };
              }}
              onPointerMove={(e) => {
                if (!dragStartRef.current) return;
                setOffsetPx({
                  x: dragStartRef.current.origOffX + (e.clientX - dragStartRef.current.x),
                  y: dragStartRef.current.origOffY + (e.clientY - dragStartRef.current.y),
                });
              }}
              onPointerUp={() => {
                dragStartRef.current = null;
              }}
              onPointerCancel={() => {
                dragStartRef.current = null;
              }}
            >
              {/* Video Camera Feed */}
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={`absolute inset-0 w-full h-full object-cover ${
                  cameraStatus === 'active' ? 'opacity-100' : 'opacity-0'
                }`}
              />

              {/* Test Real-World Floor Grid Backdrop if user explicitly enables calibration without camera */}
              {sandboxBackdrop && cameraStatus !== 'active' && (
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(circle at 50% 35%, #334155 0%, #0F172A 75%)',
                  }}
                >
                  <div
                    className="absolute inset-x-[-40%] bottom-[-10%] h-[78%] opacity-35"
                    style={{
                      transform: 'perspective(800px) rotateX(62deg)',
                      backgroundImage:
                        'linear-gradient(to right, rgba(255,255,255,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.22) 1px, transparent 1px)',
                      backgroundSize: '48px 48px',
                    }}
                  />
                </div>
              )}

              {/* Camera Error / Starting Overlay */}
              {cameraStatus !== 'active' && !sandboxBackdrop && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 space-y-4">
                  <Camera className="w-10 h-10 text-blue-400" />
                  <div className="max-w-sm space-y-1.5">
                    <div className="text-sm font-bold text-white">
                      {cameraStatus === 'starting'
                        ? 'جارٍ تشغيل الكاميرا...'
                        : 'تعذر الوصول إلى الكاميرا'}
                    </div>
                    {cameraError && (
                      <p className="text-xs text-slate-300 leading-relaxed">{cameraError}</p>
                    )}
                  </div>
                  {cameraStatus === 'error' && (
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => void startCamera(facingMode)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>إعادة المحاولة</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSandboxBackdrop(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 hover:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200"
                      >
                        <Grid3X3 className="w-3.5 h-3.5" />
                        <span>معاينة على شبكة أرضية افتراضية</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Projected 2D Floorplan Overlay Canvas (with CSS 3D Floor Perspective) */}
              <div
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
                style={{ perspective: '950px' }}
              >
                <div
                  style={{
                    transform: `translate(${offsetPx.x}px, ${offsetPx.y}px) rotateX(${tiltDeg}deg) rotateZ(${rotationDeg}deg) scale(${scaleMultiplier})`,
                    transformStyle: 'preserve-3d',
                    opacity: planOpacity,
                    transition: dragStartRef.current ? 'none' : 'transform 75ms linear',
                  }}
                >
                  <canvas
                    ref={overlayCanvasRef}
                    className="w-[320px] sm:w-[460px] md:w-[540px] h-auto drop-shadow-[0_12px_28px_rgba(0,0,0,0.65)]"
                  />
                </div>
              </div>

              {/* Top Floating Status & Camera Actions */}
              <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
                <div className="pointer-events-auto inline-flex items-center gap-2 rounded-lg bg-slate-950/75 border border-slate-700/80 px-2.5 py-1.5 text-[11px] text-slate-200 backdrop-blur-sm">
                  <Move className="w-3.5 h-3.5 text-blue-400" />
                  <span>اسحب المخطط بالإصبع لمحاذاة الزوايا على الأرضية</span>
                </div>

                <div className="pointer-events-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950/80 border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                    title="تبديل الكاميرا الأمامية / الخلفية"
                  >
                    <SwitchCamera className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">
                      {facingMode === 'environment' ? 'الخلفية' : 'الأمامية'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleGyro()}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      gyroEnabled
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-950/80 border-slate-700 text-slate-200 hover:bg-slate-800'
                    }`}
                    title="مزامنة تلقائية مع حساسات الميل بالجوال"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">حساسات الجوال</span>
                  </button>
                </div>
              </div>

              {/* Bottom Snapshot CTA & Toast */}
              <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between gap-2 pointer-events-none">
                <div className="pointer-events-auto rounded-lg bg-slate-950/75 border border-slate-700/80 px-2.5 py-1.5 text-[11px] font-mono-nums text-slate-200 backdrop-blur-sm">
                  {planBounds.widthM.toFixed(1)}×{planBounds.depthM.toFixed(1)} م · {metrics.totalAreaSqm.toFixed(1)} م²
                </div>

                <button
                  type="button"
                  onClick={handleCaptureSnapshot}
                  className="pointer-events-auto inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-3.5 py-2 text-xs font-bold text-white shadow-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>التقاط وحفظ صورة المعاينة</span>
                </button>
              </div>

              {capturedToast && (
                <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg">
                  {capturedToast}
                </div>
              )}
            </div>

            {/* Calibration Control Panel */}
            <aside className="w-full lg:w-72 shrink-0 border-t lg:border-t-0 lg:border-r border-slate-800 bg-slate-900/95 p-3.5 space-y-3.5 overflow-y-auto studio-scroll max-h-[38dvh] lg:max-h-none">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">ضبط الإسقاط في الفضاء الحقيقي</span>
                <button
                  type="button"
                  onClick={resetCalibration}
                  className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>إعادة ضبط</span>
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <div className="flex items-center justify-between text-slate-300 mb-1">
                    <span>زاوية الميل على الأرضية</span>
                    <span className="font-mono-nums text-blue-400">{tiltDeg}°</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={72}
                    step={1}
                    value={tiltDeg}
                    onChange={(e) => {
                      setGyroEnabled(false);
                      setTiltDeg(Number(e.target.value));
                    }}
                    className="w-full accent-blue-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-slate-300 mb-1">
                    <span>التدوير والاتجاه</span>
                    <span className="font-mono-nums text-blue-400">{rotationDeg}°</span>
                  </div>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    step={1}
                    value={rotationDeg}
                    onChange={(e) => {
                      setGyroEnabled(false);
                      setRotationDeg(Number(e.target.value));
                    }}
                    className="w-full accent-blue-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-slate-300 mb-1">
                    <span>مقياس الحجم (الزوم)</span>
                    <span className="font-mono-nums text-blue-400">
                      {Math.round(scaleMultiplier * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.35}
                    max={2.6}
                    step={0.05}
                    value={scaleMultiplier}
                    onChange={(e) => setScaleMultiplier(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-slate-300 mb-1">
                    <span>شفافية المخطط</span>
                    <span className="font-mono-nums text-blue-400">
                      {Math.round(planOpacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.25}
                    max={1}
                    step={0.05}
                    value={planOpacity}
                    onChange={(e) => setPlanOpacity(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
              </div>

              {/* Layer Visibility Toggles */}
              <div className="pt-2 border-t border-slate-800 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-400 mb-1">طبقات المعاينة</div>
                <button
                  type="button"
                  onClick={() => setShowFurniture((v) => !v)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    showFurniture
                      ? 'border-blue-500/50 bg-blue-600/15 text-blue-200'
                      : 'border-slate-800 bg-slate-800/40 text-slate-400'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Sofa className="w-3.5 h-3.5" />
                    <span>إظهار الأثاث والأجهزة</span>
                  </span>
                  {showFurniture ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => setShowLabels((v) => !v)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    showLabels
                      ? 'border-blue-500/50 bg-blue-600/15 text-blue-200'
                      : 'border-slate-800 bg-slate-800/40 text-slate-400'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>أسماء الغرف والقياسات</span>
                  </span>
                  {showLabels ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => setShowMeterGrid((v) => !v)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    showMeterGrid
                      ? 'border-blue-500/50 bg-blue-600/15 text-blue-200'
                      : 'border-slate-800 bg-slate-800/40 text-slate-400'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Grid3X3 className="w-3.5 h-3.5" />
                    <span>شبكة القياس المترية (1م)</span>
                  </span>
                  {showMeterGrid ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
};
