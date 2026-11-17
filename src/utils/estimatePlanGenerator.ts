import {
  FURNITURE_CATALOG,
  getDefaultFurniturePriceDzd,
} from '../data/catalog';
import { EstimatorInputs, FinishLevel } from '../data/algeriaMarketPrices';
import {
  FloorPlanData,
  FurnitureItem,
  FurnitureType,
  Opening,
  Room,
  RoomFloorStyle,
  Wall,
} from '../types/planner';

export type RoomRole =
  | 'salon'
  | 'kitchen'
  | 'bedroom'
  | 'bathroom'
  | 'garage'
  | 'balcony'
  | 'hall';

export interface GeneratedPlanVariant {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  placementNotes: string[];
  totalAreaSqm: number;
  roomsSummary: string;
  floorPlan: FloorPlanData;
}

interface RoomSpec {
  key: string;
  role: RoomRole;
  name: string;
  weight: number;
  minWidth: number;
  minDepth: number;
  floorStyle: RoomFloorStyle;
}

interface PlacedRoom extends Room {
  role: RoomRole;
}

interface WallSegmentMeta {
  wall: Wall;
  isHorizontal: boolean;
  roomA: PlacedRoom;
  roomB?: PlacedRoom;
}

const CATALOG_MAP = new Map(FURNITURE_CATALOG.map((c) => [c.type, c]));

const round2 = (v: number): number => Math.round(v * 100) / 100;

function getFinishWallColor(finishLevel: FinishLevel, variantIndex: number): string {
  if (finishLevel === 'luxury') {
    return variantIndex % 2 === 0 ? '#FAF6EE' : '#EAE6DF';
  }
  if (finishLevel === 'economic') {
    return '#FFFFFF';
  }
  return variantIndex % 2 === 0 ? '#F5F2EB' : '#EAE6DF';
}

function getFloorStyleForRole(role: RoomRole, finishLevel: FinishLevel, variantIndex: number): RoomFloorStyle {
  switch (role) {
    case 'salon':
      if (finishLevel === 'luxury') return 'ceramic_calacatta';
      return variantIndex % 2 === 0 ? 'ceramic_calacatta' : 'ceramic_travertine';
    case 'hall':
      return variantIndex === 1 ? 'zellige_casbah' : 'zellige_tlemcen';
    case 'kitchen':
      return finishLevel === 'luxury' ? 'ceramic_nero_marquina' : 'ceramic_marble_dz';
    case 'bedroom':
      return finishLevel === 'luxury' ? 'walnut' : 'oak';
    case 'bathroom':
      return variantIndex % 2 === 0 ? 'ceramic_hex_nordic' : 'tile';
    case 'garage':
      return 'sahara_sandstone';
    case 'balcony':
      return 'bejaia_terracotta';
  }
}

function buildRequestedRoomSpecs(inputs: EstimatorInputs, variantIndex: number): RoomSpec[] {
  const bedrooms = Math.max(0, Math.min(12, Math.round(inputs.roomsCount ?? 0)));
  const salons = Math.max(0, Math.min(4, Math.round(inputs.salonsCount ?? 0)));
  const kitchens = Math.max(0, Math.min(3, Math.round(inputs.kitchensCount ?? 0)));
  const bathrooms = Math.max(0, Math.min(6, Math.round(inputs.bathroomsCount ?? 0)));
  const garages = Math.max(0, Math.min(3, Math.round(inputs.garagesCount ?? 0)));
  const balconies = Math.max(0, Math.min(4, Math.round(inputs.balconiesCount ?? 0)));

  const specs: RoomSpec[] = [];

  for (let i = 0; i < salons; i++) {
    specs.push({
      key: `salon_${i + 1}`,
      role: 'salon',
      name: i === 0 ? 'الصالون الرئيسي' : `صالة عائلية ${i + 1}`,
      weight: i === 0 ? 22 : 16,
      minWidth: 3.2,
      minDepth: 3.0,
      floorStyle: getFloorStyleForRole('salon', inputs.finishLevel, variantIndex),
    });
  }

  for (let i = 0; i < kitchens; i++) {
    specs.push({
      key: `kitchen_${i + 1}`,
      role: 'kitchen',
      name: i === 0 ? 'المطبخ (كوزينة)' : `مطبخ ثانوي ${i + 1}`,
      weight: i === 0 ? 12.5 : 9,
      minWidth: 2.6,
      minDepth: 2.6,
      floorStyle: getFloorStyleForRole('kitchen', inputs.finishLevel, variantIndex),
    });
  }

  for (let i = 0; i < bedrooms; i++) {
    specs.push({
      key: `bedroom_${i + 1}`,
      role: 'bedroom',
      name:
        bedrooms === 1
          ? 'غرفة النوم'
          : i === 0
            ? 'غرفة النوم الرئيسية'
            : `غرفة نوم ${i + 1}`,
      weight: i === 0 ? 15 : 12.5,
      minWidth: 2.8,
      minDepth: 2.8,
      floorStyle: getFloorStyleForRole('bedroom', inputs.finishLevel, variantIndex),
    });
  }

  for (let i = 0; i < bathrooms; i++) {
    const isGuestWc = bathrooms >= 2 && i === bathrooms - 1;
    specs.push({
      key: `bath_${i + 1}`,
      role: 'bathroom',
      name:
        bathrooms === 1
          ? 'الحمام و WC'
          : isGuestWc
            ? 'تواليت الضيوف (WC)'
            : i === 0
              ? 'الحمام الرئيسي'
              : `حمام ${i + 1}`,
      weight: isGuestWc ? 3.5 : 5.6,
      minWidth: isGuestWc ? 1.5 : 2.0,
      minDepth: isGuestWc ? 1.5 : 2.0,
      floorStyle: getFloorStyleForRole('bathroom', inputs.finishLevel, variantIndex),
    });
  }

  for (let i = 0; i < garages; i++) {
    specs.push({
      key: `garage_${i + 1}`,
      role: 'garage',
      name: garages === 1 ? 'الكراج (المرآب)' : `كراج ${i + 1}`,
      weight: 18,
      minWidth: 3.1,
      minDepth: 4.5,
      floorStyle: getFloorStyleForRole('garage', inputs.finishLevel, variantIndex),
    });
  }

  for (let i = 0; i < balconies; i++) {
    specs.push({
      key: `balcony_${i + 1}`,
      role: 'balcony',
      name: balconies === 1 ? 'الشرفة / بالكون' : `شرفة ${i + 1}`,
      weight: 7,
      minWidth: 2.4,
      minDepth: 1.6,
      floorStyle: getFloorStyleForRole('balcony', inputs.finishLevel, variantIndex),
    });
  }

  // Fallback if user set every space counter to 0
  if (specs.length === 0) {
    specs.push({
      key: 'salon_1',
      role: 'salon',
      name: 'فضاء مفتوح / استوديو',
      weight: 28,
      minWidth: 4.0,
      minDepth: 3.5,
      floorStyle: getFloorStyleForRole('salon', inputs.finishLevel, variantIndex),
    });
  }

  return specs;
}

/**
 * Packs a list of RoomSpecs into horizontal architectural bands so all rooms inside a band
 * share the exact band depth and the band widths equal totalWidth — eliminating overlaps and gaps.
 */
function packBandsIntoRectangle(
  bands: RoomSpec[][],
  bandDepthFactors: number[],
  totalWidth: number,
  totalDepth: number,
  targetArea: number,
  totalWeight: number,
  originX = 0,
  originZ = 0
): PlacedRoom[] {
  const activePairs = bands
    .map((items, idx) => ({ items, factor: bandDepthFactors[idx] ?? 1 }))
    .filter((b) => b.items.length > 0);

  if (activePairs.length === 0) return [];

  const bandWeights = activePairs.map((b) => {
    const sumW = b.items.reduce((s, r) => s + r.weight, 0);
    return Math.max(1, sumW * b.factor);
  });
  const totalBandWeight = bandWeights.reduce((s, w) => s + w, 0);

  // Allocate depths proportionally with realistic min-depth clamp
  const rawDepths = bandWeights.map((bw) => (bw / totalBandWeight) * totalDepth);
  const adjustedDepths = rawDepths.map((d, i) => {
    const minReq = Math.max(...activePairs[i].items.map((r) => r.minDepth * 0.78), 1.5);
    return Math.max(minReq, d);
  });
  const sumAdjustedDepth = adjustedDepths.reduce((s, d) => s + d, 0);
  const depthScale = sumAdjustedDepth > 0 ? totalDepth / sumAdjustedDepth : 1;

  const placed: PlacedRoom[] = [];
  let cursorZ = originZ;

  activePairs.forEach((band, bIdx) => {
    const bandDepth = round2(
      bIdx === activePairs.length - 1
        ? originZ + totalDepth - cursorZ
        : Math.max(1.5, adjustedDepths[bIdx] * depthScale)
    );

    const itemSumWeight = band.items.reduce((s, r) => s + r.weight, 0) || 1;
    let cursorX = originX;

    band.items.forEach((spec, rIdx) => {
      const share = spec.weight / itemSumWeight;
      const w = round2(
        rIdx === band.items.length - 1
          ? originX + totalWidth - cursorX
          : Math.max(1.4, totalWidth * share)
      );

      placed.push({
        id: spec.key,
        name: spec.name,
        role: spec.role,
        x: round2(cursorX),
        z: round2(cursorZ),
        width: Math.max(1.2, w),
        depth: Math.max(1.2, bandDepth),
        floorStyle: spec.floorStyle,
      });

      cursorX = round2(cursorX + w);
    });

    cursorZ = round2(cursorZ + bandDepth);
  });

  // Reference unused vars lint safety if needed
  void targetArea;
  void totalWeight;
  return placed;
}

/**
 * Packs a central Spine + Left Wing + Right Wing layout (great for central Hallway / Hosh circulation).
 */
function packThreeColumnWings(
  leftRooms: RoomSpec[],
  centerRooms: RoomSpec[],
  rightRooms: RoomSpec[],
  totalWidth: number,
  totalDepth: number,
  originX = 0,
  originZ = 0
): PlacedRoom[] {
  const columns = [
    { key: 'left', items: leftRooms, minW: 2.5 },
    { key: 'center', items: centerRooms, minW: 1.65 },
    { key: 'right', items: rightRooms, minW: 2.5 },
  ].filter((c) => c.items.length > 0);

  if (columns.length === 0) return [];

  const colWeights = columns.map((c) => {
    const sum = c.items.reduce((s, r) => s + r.weight, 0);
    // Keep hall narrow-ish & practical as circulation spine
    if (c.key === 'center' && c.items.every((i) => i.role === 'hall')) {
      return Math.max(sum * 0.9, 10);
    }
    return Math.max(sum, 12);
  });
  const totalColW = colWeights.reduce((s, w) => s + w, 0) || 1;

  const placed: PlacedRoom[] = [];
  let cursorX = originX;

  columns.forEach((col, cIdx) => {
    let colW =
      cIdx === columns.length - 1
        ? originX + totalWidth - cursorX
        : Math.max(col.minW, (colWeights[cIdx] / totalColW) * totalWidth);

    if (col.key === 'center' && col.items.every((i) => i.role === 'hall')) {
      colW = Math.min(Math.max(1.7, totalWidth * 0.2), Math.max(1.7, colW));
    }
    colW = round2(Math.max(1.5, colW));

    const sumRowW = col.items.reduce((s, r) => s + r.weight, 0) || 1;
    let cursorZ = originZ;

    col.items.forEach((spec, rIdx) => {
      const d = round2(
        rIdx === col.items.length - 1
          ? originZ + totalDepth - cursorZ
          : Math.max(1.5, totalDepth * (spec.weight / sumRowW))
      );

      placed.push({
        id: spec.key,
        name: spec.name,
        role: spec.role,
        x: round2(cursorX),
        z: round2(cursorZ),
        width: Math.max(1.3, colW),
        depth: Math.max(1.3, d),
        floorStyle: spec.floorStyle,
      });
      cursorZ = round2(cursorZ + d);
    });

    cursorX = round2(cursorX + colW);
  });

  return placed;
}

/**
 * Extracts clean, non-overlapping walls by splitting room borders at every perpendicular coordinate.
 */
function buildWallsAndOpenings(
  rooms: PlacedRoom[],
  wallHeight: number,
  wallColor: string,
  preferOpenSalonKitchen: boolean
): { walls: Wall[]; openings: Opening[] } {
  const EPS = 0.04;

  const xCoords = Array.from(
    new Set(rooms.flatMap((r) => [round2(r.x), round2(r.x + r.width)]))
  ).sort((a, b) => a - b);

  const zCoords = Array.from(
    new Set(rooms.flatMap((r) => [round2(r.z), round2(r.z + r.depth)]))
  ).sort((a, b) => a - b);

  const segments: WallSegmentMeta[] = [];
  let wallIdx = 1;

  // Horizontal wall segments along each Z line
  for (const zLine of zCoords) {
    for (let i = 0; i < xCoords.length - 1; i++) {
      const xStart = xCoords[i];
      const xEnd = xCoords[i + 1];
      if (xEnd - xStart < 0.25) continue;
      const midX = (xStart + xEnd) / 2;

      const above = rooms.find(
        (r) =>
          Math.abs(r.z + r.depth - zLine) < EPS &&
          midX > r.x + EPS &&
          midX < r.x + r.width - EPS
      );
      const below = rooms.find(
        (r) =>
          Math.abs(r.z - zLine) < EPS &&
          midX > r.x + EPS &&
          midX < r.x + r.width - EPS
      );

      if (!above && !below) continue;
      const roomA = (above || below)!;
      const roomB = above && below ? below : undefined;

      segments.push({
        isHorizontal: true,
        roomA,
        roomB,
        wall: {
          id: `est_w_${wallIdx++}`,
          x1: round2(xStart),
          z1: round2(zLine),
          x2: round2(xEnd),
          z2: round2(zLine),
          thickness: roomB ? 0.14 : 0.2,
          height: wallHeight,
          color: wallColor,
        },
      });
    }
  }

  // Vertical wall segments along each X line
  for (const xLine of xCoords) {
    for (let i = 0; i < zCoords.length - 1; i++) {
      const zStart = zCoords[i];
      const zEnd = zCoords[i + 1];
      if (zEnd - zStart < 0.25) continue;
      const midZ = (zStart + zEnd) / 2;

      const left = rooms.find(
        (r) =>
          Math.abs(r.x + r.width - xLine) < EPS &&
          midZ > r.z + EPS &&
          midZ < r.z + r.depth - EPS
      );
      const right = rooms.find(
        (r) =>
          Math.abs(r.x - xLine) < EPS &&
          midZ > r.z + EPS &&
          midZ < r.z + r.depth - EPS
      );

      if (!left && !right) continue;
      const roomA = (left || right)!;
      const roomB = left && right ? right : undefined;

      segments.push({
        isHorizontal: false,
        roomA,
        roomB,
        wall: {
          id: `est_w_${wallIdx++}`,
          x1: round2(xLine),
          z1: round2(zStart),
          x2: round2(xLine),
          z2: round2(zEnd),
          thickness: roomB ? 0.14 : 0.2,
          height: wallHeight,
          color: wallColor,
        },
      });
    }
  }

  // Merge colinear contiguous segments that share the exact same (roomA, roomB) pair
  const mergedSegments: WallSegmentMeta[] = [];
  const used = new Set<number>();

  for (let i = 0; i < segments.length; i++) {
    if (used.has(i)) continue;
    let cur = { ...segments[i], wall: { ...segments[i].wall } };
    used.add(i);

    let extended = true;
    while (extended) {
      extended = false;
      for (let j = 0; j < segments.length; j++) {
        if (used.has(j)) continue;
        const cand = segments[j];
        if (cand.isHorizontal !== cur.isHorizontal) continue;
        const samePair =
          (cand.roomA.id === cur.roomA.id && cand.roomB?.id === cur.roomB?.id) ||
          (cand.roomB?.id === cur.roomA.id && cand.roomA.id === cur.roomB?.id);
        if (!samePair) continue;

        if (
          cur.isHorizontal &&
          Math.abs(cand.wall.z1 - cur.wall.z1) < EPS &&
          Math.abs(cand.wall.x1 - cur.wall.x2) < EPS
        ) {
          cur.wall.x2 = cand.wall.x2;
          used.add(j);
          extended = true;
        } else if (
          !cur.isHorizontal &&
          Math.abs(cand.wall.x1 - cur.wall.x1) < EPS &&
          Math.abs(cand.wall.z1 - cur.wall.z2) < EPS
        ) {
          cur.wall.z2 = cand.wall.z2;
          used.add(j);
          extended = true;
        }
      }
    }
    mergedSegments.push(cur);
  }

  const walls = mergedSegments.map((m) => m.wall);
  const openings: Opening[] = [];
  let opIdx = 1;

  const segLength = (w: Wall) => Math.hypot(w.x2 - w.x1, w.z2 - w.z1);
  const doorHeight = Math.min(2.15, Math.max(1.9, wallHeight - 0.35));

  // Track room connectivity via interior doors/arches
  const connected = new Set<string>();
  const startRoom =
    rooms.find((r) => r.role === 'hall') ||
    rooms.find((r) => r.role === 'salon') ||
    rooms[0];
  if (startRoom) connected.add(startRoom.id);

  // Place Exterior Main Entrance & Garage Doors
  const maxZ = Math.max(...rooms.map((r) => r.z + r.depth));
  const minZ = Math.min(...rooms.map((r) => r.z));

  const frontDoorCandidate =
    mergedSegments.find(
      (s) =>
        !s.roomB &&
        s.isHorizontal &&
        Math.abs(s.wall.z1 - maxZ) < EPS &&
        (s.roomA.role === 'hall' || s.roomA.role === 'salon') &&
        segLength(s.wall) >= 1.3
    ) ||
    mergedSegments.find(
      (s) =>
        !s.roomB &&
        (s.roomA.role === 'hall' || s.roomA.role === 'salon') &&
        segLength(s.wall) >= 1.3
    ) ||
    mergedSegments.find((s) => !s.roomB && segLength(s.wall) >= 1.2);

  if (frontDoorCandidate) {
    openings.push({
      id: `est_op_${opIdx++}`,
      wallId: frontDoorCandidate.wall.id,
      type: 'door',
      offsetRatio: 0.5,
      width: Math.min(1.15, segLength(frontDoorCandidate.wall) * 0.55),
      height: doorHeight,
      sillHeight: 0,
      swing: 'in',
    });
  }

  // Place Garage wide door on exterior wall of each garage
  for (const seg of mergedSegments) {
    if (seg.roomB || seg.roomA.role !== 'garage') continue;
    const len = segLength(seg.wall);
    if (len < 2.4) continue;
    const alreadyHasDoor = openings.some((o) => o.wallId === seg.wall.id);
    if (alreadyHasDoor) continue;
    const isBottomOrTop =
      Math.abs(seg.wall.z1 - maxZ) < EPS || Math.abs(seg.wall.z1 - minZ) < EPS;
    if (isBottomOrTop || !openings.some((o) => o.wallId === seg.wall.id)) {
      openings.push({
        id: `est_op_${opIdx++}`,
        wallId: seg.wall.id,
        type: 'door',
        offsetRatio: 0.5,
        width: Math.min(2.6, len * 0.72),
        height: Math.min(2.3, wallHeight - 0.25),
        sillHeight: 0,
        swing: 'out',
      });
      break;
    }
  }

  // Interior walls: connect Hall to adjacent rooms & Salon<->Kitchen arch in open mode
  const interiorSegs = mergedSegments.filter((s) => Boolean(s.roomB));
  const usedInteriorWalls = new Set<string>();

  const addInteriorOpening = (seg: WallSegmentMeta, type: 'door' | 'arch', width: number) => {
    if (usedInteriorWalls.has(seg.wall.id)) return;
    const len = segLength(seg.wall);
    if (len < 0.85) return;
    usedInteriorWalls.add(seg.wall.id);
    openings.push({
      id: `est_op_${opIdx++}`,
      wallId: seg.wall.id,
      type,
      offsetRatio: 0.5,
      width: round2(Math.min(width, len * 0.65)),
      height: type === 'arch' ? Math.min(2.45, wallHeight - 0.2) : doorHeight,
      sillHeight: 0,
      swing: type === 'door' ? 'in' : undefined,
    });
    connected.add(seg.roomA.id);
    if (seg.roomB) connected.add(seg.roomB.id);
  };

  // Pass 1: Preferred links (Salon <-> Kitchen arch, Hall <-> everything touching it)
  for (const seg of interiorSegs) {
    if (!seg.roomB) continue;
    const roles = new Set([seg.roomA.role, seg.roomB.role]);

    if (preferOpenSalonKitchen && roles.has('salon') && roles.has('kitchen')) {
      addInteriorOpening(seg, 'arch', 1.9);
    } else if (roles.has('hall')) {
      const otherRole = seg.roomA.role === 'hall' ? seg.roomB.role : seg.roomA.role;
      if (otherRole === 'salon') {
        addInteriorOpening(seg, 'arch', 1.65);
      } else {
        addInteriorOpening(seg, 'door', otherRole === 'bathroom' ? 0.8 : 0.9);
      }
    }
  }

  // Pass 2: Graph BFS expansion so 100% of rooms are connected via doors
  const roleTransitPenalty = (role: RoomRole): number => {
    if (role === 'hall') return 0;
    if (role === 'salon') return 1;
    if (role === 'kitchen') return 2;
    if (role === 'bedroom') return 3;
    if (role === 'balcony') return 4;
    if (role === 'garage') return 8;
    return 12; // bathroom: last resort only
  };

  let progress = true;
  while (progress && connected.size < rooms.length) {
    progress = false;
    const candidates = interiorSegs
      .filter((s) => {
        if (!s.roomB) return false;
        const aIn = connected.has(s.roomA.id);
        const bIn = connected.has(s.roomB.id);
        return aIn !== bIn && segLength(s.wall) >= 0.85;
      })
      .sort((a, b) => {
        const aSource = connected.has(a.roomA.id) ? a.roomA : a.roomB!;
        const bSource = connected.has(b.roomA.id) ? b.roomA : b.roomB!;
        const penDiff = roleTransitPenalty(aSource.role) - roleTransitPenalty(bSource.role);
        if (penDiff !== 0) return penDiff;
        return segLength(b.wall) - segLength(a.wall);
      });

    if (candidates.length > 0) {
      const chosen = candidates[0];
      const involvesSalonKitchen =
        preferOpenSalonKitchen &&
        ((chosen.roomA.role === 'salon' && chosen.roomB?.role === 'kitchen') ||
          (chosen.roomA.role === 'kitchen' && chosen.roomB?.role === 'salon'));
      addInteriorOpening(
        chosen,
        involvesSalonKitchen ? 'arch' : 'door',
        involvesSalonKitchen ? 1.85 : 0.9
      );
      progress = true;
    }
  }

  // Exterior Windows on bedrooms, salons, kitchens, bathrooms
  const windowedRoomIds = new Set<string>();
  for (const seg of mergedSegments) {
    if (seg.roomB) continue;
    if (seg.roomA.role === 'garage' || seg.roomA.role === 'balcony' || seg.roomA.role === 'hall') {
      continue;
    }
    if (windowedRoomIds.has(seg.roomA.id)) continue;
    if (openings.some((o) => o.wallId === seg.wall.id)) continue;
    const len = segLength(seg.wall);
    if (len < 1.35) continue;

    const isBath = seg.roomA.role === 'bathroom';
    openings.push({
      id: `est_op_${opIdx++}`,
      wallId: seg.wall.id,
      type: 'window',
      offsetRatio: 0.5,
      width: round2(isBath ? Math.min(0.85, len * 0.45) : Math.min(1.65, len * 0.48)),
      height: isBath ? 0.75 : 1.35,
      sillHeight: isBath ? 1.35 : 0.85,
    });
    windowedRoomIds.add(seg.roomA.id);
  }

  return { walls, openings };
}

function makeItem(
  id: string,
  type: FurnitureType,
  x: number,
  z: number,
  rotation = 0,
  maxWidth?: number,
  maxDepth?: number
): FurnitureItem | null {
  const def = CATALOG_MAP.get(type);
  if (!def) return null;

  const isRotated90 = Math.abs(Math.sin(rotation)) > 0.7;
  const effW = isRotated90 ? def.depth : def.width;
  const effD = isRotated90 ? def.width : def.depth;

  if (maxWidth !== undefined && effW > maxWidth) return null;
  if (maxDepth !== undefined && effD > maxDepth) return null;

  return {
    id,
    catalogId: def.catalogId,
    type: def.type,
    name: def.name,
    category: def.category,
    x: round2(x),
    z: round2(z),
    rotation,
    width: def.width,
    depth: def.depth,
    height: def.height,
    primaryColor: def.defaultPrimary,
    accentColor: def.defaultAccent,
    priceDzd: getDefaultFurniturePriceDzd({ type: def.type, catalogId: def.catalogId }),
  };
}

function populateFurnitureForRooms(rooms: PlacedRoom[]): FurnitureItem[] {
  const items: FurnitureItem[] = [];
  let idx = 1;

  for (const room of rooms) {
    const cx = room.x + room.width / 2;
    const cz = room.z + room.depth / 2;
    const pad = 0.42;
    const innerW = Math.max(0.6, room.width - pad * 2);
    const innerD = Math.max(0.6, room.depth - pad * 2);

    if (room.role === 'salon') {
      const uSalon = makeItem(
        `est_f_${idx++}`,
        'algerian_salon_u',
        cx,
        room.z + room.depth * 0.42,
        0,
        innerW,
        innerD * 0.75
      );
      if (uSalon) {
        items.push(uSalon);
        const tea = makeItem(
          `est_f_${idx++}`,
          'brass_tea_table',
          cx,
          room.z + room.depth * 0.48,
          0,
          innerW * 0.4,
          innerD * 0.4
        );
        if (tea) items.push(tea);
      } else {
        const sofa = makeItem(
          `est_f_${idx++}`,
          'sofa_3',
          cx,
          room.z + 0.72,
          0,
          innerW,
          innerD * 0.55
        );
        if (sofa) items.push(sofa);
        const coffee = makeItem(
          `est_f_${idx++}`,
          'coffee_table',
          cx,
          cz + 0.15,
          0,
          innerW * 0.65,
          innerD * 0.45
        );
        if (coffee) items.push(coffee);
      }

      const tv = makeItem(
        `est_f_${idx++}`,
        'tv_stand',
        cx,
        room.z + room.depth - 0.36,
        Math.PI,
        innerW * 0.8,
        0.7
      );
      if (tv) items.push(tv);
    } else if (room.role === 'kitchen') {
      const potager =
        makeItem(
          `est_f_${idx++}`,
          'potager_corner',
          room.x + room.width - 1.1,
          room.z + 1.05,
          0,
          innerW * 0.9,
          innerD * 0.85
        ) ||
        makeItem(
          `est_f_${idx++}`,
          'potager_straight',
          cx,
          room.z + 0.46,
          0,
          innerW,
          0.9
        );
      if (potager) items.push(potager);

      const stove = makeItem(
        `est_f_${idx++}`,
        'gas_oven_5burner',
        room.x + 0.62,
        room.z + 0.48,
        0,
        innerW * 0.45,
        0.9
      );
      if (stove) items.push(stove);

      const fridge = makeItem(
        `est_f_${idx++}`,
        'fridge',
        room.x + 0.52,
        room.z + room.depth - 0.52,
        Math.PI / 2,
        innerW * 0.45,
        innerD * 0.45
      );
      if (fridge) items.push(fridge);
    } else if (room.role === 'bedroom') {
      const isMaster = room.id === 'bedroom_1';
      const bed =
        makeItem(
          `est_f_${idx++}`,
          isMaster ? 'bed_double' : 'bed_single',
          cx - (room.width >= 3.3 ? 0.35 : 0),
          room.z + Math.min(room.depth * 0.48, 1.25),
          0,
          innerW * 0.82,
          innerD * 0.85
        ) ||
        makeItem(
          `est_f_${idx++}`,
          'bed_single',
          cx,
          cz,
          0,
          innerW,
          innerD
        );
      if (bed) items.push(bed);

      const wardrobe = makeItem(
        `est_f_${idx++}`,
        'wardrobe',
        room.x + room.width - 0.42,
        cz,
        -Math.PI / 2,
        0.85,
        innerD * 0.85
      );
      if (wardrobe) items.push(wardrobe);
    } else if (room.role === 'bathroom') {
      const isWcOnly = room.name.includes('تواليت') || room.width * room.depth < 4.0;
      const toilet = makeItem(
        `est_f_${idx++}`,
        isWcOnly ? 'toilet_arabic' : 'toilet_anglaise',
        room.x + 0.45,
        room.z + room.depth - 0.48,
        Math.PI,
        innerW * 0.5,
        innerD * 0.55
      );
      if (toilet) items.push(toilet);

      if (!isWcOnly) {
        const shower = makeItem(
          `est_f_${idx++}`,
          'shower_italian',
          room.x + room.width - 0.62,
          room.z + 0.62,
          0,
          innerW * 0.65,
          innerD * 0.65
        );
        if (shower) items.push(shower);
      }

      const vanity = makeItem(
        `est_f_${idx++}`,
        'vanity',
        room.x + 0.55,
        room.z + 0.38,
        0,
        innerW * 0.7,
        0.75
      );
      if (vanity) items.push(vanity);
    } else if (room.role === 'garage') {
      const car = makeItem(
        `est_f_${idx++}`,
        'garage_car',
        cx,
        cz,
        room.width > room.depth ? Math.PI / 2 : 0,
        innerW + 0.35,
        innerD + 0.35
      );
      if (car) items.push(car);
    } else if (room.role === 'balcony') {
      const plant = makeItem(
        `est_f_${idx++}`,
        'plant_olive',
        room.x + 0.45,
        cz,
        0,
        innerW * 0.5,
        innerD * 0.8
      );
      if (plant) items.push(plant);
    } else if (room.role === 'hall') {
      const bench = makeItem(
        `est_f_${idx++}`,
        'hallway_coat_bench',
        cx,
        room.z + 0.35,
        0,
        innerW * 0.75,
        0.7
      );
      if (bench) items.push(bench);
    }
  }

  return items;
}

function centerFloorPlan(
  rooms: PlacedRoom[],
  walls: Wall[],
  openings: Opening[],
  furniture: FurnitureItem[],
  wallHeight: number
): FloorPlanData {
  if (rooms.length === 0) {
    return { rooms: [], walls: [], openings: [], furniture: [], wallHeight, unit: 'm' };
  }

  const minX = Math.min(...rooms.map((r) => r.x));
  const maxX = Math.max(...rooms.map((r) => r.x + r.width));
  const minZ = Math.min(...rooms.map((r) => r.z));
  const maxZ = Math.max(...rooms.map((r) => r.z + r.depth));

  const offsetX = round2(-(minX + maxX) / 2);
  const offsetZ = round2(-(minZ + maxZ) / 2);

  return {
    wallHeight,
    unit: 'm',
    rooms: rooms.map(({ role: _role, ...r }) => ({
      ...r,
      x: round2(r.x + offsetX),
      z: round2(r.z + offsetZ),
    })),
    walls: walls.map((w) => ({
      ...w,
      x1: round2(w.x1 + offsetX),
      z1: round2(w.z1 + offsetZ),
      x2: round2(w.x2 + offsetX),
      z2: round2(w.z2 + offsetZ),
    })),
    openings,
    furniture: furniture.map((f) => ({
      ...f,
      x: round2(f.x + offsetX),
      z: round2(f.z + offsetZ),
    })),
  };
}

function summarizeSpecs(specs: RoomSpec[]): string {
  const countRole = (r: RoomRole) => specs.filter((s) => s.role === r).length;
  const parts: string[] = [];
  const beds = countRole('bedroom');
  const salons = countRole('salon');
  const kitchens = countRole('kitchen');
  const baths = countRole('bathroom');
  const garages = countRole('garage');
  const balconies = countRole('balcony');

  if (beds > 0) parts.push(`${beds} غرف نوم`);
  if (salons > 0) parts.push(`${salons} صالون`);
  if (kitchens > 0) parts.push(`${kitchens} مطبخ`);
  if (baths > 0) parts.push(`${baths} حمام`);
  if (garages > 0) parts.push(`${garages} كراج`);
  if (balconies > 0) parts.push(`${balconies} شرفة`);

  return parts.join(' + ');
}

export function generateEstimatedFloorPlanVariants(
  inputs: EstimatorInputs
): GeneratedPlanVariant[] {
  const targetArea = Math.max(20, Math.min(800, Number(inputs.floorAreaSqm) || 100));
  const wallHeight = Math.max(2.4, Math.min(4.5, Number(inputs.wallHeightM) || 2.9));

  const createVariant = (
    variantIdx: number,
    id: string,
    title: string,
    subtitle: string,
    badge: string,
    placementNotes: string[],
    preferOpenSalonKitchen: boolean,
    layoutBuilder: (specs: RoomSpec[], totalW: number, totalD: number) => PlacedRoom[]
  ): GeneratedPlanVariant => {
    const baseSpecs = buildRequestedRoomSpecs(inputs, variantIdx);

    // Add a distribution Hall when there are 3 or more functional spaces
    const needsHall = baseSpecs.filter((s) => s.role !== 'balcony' && s.role !== 'garage').length >= 3;
    const allSpecs: RoomSpec[] = needsHall
      ? [
          ...baseSpecs,
          {
            key: 'hall_1',
            role: 'hall',
            name: 'هول التوزيع',
            weight: Math.max(7.5, Math.min(14, targetArea * 0.095)),
            minWidth: 1.7,
            minDepth: 2.2,
            floorStyle: getFloorStyleForRole('hall', inputs.finishLevel, variantIdx),
          },
        ]
      : baseSpecs;

    const totalWeight = allSpecs.reduce((s, r) => s + r.weight, 0) || 1;
    // Scale room weights smoothly to target area while enforcing architectural minimum envelope
    const minNeededArea = allSpecs.reduce(
      (s, r) => s + r.minWidth * r.minDepth * 0.78,
      0
    );
    const effectiveArea = Math.max(targetArea, minNeededArea);

    const aspectRatio =
      variantIdx === 3
        ? 0.78 // narrower front, deeper length
        : variantIdx === 1
          ? 1.32 // wider 3-wing footprint
          : 1.18;

    const totalWidth = round2(Math.max(5.5, Math.sqrt(effectiveArea * aspectRatio)));
    const totalDepth = round2(Math.max(5.0, effectiveArea / totalWidth));

    const placedRooms = layoutBuilder(allSpecs, totalWidth, totalDepth);
    const wallColor = getFinishWallColor(inputs.finishLevel, variantIdx);
    const { walls, openings } = buildWallsAndOpenings(
      placedRooms,
      wallHeight,
      wallColor,
      preferOpenSalonKitchen
    );
    const furniture = populateFurnitureForRooms(placedRooms);
    const floorPlan = centerFloorPlan(placedRooms, walls, openings, furniture, wallHeight);

    const computedArea = Number(
      floorPlan.rooms.reduce((sum, r) => sum + r.width * r.depth, 0).toFixed(1)
    );

    return {
      id,
      title,
      subtitle,
      badge,
      placementNotes,
      totalAreaSqm: computedArea,
      roomsSummary: summarizeSpecs(baseSpecs),
      floorPlan,
    };
  };

  // Helper getters by role
  const byRole = (specs: RoomSpec[], roles: RoomRole[]) =>
    specs.filter((s) => roles.includes(s.role));

  // ── Variant 1: Classic Algerian Reception Front + Kitchen/Bath Middle + Quiet Bedrooms Back ──
  const variant1 = createVariant(
    0,
    'variant_classic_front_salon',
    'الاحتمال 1: استقبال أمامي + جناح نوم خلفي',
    'الصالون والكراج في الواجهة الأمامية، المطبخ والحمام في الوسط، وغرف النوم مع الشرفة في الخلف الهادئ.',
    'الأكثر طلباً',
    [
      'الصالون والمدخل في الواجهة الأمامية لاستقبال الضيوف بخصوصية',
      'المطبخ والحمام متجاوران في المنتصف لتسهيل شبكة المياه والغاز',
      'غرف النوم في الجزء الخلفي الهادئ بعيدة عن ضجيج الواجهة',
    ],
    false,
    (specs, totalW, totalD) => {
      const rearBedrooms = [...byRole(specs, ['bedroom']), ...byRole(specs, ['balcony'])];
      const middleCore = [
        ...byRole(specs, ['kitchen']),
        ...byRole(specs, ['hall']),
        ...byRole(specs, ['bathroom']),
      ];
      const frontZone = [...byRole(specs, ['salon']), ...byRole(specs, ['garage'])];

      return packBandsIntoRectangle(
        [rearBedrooms, middleCore, frontZone],
        [1.05, 0.9, 1.05],
        totalW,
        totalD,
        targetArea,
        specs.reduce((s, r) => s + r.weight, 0)
      );
    }
  );

  // ── Variant 2: Central Hall Spine (Living & Kitchen Wing Right vs Private Bedrooms Wing Left) ──
  const variant2 = createVariant(
    1,
    'variant_central_hall_split',
    'الاحتمال 2: هول وسطي فاصل بين جناحين',
    'جناح خاص بغرف النوم على اليسار، وهول توزيع في الوسط، وجناح الصالون والمطبخ والحمام على اليمين.',
    'عزل مثالي للخصوصية',
    [
      'تقسيم طولي يفصل تماماً بين جناح العائلة/النوم وجناح الضيافة',
      'هول وسطي يوزع الحركة مباشرة نحو جميع الغرف والمطبخ',
      'سهولة وضع المطبخ والشرفة في نهاية الجناح الحيوي',
    ],
    false,
    (specs, totalW, totalD) => {
      const leftWing = [...byRole(specs, ['bedroom']), ...byRole(specs, ['balcony'])];
      const centerSpine = byRole(specs, ['hall']);
      const rightWing = [
        ...byRole(specs, ['kitchen']),
        ...byRole(specs, ['bathroom']),
        ...byRole(specs, ['salon']),
        ...byRole(specs, ['garage']),
      ];

      // Balance empty wing gracefully when e.g. bedrooms === 0
      if (leftWing.length === 0) {
        return packThreeColumnWings(
          byRole(specs, ['kitchen', 'bathroom']),
          centerSpine,
          byRole(specs, ['salon', 'garage', 'balcony']),
          totalW,
          totalD
        );
      }
      return packThreeColumnWings(leftWing, centerSpine, rightWing, totalW, totalD);
    }
  );

  // ── Variant 3: Open Salon-Kitchen Living Concept + Rear/Side Balcony ──
  const variant3 = createVariant(
    2,
    'variant_open_salon_kitchen',
    'الاحتمال 3: مطبخ مفتوح على الصالة بقوس معماري',
    'الصالون والمطبخ في الأمام متصلان بقوس مفتوح لرحابة أكبر، مع غرف النوم والحمامات والشرفة في الجهة المقابلة.',
    'تصميم عصري مفتوح',
    [
      'قوس معماري (Arch) يربط الصالون والمطبخ لزيادة الإضاءة والاتساع',
      'المطبخ متموضع على الواجهة الأمامية أو الجانبية مع تهوية مباشرة',
      'الحمام والغرف معزولة خلف هول التوزيع الداخلي',
    ],
    true,
    (specs, totalW, totalD) => {
      const topRooms = [
        ...byRole(specs, ['balcony']),
        ...byRole(specs, ['bedroom']),
      ];
      const midRooms = [...byRole(specs, ['bathroom']), ...byRole(specs, ['hall'])];
      const frontOpenLiving = [
        ...byRole(specs, ['kitchen']),
        ...byRole(specs, ['salon']),
        ...byRole(specs, ['garage']),
      ];

      return packBandsIntoRectangle(
        [topRooms, midRooms, frontOpenLiving],
        [1.05, 0.8, 1.15],
        totalW,
        totalD,
        targetArea,
        specs.reduce((s, r) => s + r.weight, 0)
      );
    }
  );

  // ── Variant 4: Narrow Facade / Deep Plot Layout (Kitchen & Bath Side-by-Side Back/Mid) ──
  const variant4 = createVariant(
    3,
    'variant_narrow_deep_plot',
    'الاحتمال 4: مخطط طولي (للواجهات الضيقة والقطع المستطيلة)',
    'مناسب للأراضي ذات الواجهة المحدودة: صالون وكراج في المقدمة، ثم ممر يوزع لغرف النوم والمطبخ والشرفة الخلفية.',
    'للقطع الطولية',
    [
      'واجهة أمامية مستغلة بالكامل للصالون أو الكراج',
      'المطبخ والشرفة متلاصقان في الخلف (كور للتهوية والغسيل)',
      'توزيع متسلسل لغرف النوم والحمام على طول الممر الداخلي',
    ],
    false,
    (specs, totalW, totalD) => {
      const backService = [...byRole(specs, ['balcony']), ...byRole(specs, ['kitchen'])];
      const beds = byRole(specs, ['bedroom']);
      const halfBed = Math.ceil(beds.length / 2);
      const midRowA = [...beds.slice(0, halfBed), ...byRole(specs, ['bathroom'])];
      const midRowB = [...beds.slice(halfBed), ...byRole(specs, ['hall'])];
      const frontRow = [...byRole(specs, ['garage']), ...byRole(specs, ['salon'])];

      return packBandsIntoRectangle(
        [backService, midRowA, midRowB, frontRow],
        [0.95, 1.0, 0.95, 1.1],
        totalW,
        totalD,
        targetArea,
        specs.reduce((s, r) => s + r.weight, 0)
      );
    }
  );

  return [variant1, variant2, variant3, variant4];
}
