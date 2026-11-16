import React, { useId } from 'react';
import { FLOOR_STYLES } from '../data/catalog';
import { FloorPlanData } from '../types/planner';

interface TemplateBlueprintPreviewProps {
  floorPlan: FloorPlanData;
  className?: string;
  showRoomLabels?: boolean;
}

export const TemplateBlueprintPreview: React.FC<TemplateBlueprintPreviewProps> = React.memo(
  ({ floorPlan, className = '', showRoomLabels = false }) => {
    const rawId = useId();
    const gridPatternId = `tplGrid_${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

    const xs: number[] = [];
    const zs: number[] = [];

    (floorPlan?.rooms || []).forEach((r) => {
      xs.push(r.x, r.x + r.width);
      zs.push(r.z, r.z + r.depth);
    });
    (floorPlan?.walls || []).forEach((w) => {
      xs.push(w.x1, w.x2);
      zs.push(w.z1, w.z2);
    });
    (floorPlan?.furniture || []).forEach((f) => {
      const halfSpan = Math.max(f.width, f.depth) / 2;
      xs.push(f.x - halfSpan, f.x + halfSpan);
      zs.push(f.z - halfSpan, f.z + halfSpan);
    });

    const minX = xs.length > 0 ? Math.min(...xs) : -6;
    const maxX = xs.length > 0 ? Math.max(...xs) : 6;
    const minZ = zs.length > 0 ? Math.min(...zs) : -5;
    const maxZ = zs.length > 0 ? Math.max(...zs) : 5;

    const pad = showRoomLabels ? 1.4 : 1.1;
    const vx = minX - pad;
    const vy = minZ - pad;
    const vw = Math.max(4, maxX - minX + pad * 2);
    const vh = Math.max(4, maxZ - minZ + pad * 2);

    const styleMap = new Map(FLOOR_STYLES.map((s) => [s.id, s.previewColor]));
    const rooms = floorPlan?.rooms || [];
    const walls = floorPlan?.walls || [];
    const openings = floorPlan?.openings || [];
    const furniture = floorPlan?.furniture || [];

    return (
      <div
        className={`relative w-full h-full bg-[#FAF8F4] dark:bg-[#14181F] overflow-hidden ${className}`}
      >
        <svg
          viewBox={`${vx} ${vy} ${vw} ${vh}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full block"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id={gridPatternId}
              width="1"
              height="1"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 1 0 L 0 0 0 1"
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.07"
                strokeWidth="0.04"
              />
            </pattern>
          </defs>

          <rect
            x={vx}
            y={vy}
            width={vw}
            height={vh}
            fill={`url(#${gridPatternId})`}
            className="text-slate-900 dark:text-slate-200"
          />

          {/* Rooms */}
          {rooms.map((room) => {
            const fillHex = styleMap.get(room.floorStyle) || '#C59B6D';
            const area = (room.width * room.depth).toFixed(1);
            const labelFontSize = Math.max(0.26, Math.min(0.45, Math.min(room.width, room.depth) * 0.16));
            return (
              <g key={room.id}>
                <rect
                  x={room.x}
                  y={room.z}
                  width={room.width}
                  height={room.depth}
                  fill={fillHex}
                  fillOpacity={0.28}
                  stroke="rgba(15,23,42,0.18)"
                  strokeWidth={0.04}
                />
                {showRoomLabels && room.width >= 1.5 && room.depth >= 1.2 && (
                  <g>
                    <text
                      x={room.x + room.width / 2}
                      y={room.z + room.depth / 2 - labelFontSize * 0.25}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={labelFontSize}
                      fontWeight="700"
                      className="fill-slate-800 dark:fill-slate-100 select-none"
                    >
                      {room.name}
                    </text>
                    <text
                      x={room.x + room.width / 2}
                      y={room.z + room.depth / 2 + labelFontSize * 0.9}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={labelFontSize * 0.8}
                      className="fill-slate-500 dark:fill-slate-400 select-none"
                    >
                      {`${room.width.toFixed(1)}×${room.depth.toFixed(1)}م (${area}م²)`}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Furniture Silhouettes */}
          {furniture.map((item) => {
            const deg = (-item.rotation * 180) / Math.PI;
            return (
              <rect
                key={item.id}
                x={-item.width / 2}
                y={-item.depth / 2}
                width={item.width}
                height={item.depth}
                rx={0.06}
                fill={item.primaryColor}
                fillOpacity={item.type === 'rug' ? 0.35 : 0.85}
                stroke="rgba(15,23,42,0.45)"
                strokeWidth={0.04}
                transform={`translate(${item.x}, ${item.z}) rotate(${deg})`}
              />
            );
          })}

          {/* Walls */}
          {walls.map((wall) => (
            <line
              key={wall.id}
              x1={wall.x1}
              y1={wall.z1}
              x2={wall.x2}
              y2={wall.z2}
              stroke="#0F172A"
              strokeWidth={Math.max(0.14, wall.thickness)}
              strokeLinecap="square"
              className="dark:stroke-slate-200"
            />
          ))}

          {/* Doors & Windows */}
          {openings.map((op) => {
            const wall = walls.find((w) => w.id === op.wallId);
            if (!wall) return null;
            const dx = wall.x2 - wall.x1;
            const dz = wall.z2 - wall.z1;
            const cx = wall.x1 + dx * op.offsetRatio;
            const cz = wall.z1 + dz * op.offsetRatio;
            const angleDeg = (Math.atan2(dz, dx) * 180) / Math.PI;
            return (
              <g key={op.id} transform={`translate(${cx}, ${cz}) rotate(${angleDeg})`}>
                <rect
                  x={-op.width / 2}
                  y={-0.14}
                  width={op.width}
                  height={0.28}
                  fill={op.type === 'window' ? '#38BDF8' : '#FAF8F4'}
                  fillOpacity={op.type === 'window' ? 0.85 : 1}
                />
                {op.type === 'door' && (
                  <line
                    x1={-op.width / 2}
                    y1={0}
                    x2={-op.width / 2}
                    y2={op.swing === 'out' ? -op.width * 0.85 : op.width * 0.85}
                    stroke="#92400E"
                    strokeWidth={0.09}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
    );
  }
);

TemplateBlueprintPreview.displayName = 'TemplateBlueprintPreview';
