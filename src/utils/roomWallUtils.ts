import { FloorPlanData, Opening, Room, Wall } from '../types/planner';

export function getWallLength(wall: Pick<Wall, 'x1' | 'z1' | 'x2' | 'z2'>): number {
  return Math.hypot(wall.x2 - wall.x1, wall.z2 - wall.z1);
}

export function setWallLengthPreservingAngle(wall: Wall, targetLengthM: number): Wall {
  const clamped = Math.max(0.3, Math.min(50, Number(targetLengthM) || 0.3));
  const dx = wall.x2 - wall.x1;
  const dz = wall.z2 - wall.z1;
  const currentLen = Math.hypot(dx, dz);
  const ux = currentLen > 1e-5 ? dx / currentLen : 1;
  const uz = currentLen > 1e-5 ? dz / currentLen : 0;
  return {
    ...wall,
    x2: Number((wall.x1 + ux * clamped).toFixed(3)),
    z2: Number((wall.z1 + uz * clamped).toFixed(3)),
  };
}

export type RoomEdgeKey = 'top' | 'bottom' | 'left' | 'right';

export interface RoomWallMatches {
  edges: Record<RoomEdgeKey, Wall[]>;
  allMatchedIds: Set<string>;
}

function intervalOverlap(a1: number, a2: number, b1: number, b2: number): number {
  const minA = Math.min(a1, a2);
  const maxA = Math.max(a1, a2);
  const minB = Math.min(b1, b2);
  const maxB = Math.max(b1, b2);
  return Math.max(0, Math.min(maxA, maxB) - Math.max(minA, minB));
}

export function findWallsForRoom(
  room: Room,
  walls: Wall[],
  tol = 0.28
): RoomWallMatches {
  const edges: Record<RoomEdgeKey, Wall[]> = {
    top: [],
    bottom: [],
    left: [],
    right: [],
  };
  const allMatchedIds = new Set<string>();

  const minOverlapX = Math.min(0.6, Math.max(0.25, room.width * 0.4));
  const minOverlapZ = Math.min(0.6, Math.max(0.25, room.depth * 0.4));

  for (const w of walls) {
    const dx = Math.abs(w.x2 - w.x1);
    const dz = Math.abs(w.z2 - w.z1);

    // Horizontal edge candidates (top / bottom)
    if (dz <= tol && dx >= 0.3) {
      const avgZ = (w.z1 + w.z2) / 2;
      const ovX = intervalOverlap(w.x1, w.x2, room.x - tol, room.x + room.width + tol);
      if (ovX >= minOverlapX) {
        if (Math.abs(avgZ - room.z) <= tol) {
          edges.top.push(w);
          allMatchedIds.add(w.id);
          continue;
        }
        if (Math.abs(avgZ - (room.z + room.depth)) <= tol) {
          edges.bottom.push(w);
          allMatchedIds.add(w.id);
          continue;
        }
      }
    }

    // Vertical edge candidates (left / right)
    if (dx <= tol && dz >= 0.3) {
      const avgX = (w.x1 + w.x2) / 2;
      const ovZ = intervalOverlap(w.z1, w.z2, room.z - tol, room.z + room.depth + tol);
      if (ovZ >= minOverlapZ) {
        if (Math.abs(avgX - room.x) <= tol) {
          edges.left.push(w);
          allMatchedIds.add(w.id);
          continue;
        }
        if (Math.abs(avgX - (room.x + room.width)) <= tol) {
          edges.right.push(w);
          allMatchedIds.add(w.id);
          continue;
        }
      }
    }
  }

  return { edges, allMatchedIds };
}

export interface RoomWallAnalysis {
  matched: RoomWallMatches;
  exclusiveWallIds: Set<string>;
  sharedWallIds: Set<string>;
}

export function analyzeRoomWalls(plan: FloorPlanData, roomId: string): RoomWallAnalysis | null {
  const room = plan.rooms.find((r) => r.id === roomId);
  if (!room) return null;

  const matched = findWallsForRoom(room, plan.walls);
  const otherWallIds = new Set<string>();
  for (const other of plan.rooms) {
    if (other.id === roomId) continue;
    const m = findWallsForRoom(other, plan.walls);
    m.allMatchedIds.forEach((id) => otherWallIds.add(id));
  }

  const exclusiveWallIds = new Set<string>();
  const sharedWallIds = new Set<string>();

  matched.allMatchedIds.forEach((id) => {
    if (otherWallIds.has(id)) {
      sharedWallIds.add(id);
    } else {
      exclusiveWallIds.add(id);
    }
  });

  return { matched, exclusiveWallIds, sharedWallIds };
}

export function isPointInsideRoom(
  x: number,
  z: number,
  room: Room,
  pad = 0.12
): boolean {
  return (
    x >= room.x - pad &&
    x <= room.x + room.width + pad &&
    z >= room.z - pad &&
    z <= room.z + room.depth + pad
  );
}

/**
 * Collects & standardizes all 4 perimeter walls of a room:
 * - Aligns exclusive single edge walls to exact room coordinates
 * - Generates clean walls for any missing edges (without duplicating existing walls)
 */
export function groupOrEnsureRoomWalls(
  plan: FloorPlanData,
  roomId: string
): { plan: FloorPlanData; groupedWallIds: string[] } {
  const analysis = analyzeRoomWalls(plan, roomId);
  const room = plan.rooms.find((r) => r.id === roomId);
  if (!analysis || !room) {
    return { plan, groupedWallIds: [] };
  }

  const edgeTargets: Record<
    RoomEdgeKey,
    { x1: number; z1: number; x2: number; z2: number }
  > = {
    top: { x1: room.x, z1: room.z, x2: room.x + room.width, z2: room.z },
    right: {
      x1: room.x + room.width,
      z1: room.z,
      x2: room.x + room.width,
      z2: room.z + room.depth,
    },
    bottom: {
      x1: room.x + room.width,
      z1: room.z + room.depth,
      x2: room.x,
      z2: room.z + room.depth,
    },
    left: { x1: room.x, z1: room.z + room.depth, x2: room.x, z2: room.z },
  };

  let nextWalls = [...plan.walls];
  const groupedWallIds: string[] = [];
  const defaultColor =
    nextWalls.find((w) => analysis.matched.allMatchedIds.has(w.id))?.color || '#F5F2EB';
  const defaultThickness =
    nextWalls.find((w) => analysis.matched.allMatchedIds.has(w.id))?.thickness || 0.16;
  const defaultHeight =
    nextWalls.find((w) => analysis.matched.allMatchedIds.has(w.id))?.height ||
    plan.wallHeight ||
    2.8;

  const ts = Date.now();
  const edgeKeys: RoomEdgeKey[] = ['top', 'right', 'bottom', 'left'];

  edgeKeys.forEach((edgeKey, idx) => {
    const matches = analysis.matched.edges[edgeKey];
    const target = edgeTargets[edgeKey];

    if (matches.length === 0) {
      const newWall: Wall = {
        id: `w_grp_${ts}_${idx}`,
        ...target,
        thickness: defaultThickness,
        height: defaultHeight,
        color: defaultColor,
      };
      nextWalls.push(newWall);
      groupedWallIds.push(newWall.id);
      return;
    }

    // If there is exactly 1 exclusive wall on this edge, snap its coords cleanly to room edge
    if (matches.length === 1 && analysis.exclusiveWallIds.has(matches[0].id)) {
      const existing = matches[0];
      nextWalls = nextWalls.map((w) =>
        w.id === existing.id ? { ...w, ...target } : w
      );
      groupedWallIds.push(existing.id);
      return;
    }

    // Otherwise keep existing matched walls (shared or segmented) in the group
    matches.forEach((m) => groupedWallIds.push(m.id));
  });

  return {
    plan: { ...plan, walls: nextWalls },
    groupedWallIds,
  };
}

export function updateRoomGroupedWalls(
  plan: FloorPlanData,
  roomId: string,
  patch: Partial<Pick<Wall, 'height' | 'thickness' | 'color'>>
): FloorPlanData {
  const { plan: ensuredPlan, groupedWallIds } = groupOrEnsureRoomWalls(plan, roomId);
  if (groupedWallIds.length === 0) return ensuredPlan;
  const targetSet = new Set(groupedWallIds);
  return {
    ...ensuredPlan,
    walls: ensuredPlan.walls.map((w) =>
      targetSet.has(w.id) ? { ...w, ...patch } : w
    ),
  };
}

export function moveRoomCascade(
  plan: FloorPlanData,
  roomId: string,
  nextX: number,
  nextZ: number,
  moveWalls = true
): FloorPlanData {
  const room = plan.rooms.find((r) => r.id === roomId);
  if (!room) return plan;

  const dx = Number((nextX - room.x).toFixed(3));
  const dz = Number((nextZ - room.z).toFixed(3));
  if (Math.abs(dx) < 1e-4 && Math.abs(dz) < 1e-4) return plan;

  const analysis = moveWalls ? analyzeRoomWalls(plan, roomId) : null;
  const exclusiveWalls = analysis?.exclusiveWallIds ?? new Set<string>();

  return {
    ...plan,
    rooms: plan.rooms.map((r) =>
      r.id === roomId ? { ...r, x: nextX, z: nextZ } : r
    ),
    walls: moveWalls
      ? plan.walls.map((w) =>
          exclusiveWalls.has(w.id)
            ? {
                ...w,
                x1: Number((w.x1 + dx).toFixed(3)),
                z1: Number((w.z1 + dz).toFixed(3)),
                x2: Number((w.x2 + dx).toFixed(3)),
                z2: Number((w.z2 + dz).toFixed(3)),
              }
            : w
        )
      : plan.walls,
    furniture: plan.furniture.map((f) =>
      isPointInsideRoom(f.x, f.z, room)
        ? {
            ...f,
            x: Number((f.x + dx).toFixed(3)),
            z: Number((f.z + dz).toFixed(3)),
          }
        : f
    ),
  };
}

export function resizeRoomWithWalls(
  plan: FloorPlanData,
  roomId: string,
  nextWidth: number,
  nextDepth: number
): FloorPlanData {
  const room = plan.rooms.find((r) => r.id === roomId);
  if (!room) return plan;

  const clampedW = Math.max(1, Math.min(35, Number(nextWidth) || room.width));
  const clampedD = Math.max(1, Math.min(35, Number(nextDepth) || room.depth));

  const analysis = analyzeRoomWalls(plan, roomId);
  const nextRightX = room.x + clampedW;
  const nextBottomZ = room.z + clampedD;
  const tol = 0.28;

  const adjustCoord = (
    val: number,
    oldEdge: number,
    newEdge: number
  ): number => (Math.abs(val - oldEdge) <= tol ? newEdge : val);

  const oldRightX = room.x + room.width;
  const oldBottomZ = room.z + room.depth;

  return {
    ...plan,
    rooms: plan.rooms.map((r) =>
      r.id === roomId ? { ...r, width: clampedW, depth: clampedD } : r
    ),
    walls: plan.walls.map((w) => {
      if (!analysis?.exclusiveWallIds.has(w.id)) return w;
      return {
        ...w,
        x1: Number(adjustCoord(w.x1, oldRightX, nextRightX).toFixed(3)),
        x2: Number(adjustCoord(w.x2, oldRightX, nextRightX).toFixed(3)),
        z1: Number(adjustCoord(w.z1, oldBottomZ, nextBottomZ).toFixed(3)),
        z2: Number(adjustCoord(w.z2, oldBottomZ, nextBottomZ).toFixed(3)),
      };
    }),
  };
}

export function duplicateRoomCascade(
  plan: FloorPlanData,
  roomId: string
): { plan: FloorPlanData; newRoomId: string } | null {
  const room = plan.rooms.find((r) => r.id === roomId);
  if (!room) return null;

  let maxX = -Infinity;
  for (const r of plan.rooms) {
    maxX = Math.max(maxX, r.x + r.width);
  }
  for (const w of plan.walls) {
    maxX = Math.max(maxX, w.x1, w.x2);
  }
  const destX = Number((Number.isFinite(maxX) ? maxX + 0.5 : room.x + room.width + 0.5).toFixed(2));
  const destZ = room.z;
  const dx = destX - room.x;
  const dz = destZ - room.z;

  const ts = Date.now();
  const newRoomId = `room_${ts}`;
  const newRoom: Room = {
    ...room,
    id: newRoomId,
    name: `${room.name} (نسخة)`,
    x: destX,
    z: destZ,
  };

  const analysis = analyzeRoomWalls(plan, roomId);
  const newWalls: Wall[] = [];
  const newOpenings: Opening[] = [];
  const wallIdMap = new Map<string, string>();

  const matchedWalls = analysis
    ? plan.walls.filter((w) => analysis.matched.allMatchedIds.has(w.id))
    : [];

  if (matchedWalls.length >= 4) {
    matchedWalls.forEach((w, idx) => {
      const clonedId = `w_dup_${ts}_${idx}`;
      wallIdMap.set(w.id, clonedId);
      // Clip wall segment cleanly to room bounds + shift by dx, dz if it was longer shared wall
      const x1 = Number((Math.max(room.x, Math.min(room.x + room.width, w.x1)) + dx).toFixed(3));
      const z1 = Number((Math.max(room.z, Math.min(room.z + room.depth, w.z1)) + dz).toFixed(3));
      const x2 = Number((Math.max(room.x, Math.min(room.x + room.width, w.x2)) + dx).toFixed(3));
      const z2 = Number((Math.max(room.z, Math.min(room.z + room.depth, w.z2)) + dz).toFixed(3));
      if (Math.hypot(x2 - x1, z2 - z1) >= 0.3) {
        newWalls.push({
          ...w,
          id: clonedId,
          x1,
          z1,
          x2,
          z2,
        });
      }
    });
  } else {
    const h = plan.wallHeight || 2.8;
    const sampleColor = matchedWalls[0]?.color || '#F5F2EB';
    const sampleThick = matchedWalls[0]?.thickness || 0.16;
    newWalls.push(
      { id: `w_dup_${ts}_1`, x1: destX, z1: destZ, x2: destX + room.width, z2: destZ, thickness: sampleThick, height: h, color: sampleColor },
      { id: `w_dup_${ts}_2`, x1: destX + room.width, z1: destZ, x2: destX + room.width, z2: destZ + room.depth, thickness: sampleThick, height: h, color: sampleColor },
      { id: `w_dup_${ts}_3`, x1: destX + room.width, z1: destZ + room.depth, x2: destX, z2: destZ + room.depth, thickness: sampleThick, height: h, color: sampleColor },
      { id: `w_dup_${ts}_4`, x1: destX, z1: destZ + room.depth, x2: destX, z2: destZ, thickness: sampleThick, height: h, color: sampleColor }
    );
  }

  // Clone openings on exclusive matched walls
  plan.openings.forEach((op, idx) => {
    const mappedWallId = wallIdMap.get(op.wallId);
    if (mappedWallId && analysis?.exclusiveWallIds.has(op.wallId)) {
      newOpenings.push({
        ...op,
        id: `op_dup_${ts}_${idx}`,
        wallId: mappedWallId,
      });
    }
  });

  // Clone interior furniture
  const newFurniture = plan.furniture
    .filter((f) => isPointInsideRoom(f.x, f.z, room))
    .map((f, idx) => ({
      ...f,
      id: `furn_dup_${ts}_${idx}`,
      x: Number((f.x + dx).toFixed(3)),
      z: Number((f.z + dz).toFixed(3)),
    }));

  return {
    newRoomId,
    plan: {
      ...plan,
      rooms: [...plan.rooms, newRoom],
      walls: [...plan.walls, ...newWalls],
      openings: [...plan.openings, ...newOpenings],
      furniture: [...plan.furniture, ...newFurniture],
    },
  };
}

export function deleteRoomWithWalls(
  plan: FloorPlanData,
  roomId: string,
  includeExclusiveWalls = true
): FloorPlanData {
  const room = plan.rooms.find((r) => r.id === roomId);
  if (!room) return plan;

  const analysis = includeExclusiveWalls ? analyzeRoomWalls(plan, roomId) : null;
  const wallsToDelete = analysis?.exclusiveWallIds ?? new Set<string>();

  return {
    ...plan,
    rooms: plan.rooms.filter((r) => r.id !== roomId),
    walls: includeExclusiveWalls
      ? plan.walls.filter((w) => !wallsToDelete.has(w.id))
      : plan.walls,
    openings: includeExclusiveWalls
      ? plan.openings.filter((o) => !wallsToDelete.has(o.wallId))
      : plan.openings,
    furniture: includeExclusiveWalls
      ? plan.furniture.filter((f) => !isPointInsideRoom(f.x, f.z, room))
      : plan.furniture,
  };
}
