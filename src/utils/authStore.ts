import {
  FloorPlanData,
  ProSubscriptionOrder,
  ProjectRecord,
} from '../types/planner';
import { computeFloorPlanMetrics } from '../data/catalog';

export const ADMIN_PANEL_USERNAME = 'bachirofst@gmail.com';
const ADMIN_USERNAMES = ['bachirofst@gmail.com', 'bachirofsat@gmail.com'];
const ADMIN_PASS = 'hamidibachir1975';

// Epoch Jan 1, 2026 UTC for compact passkey expiry encoding
const PASSKEY_EPOCH_MS = Date.UTC(2026, 0, 1);
const PASSKEY_SECRET = 'HB_ARCH_5D_ALGERIA_2026_KEY';

export interface SubscriberAccount {
  id: string;
  displayName: string;
  username: string;
  password: string;
  proActive: boolean;
  proPlan: 'free' | 'monthly' | 'annual';
  active: boolean;
  expiresAtMs: number | null;
  phone?: string;
  notes?: string;
  createdAtMs: number;
  isUniversalPasskey?: boolean;
}

export interface ActiveAuthSession {
  role: 'admin' | 'subscriber' | 'guest';
  username: string;
  displayName: string;
  proActive: boolean;
  proPlan: 'free' | 'monthly' | 'annual';
  expiresAtMs: number | null;
}

export const GUEST_MAX_DESIGNS = 1;

// 1-month full free access period: Nov 16, 2026 -> Dec 16, 2026
export const FREE_PROMO_START_MS = Date.UTC(2026, 10, 16, 0, 0, 0);
export const FREE_PROMO_END_MS = Date.UTC(2026, 11, 16, 23, 59, 59);

export function isFreePromoMonthActive(nowMs = Date.now()): boolean {
  return nowMs >= FREE_PROMO_START_MS && nowMs <= FREE_PROMO_END_MS;
}

export function getFreePromoDaysRemaining(nowMs = Date.now()): number {
  if (!isFreePromoMonthActive(nowMs)) return 0;
  return Math.max(1, Math.ceil((FREE_PROMO_END_MS - nowMs) / 86400000));
}

// Optional static list if you want to commit custom-password users into GitHub directly
export const BUILTIN_SUBSCRIBERS: SubscriberAccount[] = [];

const STORAGE_SESSION_KEY = 'hb_studio_auth_session_v2';
const STORAGE_GUEST_USAGE_KEY = 'hb_studio_guest_designs_used_v1';
const STORAGE_SUBSCRIBERS_KEY = 'hb_studio_subscribers_v2';
const STORAGE_REVOKED_KEY = 'hb_studio_revoked_users_v2';
const STORAGE_PROJECTS_KEY = 'bachir5d_guest_projects_v1';
const STORAGE_BRAND_KEY = 'bachir5d_studio_brand_v1';
const STORAGE_PRO_ORDERS_KEY = 'bachir5d_guest_pro_orders_v1';
const STORAGE_FB_LINK_KEY = 'bachir5d_facebook_url_v1';

export function isAdminCredentials(username: string, password: string): boolean {
  const cleanUser = username.trim().toLowerCase();
  return ADMIN_USERNAMES.includes(cleanUser) && password === ADMIN_PASS;
}

function computePasskeySignature(username: string, payload: string): string {
  const input = `${username.trim().toLowerCase()}|${payload}|${PASSKEY_SECRET}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i += 1) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= c + (i << 3);
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  const combined = ((h1 ^ (h2 >>> 7)) >>> 0) % 1000000;
  return String(combined).padStart(6, '0');
}

export function generateUniversalPasskey(
  username: string,
  plan: 'free' | 'monthly' | 'annual',
  durationDays: number | null
): { password: string; expiresAtMs: number | null } {
  const tierChar = plan === 'free' ? 'F' : plan === 'annual' ? 'A' : 'M';
  let expCode = '000';
  let expiresAtMs: number | null = null;

  if (durationDays && durationDays > 0) {
    const targetMs = Date.now() + durationDays * 86400000;
    const dayOffset = Math.min(46655, Math.max(1, Math.ceil((targetMs - PASSKEY_EPOCH_MS) / 86400000)));
    expCode = dayOffset.toString(36).toUpperCase().padStart(3, '0');
    expiresAtMs = PASSKEY_EPOCH_MS + dayOffset * 86400000;
  }

  const payload = `${tierChar}${expCode}`;
  const sig = computePasskeySignature(username, payload);
  return {
    password: `HB-${payload}-${sig}`,
    expiresAtMs,
  };
}

export function verifyUniversalPasskey(
  username: string,
  password: string
): {
  valid: boolean;
  expired?: boolean;
  proActive?: boolean;
  proPlan?: 'free' | 'monthly' | 'annual';
  expiresAtMs?: number | null;
} {
  const cleanPass = password.trim().toUpperCase();
  const match = cleanPass.match(/^HB-([FAM])([0-9A-Z]{3})-(\d{6})$/);
  if (!match) return { valid: false };

  const [, tierChar, expCode, sig] = match;
  const expectedSig = computePasskeySignature(username, `${tierChar}${expCode}`);
  if (sig !== expectedSig) return { valid: false };

  let expiresAtMs: number | null = null;
  if (expCode !== '000') {
    const dayOffset = parseInt(expCode, 36);
    expiresAtMs = PASSKEY_EPOCH_MS + dayOffset * 86400000;
    if (Date.now() > expiresAtMs) {
      return { valid: true, expired: true };
    }
  }

  const proPlan: 'free' | 'monthly' | 'annual' =
    tierChar === 'F' ? 'free' : tierChar === 'A' ? 'annual' : 'monthly';

  return {
    valid: true,
    expired: false,
    proActive: tierChar !== 'F',
    proPlan,
    expiresAtMs,
  };
}

export function loadActiveSession(): ActiveAuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveAuthSession;
    if (!parsed || !parsed.username || !parsed.role) return null;
    if (parsed.expiresAtMs && Date.now() > parsed.expiresAtMs) {
      localStorage.removeItem(STORAGE_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveActiveSession(session: ActiveAuthSession | null): void {
  try {
    if (session) localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_SESSION_KEY);
  } catch {
    // ignore quota errors
  }
}

export function createGuestSession(): ActiveAuthSession {
  const session: ActiveAuthSession = {
    role: 'guest',
    username: 'guest_preview',
    displayName: 'زائر (معاينة مؤقتة)',
    proActive: false,
    proPlan: 'free',
    expiresAtMs: Date.now() + 24 * 60 * 60 * 1000,
  };
  saveActiveSession(session);
  return session;
}

export function loadGuestDesignsUsed(): number {
  try {
    const raw = localStorage.getItem(STORAGE_GUEST_USAGE_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function incrementGuestDesignsUsed(): number {
  const next = loadGuestDesignsUsed() + 1;
  try {
    localStorage.setItem(STORAGE_GUEST_USAGE_KEY, String(next));
  } catch {
    // ignore quota errors
  }
  return next;
}

export function loadSubscribers(): SubscriberAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_SUBSCRIBERS_KEY);
    const localList = raw ? (JSON.parse(raw) as SubscriberAccount[]) : [];
    const safeLocal = Array.isArray(localList) ? localList : [];
    const map = new Map<string, SubscriberAccount>();
    for (const s of BUILTIN_SUBSCRIBERS) {
      map.set(s.username.trim().toLowerCase(), s);
    }
    for (const s of safeLocal) {
      map.set(s.username.trim().toLowerCase(), s);
    }
    return Array.from(map.values()).sort((a, b) => b.createdAtMs - a.createdAtMs);
  } catch {
    return [...BUILTIN_SUBSCRIBERS];
  }
}

export function saveSubscribers(list: SubscriberAccount[]): SubscriberAccount[] {
  const sorted = [...list].sort((a, b) => b.createdAtMs - a.createdAtMs);
  try {
    localStorage.setItem(STORAGE_SUBSCRIBERS_KEY, JSON.stringify(sorted));
  } catch {
    // ignore storage errors
  }
  return sorted;
}

function loadRevokedUsernames(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_REVOKED_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setRevokedUsername(username: string, revoked: boolean): void {
  const clean = username.trim().toLowerCase();
  const current = new Set(loadRevokedUsernames());
  if (revoked) current.add(clean);
  else current.delete(clean);
  try {
    localStorage.setItem(STORAGE_REVOKED_KEY, JSON.stringify(Array.from(current)));
  } catch {
    // ignore
  }
}

export async function syncSubscribersFromServer(): Promise<SubscriberAccount[] | null> {
  try {
    const res = await fetch('./api/subscribers', { method: 'GET' });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;
    const data = (await res.json()) as { subscribers?: SubscriberAccount[] };
    if (!Array.isArray(data.subscribers)) return null;

    const merged = new Map<string, SubscriberAccount>();
    for (const s of loadSubscribers()) {
      merged.set(s.username.trim().toLowerCase(), s);
    }
    for (const s of data.subscribers) {
      merged.set(s.username.trim().toLowerCase(), s);
    }
    return saveSubscribers(Array.from(merged.values()));
  } catch {
    return null;
  }
}

export async function pushSubscriberToServer(sub: SubscriberAccount): Promise<void> {
  try {
    await fetch('./api/subscribers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub),
    });
  } catch {
    // Static hosting fallback (GitHub Pages) silently ignores /api
  }
}

export async function deleteSubscriberOnServer(id: string): Promise<void> {
  try {
    await fetch(`./api/subscribers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  } catch {
    // Static hosting fallback
  }
}

export interface LoginResult {
  ok: boolean;
  session?: ActiveAuthSession;
  error?: string;
}

export async function authenticateUserOrAdmin(
  username: string,
  password: string
): Promise<LoginResult> {
  const cleanUser = username.trim();
  const normalizedUser = cleanUser.toLowerCase();
  const cleanPass = password.trim();

  if (!cleanUser || !cleanPass) {
    return { ok: false, error: 'يرجى إدخال اسم المستخدم والرقم السري.' };
  }

  // 1. Check Admin credentials first
  if (isAdminCredentials(cleanUser, cleanPass)) {
    const session: ActiveAuthSession = {
      role: 'admin',
      username: ADMIN_PANEL_USERNAME,
      displayName: 'المدير (حميدي البشير)',
      proActive: true,
      proPlan: 'annual',
      expiresAtMs: null,
    };
    saveActiveSession(session);
    return { ok: true, session };
  }

  // 2. Check Express server (if deployed on Node)
  try {
    const res = await fetch('./api/subscribers/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cleanUser, password: cleanPass }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const payload = (await res.json()) as {
        ok?: boolean;
        error?: string;
        subscriber?: SubscriberAccount;
      };
      if (res.ok && payload.ok && payload.subscriber) {
        const s = payload.subscriber;
        const session: ActiveAuthSession = {
          role: 'subscriber',
          username: s.username,
          displayName: s.displayName,
          proActive: s.proActive,
          proPlan: s.proPlan,
          expiresAtMs: s.expiresAtMs,
        };
        saveActiveSession(session);
        return { ok: true, session };
      }
      if (res.status === 403 && payload.error) {
        return { ok: false, error: payload.error };
      }
    }
  } catch {
    // Proceed to local & universal passkey checks
  }

  // 3. Check local / built-in subscriber records
  const localMatch = loadSubscribers().find(
    (s) => s.username.trim().toLowerCase() === normalizedUser
  );
  if (localMatch) {
    if (localMatch.password !== cleanPass && localMatch.password.toUpperCase() !== cleanPass.toUpperCase()) {
      return { ok: false, error: 'الرقم السري غير صحيح.' };
    }
    if (!localMatch.active) {
      return { ok: false, error: 'تم تعطيل هذا الحساب من طرف الإدارة. يرجى التواصل معنا.' };
    }
    if (localMatch.expiresAtMs && Date.now() > localMatch.expiresAtMs) {
      return { ok: false, error: 'انتهت مدة صلاحية هذا الحساب. يرجى تجديد الاشتراك مع الإدارة.' };
    }
    const session: ActiveAuthSession = {
      role: 'subscriber',
      username: localMatch.username,
      displayName: localMatch.displayName,
      proActive: localMatch.proActive,
      proPlan: localMatch.proPlan,
      expiresAtMs: localMatch.expiresAtMs,
    };
    saveActiveSession(session);
    return { ok: true, session };
  }

  // 4. Verify stateless Universal Cross-Device Passkey (works on GitHub Pages across any device)
  const passCheck = verifyUniversalPasskey(cleanUser, cleanPass);
  if (passCheck.valid) {
    if (loadRevokedUsernames().includes(normalizedUser)) {
      return { ok: false, error: 'تم إيقاف هذا الحساب من طرف الإدارة.' };
    }
    if (passCheck.expired) {
      return { ok: false, error: 'انتهت صلاحية الرقم السري. يرجى مراسلة الإدارة لتجديد الاشتراك.' };
    }
    const session: ActiveAuthSession = {
      role: 'subscriber',
      username: cleanUser,
      displayName: cleanUser,
      proActive: Boolean(passCheck.proActive),
      proPlan: passCheck.proPlan || 'monthly',
      expiresAtMs: passCheck.expiresAtMs ?? null,
    };
    saveActiveSession(session);
    return { ok: true, session };
  }

  return { ok: false, error: 'اسم المستخدم أو الرقم السري غير صحيح.' };
}

// ── Clean Local Persistence Helpers (Projects, Brand, Orders, Links) ──

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned.length > 0 ? cleaned : `proj_${Date.now()}`;
}

export function loadLocalProjects(): ProjectRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProjectRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalProject(
  project: Omit<ProjectRecord, 'roomCount' | 'totalAreaSqm'> & {
    roomCount?: number;
    totalAreaSqm?: number;
  }
): ProjectRecord[] {
  const metrics = computeFloorPlanMetrics(project.floorPlanData);
  const fullRecord: ProjectRecord = {
    ...project,
    roomCount: project.roomCount ?? metrics.roomCount,
    totalAreaSqm: project.totalAreaSqm ?? metrics.totalAreaSqm,
    updatedAtMs: Date.now(),
  };
  const current = loadLocalProjects();
  const idx = current.findIndex((p) => p.id === fullRecord.id);
  const next =
    idx >= 0
      ? current.map((p, i) => (i === idx ? fullRecord : p))
      : [fullRecord, ...current];
  localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(next));
  return next;
}

export function deleteLocalProject(projectId: string): ProjectRecord[] {
  const next = loadLocalProjects().filter((p) => p.id !== projectId);
  localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(next));
  return next;
}

export function loadLocalBrandName(): string {
  const saved = localStorage.getItem(STORAGE_BRAND_KEY);
  if (!saved || saved === 'بشير 5D' || saved === 'خدمات انشاء حميدي البشير') return 'داري';
  return saved;
}

export function saveLocalBrandName(name: string): void {
  localStorage.setItem(STORAGE_BRAND_KEY, name.trim().slice(0, 80) || 'داري');
}

export function loadFacebookUrl(): string {
  return localStorage.getItem(STORAGE_FB_LINK_KEY) || 'https://www.facebook.com/';
}

export function saveFacebookUrl(url: string): void {
  localStorage.setItem(STORAGE_FB_LINK_KEY, url.trim() || 'https://www.facebook.com/');
}

export function loadLocalProOrders(): ProSubscriptionOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_PRO_ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProSubscriptionOrder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalProOrder(order: ProSubscriptionOrder): ProSubscriptionOrder[] {
  const next = [order, ...loadLocalProOrders()].slice(0, 30);
  localStorage.setItem(STORAGE_PRO_ORDERS_KEY, JSON.stringify(next));
  return next;
}

export function updateLocalProOrderStatus(
  orderId: string,
  status: 'approved' | 'rejected'
): ProSubscriptionOrder[] {
  const next = loadLocalProOrders().map((o) => (o.id === orderId ? { ...o, status } : o));
  localStorage.setItem(STORAGE_PRO_ORDERS_KEY, JSON.stringify(next));
  return next;
}

export function computeFloorPlanSummary(plan: FloorPlanData) {
  return computeFloorPlanMetrics(plan);
}
