import { FloorPlanData, StructuralBeam, StructuralColumn } from '../types/planner';

const round2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * Automatically detects structural corners and intersections from walls and rooms,
 * placing reinforced concrete columns (البيليات - Poteaux) and connecting overhead
 * tie beams (السوانتر - Chaînages / Poutres).
 */
export function generateAutoColumnsAndBeams(floorPlan: FloorPlanData): {
  columns: StructuralColumn[];
  beams: StructuralBeam[];
} {
  const vertices: { x: number; z: number }[] = [];
  const MERGE_TOL = 0.35;

  const pushVertex = (x: number, z: number) => {
    const rx = round2(x);
    const rz = round2(z);
    if (!vertices.some((v) => Math.hypot(v.x - rx, v.z - rz) < MERGE_TOL)) {
      vertices.push({ x: rx, z: rz });
    }
  };

  floorPlan.walls.forEach((w) => {
    pushVertex(w.x1, w.z1);
    pushVertex(w.x2, w.z2);
  });

  if (vertices.length === 0) {
    floorPlan.rooms.forEach((r) => {
      pushVertex(r.x, r.z);
      pushVertex(r.x + r.width, r.z);
      pushVertex(r.x + r.width, r.z + r.depth);
      pushVertex(r.x, r.z + r.depth);
    });
  }

  // Also add intermediate structural columns along very long walls (> 5.2m)
  floorPlan.walls.forEach((w) => {
    const len = Math.hypot(w.x2 - w.x1, w.z2 - w.z1);
    if (len > 5.2) {
      const spans = Math.ceil(len / 4.5);
      for (let i = 1; i < spans; i++) {
        const t = i / spans;
        pushVertex(w.x1 + (w.x2 - w.x1) * t, w.z1 + (w.z2 - w.z1) * t);
      }
    }
  });

  const ts = Date.now();
  const columns: StructuralColumn[] = vertices.map((v, idx) => ({
    id: `col_${ts}_${idx + 1}`,
    x: v.x,
    z: v.z,
    width: 0.3,
    depth: 0.3,
    height: floorPlan.wallHeight || 2.8,
    label: `P${idx + 1}`,
    color: '#64748B',
  }));

  // Place perimeter/structural beams (سوانتر) along existing walls >= 0.8m
  const beams: StructuralBeam[] = [];
  floorPlan.walls.forEach((w, idx) => {
    const len = Math.hypot(w.x2 - w.x1, w.z2 - w.z1);
    if (len < 0.8) return;
    beams.push({
      id: `beam_${ts}_${idx + 1}`,
      x1: round2(w.x1),
      z1: round2(w.z1),
      x2: round2(w.x2),
      z2: round2(w.z2),
      width: 0.24,
      height: 0.35,
      label: `S${beams.length + 1}`,
      color: '#475569',
    });
  });

  return { columns, beams };
}

export interface PlanStructureMetrics {
  columnsCount: number;
  totalColumnsHeightM: number;
  beamsCount: number;
  totalBeamsLengthM: number;
  estimatedConcreteColumnsM3: number;
  estimatedConcreteBeamsM3: number;
}

export function computePlanStructureMetrics(floorPlan: FloorPlanData): PlanStructureMetrics {
  const columns = floorPlan.columns || [];
  const beams = floorPlan.beams || [];
  const defaultH = floorPlan.wallHeight || 2.85;

  const totalColumnsHeightM = Number(
    columns.reduce((sum, c) => sum + (c.height || defaultH), 0).toFixed(2)
  );
  const estimatedConcreteColumnsM3 = Number(
    columns
      .reduce((sum, c) => sum + c.width * c.depth * (c.height || defaultH), 0)
      .toFixed(2)
  );

  const totalBeamsLengthM = Number(
    beams.reduce((sum, b) => sum + Math.hypot(b.x2 - b.x1, b.z2 - b.z1), 0).toFixed(2)
  );
  const estimatedConcreteBeamsM3 = Number(
    beams
      .reduce(
        (sum, b) => sum + Math.hypot(b.x2 - b.x1, b.z2 - b.z1) * b.width * b.height,
        0
      )
      .toFixed(2)
  );

  return {
    columnsCount: columns.length,
    totalColumnsHeightM,
    beamsCount: beams.length,
    totalBeamsLengthM,
    estimatedConcreteColumnsM3,
    estimatedConcreteBeamsM3,
  };
}
