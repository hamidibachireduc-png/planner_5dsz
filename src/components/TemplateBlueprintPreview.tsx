import React from 'react';
import { FLOOR_STYLES } from '../data/catalog';
import { FloorPlanData } from '../types/planner';

interface TemplateBlueprintPreviewProps {
  floorPlan: FloorPlanData;
  className?: string;
}

export const TemplateBlueprintPreview: React.FC<TemplateBlueprintPreviewProps> = React.memo(
  ({ floorPlan, className = '' }) => {
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

    const minX = xs.length > 0 ? Math.min(...xs) : -6;
    const maxX = xs.length > 0 ? Math.max(...xs) : 6;
    const minZ = zs.length > 0 ? Math.min(...zs) : -5;
    const maxZ = zs.length > 0 ? Math.max(...zs) : 5;

    const pad = 1.1;
    const vx = minX - pad;
    const vy = minZ - pad;
    const vw = Math.max(4, maxX - minX + pad * 2);
    const vh = Math.max(4, maxZ - minZ + pad * 2);

    const styleMap = new Map(FLOOR_STYLES.map((s) => [s.id, s.previewColor]));

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
              id="tplGrid"
              width="1"
              height="1"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 1 0 L 0 0 0 1"
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.06"
                strokeWidth="0.04"
              />
            </pattern>
          </defs>

          <rect
            x={vx}
            y={vy}
            width={vw}
            height={vh}
            fill="url(#tplGrid)"
            className="text-slate-900 dark:text-slate-200"
          />

          {/* Rooms */}
          {floorPlan.rooms.map((room) => {
            const fillHex = styleMap.get(room.floorStyle) || '#C59B6D';
            return (
              <g key={room.id}>
                <rect
                  x={room.x}
                  y={room.z}
                  width={room.width}
                  height={room.depth}
                  fill={fillHex}
                  fillOpacity={0.28}
                  stroke="rgba(15,23,42,0.16)"
                  strokeWidth={0.04}
                />
              </g>
            );
          })}

          {/* Furniture Silhouettes */}
          {floorPlan.furniture.map((item) => {
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
          {floorPlan.walls.map((wall) => (
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
          {floorPlan.openings.map((op) => {
            const wall = floorPlan.walls.find((w) => w.id === op.wallId);
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
