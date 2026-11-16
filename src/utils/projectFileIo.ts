import { computeFloorPlanMetrics } from '../data/catalog';
import { sanitizeId } from './authStore';
import {
  FloorPlanData,
  FurnitureCategory,
  FurnitureItem,
  FurnitureType,
  Opening,
  ProjectRecord,
  Room,
  RoomFloorStyle,
  Wall,
} from '../types/planner';

const VALID_FLOOR_STYLES = new Set<RoomFloorStyle>([
  'oak',
  'walnut',
  'marble',
  'tile',
  'concrete',
  'terrazzo',
  'carpet',
]);

const VALID_CATEGORIES = new Set<FurnitureCategory>([
  'living',
  'bedroom',
  'kitchen',
  'appliances',
  'dining',
  'bathroom',
  'decor',
]);

export interface ImportedProjectPayload {
  title: string;
  templateKey?: string;
  floorPlanData: FloorPlanData;
}

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function validateAndSanitizeFloorPlan(raw: unknown): FloorPlanData {
  if (!raw || typeof raw !== 'object') {
    throw new Error('صيغة المخطط غير صالحة.');
  }
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.rooms) && !Array.isArray(obj.walls) && !Array.isArray(obj.furniture)) {
    throw new Error('لا يحتوي الملف على بيانات غرف أو جدران أو أثاث صالحة.');
  }

  const rawRooms = Array.isArray(obj.rooms) ? obj.rooms.slice(0, 40) : [];
  const rawWalls = Array.isArray(obj.walls) ? obj.walls.slice(0, 120) : [];
  const rawOpenings = Array.isArray(obj.openings) ? obj.openings.slice(0, 80) : [];
  const rawFurniture = Array.isArray(obj.furniture) ? obj.furniture.slice(0, 150) : [];

  const rooms: Room[] = rawRooms
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === 'object'))
    .map((r, idx) => ({
      id: sanitizeId(String(r.id || `room_${idx + 1}`)),
      name: String(r.name || `غرفة ${idx + 1}`).slice(0, 80),
      x: Number(num(r.x, 0).toFixed(3)),
      z: Number(num(r.z, 0).toFixed(3)),
      width: Math.max(0.5, Math.min(40, Number(num(r.width, 4).toFixed(3)))),
      depth: Math.max(0.5, Math.min(40, Number(num(r.depth, 4).toFixed(3)))),
      floorStyle: VALID_FLOOR_STYLES.has(r.floorStyle as RoomFloorStyle)
        ? (r.floorStyle as RoomFloorStyle)
        : 'oak',
    }));

  const walls: Wall[] = rawWalls
    .filter((w): w is Record<string, unknown> => Boolean(w && typeof w === 'object'))
    .map((w, idx) => ({
      id: sanitizeId(String(w.id || `wall_${idx + 1}`)),
      x1: Number(num(w.x1, 0).toFixed(3)),
      z1: Number(num(w.z1, 0).toFixed(3)),
      x2: Number(num(w.x2, 4).toFixed(3)),
      z2: Number(num(w.z2, 0).toFixed(3)),
      thickness: Math.min(0.6, Math.max(0.08, num(w.thickness, 0.16))),
      height: Math.min(6, Math.max(2, num(w.height, 2.8))),
      color: String(w.color || '#F5F2EB').slice(0, 20),
    }));

  const wallIds = new Set(walls.map((w) => w.id));
  const openings: Opening[] = rawOpenings
    .filter((o): o is Record<string, unknown> => Boolean(o && typeof o === 'object'))
    .map((o, idx): Opening => {
      const wId = sanitizeId(String(o.wallId || ''));
      const type: Opening['type'] =
        o.type === 'window' || o.type === 'arch' ? o.type : 'door';
      const swing: Opening['swing'] = o.swing === 'out' ? 'out' : 'in';
      return {
        id: sanitizeId(String(o.id || `op_${idx + 1}`)),
        wallId: wId,
        type,
        offsetRatio: Math.min(0.95, Math.max(0.05, num(o.offsetRatio, 0.5))),
        width: Math.min(5, Math.max(0.5, num(o.width, 0.9))),
        height: Math.min(4, Math.max(0.4, num(o.height, 2.1))),
        sillHeight: Math.min(2.5, Math.max(0, num(o.sillHeight, type === 'window' ? 0.85 : 0))),
        swing,
      };
    })
    .filter((o) => wallIds.has(o.wallId));

  const furniture: FurnitureItem[] = rawFurniture
    .filter((f): f is Record<string, unknown> => Boolean(f && typeof f === 'object'))
    .map((f, idx) => {
      const item: FurnitureItem = {
        id: sanitizeId(String(f.id || `furn_${idx + 1}`)),
        type: String(f.type || 'sofa_3') as FurnitureType,
        name: String(f.name || 'عنصر أثاث').slice(0, 80),
        category: VALID_CATEGORIES.has(f.category as FurnitureCategory)
          ? (f.category as FurnitureCategory)
          : 'living',
        x: Number(num(f.x, 0).toFixed(3)),
        z: Number(num(f.z, 0).toFixed(3)),
        rotation: Number(num(f.rotation, 0).toFixed(4)),
        width: Math.max(0.2, Math.min(10, Number(num(f.width, 1).toFixed(3)))),
        depth: Math.max(0.2, Math.min(10, Number(num(f.depth, 1).toFixed(3)))),
        height: Math.max(0.02, Math.min(5, Number(num(f.height, 0.8).toFixed(3)))),
        primaryColor: String(f.primaryColor || '#D6CFC2').slice(0, 20),
        accentColor: String(f.accentColor || '#6B4F3B').slice(0, 20),
      };
      if (typeof f.catalogId === 'string' && f.catalogId.trim()) {
        item.catalogId = sanitizeId(f.catalogId).slice(0, 100);
      }
      if (typeof f.priceDzd === 'number' && Number.isFinite(f.priceDzd) && f.priceDzd >= 0) {
        item.priceDzd = Math.round(f.priceDzd);
      }
      return item;
    });

  return {
    rooms,
    walls,
    openings,
    furniture,
    wallHeight: Math.min(6, Math.max(2, num(obj.wallHeight, 2.8))),
    unit: obj.unit === 'ft' ? 'ft' : 'm',
  };
}

function triggerJsonDownload(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function safeFileSlug(title: string): string {
  return (
    title
      .trim()
      .replace(/[/\\?%*:|"<>]/g, '-')
      .replace(/\s+/g, '_')
      .slice(0, 60) || 'bachir-5d-project'
  );
}

export function downloadProjectToDevice(project: {
  title: string;
  brandName?: string;
  templateKey?: string;
  floorPlanData: FloorPlanData;
}): void {
  const metrics = computeFloorPlanMetrics(project.floorPlanData);
  const payload = {
    format: 'bachir5d_project_v2',
    exportedAt: new Date().toISOString(),
    brandName: project.brandName || 'خدمات انشاء حميدي البشير',
    title: project.title || 'تصميم منزل',
    templateKey: project.templateKey,
    roomCount: metrics.roomCount,
    totalAreaSqm: metrics.totalAreaSqm,
    floorPlan: project.floorPlanData,
  };
  triggerJsonDownload(`${safeFileSlug(project.title)}.json`, payload);
}

export function downloadAllProjectsBackup(projects: ProjectRecord[], brandName?: string): void {
  const payload = {
    format: 'bachir5d_backup_v2',
    exportedAt: new Date().toISOString(),
    brandName: brandName || 'خدمات انشاء حميدي البشير',
    count: projects.length,
    projects: projects.map((p) => ({
      id: p.id,
      title: p.title,
      templateKey: p.templateKey,
      roomCount: p.roomCount,
      totalAreaSqm: p.totalAreaSqm,
      floorPlanData: p.floorPlanData,
    })),
  };
  const dateTag = new Date().toISOString().slice(0, 10);
  triggerJsonDownload(`bachir5d_projects_backup_${dateTag}.json`, payload);
}

export async function parseImportedProjectFile(file: File): Promise<ImportedProjectPayload[]> {
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('حجم الملف كبير جداً (الحد الأقصى 8 ميغابايت).');
  }
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('تعذر قراءة الملف — تأكد من أنه ملف مشروع JSON صالح.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('بنية الملف غير متوافقة.');
  }

  const root = parsed as Record<string, unknown>;
  const fallbackBaseTitle = file.name.replace(/\.json$/i, '').replace(/[_-]+/g, ' ').trim() || 'مشروع مستورد';

  // Case 1: Multi-project backup bundle
  if (Array.isArray(root.projects)) {
    const imported: ImportedProjectPayload[] = [];
    for (let i = 0; i < root.projects.length; i += 1) {
      const entry = root.projects[i];
      if (!entry || typeof entry !== 'object') continue;
      const eObj = entry as Record<string, unknown>;
      const rawPlan = eObj.floorPlanData ?? eObj.floorPlan ?? eObj;
      try {
        const floorPlanData = validateAndSanitizeFloorPlan(rawPlan);
        imported.push({
          title: String(eObj.title || `${fallbackBaseTitle} (${i + 1})`).slice(0, 120),
          templateKey: typeof eObj.templateKey === 'string' ? eObj.templateKey.slice(0, 64) : undefined,
          floorPlanData,
        });
      } catch {
        // skip invalid entries inside bundle
      }
    }
    if (imported.length === 0) {
      throw new Error('لم يتم العثور على مشاريع صالحة داخل ملف النسخ الاحتياطي.');
    }
    return imported;
  }

  // Case 2: Single project export ({ title, floorPlan } or { title, floorPlanData } or raw FloorPlanData)
  const rawSinglePlan = root.floorPlan ?? root.floorPlanData ?? root;
  const floorPlanData = validateAndSanitizeFloorPlan(rawSinglePlan);
  const title = String(root.title || fallbackBaseTitle).trim().slice(0, 120) || 'مشروع مستورد';
  const templateKey = typeof root.templateKey === 'string' ? root.templateKey.slice(0, 64) : undefined;

  return [{ title, templateKey, floorPlanData }];
}
