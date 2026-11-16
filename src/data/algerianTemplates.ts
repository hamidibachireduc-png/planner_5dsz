import {
  FloorPlanData,
  FurnitureItem,
  FurnitureType,
  Opening,
  Room,
  RoomFloorStyle,
  Wall,
} from '../types/planner';
import { FURNITURE_CATALOG, STARTER_TEMPLATES, StarterTemplate } from './catalog';

const CATALOG_MAP = new Map(FURNITURE_CATALOG.map((c) => [c.type, c]));

function makeFurn(
  id: string,
  type: FurnitureType,
  x: number,
  z: number,
  rotation = 0,
  overridePrimary?: string,
  overrideAccent?: string
): FurnitureItem {
  const def = CATALOG_MAP.get(type);
  if (!def) {
    return {
      id,
      type: 'sofa_3',
      name: 'كنبة ثلاثية فاخرة',
      category: 'living',
      x: Number(x.toFixed(2)),
      z: Number(z.toFixed(2)),
      rotation,
      width: 2.0,
      depth: 0.9,
      height: 0.8,
      primaryColor: '#D6CFC2',
      accentColor: '#6B4F3B',
    };
  }
  return {
    id,
    type: def.type,
    name: def.name,
    category: def.category,
    x: Number(x.toFixed(2)),
    z: Number(z.toFixed(2)),
    rotation,
    width: def.width,
    depth: def.depth,
    height: def.height,
    primaryColor: overridePrimary || def.defaultPrimary,
    accentColor: overrideAccent || def.defaultAccent,
  };
}

function mirrorPlan(plan: FloorPlanData, mx: boolean, mz: boolean): FloorPlanData {
  if (!mx && !mz) return plan;
  const sx = mx ? -1 : 1;
  const sz = mz ? -1 : 1;

  const rooms: Room[] = plan.rooms.map((r) => ({
    ...r,
    x: mx ? Number((-r.x - r.width).toFixed(2)) : r.x,
    z: mz ? Number((-r.z - r.depth).toFixed(2)) : r.z,
  }));

  const walls: Wall[] = plan.walls.map((w) => ({
    ...w,
    x1: Number((w.x1 * sx).toFixed(2)),
    z1: Number((w.z1 * sz).toFixed(2)),
    x2: Number((w.x2 * sx).toFixed(2)),
    z2: Number((w.z2 * sz).toFixed(2)),
  }));

  const openings: Opening[] = plan.openings.map((o) => ({
    ...o,
    swing: mx !== mz ? (o.swing === 'out' ? 'in' : 'out') : o.swing,
  }));

  const furniture: FurnitureItem[] = plan.furniture.map((f) => {
    let rot = f.rotation;
    if (mx) rot = -rot;
    if (mz) rot = Math.PI - rot;
    return {
      ...f,
      x: Number((f.x * sx).toFixed(2)),
      z: Number((f.z * sz).toFixed(2)),
      rotation: Number(rot.toFixed(4)),
    };
  });

  return { ...plan, rooms, walls, openings, furniture };
}

interface PaletteConfig {
  wallColor: string;
  salonFloor: RoomFloorStyle;
  livingFloor: RoomFloorStyle;
  bedFloor: RoomFloorStyle;
  kitchenFloor: RoomFloorStyle;
  bathFloor: RoomFloorStyle;
  terraceFloor: RoomFloorStyle;
  sedariPrimary: string;
  sedariAccent: string;
  sofaPrimary: string;
  kitchenPrimary: string;
}

const PALETTES: PaletteConfig[] = [
  {
    wallColor: '#F5F2EB',
    salonFloor: 'marble',
    livingFloor: 'oak',
    bedFloor: 'oak',
    kitchenFloor: 'tile',
    bathFloor: 'tile',
    terraceFloor: 'concrete',
    sedariPrimary: '#7C2D12',
    sedariAccent: '#D4AF37',
    sofaPrimary: '#D6CFC2',
    kitchenPrimary: '#3F4E4F',
  },
  {
    wallColor: '#EAE6DF',
    salonFloor: 'terrazzo',
    livingFloor: 'oak',
    bedFloor: 'carpet',
    kitchenFloor: 'terrazzo',
    bathFloor: 'marble',
    terraceFloor: 'concrete',
    sedariPrimary: '#1E3A8A',
    sedariAccent: '#D4AF37',
    sofaPrimary: '#475569',
    kitchenPrimary: '#8B623D',
  },
  {
    wallColor: '#F5F2EB',
    salonFloor: 'marble',
    livingFloor: 'walnut',
    bedFloor: 'walnut',
    kitchenFloor: 'tile',
    bathFloor: 'tile',
    terraceFloor: 'terrazzo',
    sedariPrimary: '#14532D',
    sedariAccent: '#D4AF37',
    sofaPrimary: '#5B7065',
    kitchenPrimary: '#5C4028',
  },
  {
    wallColor: '#E2E8F0',
    salonFloor: 'oak',
    livingFloor: 'oak',
    bedFloor: 'oak',
    kitchenFloor: 'tile',
    bathFloor: 'marble',
    terraceFloor: 'concrete',
    sedariPrimary: '#6E4B32',
    sedariAccent: '#EAE6DF',
    sofaPrimary: '#8B7E74',
    kitchenPrimary: '#334155',
  },
  {
    wallColor: '#D1D9CE',
    salonFloor: 'marble',
    livingFloor: 'terrazzo',
    bedFloor: 'carpet',
    kitchenFloor: 'tile',
    bathFloor: 'tile',
    terraceFloor: 'concrete',
    sedariPrimary: '#78350F',
    sedariAccent: '#D4AF37',
    sofaPrimary: '#C59B6D',
    kitchenPrimary: '#3F4E4F',
  },
];

// ── 12 Algerian Architectural Layout Builders ──────────────────────────────────

function buildAptF2(
  w: number,
  d: number,
  wh: number,
  p: PaletteConfig,
  useSedari: boolean
): FloorPlanData {
  const hw = w / 2;
  const hd = d / 2;
  const splitX = Number((-hw + w * 0.56).toFixed(2));
  const splitZ = Number((-hd + d * 0.48).toFixed(2));
  const bathW = Number((w - w * 0.56).toFixed(2));
  const leftW = Number((w * 0.56).toFixed(2));
  const topD = Number((d * 0.48).toFixed(2));
  const botD = Number((d - topD).toFixed(2));

  return {
    wallHeight: wh,
    unit: 'm',
    rooms: [
      { id: 'r1', name: 'بهو الاستقبال والصالون', x: -hw, z: -hd, width: leftW, depth: topD, floorStyle: p.salonFloor },
      { id: 'r2', name: 'المطبخ والشرفة', x: -hw, z: splitZ, width: leftW, depth: botD, floorStyle: p.kitchenFloor },
      { id: 'r3', name: 'غرفة النوم', x: splitX, z: -hd, width: bathW, depth: Number((d * 0.6).toFixed(2)), floorStyle: p.bedFloor },
      { id: 'r4', name: 'الحمام والوضوء', x: splitX, z: Number((-hd + d * 0.6).toFixed(2)), width: bathW, depth: Number((d * 0.4).toFixed(2)), floorStyle: p.bathFloor },
    ],
    walls: [
      { id: 'w1', x1: -hw, z1: -hd, x2: hw, z2: -hd, thickness: 0.18, height: wh, color: p.wallColor },
      { id: 'w2', x1: hw, z1: -hd, x2: hw, z2: hd, thickness: 0.18, height: wh, color: p.wallColor },
      { id: 'w3', x1: hw, z1: hd, x2: -hw, z2: hd, thickness: 0.18, height: wh, color: p.wallColor },
      { id: 'w4', x1: -hw, z1: hd, x2: -hw, z2: -hd, thickness: 0.18, height: wh, color: p.wallColor },
      { id: 'w5', x1: splitX, z1: -hd, x2: splitX, z2: hd, thickness: 0.14, height: wh, color: p.wallColor },
      { id: 'w6', x1: -hw, z1: splitZ, x2: splitX, z2: splitZ, thickness: 0.14, height: wh, color: p.wallColor },
      { id: 'w7', x1: splitX, z1: Number((-hd + d * 0.6).toFixed(2)), x2: hw, z2: Number((-hd + d * 0.6).toFixed(2)), thickness: 0.14, height: wh, color: p.wallColor },
    ],
    openings: [
      { id: 'o1', wallId: 'w1', type: 'window', offsetRatio: 0.28, width: 1.8, height: 1.45, sillHeight: 0.85 },
      { id: 'o2', wallId: 'w1', type: 'window', offsetRatio: 0.78, width: 1.5, height: 1.45, sillHeight: 0.85 },
      { id: 'o3', wallId: 'w4', type: 'door', offsetRatio: 0.25, width: 0.95, height: 2.15, sillHeight: 0, swing: 'in' },
      { id: 'o4', wallId: 'w6', type: 'door', offsetRatio: 0.72, width: 0.85, height: 2.1, sillHeight: 0, swing: 'in' },
      { id: 'o5', wallId: 'w5', type: 'door', offsetRatio: 0.28, width: 0.9, height: 2.1, sillHeight: 0, swing: 'in' },
      { id: 'o6', wallId: 'w5', type: 'door', offsetRatio: 0.76, width: 0.8, height: 2.1, sillHeight: 0, swing: 'in' },
    ],
    furniture: [
      makeFurn('f1', useSedari ? 'algerian_sedari' : 'sofa_3', -hw + leftW * 0.5, -hd + 0.65, 0, p.sedariPrimary, p.sedariAccent),
      makeFurn('f2', useSedari ? 'brass_tea_table' : 'coffee_table', -hw + leftW * 0.5, -hd + topD * 0.55, 0),
      makeFurn('f3', 'hallway_coat_bench', -hw + 0.35, -hd + topD * 0.72, Math.PI / 2),
      makeFurn('f4', 'privacy_partition', splitX - 0.3, -hd + topD * 0.75, Math.PI / 2),
      makeFurn('f5', 'kitchen_counter', -hw + leftW * 0.45, hd - 0.42, Math.PI, p.kitchenPrimary),
      makeFurn('f6', 'gas_oven_5burner', -hw + 0.58, splitZ + 0.5, Math.PI / 2),
      makeFurn('f7', 'fridge', splitX - 0.55, hd - 0.48, Math.PI),
      makeFurn('f8', 'bed_double', splitX + bathW * 0.52, -hd + 1.3, 0),
      makeFurn('f9', 'sliding_wardrobe_mirror', hw - 0.42, -hd + d * 0.42, -Math.PI / 2),
      makeFurn('f10', 'vanity', splitX + bathW * 0.45, hd - 0.38, Math.PI),
      makeFurn('f11', 'shower_cabin', hw - 0.6, Number((-hd + d * 0.6).toFixed(2)) + 0.6, 0),
      makeFurn('f12', 'toilet', splitX + 0.4, Number((-hd + d * 0.6).toFixed(2)) + 0.45, 0),
    ],
  };
}

function buildAptF3Privacy(
  w: number,
  d: number,
  wh: number,
  p: PaletteConfig,
  useSedari: boolean
): FloorPlanData {
  const hw = w / 2;
  const hd = d / 2;
  const col1 = Number((-hw + w * 0.42).toFixed(2));
  const col2 = Number((-hw + w * 0.72).toFixed(2));
  const rowZ = Number((-hd + d * 0.5).toFixed(2));
  const w1 = Number((w * 0.42).toFixed(2));
  const w2 = Number((w * 0.3).toFixed(2));
  const w3 = Number((w * 0.28).toFixed(2));
  const dTop = Number((d * 0.5).toFixed(2));
  const dBot = Number((d - dTop).toFixed(2));

  return {
    wallHeight: wh,
    unit: 'm',
    rooms: [
      { id: 'r1', name: 'صالون الضيافة المعزول', x: -hw, z: -hd, width: w1, depth: dTop, floorStyle: p.salonFloor },
      { id: 'r2', name: 'سقيفة المدخل والبهو', x: col1, z: -hd, width: w2, depth: dTop, floorStyle: p.livingFloor },
      { id: 'r3', name: 'المطبخ واللوجيا', x: col2, z: -hd, width: w3, depth: dTop, floorStyle: p.kitchenFloor },
      { id: 'r4', name: 'غرفة النوم الرئيسية', x: -hw, z: rowZ, width: w1, depth: dBot, floorStyle: p.bedFloor },
      { id: 'r5', name: 'غرفة الأبناء', x: col1, z: rowZ, width: w2, depth: dBot, floorStyle: p.bedFloor },
      { id: 'r6', name: 'الحمام ومغسل الوضوء', x: col2, z: rowZ, width: w3, depth: dBot, floorStyle: p.bathFloor },
    ],
    walls: [
      { id: 'w1', x1: -hw, z1: -hd, x2: hw, z2: -hd, thickness: 0.18, height: wh, color: p.wallColor },
      { id: 'w2', x1: hw, z1: -hd, x2: hw, z2: hd, thickness: 0.18, height: wh, color: p.wallColor },
      { id: 'w3', x1: hw, z1: hd, x2: -hw, z2: hd, thickness: 0.18, height: wh, color: p.wallColor },
      { id: 'w4', x1: -hw, z1: hd, x2: -hw, z2: -hd, thickness: 0.18, height: wh, color: p.wallColor },
      { id: 'w5', x1: col1, z1: -hd, x2: col1, z2: hd, thickness: 0.14, height: wh, color: p.wallColor },
      { id: 'w6', x1: col2, z1: -hd, x2: col2, z2: hd, thickness: 0.14, height: wh, color: p.wallColor },
      { id: 'w7', x1: -hw, z1: rowZ, x2: hw, z2: rowZ, thickness: 0.14, height: wh, color: p.wallColor },
    ],
    openings: [
      { id: 'o1', wallId: 'w1', type: 'window', offsetRatio: 0.2, width: 2.0, height: 1.5, sillHeight: 0.8 },
      { id: 'o2', wallId: 'w1', type: 'door', offsetRatio: 0.56, width: 1.0, height: 2.15, sillHeight: 0, swing: 'in' },
      { id: 'o3', wallId: 'w1', type: 'window', offsetRatio: 0.86, width: 1.4, height: 1.4, sillHeight: 0.9 },
      { id: 'o4', wallId: 'w3', type: 'window', offsetRatio: 0.22, width: 1.5, height: 1.45, sillHeight: 0.85 },
      { id: 'o5', wallId: 'w3', type: 'window', offsetRatio: 0.78, width: 1.6, height: 1.45, sillHeight: 0.85 },
      { id: 'o6', wallId: 'w5', type: 'door', offsetRatio: 0.25, width: 0.95, height: 2.15, sillHeight: 0, swing: 'in' },
      { id: 'o7', wallId: 'w6', type: 'door', offsetRatio: 0.26, width: 0.9, height: 2.15, sillHeight: 0, swing: 'in' },
      { id: 'o8', wallId: 'w6', type: 'door', offsetRatio: 0.74, width: 0.85, height: 2.1, sillHeight: 0, swing: 'in' },
      { id: 'o9', wallId: 'w7', type: 'door', offsetRatio: 0.24, width: 0.9, height: 2.1, sillHeight: 0, swing: 'in' },
      { id: 'o10', wallId: 'w7', type: 'door', offsetRatio: 0.56, width: 0.9, height: 2.1, sillHeight: 0, swing: 'in' },
    ],
    furniture: [
      makeFurn('f1', 'rug', -hw + w1 * 0.5, -hd + dTop * 0.52, 0),
      makeFurn('f2', useSedari ? 'algerian_sedari' : 'sofa_l', -hw + w1 * 0.5, -hd + 0.65, 0, p.sedariPrimary, p.sedariAccent),
      makeFurn('f3', useSedari ? 'brass_tea_table' : 'coffee_table', -hw + w1 * 0.5, -hd + dTop * 0.55, 0),
      makeFurn('f4', 'hallway_coat_bench', col1 + 0.72, -hd + 0.4, 0),
      makeFurn('f5', 'privacy_partition', col1 + w2 * 0.5, rowZ - 0.45, 0),
      makeFurn('f6', 'gas_heater_algerian', col1 + w2 - 0.25, -hd + dTop * 0.5, -Math.PI / 2),
      makeFurn('f7', 'kitchen_counter', hw - 1.25, -hd + 0.45, 0, p.kitchenPrimary),
      makeFurn('f8', 'freezer_chest', hw - 0.45, rowZ - 0.85, -Math.PI / 2),
      makeFurn('f9', 'gas_oven_5burner', col2 + 0.52, rowZ - 0.55, Math.PI),
      makeFurn('f10', 'bed_double', -hw + w1 * 0.46, hd - 1.25, Math.PI),
      makeFurn('f11', 'prayer_corner', -hw + 0.8, rowZ + 0.75, 0),
      makeFurn('f12', 'sliding_wardrobe_mirror', col1 - 0.45, rowZ + dBot * 0.45, -Math.PI / 2),
      makeFurn('f13', 'bed_single', col1 + w2 * 0.5, hd - 1.2, Math.PI),
      makeFurn('f14', 'ablution_station', hw - 0.45, rowZ + 0.75, -Math.PI / 2),
      makeFurn('f15', 'vanity', col2 + 0.65, hd - 0.4, Math.PI),
      makeFurn('f16', 'washer', hw - 0.45, hd - 0.45, Math.PI),
    ],
  };
}

function buildAptF4Split(
  w: number,
  d: number,
  wh: number,
  p: PaletteConfig,
  useSedari: boolean
): FloorPlanData {
  const hw = w / 2;
  const hd = d / 2;
  const col1 = Number((-hw + w * 0.38).toFixed(2));
  const col2 = Number((-hw + w * 0.68).toFixed(2));
  const rowZ = Number((-hd + d * 0.5).toFixed(2));
  const w1 = Number((w * 0.38).toFixed(2));
  const w2 = Number((w * 0.3).toFixed(2));
  const w3 = Number((w * 0.32).toFixed(2));
  const dTop = Number((d * 0.5).toFixed(2));
  const dBot = Number((d - dTop).toFixed(2));

  return {
    wallHeight: wh,
    unit: 'm',
    rooms: [
      { id: 'r1', name: 'صالون الضيوف والمجلس', x: -hw, z: -hd, width: w1, depth: dTop, floorStyle: p.salonFloor },
      { id: 'r2', name: 'المطبخ وغرفة الأكل', x: col1, z: -hd, width: w2, depth: dTop, floorStyle: p.kitchenFloor },
      { id: 'r3', name: 'جناح الوالدين', x: col2, z: -hd, width: w3, depth: dTop, floorStyle: p.bedFloor },
      { id: 'r4', name: 'غرفة البنات', x: -hw, z: rowZ, width: w1, depth: dBot, floorStyle: p.bedFloor },
      { id: 'r5', name: 'غرفة الأولاد', x: col1, z: rowZ, width: w2, depth: dBot, floorStyle: p.bedFloor },
      { id: 'r6', name: 'الحمام ومغسل الوضوء', x: col2, z: rowZ, width: w3, depth: dBot, floorStyle: p.bathFloor },
    ],
    walls: [
      { id: 'w1', x1: -hw, z1: -hd, x2: hw, z2: -hd, thickness: 0.18, height: wh, color: p.wallColor },
      { id: 'w2', x1: hw, z1: -hd, x2: hw, z2: hd, thickness: 0.18, height: wh, color: p.wallColor },
      { id: 'w3', x1: hw, z1: hd, x2: -hw, z2: hd, thickness: 0.18, height: wh, color: p.wallColor },
      { id: 'w4', x1: -hw, z1: hd, x2: -hw, z2: -hd, thickness: 0.18, height: wh, color: p.wallColor },
      { id: 'w5', x1: col1, z1: -hd, x2: col1, z2: hd, thickness: 0.14, height: wh, color: p.wallColor },
      { id: 'w6', x1: col2, z1: -hd, x2: col2, z2: hd, thickness: 0.14, height: wh, color: p.wallColor },
      { id: 'w7', x1: -hw, z1: rowZ, x2: hw, z2: rowZ, thickness: 0.14, height: wh, color: p.wallColor },
    ],
    openings: [
      { id: 'o1', wallId: 'w1', type: 'window', offsetRatio: 0.2, width: 2.2, height: 1.55, sillHeight: 0.8 },
      { id: 'o2', wallId: 'w1', type: 'window', offsetRatio: 0.54, width: 1.5, height: 1.4, sillHeight: 0.9 },
      { id: 'o3', wallId: 'w1', type: 'window', offsetRatio: 0.84, width: 1.7, height: 1.5, sillHeight: 0.8 },
      { id: 'o4', wallId: 'w3', type: 'window', offsetRatio: 0.2, width: 1.6, height: 1.5, sillHeight: 0.85 },
      { id: 'o5', wallId: 'w3', type: 'window', offsetRatio: 0.55, width: 1.6, height: 1.5, sillHeight: 0.85 },
      { id: 'o6', wallId: 'w4', type: 'door', offsetRatio: 0.24, width: 1.0, height: 2.15, sillHeight: 0, swing: 'in' },
      { id: 'o7', wallId: 'w5', type: 'arch', offsetRatio: 0.5, width: 1.6, height: 2.35, sillHeight: 0 },
      { id: 'o8', wallId: 'w6', type: 'door', offsetRatio: 0.25, width: 0.9, height: 2.15, sillHeight: 0, swing: 'in' },
      { id: 'o9', wallId: 'w6', type: 'door', offsetRatio: 0.75, width: 0.85, height: 2.1, sillHeight: 0, swing: 'in' },
      { id: 'o10', wallId: 'w7', type: 'door', offsetRatio: 0.2, width: 0.9, height: 2.1, sillHeight: 0, swing: 'in' },
      { id: 'o11', wallId: 'w7', type: 'door', offsetRatio: 0.54, width: 0.9, height: 2.1, sillHeight: 0, swing: 'in' },
    ],
    furniture: [
      makeFurn('f1', 'rug', -hw + w1 * 0.5, -hd + dTop * 0.5, 0),
      makeFurn('f2', useSedari ? 'algerian_sedari' : 'sofa_l', -hw + w1 * 0.5, -hd + 0.65, 0, p.sedariPrimary, p.sedariAccent),
      makeFurn('f3', useSedari ? 'brass_tea_table' : 'coffee_table', -hw + w1 * 0.5, -hd + dTop * 0.55, 0),
      makeFurn('f4', 'privacy_partition', col1 - 0.25, -hd + dTop * 0.72, Math.PI / 2),
      makeFurn('f5', 'hallway_coat_bench', -hw + 0.38, rowZ - 0.9, Math.PI / 2),
      makeFurn('f6', 'couscous_prep_counter', col1 + w2 * 0.5, -hd + 0.5, 0, p.kitchenPrimary),
      makeFurn('f7', 'freezer_chest', col2 - 0.52, -hd + dTop * 0.65, -Math.PI / 2),
      makeFurn('f8', 'gas_oven_5burner', col1 + 0.52, rowZ - 0.55, Math.PI),
      makeFurn('f9', 'bed_double', col2 + w3 * 0.5, -hd + 1.3, 0),
      makeFurn('f10', 'prayer_corner', col2 + 0.72, rowZ - 0.65, 0),
      makeFurn('f11', 'sliding_wardrobe_mirror', hw - 0.42, -hd + dTop * 0.55, -Math.PI / 2),
      makeFurn('f12', 'bunk_bed', -hw + 0.85, hd - 1.3, Math.PI / 2),
      makeFurn('f13', 'underbed_storage_bed', col1 + w2 * 0.5, hd - 1.25, Math.PI),
      makeFurn('f14', 'double_vanity', col2 + w3 * 0.48, rowZ + 0.4, 0),
      makeFurn('f15', 'ablution_station', hw - 0.45, hd - 0.65, -Math.PI / 2),
      makeFurn('f16', 'washer', col2 + 0.5, hd - 0.5, Math.PI),
    ],
  };
}

function buildAptF5Grand(
  w: number,
  d: number,
  wh: number,
  p: PaletteConfig,
  useSedari: boolean
): FloorPlanData {
  const hw = w / 2;
  const hd = d / 2;
  const col1 = Number((-hw + w * 0.34).toFixed(2));
  const col2 = Number((-hw + w * 0.66).toFixed(2));
  const rowZ = Number((-hd + d * 0.5).toFixed(2));
  const w1 = Number((w * 0.34).toFixed(2));
  const w2 = Number((w * 0.32).toFixed(2));
  const w3 = Number((w * 0.34).toFixed(2));
  const dTop = Number((d * 0.5).toFixed(2));
  const dBot = Number((d - dTop).toFixed(2));
  const bathSplitZ = Number((rowZ + dBot * 0.52).toFixed(2));

  return {
    wallHeight: wh,
    unit: 'm',
    rooms: [
      { id: 'r1', name: 'مجلس الضيوف الكبير', x: -hw, z: -hd, width: w1, depth: dTop, floorStyle: p.salonFloor },
      { id: 'r2', name: 'المطبخ وقاعة الأكل', x: col1, z: -hd, width: w2, depth: dTop, floorStyle: p.kitchenFloor },
      { id: 'r3', name: 'غرفة الجلوس العائلية', x: col2, z: -hd, width: w3, depth: dTop, floorStyle: p.livingFloor },
      { id: 'r4', name: 'الجناح الرئيسي والعبادة', x: -hw, z: rowZ, width: w1, depth: dBot, floorStyle: p.bedFloor },
      { id: 'r5', name: 'غرفة نوم الأبناء 1', x: col1, z: rowZ, width: w2, depth: dBot, floorStyle: p.bedFloor },
      { id: 'r6', name: 'غرفة نوم الأبناء 2', x: col2, z: rowZ, width: w3, depth: Number((dBot * 0.52).toFixed(2)), floorStyle: p.bedFloor },
      { id: 'r7', name: 'الحمام التقليدي والغسيل', x: col2, z: bathSplitZ, width: w3, depth: Number((dBot * 0.48).toFixed(2)), floorStyle: p.bathFloor },
    ],
    walls: [
      { id: 'w1', x1: -hw, z1: -hd, x2: hw, z2: -hd, thickness: 0.18, height: wh, color: p.wallColor },
      { id: 'w2', x1: hw, z1: -hd, x2: hw, z2: hd, thickness: 0.18, height: wh, color: p.wallColor },
      { id: 'w3', x1: hw, z1: hd, x2: -hw, z2: hd, thickness: 0.18, height: wh, color: p.wallColor },
      { id: 'w4', x1: -hw, z1: hd, x2: -hw, z2: -hd, thickness: 0.18, height: wh, color: p.wallColor },
      { id: 'w5', x1: col1, z1: -hd, x2: col1, z2: hd, thickness: 0.14, height: wh, color: p.wallColor },
      { id: 'w6', x1: col2, z1: -hd, x2: col2, z2: hd, thickness: 0.14, height: wh, color: p.wallColor },
      { id: 'w7', x1: -hw, z1: rowZ, x2: hw, z2: rowZ, thickness: 0.14, height: wh, color: p.wallColor },
      { id: 'w8', x1: col2, z1: bathSplitZ, x2: hw, z2: bathSplitZ, thickness: 0.14, height: wh, color: p.wallColor },
    ],
    openings: [
      { id: 'o1', wallId: 'w1', type: 'window', offsetRatio: 0.18, width: 2.3, height: 1.6, sillHeight: 0.75 },
      { id: 'o2', wallId: 'w1', type: 'window', offsetRatio: 0.5, width: 1.6, height: 1.5, sillHeight: 0.85 },
      { id: 'o3', wallId: 'w1', type: 'window', offsetRatio: 0.84, width: 2.0, height: 1.6, sillHeight: 0.75 },
      { id: 'o4', wallId: 'w3', type: 'window', offsetRatio: 0.18, width: 1.6, height: 1.5, sillHeight: 0.85 },
      { id: 'o5', wallId: 'w3', type: 'window', offsetRatio: 0.5, width: 1.6, height: 1.5, sillHeight: 0.85 },
      { id: 'o6', wallId: 'w4', type: 'door', offsetRatio: 0.25, width: 1.05, height: 2.2, sillHeight: 0, swing: 'in' },
      { id: 'o7', wallId: 'w5', type: 'door', offsetRatio: 0.25, width: 1.0, height: 2.15, sillHeight: 0, swing: 'in' },
      { id: 'o8', wallId: 'w6', type: 'arch', offsetRatio: 0.25, width: 1.6, height: 2.35, sillHeight: 0 },
      { id: 'o9', wallId: 'w7', type: 'door', offsetRatio: 0.2, width: 0.9, height: 2.15, sillHeight: 0, swing: 'in' },
      { id: 'o10', wallId: 'w7', type: 'door', offsetRatio: 0.5, width: 0.9, height: 2.15, sillHeight: 0, swing: 'in' },
      { id: 'o11', wallId: 'w7', type: 'door', offsetRatio: 0.82, width: 0.9, height: 2.15, sillHeight: 0, swing: 'in' },
      { id: 'o12', wallId: 'w6', type: 'door', offsetRatio: 0.86, width: 0.85, height: 2.1, sillHeight: 0, swing: 'in' },
    ],
    furniture: [
      makeFurn('f1', useSedari ? 'algerian_sedari' : 'sofa_l', -hw + w1 * 0.5, -hd + 0.65, 0, p.sedariPrimary, p.sedariAccent),
      makeFurn('f2', 'brass_tea_table', -hw + w1 * 0.5, -hd + dTop * 0.52, 0),
      makeFurn('f3', 'privacy_partition', col1 - 0.25, -hd + dTop * 0.72, Math.PI / 2),
      makeFurn('f4', 'hallway_coat_bench', -hw + 0.38, rowZ - 0.9, Math.PI / 2),
      makeFurn('f5', 'kitchen_counter', col1 + w2 * 0.45, -hd + 0.45, 0, p.kitchenPrimary),
      makeFurn('f6', 'dining_set', col1 + w2 * 0.5, -hd + dTop * 0.62, 0),
      makeFurn('f7', 'freezer_chest', col2 - 0.45, -hd + dTop * 0.52, -Math.PI / 2),
      makeFurn('f8', 'sofa_3', col2 + w3 * 0.5, -hd + 0.75, 0, p.sofaPrimary),
      makeFurn('f9', 'smart_tv_wall', hw - 0.2, -hd + dTop * 0.55, -Math.PI / 2),
      makeFurn('f10', 'gas_heater_algerian', col2 + 0.35, -hd + dTop * 0.75, Math.PI / 2),
      makeFurn('f11', 'bed_double', -hw + w1 * 0.5, hd - 1.3, Math.PI),
      makeFurn('f12', 'prayer_corner', -hw + 0.75, rowZ + 0.75, 0),
      makeFurn('f13', 'underbed_storage_bed', col1 + w2 * 0.5, hd - 1.25, Math.PI),
      makeFurn('f14', 'sliding_wardrobe_mirror', col2 - 0.42, rowZ + dBot * 0.45, -Math.PI / 2),
      makeFurn('f15', 'bed_single', col2 + w3 * 0.52, rowZ + dBot * 0.26, Math.PI / 2),
      makeFurn('f16', 'turkish_hammam_bench', hw - 0.95, hd - 0.65, 0),
      makeFurn('f17', 'ablution_station', col2 + 0.55, bathSplitZ + 0.55, 0),
    ],
  };
}

function buildVillaRdcIndividual(
  w: number,
  d: number,
  wh: number,
  p: PaletteConfig,
  useSedari: boolean
): FloorPlanData {
  const hw = w / 2;
  const hd = d / 2;
  const col1 = Number((-hw + w * 0.35).toFixed(2));
  const col2 = Number((-hw + w * 0.7).toFixed(2));
  const rowZ = Number((-hd + d * 0.46).toFixed(2));
  const w1 = Number((w * 0.35).toFixed(2));
  const w2 = Number((w * 0.35).toFixed(2));
  const w3 = Number((w * 0.3).toFixed(2));
  const dTop = Number((d * 0.46).toFixed(2));
  const dBot = Number((d - dTop).toFixed(2));

  return {
    wallHeight: wh,
    unit: 'm',
    rooms: [
      { id: 'r1', name: 'مجلس الضيوف والسترة', x: -hw, z: -hd, width: w1, depth: dTop, floorStyle: p.salonFloor },
      { id: 'r2', name: 'وسط الدار العائلي المسقوف', x: col1, z: -hd, width: w2, depth: dTop, floorStyle: p.livingFloor },
      { id: 'r3', name: 'المطبخ التقليدي والمؤن', x: col2, z: -hd, width: w3, depth: dTop, floorStyle: p.kitchenFloor },
      { id: 'r4', name: 'غرفة النوم الرئيسية', x: -hw, z: rowZ, width: w1, depth: dBot, floorStyle: p.bedFloor },
      { id: 'r5', name: 'غرفة الأبناء الواسعة', x: col1, z: rowZ, width: w2, depth: dBot, floorStyle: p.bedFloor },
      { id: 'r6', name: 'الحمام التقليدي والغسيل', x: col2, z: rowZ, width: w3, depth: dBot, floorStyle: p.bathFloor },
    ],
    walls: [
      { id: 'w1', x1: -hw, z1: -hd, x2: hw, z2: -hd, thickness: 0.22, height: wh, color: p.wallColor },
      { id: 'w2', x1: hw, z1: -hd, x2: hw, z2: hd, thickness: 0.22, height: wh, color: p.wallColor },
      { id: 'w3', x1: hw, z1: hd, x2: -hw, z2: hd, thickness: 0.22, height: wh, color: p.wallColor },
      { id: 'w4', x1: -hw, z1: hd, x2: -hw, z2: -hd, thickness: 0.22, height: wh, color: p.wallColor },
      { id: 'w5', x1: col1, z1: -hd, x2: col1, z2: hd, thickness: 0.16, height: wh, color: p.wallColor },
      { id: 'w6', x1: col2, z1: -hd, x2: col2, z2: hd, thickness: 0.16, height: wh, color: p.wallColor },
      { id: 'w7', x1: -hw, z1: rowZ, x2: hw, z2: rowZ, thickness: 0.16, height: wh, color: p.wallColor },
    ],
    openings: [
      { id: 'o1', wallId: 'w1', type: 'window', offsetRatio: 0.18, width: 2.2, height: 1.7, sillHeight: 0.7 },
      { id: 'o2', wallId: 'w1', type: 'door', offsetRatio: 0.52, width: 1.2, height: 2.3, sillHeight: 0, swing: 'in' },
      { id: 'o3', wallId: 'w1', type: 'window', offsetRatio: 0.85, width: 1.6, height: 1.5, sillHeight: 0.85 },
      { id: 'o4', wallId: 'w3', type: 'window', offsetRatio: 0.2, width: 1.8, height: 1.6, sillHeight: 0.8 },
      { id: 'o5', wallId: 'w3', type: 'window', offsetRatio: 0.52, width: 1.8, height: 1.6, sillHeight: 0.8 },
      { id: 'o6', wallId: 'w5', type: 'door', offsetRatio: 0.22, width: 1.0, height: 2.2, sillHeight: 0, swing: 'in' },
      { id: 'o7', wallId: 'w6', type: 'arch', offsetRatio: 0.25, width: 1.8, height: 2.5, sillHeight: 0 },
      { id: 'o8', wallId: 'w7', type: 'door', offsetRatio: 0.22, width: 0.95, height: 2.15, sillHeight: 0, swing: 'in' },
      { id: 'o9', wallId: 'w7', type: 'door', offsetRatio: 0.52, width: 0.95, height: 2.15, sillHeight: 0, swing: 'in' },
      { id: 'o10', wallId: 'w6', type: 'door', offsetRatio: 0.75, width: 0.85, height: 2.15, sillHeight: 0, swing: 'in' },
    ],
    furniture: [
      makeFurn('f1', useSedari ? 'algerian_sedari' : 'sofa_l', -hw + w1 * 0.5, -hd + 0.65, 0, p.sedariPrimary, p.sedariAccent),
      makeFurn('f2', 'brass_tea_table', -hw + w1 * 0.5, -hd + dTop * 0.52, 0),
      makeFurn('f3', 'privacy_partition', col1 + 0.35, -hd + dTop * 0.55, Math.PI / 2),
      makeFurn('f4', 'hallway_coat_bench', col1 + w2 * 0.55, -hd + 0.45, 0),
      makeFurn('f5', 'sofa_3', col1 + w2 * 0.5, rowZ - 0.8, Math.PI, p.sofaPrimary),
      makeFurn('f6', 'couscous_prep_counter', hw - 1.1, -hd + 0.5, 0, p.kitchenPrimary),
      makeFurn('f7', 'gas_oven_5burner', col2 + 0.55, rowZ - 0.6, Math.PI),
      makeFurn('f8', 'freezer_chest', hw - 0.5, rowZ - 0.85, -Math.PI / 2),
      makeFurn('f9', 'bed_double', -hw + w1 * 0.5, hd - 1.3, Math.PI),
      makeFurn('f10', 'prayer_corner', -hw + 0.75, rowZ + 0.75, 0),
      makeFurn('f11', 'sliding_wardrobe_mirror', col1 - 0.42, rowZ + dBot * 0.5, -Math.PI / 2),
      makeFurn('f12', 'bunk_bed', col1 + 0.8, hd - 1.3, Math.PI / 2),
      makeFurn('f13', 'underbed_storage_bed', col2 - 1.1, hd - 1.25, Math.PI),
      makeFurn('f14', 'turkish_hammam_bench', hw - 0.95, hd - 0.65, 0),
      makeFurn('f15', 'ablution_station', col2 + 0.55, rowZ + 0.65, 0),
      makeFurn('f16', 'water_tank_pump', hw - 0.65, rowZ + 0.75, 0),
    ],
  };
}

function buildVillaCourtyardDar(
  w: number,
  d: number,
  wh: number,
  p: PaletteConfig,
  useSedari: boolean
): FloorPlanData {
  const hw = w / 2;
  const hd = d / 2;
  const col1 = Number((-hw + w * 0.3).toFixed(2));
  const col2 = Number((-hw + w * 0.7).toFixed(2));
  const rowZ = Number((-hd + d * 0.48).toFixed(2));
  const wSide = Number((w * 0.3).toFixed(2));
  const wMid = Number((w * 0.4).toFixed(2));
  const dTop = Number((d * 0.48).toFixed(2));
  const dBot = Number((d - dTop).toFixed(2));

  return {
    wallHeight: wh,
    unit: 'm',
    rooms: [
      { id: 'r1', name: 'مجلس الضيافة الأندلسي', x: -hw, z: -hd, width: Number((w * 0.55).toFixed(2)), depth: dTop, floorStyle: p.salonFloor },
      { id: 'r2', name: 'المطبخ التقليدي وقاعة الأكل', x: Number((-hw + w * 0.55).toFixed(2)), z: -hd, width: Number((w * 0.45).toFixed(2)), depth: dTop, floorStyle: p.kitchenFloor },
      { id: 'r3', name: 'جناح النوم الرئيسي', x: -hw, z: rowZ, width: wSide, depth: dBot, floorStyle: p.bedFloor },
      { id: 'r4', name: 'وسط الدار والنافورة (الحوش)', x: col1, z: rowZ, width: wMid, depth: dBot, floorStyle: p.terraceFloor },
      { id: 'r5', name: 'الحمام التقليدي والضيوف', x: col2, z: rowZ, width: wSide, depth: dBot, floorStyle: p.bathFloor },
    ],
    walls: [
      { id: 'w1', x1: -hw, z1: -hd, x2: hw, z2: -hd, thickness: 0.22, height: wh, color: p.wallColor },
      { id: 'w2', x1: hw, z1: -hd, x2: hw, z2: hd, thickness: 0.22, height: wh, color: p.wallColor },
      { id: 'w3', x1: hw, z1: hd, x2: col2, z2: hd, thickness: 0.22, height: wh, color: p.wallColor },
      { id: 'w4', x1: col1, z1: hd, x2: -hw, z2: hd, thickness: 0.22, height: wh, color: p.wallColor },
      { id: 'w5', x1: -hw, z1: hd, x2: -hw, z2: -hd, thickness: 0.22, height: wh, color: p.wallColor },
      { id: 'w6', x1: Number((-hw + w * 0.55).toFixed(2)), z1: -hd, x2: Number((-hw + w * 0.55).toFixed(2)), z2: rowZ, thickness: 0.16, height: wh, color: p.wallColor },
      { id: 'w7', x1: -hw, z1: rowZ, x2: hw, z2: rowZ, thickness: 0.16, height: wh, color: p.wallColor },
      { id: 'w8', x1: col1, z1: rowZ, x2: col1, z2: hd, thickness: 0.16, height: wh, color: p.wallColor },
      { id: 'w9', x1: col2, z1: rowZ, x2: col2, z2: hd, thickness: 0.16, height: wh, color: p.wallColor },
    ],
    openings: [
      { id: 'o1', wallId: 'w1', type: 'window', offsetRatio: 0.25, width: 2.5, height: 1.8, sillHeight: 0.65 },
      { id: 'o2', wallId: 'w1', type: 'window', offsetRatio: 0.78, width: 2.0, height: 1.7, sillHeight: 0.7 },
      { id: 'o3', wallId: 'w5', type: 'door', offsetRatio: 0.22, width: 1.2, height: 2.35, sillHeight: 0, swing: 'in' },
      { id: 'o4', wallId: 'w6', type: 'arch', offsetRatio: 0.5, width: 2.0, height: 2.5, sillHeight: 0 },
      { id: 'o5', wallId: 'w7', type: 'door', offsetRatio: 0.16, width: 0.95, height: 2.2, sillHeight: 0, swing: 'in' },
      { id: 'o6', wallId: 'w7', type: 'arch', offsetRatio: 0.5, width: 2.2, height: 2.5, sillHeight: 0 },
      { id: 'o7', wallId: 'w7', type: 'door', offsetRatio: 0.84, width: 0.9, height: 2.2, sillHeight: 0, swing: 'in' },
    ],
    furniture: [
      makeFurn('f1', 'rug', -hw + w * 0.28, -hd + dTop * 0.5, 0),
      makeFurn('f2', useSedari ? 'algerian_sedari' : 'sofa_l', -hw + w * 0.28, -hd + 0.75, 0, p.sedariPrimary, p.sedariAccent),
      makeFurn('f3', 'brass_tea_table', -hw + w * 0.28, -hd + dTop * 0.52, 0),
      makeFurn('f4', 'privacy_partition', -hw + w * 0.52, -hd + dTop * 0.75, Math.PI / 2),
      makeFurn('f5', 'couscous_prep_counter', hw - 1.3, -hd + 0.55, 0, p.kitchenPrimary),
      makeFurn('f6', 'dining_set', -hw + w * 0.75, -hd + dTop * 0.6, 0),
      makeFurn('f7', 'gas_oven_5burner', hw - 0.65, rowZ - 0.65, -Math.PI / 2),
      makeFurn('f8', 'courtyard_fountain', 0, rowZ + dBot * 0.48, 0),
      makeFurn('f9', 'plant_olive', col1 + 0.6, hd - 0.7, 0),
      makeFurn('f10', 'outdoor_lounge', col2 - 1.25, rowZ + 1.0, Math.PI),
      makeFurn('f11', 'bed_double', -hw + wSide * 0.5, hd - 1.3, Math.PI),
      makeFurn('f12', 'prayer_corner', -hw + 0.75, rowZ + 0.75, 0),
      makeFurn('f13', 'turkish_hammam_bench', hw - 0.95, hd - 0.65, 0),
      makeFurn('f14', 'ablution_station', col2 + 0.55, rowZ + 0.65, 0),
      makeFurn('f15', 'water_tank_pump', hw - 0.65, rowZ + 0.75, 0),
    ],
  };
}

function buildVillaCornerGarden(
  w: number,
  d: number,
  wh: number,
  p: PaletteConfig,
  useSedari: boolean
): FloorPlanData {
  const hw = w / 2;
  const hd = d / 2;
  const col1 = Number((-hw + w * 0.36).toFixed(2));
  const col2 = Number((-hw + w * 0.7).toFixed(2));
  const rowZ = Number((-hd + d * 0.45).toFixed(2));
  const rowZ2 = Number((rowZ + (hd - rowZ) * 0.55).toFixed(2));
  const w1 = Number((w * 0.36).toFixed(2));
  const w2 = Number((w * 0.34).toFixed(2));
  const w3 = Number((w * 0.3).toFixed(2));
  const dTop = Number((d * 0.45).toFixed(2));
  const dBot = Number((d - dTop).toFixed(2));

  return {
    wallHeight: wh,
    unit: 'm',
    rooms: [
      { id: 'r1', name: 'مجلس الضيافة الواسع', x: -hw, z: -hd, width: w1, depth: dTop, floorStyle: p.salonFloor },
      { id: 'r2', name: 'قاعة الطعام والبوفيه', x: col1, z: -hd, width: w2, depth: dTop, floorStyle: p.livingFloor },
      { id: 'r3', name: 'المطبخ العصري والمخزن', x: col2, z: -hd, width: w3, depth: dTop, floorStyle: p.kitchenFloor },
      { id: 'r4', name: 'الجناح الملكي', x: -hw, z: rowZ, width: w1, depth: Number((rowZ2 - rowZ).toFixed(2)), floorStyle: p.bedFloor },
      { id: 'r5', name: 'غرفة الأبناء', x: -hw, z: rowZ2, width: w1, depth: Number((hd - rowZ2).toFixed(2)), floorStyle: p.bedFloor },
      { id: 'r6', name: 'الحديقة والشواية', x: col1, z: rowZ, width: w2, depth: dBot, floorStyle: p.terraceFloor },
      { id: 'r7', name: 'الحمام الملكي والوضوء', x: col2, z: rowZ, width: w3, depth: dBot, floorStyle: p.bathFloor },
    ],
    walls: [
      { id: 'w1', x1: -hw, z1: -hd, x2: hw, z2: -hd, thickness: 0.22, height: wh, color: p.wallColor },
      { id: 'w2', x1: hw, z1: -hd, x2: hw, z2: hd, thickness: 0.22, height: wh, color: p.wallColor },
      { id: 'w3', x1: hw, z1: hd, x2: col2, z2: hd, thickness: 0.22, height: wh, color: p.wallColor },
      { id: 'w4', x1: col1, z1: hd, x2: -hw, z2: hd, thickness: 0.22, height: wh, color: p.wallColor },
      { id: 'w5', x1: -hw, z1: hd, x2: -hw, z2: -hd, thickness: 0.22, height: wh, color: p.wallColor },
      { id: 'w6', x1: col1, z1: -hd, x2: col1, z2: hd, thickness: 0.16, height: wh, color: p.wallColor },
      { id: 'w7', x1: col2, z1: -hd, x2: col2, z2: hd, thickness: 0.16, height: wh, color: p.wallColor },
      { id: 'w8', x1: -hw, z1: rowZ, x2: hw, z2: rowZ, thickness: 0.16, height: wh, color: p.wallColor },
      { id: 'w9', x1: -hw, z1: rowZ2, x2: col1, z2: rowZ2, thickness: 0.14, height: wh, color: p.wallColor },
    ],
    openings: [
      { id: 'o1', wallId: 'w1', type: 'window', offsetRatio: 0.2, width: 2.5, height: 1.9, sillHeight: 0.6 },
      { id: 'o2', wallId: 'w1', type: 'window', offsetRatio: 0.54, width: 2.0, height: 1.9, sillHeight: 0.6 },
      { id: 'o3', wallId: 'w5', type: 'door', offsetRatio: 0.2, width: 1.2, height: 2.35, sillHeight: 0, swing: 'in' },
      { id: 'o4', wallId: 'w6', type: 'arch', offsetRatio: 0.25, width: 2.0, height: 2.5, sillHeight: 0 },
      { id: 'o5', wallId: 'w7', type: 'arch', offsetRatio: 0.22, width: 1.6, height: 2.4, sillHeight: 0 },
      { id: 'o6', wallId: 'w7', type: 'door', offsetRatio: 0.72, width: 0.9, height: 2.2, sillHeight: 0, swing: 'in' },
      { id: 'o7', wallId: 'w8', type: 'door', offsetRatio: 0.2, width: 0.95, height: 2.2, sillHeight: 0, swing: 'in' },
      { id: 'o8', wallId: 'w8', type: 'window', offsetRatio: 0.55, width: 2.6, height: 2.1, sillHeight: 0.25 },
      { id: 'o9', wallId: 'w9', type: 'door', offsetRatio: 0.5, width: 0.9, height: 2.15, sillHeight: 0, swing: 'in' },
    ],
    furniture: [
      makeFurn('f1', useSedari ? 'algerian_sedari' : 'sofa_l', -hw + w1 * 0.5, -hd + 0.75, 0, p.sedariPrimary, p.sedariAccent),
      makeFurn('f2', 'brass_tea_table', -hw + w1 * 0.5, -hd + dTop * 0.52, 0),
      makeFurn('f3', 'privacy_partition', col1 - 0.25, -hd + dTop * 0.7, Math.PI / 2),
      makeFurn('f4', 'meeting_table', col1 + w2 * 0.5, -hd + dTop * 0.52, Math.PI / 2),
      makeFurn('f5', 'buffet_sideboard', col1 + w2 * 0.5, -hd + 0.45, 0),
      makeFurn('f6', 'couscous_prep_counter', hw - 1.15, -hd + 0.5, 0, p.kitchenPrimary),
      makeFurn('f7', 'gas_oven_5burner', hw - 0.55, rowZ - 0.65, -Math.PI / 2),
      makeFurn('f8', 'bed_double', -hw + w1 * 0.4, rowZ + 1.4, Math.PI / 2),
      makeFurn('f9', 'walk_in_closet', col1 - 1.2, rowZ + 0.95, 0),
      makeFurn('f10', 'bunk_bed', -hw + 0.85, hd - 1.25, Math.PI / 2),
      makeFurn('f11', 'courtyard_fountain', col1 + w2 * 0.5, rowZ + dBot * 0.52, 0),
      makeFurn('f12', 'outdoor_bbq_grill', col2 - 0.65, hd - 0.9, -Math.PI / 2),
      makeFurn('f13', 'pergola_swing', col1 + w2 * 0.48, rowZ + 1.0, 0),
      makeFurn('f14', 'turkish_hammam_bench', hw - 0.95, hd - 0.65, 0),
      makeFurn('f15', 'double_vanity', col2 + w3 * 0.5, rowZ + 0.42, 0),
      makeFurn('f16', 'water_tank_pump', hw - 0.65, rowZ + 1.5, 0),
    ],
  };
}

function buildDuplexTownhouse(
  w: number,
  d: number,
  wh: number,
  p: PaletteConfig,
  useSedari: boolean
): FloorPlanData {
  const hw = w / 2;
  const hd = d / 2;
  const col1 = Number((-hw + w * 0.46).toFixed(2));
  const col2 = Number((-hw + w * 0.74).toFixed(2));
  const rowZ = Number((-hd + d * 0.5).toFixed(2));
  const w1 = Number((w * 0.46).toFixed(2));
  const w2 = Number((w * 0.28).toFixed(2));
  const w3 = Number((w * 0.26).toFixed(2));
  const dTop = Number((d * 0.5).toFixed(2));
  const dBot = Number((d - dTop).toFixed(2));

  return {
    wallHeight: wh,
    unit: 'm',
    rooms: [
      { id: 'r1', name: 'الصالة المفتوحة والمدفأة', x: -hw, z: -hd, width: w1, depth: dTop, floorStyle: p.salonFloor },
      { id: 'r2', name: 'قاعة الطعام والضيافة', x: col1, z: -hd, width: w2, depth: dTop, floorStyle: p.livingFloor },
      { id: 'r3', name: 'المطبخ بالجزيرة والبار', x: col2, z: -hd, width: w3, depth: dTop, floorStyle: p.kitchenFloor },
      { id: 'r4', name: 'الجناح العائلي والملابس', x: -hw, z: rowZ, width: w1, depth: dBot, floorStyle: p.bedFloor },
      { id: 'r5', name: 'التراس والحديقة الخلفية', x: col1, z: rowZ, width: w2, depth: dBot, floorStyle: p.terraceFloor },
      { id: 'r6', name: 'الحمام الفاخر والغسيل', x: col2, z: rowZ, width: w3, depth: dBot, floorStyle: p.bathFloor },
    ],
    walls: [
      { id: 'w1', x1: -hw, z1: -hd, x2: hw, z2: -hd, thickness: 0.2, height: wh, color: p.wallColor },
      { id: 'w2', x1: hw, z1: -hd, x2: hw, z2: hd, thickness: 0.2, height: wh, color: p.wallColor },
      { id: 'w3', x1: hw, z1: hd, x2: col2, z2: hd, thickness: 0.2, height: wh, color: p.wallColor },
      { id: 'w4', x1: col1, z1: hd, x2: -hw, z2: hd, thickness: 0.2, height: wh, color: p.wallColor },
      { id: 'w5', x1: -hw, z1: hd, x2: -hw, z2: -hd, thickness: 0.2, height: wh, color: p.wallColor },
      { id: 'w6', x1: col1, z1: -hd, x2: col1, z2: hd, thickness: 0.16, height: wh, color: p.wallColor },
      { id: 'w7', x1: col2, z1: -hd, x2: col2, z2: hd, thickness: 0.16, height: wh, color: p.wallColor },
      { id: 'w8', x1: -hw, z1: rowZ, x2: hw, z2: rowZ, thickness: 0.16, height: wh, color: p.wallColor },
    ],
    openings: [
      { id: 'o1', wallId: 'w1', type: 'window', offsetRatio: 0.22, width: 2.6, height: 1.9, sillHeight: 0.55 },
      { id: 'o2', wallId: 'w1', type: 'window', offsetRatio: 0.62, width: 1.9, height: 1.9, sillHeight: 0.55 },
      { id: 'o3', wallId: 'w5', type: 'door', offsetRatio: 0.22, width: 1.1, height: 2.25, sillHeight: 0, swing: 'in' },
      { id: 'o4', wallId: 'w6', type: 'arch', offsetRatio: 0.24, width: 2.0, height: 2.5, sillHeight: 0 },
      { id: 'o5', wallId: 'w7', type: 'arch', offsetRatio: 0.24, width: 1.6, height: 2.4, sillHeight: 0 },
      { id: 'o6', wallId: 'w7', type: 'door', offsetRatio: 0.72, width: 0.9, height: 2.2, sillHeight: 0, swing: 'in' },
      { id: 'o7', wallId: 'w8', type: 'door', offsetRatio: 0.22, width: 0.95, height: 2.2, sillHeight: 0, swing: 'in' },
      { id: 'o8', wallId: 'w8', type: 'window', offsetRatio: 0.6, width: 2.2, height: 2.1, sillHeight: 0.2 },
    ],
    furniture: [
      makeFurn('f1', 'rug', -hw + w1 * 0.5, -hd + dTop * 0.5, 0),
      makeFurn('f2', useSedari ? 'algerian_sedari' : 'sofa_l', -hw + w1 * 0.5, -hd + 0.75, 0, p.sedariPrimary, p.sedariAccent),
      makeFurn('f3', 'fireplace_modern', -hw + w1 * 0.5, rowZ - 0.35, Math.PI),
      makeFurn('f4', 'chandelier', -hw + w1 * 0.5, -hd + dTop * 0.5, 0),
      makeFurn('f5', 'privacy_partition', col1 - 0.2, -hd + dTop * 0.7, Math.PI / 2),
      makeFurn('f6', 'dining_set', col1 + w2 * 0.5, -hd + dTop * 0.5, Math.PI / 2),
      makeFurn('f7', 'kitchen_counter', hw - 0.45, -hd + dTop * 0.5, -Math.PI / 2, p.kitchenPrimary),
      makeFurn('f8', 'bar_counter', col2 + 0.65, -hd + dTop * 0.5, Math.PI / 2),
      makeFurn('f9', 'bed_double', -hw + w1 * 0.35, hd - 1.3, Math.PI),
      makeFurn('f10', 'walk_in_closet', col1 - 1.25, rowZ + 0.95, 0),
      makeFurn('f11', 'prayer_corner', -hw + 0.75, rowZ + 0.75, 0),
      makeFurn('f12', 'pergola_swing', col1 + w2 * 0.5, hd - 1.15, 0),
      makeFurn('f13', 'outdoor_bbq_grill', col2 - 0.65, rowZ + 0.85, -Math.PI / 2),
      makeFurn('f14', 'bathtub', hw - 1.0, hd - 0.6, 0),
      makeFurn('f15', 'ablution_station', col2 + 0.55, rowZ + 0.65, 0),
      makeFurn('f16', 'water_tank_pump', hw - 0.65, rowZ + 0.75, 0),
    ],
  };
}

function buildStudioChalet(
  w: number,
  d: number,
  wh: number,
  p: PaletteConfig,
  withTerrace: boolean
): FloorPlanData {
  const hw = w / 2;
  const hd = d / 2;
  const colSplit = Number((-hw + w * 0.68).toFixed(2));
  const rowTerrace = Number((-hd + d * 0.65).toFixed(2));
  const wMain = Number((w * 0.68).toFixed(2));
  const wBath = Number((w - wMain).toFixed(2));

  if (withTerrace) {
    const dTop = Number((d * 0.65).toFixed(2));
    const dTerrace = Number((d - dTop).toFixed(2));
    return {
      wallHeight: wh,
      unit: 'm',
      rooms: [
        { id: 'r1', name: 'الاستوديو المفتوح والمطبخ', x: -hw, z: -hd, width: wMain, depth: dTop, floorStyle: p.livingFloor },
        { id: 'r2', name: 'الحمام والغسيل', x: colSplit, z: -hd, width: wBath, depth: dTop, floorStyle: p.bathFloor },
        { id: 'r3', name: 'شرفة البانورامية والبيرغولا', x: -hw, z: rowTerrace, width: w, depth: dTerrace, floorStyle: p.terraceFloor },
      ],
      walls: [
        { id: 'w1', x1: -hw, z1: -hd, x2: hw, z2: -hd, thickness: 0.18, height: wh, color: p.wallColor },
        { id: 'w2', x1: hw, z1: -hd, x2: hw, z2: rowTerrace, thickness: 0.18, height: wh, color: p.wallColor },
        { id: 'w3', x1: hw, z1: rowTerrace, x2: -hw, z2: rowTerrace, thickness: 0.16, height: wh, color: p.wallColor },
        { id: 'w4', x1: -hw, z1: rowTerrace, x2: -hw, z2: -hd, thickness: 0.18, height: wh, color: p.wallColor },
        { id: 'w5', x1: colSplit, z1: -hd, x2: colSplit, z2: rowTerrace, thickness: 0.14, height: wh, color: p.wallColor },
      ],
      openings: [
        { id: 'o1', wallId: 'w1', type: 'window', offsetRatio: 0.35, width: 2.2, height: 1.9, sillHeight: 0.5 },
        { id: 'o2', wallId: 'w4', type: 'door', offsetRatio: 0.3, width: 0.95, height: 2.15, sillHeight: 0, swing: 'in' },
        { id: 'o3', wallId: 'w5', type: 'door', offsetRatio: 0.72, width: 0.85, height: 2.1, sillHeight: 0, swing: 'in' },
        { id: 'o4', wallId: 'w3', type: 'window', offsetRatio: 0.35, width: 2.6, height: 2.1, sillHeight: 0.2 },
      ],
      furniture: [
        makeFurn('f1', 'bed_double', -hw + wMain * 0.72, -hd + 1.25, 0),
        makeFurn('f2', 'sofa_2', -hw + 1.25, -hd + 1.2, Math.PI / 2, p.sofaPrimary),
        makeFurn('f3', 'coffee_table', -hw + 2.4, -hd + 1.2, 0),
        makeFurn('f4', 'kitchen_counter', -hw + wMain * 0.45, rowTerrace - 0.42, Math.PI, p.kitchenPrimary),
        makeFurn('f5', 'work_desk', -hw + 0.95, rowTerrace - 0.5, Math.PI),
        makeFurn('f6', 'shower_cabin', hw - 0.6, -hd + 0.6, 0),
        makeFurn('f7', 'vanity', colSplit + 0.55, rowTerrace - 0.4, Math.PI),
        makeFurn('f8', 'outdoor_lounge', -hw + w * 0.3, hd - 0.95, 0),
        makeFurn('f9', 'outdoor_bbq_grill', hw - 0.9, hd - 0.7, 0),
        makeFurn('f10', 'water_tank_pump', hw - 0.65, rowTerrace + 0.7, 0),
      ],
    };
  }

  return {
    wallHeight: wh,
    unit: 'm',
    rooms: [
      { id: 'r1', name: 'الفضاء المفتوح للمعيشة والنوم', x: -hw, z: -hd, width: wMain, depth: d, floorStyle: p.livingFloor },
      { id: 'r2', name: 'الحمام والغسيل', x: colSplit, z: -hd, width: wBath, depth: d, floorStyle: p.bathFloor },
    ],
    walls: [
      { id: 'w1', x1: -hw, z1: -hd, x2: hw, z2: -hd, thickness: 0.18, height: wh, color: p.wallColor },
      { id: 'w2', x1: hw, z1: -hd, x2: hw, z2: hd, thickness: 0.18, height: wh, color: p.wallColor },
      { id: 'w3', x1: hw, z1: hd, x2: -hw, z2: hd, thickness: 0.18, height: wh, color: p.wallColor },
      { id: 'w4', x1: -hw, z1: hd, x2: -hw, z2: -hd, thickness: 0.18, height: wh, color: p.wallColor },
      { id: 'w5', x1: colSplit, z1: -hd, x2: colSplit, z2: hd, thickness: 0.14, height: wh, color: p.wallColor },
    ],
    openings: [
      { id: 'o1', wallId: 'w1', type: 'window', offsetRatio: 0.34, width: 2.2, height: 1.8, sillHeight: 0.55 },
      { id: 'o2', wallId: 'w4', type: 'door', offsetRatio: 0.72, width: 0.95, height: 2.15, sillHeight: 0, swing: 'in' },
      { id: 'o3', wallId: 'w5', type: 'door', offsetRatio: 0.75, width: 0.85, height: 2.1, sillHeight: 0, swing: 'in' },
    ],
    furniture: [
      makeFurn('f1', 'bed_double', -hw + wMain * 0.72, -hd + 1.25, 0),
      makeFurn('f2', 'privacy_partition', -hw + wMain * 0.42, -hd + 1.3, Math.PI / 2),
      makeFurn('f3', 'sofa_2', -hw + 1.15, -hd + 1.25, Math.PI / 2, p.sofaPrimary),
      makeFurn('f4', 'work_desk', -hw + 1.1, hd - 0.55, Math.PI),
      makeFurn('f5', 'kitchen_counter', -hw + wMain * 0.65, hd - 0.42, Math.PI, p.kitchenPrimary),
      makeFurn('f6', 'shower_cabin', hw - 0.6, -hd + 0.6, 0),
      makeFurn('f7', 'vanity', colSplit + 0.58, hd - 0.42, Math.PI),
      makeFurn('f8', 'toilet', colSplit + 0.45, -hd + 0.6, 0),
      makeFurn('f9', 'washer', hw - 0.5, hd - 0.5, Math.PI),
    ],
  };
}

// ── Parametric Spec Generator for 192 Algerian Templates (+ 8 existing = 200) ──

interface GenSeed {
  category: 'apartments' | 'villas' | 'duplex' | 'studios';
  categoryLabel: string;
  wilaya: string;
  titlePrefix: string;
  facadeLabel: string;
  archetype:
    | 'f2'
    | 'f3'
    | 'f4'
    | 'f5'
    | 'rdc'
    | 'dar'
    | 'corner'
    | 'duplex'
    | 'studio_plain'
    | 'studio_terrace';
  w: number;
  d: number;
  wh: number;
  isPro: boolean;
}

const WILAYAS = [
  'الجزائر العاصمة',
  'وهران',
  'قسنطينة',
  'عنابة',
  'سطيف',
  'تلمسان',
  'بجاية',
  'تيزي وزو',
  'البليدة',
  'باتنة',
  'بسكرة',
  'غرداية',
  'ورقلة',
  'جيجل',
  'تيبازة',
  'مستغانم',
  'سيدي بلعباس',
  'بشار',
  'المدية',
  'برج بوعريريج',
  'سكيكدة',
  'الشلف',
  'المسيلة',
  'الأغواط',
  'الوادي',
  'قالمة',
  'تبسة',
  'تيارت',
  'الجلفة',
  'عين تموشنت',
];

const APARTMENT_VARIANTS: Array<{
  prefix: string;
  archetype: 'f2' | 'f3' | 'f4' | 'f5';
  w: number;
  d: number;
  facade: string;
}> = [
  { prefix: 'شقة F2 عصرية بخصوصية مدخل', archetype: 'f2', w: 9.0, d: 7.0, facade: 'واجهة واحدة' },
  { prefix: 'شقة F2 ترقوية مدمجة', archetype: 'f2', w: 8.5, d: 6.8, facade: 'واجهة مضيئة' },
  { prefix: 'شقة F3 عدل / ترقوي بسقيفة استقبال', archetype: 'f3', w: 10.8, d: 8.2, facade: 'واجهتان' },
  { prefix: 'شقة F3 بمدخل خصوصية وصالون معزول', archetype: 'f3', w: 11.2, d: 8.4, facade: 'واجهتان' },
  { prefix: 'شقة F3 عائلية بمجلس سدّاري ومطبخ', archetype: 'f3', w: 11.6, d: 8.6, facade: 'واجهة رئيسية' },
  { prefix: 'شقة F4 ترقوي عمومي LPP بخصوصية', archetype: 'f4', w: 12.6, d: 9.6, facade: 'واجهتان' },
  { prefix: 'شقة F4 عائلية بجناحين ومغسل وضوء', archetype: 'f4', w: 13.2, d: 10.0, facade: 'واجهتان زاوية' },
  { prefix: 'شقة F4 حديثة بركن صلاة ومطبخ تحضير', archetype: 'f4', w: 12.8, d: 9.4, facade: '3 واجهات' },
  { prefix: 'شقة F5 فسيحة لثلاث غرف نوم ومجلسين', archetype: 'f5', w: 14.5, d: 10.5, facade: '3 واجهات' },
  { prefix: 'شقة F5 راقية بحمام تقليدي وجناح ضيوف', archetype: 'f5', w: 15.0, d: 11.0, facade: 'واجهتان' },
];

const VILLA_VARIANTS: Array<{
  prefix: string;
  archetype: 'rdc' | 'dar' | 'corner';
  w: number;
  d: number;
  facade: string;
}> = [
  { prefix: 'سكن فردي أرضي RDC بمدخل سقيفة', archetype: 'rdc', w: 11.5, d: 10.0, facade: 'واجهة 11.5 م' },
  { prefix: 'منزل عائلي أرضي 130 م² بخصوصية تامة', archetype: 'rdc', w: 13.0, d: 10.0, facade: 'واجهة 13 م' },
  { prefix: 'دار جزائرية بوسط الدار ونافورة زليج', archetype: 'dar', w: 13.5, d: 11.5, facade: 'حوش مركزي' },
  { prefix: 'فيلا أندلسية بأقواس وحمام تقليدي', archetype: 'dar', w: 14.5, d: 12.0, facade: 'فناء داخلي' },
  { prefix: 'فيلا صحراوية بسقف عالٍ وفناء مظلل', archetype: 'dar', w: 14.0, d: 11.0, facade: 'عزل حراري' },
  { prefix: 'فيلا زاوية واجهتين بحديقة وشواية', archetype: 'corner', w: 15.0, d: 13.0, facade: 'واجهتان زاوية' },
  { prefix: 'فيلا عائلية فخمة بمجلس سدّاري وبيرغولا', archetype: 'corner', w: 16.0, d: 13.5, facade: 'حديقة أمامية' },
  { prefix: 'منزل ريفي قبائلي بساحة حجرية ومطبخ واسع', archetype: 'rdc', w: 12.5, d: 11.0, facade: 'إطلالة جبلية' },
];

const DUPLEX_VARIANTS: Array<{
  prefix: string;
  archetype: 'duplex';
  w: number;
  d: number;
  facade: string;
}> = [
  { prefix: 'دوبلكس R+1 بمدخل مستقل وتراس', archetype: 'duplex', w: 13.0, d: 10.5, facade: 'واجهتان' },
  { prefix: 'دوبلكس عائلي بجناح ضيافة وجناح خاص', archetype: 'duplex', w: 14.0, d: 11.5, facade: 'مدخل مستقل' },
  { prefix: 'دوبلكس عصري بحديقة خلفية وشواية', archetype: 'duplex', w: 14.5, d: 12.0, facade: 'تراس واسع' },
  { prefix: 'دوبلكس ترقوي ببار مطبخ ومجلس سدّاري', archetype: 'duplex', w: 13.5, d: 11.0, facade: 'واجهتان' },
  { prefix: 'دوبلكس فسيح بركن صلاة ومغسل وضوء', archetype: 'duplex', w: 15.0, d: 12.2, facade: '3 واجهات' },
];

const STUDIO_VARIANTS: Array<{
  prefix: string;
  archetype: 'studio_plain' | 'studio_terrace';
  w: number;
  d: number;
  facade: string;
}> = [
  { prefix: 'استوديو عصري F1 مدمج بفاصل خصوصية', archetype: 'studio_plain', w: 7.5, d: 6.2, facade: 'واجهة مشرقة' },
  { prefix: 'استوديو عمل ومكتب هندسي سكني', archetype: 'studio_plain', w: 8.2, d: 6.6, facade: 'إضاءة نهارية' },
  { prefix: 'شاليه ساحلي بشرفة وبيرغولا خارجية', archetype: 'studio_terrace', w: 9.2, d: 8.0, facade: 'شرفة بحرية' },
  { prefix: 'ملحق سطح (بنتهاوس جزائري) بتراس شواء', archetype: 'studio_terrace', w: 10.0, d: 8.6, facade: 'إطلالة مفتوحة' },
  { prefix: 'استوديو عائلي مصغر بتراس خاص', archetype: 'studio_terrace', w: 8.8, d: 7.6, facade: 'تراس خاص' },
];

function buildAllAlgerianTemplates(): StarterTemplate[] {
  // Preserve the 8 hand-crafted flagship templates (all FREE, part of the 20 free = 10%)
  const existingFree: StarterTemplate[] = STARTER_TEMPLATES.map((tpl, idx) => ({
    ...tpl,
    isPro: false,
    wilaya: WILAYAS[idx % WILAYAS.length],
    facadeLabel: tpl.category === 'villas' ? 'واجهتان وحديقة' : 'توزيع معماري متوازن',
  }));

  // Count how many existing free per category:
  // apartments: 3, studios: 2, villas: 2, duplex: 1 -> total 8 free
  // Target totals across 200 templates:
  // apartments: 60 (6 free, 54 pro) => need +3 free, +54 pro = 57 generated
  // villas:     60 (6 free, 54 pro) => need +4 free, +54 pro = 58 generated
  // duplex:     40 (4 free, 36 pro) => need +3 free, +36 pro = 39 generated
  // studios:    40 (4 free, 36 pro) => need +2 free, +36 pro = 38 generated
  // Total = 8 + 57 + 58 + 39 + 38 = 200 templates (20 Free = 10%, 180 Pro = 90%)

  const specs: GenSeed[] = [];

  const pushCategorySeeds = (
    category: 'apartments' | 'villas' | 'duplex' | 'studios',
    categoryLabel: string,
    freeToAdd: number,
    proToAdd: number,
    variants: Array<{
      prefix: string;
      archetype: GenSeed['archetype'];
      w: number;
      d: number;
      facade: string;
    }>,
    baseWh: number,
    wilayaOffset: number
  ) => {
    const total = freeToAdd + proToAdd;
    for (let i = 0; i < total; i++) {
      const v = variants[i % variants.length];
      const scaleJitter = ((i % 5) - 2) * 0.35;
      const w = Number(Math.max(6.8, v.w + scaleJitter).toFixed(1));
      const d = Number(Math.max(5.8, v.d + ((Math.floor(i / 5) % 4) - 1) * 0.3).toFixed(1));
      const wh = Number((baseWh + (i % 3) * 0.1).toFixed(2));
      specs.push({
        category,
        categoryLabel,
        wilaya: WILAYAS[(i + wilayaOffset) % WILAYAS.length],
        titlePrefix: v.prefix,
        facadeLabel: v.facade,
        archetype: v.archetype,
        w,
        d,
        wh,
        isPro: i >= freeToAdd,
      });
    }
  };

  pushCategorySeeds('apartments', 'شقق سكنية', 3, 54, APARTMENT_VARIANTS, 2.8, 0);
  pushCategorySeeds('villas', 'فلل ومنازل', 4, 54, VILLA_VARIANTS, 3.1, 7);
  pushCategorySeeds('duplex', 'دوبلكس', 3, 36, DUPLEX_VARIANTS, 3.1, 13);
  pushCategorySeeds('studios', 'استوديو وشاليه', 2, 36, STUDIO_VARIANTS, 2.9, 19);

  const generated: StarterTemplate[] = specs.map((spec, idx) => {
    const palette = PALETTES[idx % PALETTES.length];
    const useSedari = idx % 3 !== 2; // 2/3 Algerian sedari/traditional hospitality, 1/3 modern
    const mx = idx % 2 === 1;
    const mz = Math.floor(idx / 2) % 2 === 1;

    let rawPlan: FloorPlanData;
    switch (spec.archetype) {
      case 'f2':
        rawPlan = buildAptF2(spec.w, spec.d, spec.wh, palette, useSedari);
        break;
      case 'f3':
        rawPlan = buildAptF3Privacy(spec.w, spec.d, spec.wh, palette, useSedari);
        break;
      case 'f4':
        rawPlan = buildAptF4Split(spec.w, spec.d, spec.wh, palette, useSedari);
        break;
      case 'f5':
        rawPlan = buildAptF5Grand(spec.w, spec.d, spec.wh, palette, useSedari);
        break;
      case 'rdc':
        rawPlan = buildVillaRdcIndividual(spec.w, spec.d, spec.wh, palette, useSedari);
        break;
      case 'dar':
        rawPlan = buildVillaCourtyardDar(spec.w, spec.d, spec.wh, palette, useSedari);
        break;
      case 'corner':
        rawPlan = buildVillaCornerGarden(spec.w, spec.d, spec.wh, palette, useSedari);
        break;
      case 'duplex':
        rawPlan = buildDuplexTownhouse(spec.w, spec.d, spec.wh, palette, useSedari);
        break;
      case 'studio_plain':
        rawPlan = buildStudioChalet(spec.w, spec.d, spec.wh, palette, false);
        break;
      case 'studio_terrace':
        rawPlan = buildStudioChalet(spec.w, spec.d, spec.wh, palette, true);
        break;
    }

    const floorPlan = mirrorPlan(rawPlan, mx, mz);
    const areaSqm = Math.round(
      floorPlan.rooms.reduce((sum, r) => sum + r.width * r.depth, 0)
    );
    const roomsCount = floorPlan.rooms.length;
    const numStr = String(idx + 9).padStart(3, '0');

    return {
      key: `dz_${spec.category.slice(0, 3)}_${numStr}`,
      title: `${spec.titlePrefix} — ${spec.wilaya}`,
      category: spec.category,
      categoryLabel: spec.categoryLabel,
      areaSqm,
      roomsCount,
      isPro: spec.isPro,
      wilaya: spec.wilaya,
      facadeLabel: spec.facadeLabel,
      description: `مخطط جزائري قابل للتعديل بالكامل (${areaSqm} م² · ${roomsCount} فضاءات · ${spec.facadeLabel}) يراعي الخصوصية والسترة ومجهز بالأثاث والأجهزة ثنائياً وثلاثي الأبعاد.`,
      floorPlan,
    };
  });

  // Order Free templates interleaved nicely or grouped? Let's put all 20 Free templates first when sorted default OR provide easy access so Free users immediately see free templates without hunting, while browsing all 200!
  // Let's place all 20 Free templates cleanly across the front + allow filtering Free (20) vs Pro (180)!
  const all = [...existingFree, ...generated];
  const freeItems = all.filter((t) => !t.isPro);
  const proItems = all.filter((t) => t.isPro);
  return [...freeItems, ...proItems];
}

export const ALGERIAN_TEMPLATES_200: StarterTemplate[] = buildAllAlgerianTemplates();

export const TEMPLATE_STATS = {
  total: ALGERIAN_TEMPLATES_200.length,
  freeCount: ALGERIAN_TEMPLATES_200.filter((t) => !t.isPro).length,
  proCount: ALGERIAN_TEMPLATES_200.filter((t) => t.isPro).length,
};
