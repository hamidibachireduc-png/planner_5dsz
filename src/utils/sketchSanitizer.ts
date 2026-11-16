import type {
  FloorPlanData,
  FurnitureCategory,
  FurnitureItem,
  FurnitureType,
  Opening,
  OpeningType,
  Room,
  RoomFloorStyle,
  Wall,
} from '../types/planner';

interface FurniturePresetDef {
  type: FurnitureType;
  name: string;
  category: FurnitureCategory;
  width: number;
  depth: number;
  height: number;
  primaryColor: string;
  accentColor: string;
  priceDzd?: number;
}

export const SKETCH_FURNITURE_PRESETS: Record<string, FurniturePresetDef> = {
  sofa_3: {
    type: 'sofa_3',
    name: 'كنبة ثلاثية فاخرة',
    category: 'living',
    width: 2.2,
    depth: 0.95,
    height: 0.82,
    primaryColor: '#D6CFC2',
    accentColor: '#6B4F3B',
    priceDzd: 78000,
  },
  sofa_l: {
    type: 'sofa_l',
    name: 'كنبة زاوية (L-Shape)',
    category: 'living',
    width: 2.7,
    depth: 1.85,
    height: 0.82,
    primaryColor: '#475569',
    accentColor: '#C2956E',
    priceDzd: 125000,
  },
  sofa_2: {
    type: 'sofa_2',
    name: 'كنبة ثنائية مدمجة',
    category: 'living',
    width: 1.65,
    depth: 0.88,
    height: 0.8,
    primaryColor: '#8B7E74',
    accentColor: '#4A3728',
    priceDzd: 54000,
  },
  algerian_sedari: {
    type: 'algerian_sedari',
    name: 'سدّاري جزائري للضيافة والمجالس',
    category: 'living',
    width: 2.5,
    depth: 0.85,
    height: 0.78,
    primaryColor: '#7C2D12',
    accentColor: '#D4AF37',
    priceDzd: 110000,
  },
  armchair: {
    type: 'armchair',
    name: 'كرسي استرخاء',
    category: 'living',
    width: 0.85,
    depth: 0.85,
    height: 0.8,
    primaryColor: '#5B7065',
    accentColor: '#7C5A3C',
    priceDzd: 28000,
  },
  coffee_table: {
    type: 'coffee_table',
    name: 'طاولة قهوة ترافرتين',
    category: 'living',
    width: 1.25,
    depth: 0.7,
    height: 0.4,
    primaryColor: '#DFD5C5',
    accentColor: '#2C2A29',
    priceDzd: 26000,
  },
  tv_stand: {
    type: 'tv_stand',
    name: 'مكتبة تلفاز وشاشة',
    category: 'living',
    width: 1.75,
    depth: 0.45,
    height: 1.3,
    primaryColor: '#8C6239',
    accentColor: '#18181B',
    priceDzd: 42000,
  },
  rug: {
    type: 'rug',
    name: 'سجادة أرضية منسوجة',
    category: 'living',
    width: 2.4,
    depth: 1.7,
    height: 0.03,
    primaryColor: '#E5DDD0',
    accentColor: '#9A8C7A',
    priceDzd: 18500,
  },
  bed_double: {
    type: 'bed_double',
    name: 'سرير مزدوج ملكي',
    category: 'bedroom',
    width: 1.85,
    depth: 2.1,
    height: 1.1,
    primaryColor: '#E7E2D8',
    accentColor: '#7C5A3C',
    priceDzd: 85000,
  },
  bed_single: {
    type: 'bed_single',
    name: 'سرير مفرد عصري',
    category: 'bedroom',
    width: 1.05,
    depth: 2.0,
    height: 0.95,
    primaryColor: '#CBD5E1',
    accentColor: '#64748B',
    priceDzd: 36000,
  },
  bunk_bed: {
    type: 'bunk_bed',
    name: 'سرير بطابقين للأطفال',
    category: 'bedroom',
    width: 1.15,
    depth: 2.0,
    height: 1.75,
    primaryColor: '#B08968',
    accentColor: '#E2E8F0',
    priceDzd: 64000,
  },
  wardrobe: {
    type: 'wardrobe',
    name: 'خزانة ملابس مزدوجة',
    category: 'bedroom',
    width: 1.6,
    depth: 0.62,
    height: 2.15,
    primaryColor: '#EAE6DF',
    accentColor: '#94A3B8',
    priceDzd: 72000,
  },
  nightstand: {
    type: 'nightstand',
    name: 'طاولة سرير جانبية',
    category: 'bedroom',
    width: 0.55,
    depth: 0.45,
    height: 0.55,
    primaryColor: '#9C734B',
    accentColor: '#D4AF37',
    priceDzd: 14000,
  },
  dresser: {
    type: 'dresser',
    name: 'تسريحة غرفة نوم مع مرآة',
    category: 'bedroom',
    width: 1.25,
    depth: 0.48,
    height: 1.65,
    primaryColor: '#E7E2D8',
    accentColor: '#9C734B',
    priceDzd: 39000,
  },
  kitchen_counter: {
    type: 'kitchen_counter',
    name: 'خزانة مطبخ مع حوض',
    category: 'kitchen',
    width: 2.2,
    depth: 0.65,
    height: 0.9,
    primaryColor: '#3F4E4F',
    accentColor: '#F1F5F9',
    priceDzd: 95000,
  },
  kitchen_island: {
    type: 'kitchen_island',
    name: 'جزيرة مطبخ رخامية',
    category: 'kitchen',
    width: 1.85,
    depth: 0.9,
    height: 0.92,
    primaryColor: '#F5F2EB',
    accentColor: '#8C6239',
    priceDzd: 82000,
  },
  fridge: {
    type: 'fridge',
    name: 'ثلاجة ستانلس ستيل مزدوجة',
    category: 'appliances',
    width: 0.85,
    depth: 0.72,
    height: 1.9,
    primaryColor: '#CBD5E1',
    accentColor: '#334155',
    priceDzd: 118000,
  },
  stove: {
    type: 'stove',
    name: 'فرن وموقد طبخ',
    category: 'kitchen',
    width: 0.8,
    depth: 0.65,
    height: 0.9,
    primaryColor: '#334155',
    accentColor: '#E2E8F0',
    priceDzd: 62000,
  },
  dining_set: {
    type: 'dining_set',
    name: 'طاولة طعام عائلية (6 كراسي)',
    category: 'dining',
    width: 1.95,
    depth: 1.35,
    height: 0.76,
    primaryColor: '#7C5A3C',
    accentColor: '#EAE6DF',
    priceDzd: 88000,
  },
  dining_round: {
    type: 'dining_round',
    name: 'طاولة طعام دائرية',
    category: 'dining',
    width: 1.3,
    depth: 1.3,
    height: 0.76,
    primaryColor: '#8C6239',
    accentColor: '#D6CFC2',
    priceDzd: 52000,
  },
  work_desk: {
    type: 'work_desk',
    name: 'مكتب عمل وكرسي مريح',
    category: 'dining',
    width: 1.4,
    depth: 0.72,
    height: 0.76,
    primaryColor: '#9C734B',
    accentColor: '#1E293B',
    priceDzd: 38000,
  },
  toilet: {
    type: 'toilet',
    name: 'مرحاض سيراميك',
    category: 'bathroom',
    width: 0.45,
    depth: 0.68,
    height: 0.78,
    primaryColor: '#F8FAFC',
    accentColor: '#CBD5E1',
    priceDzd: 21000,
  },
  vanity: {
    type: 'vanity',
    name: 'مغسلة حمام مع مرآة',
    category: 'bathroom',
    width: 0.95,
    depth: 0.5,
    height: 1.75,
    primaryColor: '#8C6239',
    accentColor: '#F8FAFC',
    priceDzd: 34000,
  },
  shower_cabin: {
    type: 'shower_cabin',
    name: 'مقصورة دش زجاجية',
    category: 'bathroom',
    width: 1.0,
    depth: 1.0,
    height: 2.1,
    primaryColor: '#E2E8F0',
    accentColor: '#1E293B',
    priceDzd: 48000,
  },
  bathtub: {
    type: 'bathtub',
    name: 'حوض استحمام أبيض',
    category: 'bathroom',
    width: 1.65,
    depth: 0.8,
    height: 0.58,
    primaryColor: '#F8FAFC',
    accentColor: '#94A3B8',
    priceDzd: 44000,
  },
  washer: {
    type: 'washer',
    name: 'غسالة ملابس أمامية',
    category: 'appliances',
    width: 0.62,
    depth: 0.62,
    height: 0.85,
    primaryColor: '#F8FAFC',
    accentColor: '#1E293B',
    priceDzd: 68000,
  },
  plant_olive: {
    type: 'plant_olive',
    name: 'شجرة زيتون داخلية',
    category: 'decor',
    width: 0.65,
    depth: 0.65,
    height: 1.65,
    primaryColor: '#B8734B',
    accentColor: '#4D7C4F',
    priceDzd: 8500,
  },
  courtyard_fountain: {
    type: 'courtyard_fountain',
    name: 'نافورة فناء وزليج جزائري تقليدي',
    category: 'decor',
    width: 1.25,
    depth: 1.25,
    height: 0.95,
    primaryColor: '#1E3A8A',
    accentColor: '#D4AF37',
    priceDzd: 75000,
  },
  outdoor_lounge: {
    type: 'outdoor_lounge',
    name: 'جلسة حديقة وشرفة خارجية',
    category: 'decor',
    width: 2.1,
    depth: 1.4,
    height: 0.78,
    primaryColor: '#9C734B',
    accentColor: '#E2E8F0',
    priceDzd: 65000,
  },
};

const VALID_FLOOR_STYLES = new Set<RoomFloorStyle>([
  'oak',
  'walnut',
  'marble',
  'tile',
  'concrete',
  'terrazzo',
  'carpet',
]);

function snapQuarter(v: number): number {
  return Math.round(v * 4) / 4;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function inferFloorStyle(roomName: string, rawStyle?: unknown): RoomFloorStyle {
  if (typeof rawStyle === 'string' && VALID_FLOOR_STYLES.has(rawStyle as RoomFloorStyle)) {
    return rawStyle as RoomFloorStyle;
  }
  const n = roomName.toLowerCase();
  if (n.includes('حمام') || n.includes('دوش') || n.includes('مرحاض') || n.includes('bath') || n.includes('wc')) {
    return 'tile';
  }
  if (n.includes('مطبخ') || n.includes('kitchen') || n.includes('cuisine')) {
    return 'terrazzo';
  }
  if (n.includes('صالون') || n.includes('مجلس') || n.includes('ضيوف') || n.includes('salon')) {
    return 'marble';
  }
  if (n.includes('فناء') || n.includes('حديقة') || n.includes('شرفة') || n.includes('مرآب') || n.includes('كراج')) {
    return 'concrete';
  }
  return 'oak';
}

function buildWallsFromRooms(rooms: Room[], wallHeight: number): Wall[] {
  interface Seg {
    x1: number;
    z1: number;
    x2: number;
    z2: number;
  }
  const rawSegs: Seg[] = [];
  for (const r of rooms) {
    const x1 = r.x;
    const z1 = r.z;
    const x2 = snapQuarter(r.x + r.width);
    const z2 = snapQuarter(r.z + r.depth);
    rawSegs.push({ x1, z1, x2, z2: z1 });
    rawSegs.push({ x1: x2, z1, x2, z2 });
    rawSegs.push({ x1: x2, z1: z2, x2: x1, z2 });
    rawSegs.push({ x1, z1: z2, x2: x1, z2: z1 });
  }

  const seen = new Set<string>();
  const walls: Wall[] = [];
  let idx = 1;
  for (const s of rawSegs) {
    // Canonical undirected key so shared interior walls aren't duplicated
    const forward = s.x1 < s.x2 || (s.x1 === s.x2 && s.z1 <= s.z2);
    const ax = forward ? s.x1 : s.x2;
    const az = forward ? s.z1 : s.z2;
    const bx = forward ? s.x2 : s.x1;
    const bz = forward ? s.z2 : s.z1;
    const key = `${ax.toFixed(2)},${az.toFixed(2)}->${bx.toFixed(2)},${bz.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    walls.push({
      id: `sw_${idx++}`,
      x1: ax,
      z1: az,
      x2: bx,
      z2: bz,
      thickness: 0.16,
      height: wallHeight,
      color: '#F5F2EB',
    });
  }
  return walls;
}

export function sanitizeGeneratedFloorPlan(
  rawInput: unknown,
  opts?: {
    wallHeight?: number;
    approxWidthM?: number;
    approxDepthM?: number;
    includeFurniture?: boolean;
    requestedTitle?: string;
  }
): { floorPlan: FloorPlanData; title: string; notes: string } {
  const obj = (rawInput && typeof rawInput === 'object' ? rawInput : {}) as Record<string, unknown>;
  const wallHeight = clamp(Number(opts?.wallHeight) || 2.85, 2.2, 4.5);
  const includeFurniture = opts?.includeFurniture !== false;

  const rawRooms = Array.isArray(obj.rooms) ? obj.rooms : [];
  let rooms: Room[] = rawRooms
    .map((r, i): Room | null => {
      if (!r || typeof r !== 'object') return null;
      const rr = r as Record<string, unknown>;
      const name =
        typeof rr.name === 'string' && rr.name.trim().length > 0
          ? rr.name.trim().slice(0, 50)
          : `غرفة ${i + 1}`;
      const width = snapQuarter(clamp(Number(rr.width) || 3.5, 1.25, 22));
      const depth = snapQuarter(clamp(Number(rr.depth) || 3.5, 1.25, 22));
      const x = snapQuarter(Number(rr.x) || 0);
      const z = snapQuarter(Number(rr.z) || 0);
      if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
      return {
        id: `sr_${i + 1}`,
        name,
        x,
        z,
        width,
        depth,
        floorStyle: inferFloorStyle(name, rr.floorStyle),
      };
    })
    .filter((r): r is Room => r !== null);

  if (rooms.length === 0) {
    const w = snapQuarter(clamp(Number(opts?.approxWidthM) || 8, 4, 24));
    const d = snapQuarter(clamp(Number(opts?.approxDepthM) || 6, 4, 24));
    rooms = [
      {
        id: 'sr_1',
        name: 'غرفة رئيسية',
        x: snapQuarter(-w / 2),
        z: snapQuarter(-d / 2),
        width: w,
        depth: d,
        floorStyle: 'oak',
      },
    ];
  }

  // Raw walls (optional, validated)
  const rawWalls = Array.isArray(obj.walls) ? obj.walls : [];
  let walls: Wall[] = [];
  const wallIndexRemap = new Map<number, number>();

  rawWalls.forEach((w, rawIdx) => {
    if (!w || typeof w !== 'object') return;
    const ww = w as Record<string, unknown>;
    const x1 = snapQuarter(Number(ww.x1));
    const z1 = snapQuarter(Number(ww.z1));
    const x2 = snapQuarter(Number(ww.x2));
    const z2 = snapQuarter(Number(ww.z2));
    if (![x1, z1, x2, z2].every(Number.isFinite)) return;
    if (Math.hypot(x2 - x1, z2 - z1) < 0.75) return;

    const isExterior = Boolean(ww.isExterior);
    const newIndex = walls.length;
    wallIndexRemap.set(rawIdx, newIndex);
    walls.push({
      id: `sw_${newIndex + 1}`,
      x1,
      z1,
      x2,
      z2,
      thickness: isExterior ? 0.2 : 0.14,
      height: wallHeight,
      color: isExterior ? '#F5F2EB' : '#EAE6DF',
    });
  });

  const synthesizeFallbackWalls = walls.length < Math.max(4, rooms.length);
  if (synthesizeFallbackWalls) {
    walls = buildWallsFromRooms(rooms, wallHeight);
    wallIndexRemap.clear();
  }

  // Compute current bounding box and apply optional user-requested overall scale + center around (0,0)
  const xs: number[] = [];
  const zs: number[] = [];
  rooms.forEach((r) => {
    xs.push(r.x, r.x + r.width);
    zs.push(r.z, r.z + r.depth);
  });
  walls.forEach((w) => {
    xs.push(w.x1, w.x2);
    zs.push(w.z1, w.z2);
  });

  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minZ = Math.min(...zs);
  let maxZ = Math.max(...zs);
  const curW = Math.max(1, maxX - minX);
  const curD = Math.max(1, maxZ - minZ);

  let scaleX = 1;
  let scaleZ = 1;
  if (opts?.approxWidthM && opts.approxWidthM >= 3 && opts.approxWidthM <= 45) {
    const ratio = opts.approxWidthM / curW;
    if (ratio < 0.8 || ratio > 1.25) scaleX = ratio;
  }
  if (opts?.approxDepthM && opts.approxDepthM >= 3 && opts.approxDepthM <= 45) {
    const ratio = opts.approxDepthM / curD;
    if (ratio < 0.8 || ratio > 1.25) scaleZ = ratio;
  }

  const rawFurn = includeFurniture && Array.isArray(obj.furniture) ? obj.furniture : [];
  let furniture: FurnitureItem[] = [];

  if (scaleX !== 1 || scaleZ !== 1) {
    rooms = rooms.map((r) => ({
      ...r,
      x: snapQuarter((r.x - minX) * scaleX),
      z: snapQuarter((r.z - minZ) * scaleZ),
      width: Math.max(1.25, snapQuarter(r.width * scaleX)),
      depth: Math.max(1.25, snapQuarter(r.depth * scaleZ)),
    }));
    walls = walls.map((w) => ({
      ...w,
      x1: snapQuarter((w.x1 - minX) * scaleX),
      z1: snapQuarter((w.z1 - minZ) * scaleZ),
      x2: snapQuarter((w.x2 - minX) * scaleX),
      z2: snapQuarter((w.z2 - minZ) * scaleZ),
    }));
  }

  // Recompute bounds for centering at (0,0)
  const xs2: number[] = [];
  const zs2: number[] = [];
  rooms.forEach((r) => {
    xs2.push(r.x, r.x + r.width);
    zs2.push(r.z, r.z + r.depth);
  });
  walls.forEach((w) => {
    xs2.push(w.x1, w.x2);
    zs2.push(w.z1, w.z2);
  });
  minX = Math.min(...xs2);
  maxX = Math.max(...xs2);
  minZ = Math.min(...zs2);
  maxZ = Math.max(...zs2);
  const cxOffset = snapQuarter((minX + maxX) / 2);
  const czOffset = snapQuarter((minZ + maxZ) / 2);

  rooms = rooms.map((r) => ({
    ...r,
    x: snapQuarter(r.x - cxOffset),
    z: snapQuarter(r.z - czOffset),
  }));
  walls = walls.map((w) => ({
    ...w,
    x1: snapQuarter(w.x1 - cxOffset),
    z1: snapQuarter(w.z1 - czOffset),
    x2: snapQuarter(w.x2 - cxOffset),
    z2: snapQuarter(w.z2 - czOffset),
  }));

  // Map openings safely onto valid walls
  const rawOpenings = Array.isArray(obj.openings) ? obj.openings : [];
  const openings: Opening[] = [];
  if (!synthesizeFallbackWalls) {
    rawOpenings.forEach((op, i) => {
      if (!op || typeof op !== 'object') return;
      const oo = op as Record<string, unknown>;
      const rawIdx = Number(oo.wallIndex);
      const mappedIdx = wallIndexRemap.get(rawIdx);
      if (mappedIdx === undefined) return;
      const targetWall = walls[mappedIdx];
      if (!targetWall) return;
      const wLen = Math.hypot(targetWall.x2 - targetWall.x1, targetWall.z2 - targetWall.z1);
      if (wLen < 1.1) return;

      const opType: OpeningType =
        oo.type === 'window' || oo.type === 'arch' ? oo.type : 'door';
      const defaultWidth = opType === 'window' ? 1.5 : opType === 'arch' ? 1.8 : 0.9;
      const width = clamp(Number(oo.width) || defaultWidth, 0.65, Math.min(3.0, wLen * 0.72));
      const offsetRatio = clamp(Number(oo.offsetRatio) || 0.5, 0.15, 0.85);

      openings.push({
        id: `sop_${i + 1}`,
        wallId: targetWall.id,
        type: opType,
        offsetRatio,
        width: Number(width.toFixed(2)),
        height: opType === 'window' ? 1.45 : opType === 'arch' ? Math.min(2.5, wallHeight - 0.25) : 2.15,
        sillHeight: opType === 'window' ? 0.85 : 0,
        ...(opType === 'door' ? { swing: 'in' as const } : {}),
      });
    });
  }

  // Ensure at least a main front door exists if no openings were mapped
  if (openings.length === 0 && walls.length > 0) {
    const longestWall = [...walls].sort(
      (a, b) => Math.hypot(b.x2 - b.x1, b.z2 - b.z1) - Math.hypot(a.x2 - a.x1, a.z2 - a.z1)
    )[0];
    if (longestWall && Math.hypot(longestWall.x2 - longestWall.x1, longestWall.z2 - longestWall.z1) >= 1.4) {
      openings.push({
        id: 'sop_main_door',
        wallId: longestWall.id,
        type: 'door',
        offsetRatio: 0.25,
        width: 0.95,
        height: 2.15,
        sillHeight: 0,
        swing: 'in',
      });
    }
  }

  // Map furniture items cleanly onto our real catalog specs
  if (includeFurniture) {
    furniture = rawFurn
      .map((f, i): FurnitureItem | null => {
        if (!f || typeof f !== 'object') return null;
        const ff = f as Record<string, unknown>;
        const rawType = typeof ff.type === 'string' ? ff.type.trim() : '';
        const preset = SKETCH_FURNITURE_PRESETS[rawType];
        if (!preset) return null;

        let fx = Number(ff.x);
        let fz = Number(ff.z);
        if (!Number.isFinite(fx) || !Number.isFinite(fz)) return null;
        if (scaleX !== 1 || scaleZ !== 1) {
          fx = (fx - minX) * scaleX;
          fz = (fz - minZ) * scaleZ;
        }
        fx = snapQuarter(fx - cxOffset);
        fz = snapQuarter(fz - czOffset);

        const deg = Number(ff.rotationDeg) || 0;
        const rotation = (deg * Math.PI) / 180;

        return {
          id: `sf_${i + 1}`,
          type: preset.type,
          name:
            typeof ff.name === 'string' && ff.name.trim().length > 1
              ? ff.name.trim().slice(0, 60)
              : preset.name,
          category: preset.category,
          x: fx,
          z: fz,
          rotation,
          width: preset.width,
          depth: preset.depth,
          height: preset.height,
          primaryColor: preset.primaryColor,
          accentColor: preset.accentColor,
          ...(typeof preset.priceDzd === 'number' ? { priceDzd: preset.priceDzd } : {}),
        };
      })
      .filter((f): f is FurnitureItem => f !== null)
      .slice(0, 45);
  }

  const title =
    (opts?.requestedTitle && opts.requestedTitle.trim()) ||
    (typeof obj.title === 'string' && obj.title.trim()) ||
    `مخطط من ورقة مرسومة (${rooms.length} غرف)`;

  const notes =
    typeof obj.notes === 'string' && obj.notes.trim()
      ? obj.notes.trim().slice(0, 320)
      : `تم استخلاص ${rooms.length} غرف و${walls.length} جداراً من الورقة المرسومة بنجاح.`;

  return {
    title,
    notes,
    floorPlan: {
      wallHeight,
      unit: 'm',
      rooms,
      walls,
      openings,
      furniture,
    },
  };
}
