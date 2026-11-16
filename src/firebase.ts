import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { computeFloorPlanMetrics } from './data/catalog';
import {
  FloorPlanData,
  ProOrderStatus,
  ProSubscriptionOrder,
  ProjectRecord,
  UnitType,
  UserAccountRecord,
  UserAccountStatus,
  UserStudioSettings,
} from './types/planner';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned.length > 0 ? cleaned : `proj_${Date.now()}`;
}

function sanitizeFloorPlanForFirestore(fp: FloorPlanData): FloorPlanData {
  return {
    rooms: fp.rooms.slice(0, 40).map((r) => ({
      id: sanitizeId(r.id),
      name: String(r.name || 'غرفة').slice(0, 80),
      x: Number(Number(r.x).toFixed(3)),
      z: Number(Number(r.z).toFixed(3)),
      width: Math.max(0.5, Number(Number(r.width).toFixed(3))),
      depth: Math.max(0.5, Number(Number(r.depth).toFixed(3))),
      floorStyle: r.floorStyle,
    })),
    walls: fp.walls.slice(0, 120).map((w) => ({
      id: sanitizeId(w.id),
      x1: Number(Number(w.x1).toFixed(3)),
      z1: Number(Number(w.z1).toFixed(3)),
      x2: Number(Number(w.x2).toFixed(3)),
      z2: Number(Number(w.z2).toFixed(3)),
      thickness: Math.min(0.6, Math.max(0.08, Number(w.thickness) || 0.16)),
      height: Math.min(6, Math.max(2, Number(w.height) || 2.8)),
      color: String(w.color || '#F5F2EB').slice(0, 20),
    })),
    openings: fp.openings.slice(0, 80).map((o) => ({
      id: sanitizeId(o.id),
      wallId: sanitizeId(o.wallId),
      type: o.type,
      offsetRatio: Math.min(0.95, Math.max(0.05, Number(o.offsetRatio) || 0.5)),
      width: Math.min(5, Math.max(0.5, Number(o.width) || 0.9)),
      height: Math.min(4, Math.max(0.4, Number(o.height) || 2.1)),
      sillHeight: Math.min(2.5, Math.max(0, Number(o.sillHeight) || 0)),
      swing: o.swing || 'in',
    })),
    furniture: fp.furniture.slice(0, 150).map((f) => {
      const cleanItem: FloorPlanData['furniture'][number] = {
        id: sanitizeId(f.id),
        type: f.type,
        name: String(f.name || '').slice(0, 80),
        category: f.category,
        x: Number(Number(f.x).toFixed(3)),
        z: Number(Number(f.z).toFixed(3)),
        rotation: Number(Number(f.rotation).toFixed(4)),
        width: Math.max(0.2, Number(Number(f.width).toFixed(3))),
        depth: Math.max(0.2, Number(Number(f.depth).toFixed(3))),
        height: Math.max(0.02, Number(Number(f.height).toFixed(3))),
        primaryColor: String(f.primaryColor || '#D6CFC2').slice(0, 20),
        accentColor: String(f.accentColor || '#6B4F3B').slice(0, 20),
      };
      if (typeof f.catalogId === 'string' && f.catalogId.trim()) {
        cleanItem.catalogId = sanitizeId(f.catalogId).slice(0, 100);
      }
      if (typeof f.priceDzd === 'number' && Number.isFinite(f.priceDzd) && f.priceDzd >= 0) {
        cleanItem.priceDzd = Math.round(f.priceDzd);
      }
      return cleanItem;
    }),
    wallHeight: Math.min(6, Math.max(2, Number(fp.wallHeight) || 2.8)),
    unit: fp.unit === 'ft' ? 'ft' : 'm',
  };
}

export async function signInWithGoogle(): Promise<User | null> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function subscribeAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

export function subscribeUserProjects(
  userId: string,
  onData: (projects: ProjectRecord[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = 'projects';
  const q = query(collection(db, path), where('ownerId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: ProjectRecord[] = snapshot.docs.map((d) => {
        const raw = d.data();
        const ts = raw.updatedAt as { toMillis?: () => number } | undefined;
        return {
          id: String(raw.id || d.id),
          ownerId: String(raw.ownerId),
          title: String(raw.title || 'مشروع بدون عنوان'),
          description: raw.description ? String(raw.description) : undefined,
          templateKey: raw.templateKey ? String(raw.templateKey) : undefined,
          floorPlanData: raw.floorPlanData as FloorPlanData,
          roomCount: Number(raw.roomCount || 0),
          totalAreaSqm: Number(raw.totalAreaSqm || 0),
          createdAt: raw.createdAt,
          updatedAt: raw.updatedAt,
          updatedAtMs: ts && typeof ts.toMillis === 'function' ? ts.toMillis() : Date.now(),
        };
      });
      items.sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        if (onError && e instanceof Error) onError(e);
      }
    }
  );
}

export async function saveProjectToFirestore(
  userId: string,
  project: {
    id: string;
    title: string;
    description?: string;
    templateKey?: string;
    floorPlanData: FloorPlanData;
  },
  isExisting: boolean
): Promise<string> {
  const projectId = sanitizeId(project.id);
  const path = `projects/${projectId}`;
  const cleanPlan = sanitizeFloorPlanForFirestore(project.floorPlanData);
  const metrics = computeFloorPlanMetrics(cleanPlan);
  const cleanTitle = project.title.trim().slice(0, 120) || 'تصميم منزل جديد';

  try {
    if (isExisting) {
      await updateDoc(doc(db, 'projects', projectId), {
        title: cleanTitle,
        description: (project.description || '').slice(0, 500),
        floorPlanData: cleanPlan,
        roomCount: metrics.roomCount,
        totalAreaSqm: metrics.totalAreaSqm,
        updatedAt: serverTimestamp(),
      });
    } else {
      const payload: Record<string, unknown> = {
        id: projectId,
        ownerId: userId,
        title: cleanTitle,
        floorPlanData: cleanPlan,
        roomCount: metrics.roomCount,
        totalAreaSqm: metrics.totalAreaSqm,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (project.description) {
        payload.description = project.description.slice(0, 500);
      }
      if (project.templateKey) {
        payload.templateKey = project.templateKey.slice(0, 64);
      }
      await setDoc(doc(db, 'projects', projectId), payload);
    }
    return projectId;
  } catch (error) {
    handleFirestoreError(error, isExisting ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteProjectFromFirestore(projectId: string): Promise<void> {
  const cleanId = sanitizeId(projectId);
  const path = `projects/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'projects', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function loadUserStudioSettings(userId: string): Promise<UserStudioSettings | null> {
  const path = `userSettings/${userId}`;
  try {
    const snap = await getDoc(doc(db, 'userSettings', userId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      ownerId: String(data.ownerId),
      brandName: String(data.brandName || 'خدمات انشاء حميدي البشير'),
      preferredUnit: data.preferredUnit === 'ft' ? 'ft' : 'm',
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveUserStudioSettings(
  userId: string,
  brandName: string,
  preferredUnit: UnitType
): Promise<void> {
  const path = `userSettings/${userId}`;
  const cleanBrand = brandName.trim().slice(0, 80) || 'خدمات انشاء حميدي البشير';
  try {
    const existingSnap = await getDoc(doc(db, 'userSettings', userId));
    if (existingSnap.exists()) {
      await updateDoc(doc(db, 'userSettings', userId), {
        brandName: cleanBrand,
        preferredUnit,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'userSettings', userId), {
        ownerId: userId,
        brandName: cleanBrand,
        preferredUnit,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Local guest storage fallback so users can design immediately without login
const LOCAL_PROJECTS_KEY = 'bachir5d_guest_projects_v1';
const LOCAL_BRAND_KEY = 'bachir5d_studio_brand_v1';

export function loadGuestProjects(): ProjectRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProjectRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveGuestProject(project: ProjectRecord): ProjectRecord[] {
  const existingList = loadGuestProjects();
  const idx = existingList.findIndex((p) => p.id === project.id);
  const updated = { ...project, updatedAtMs: Date.now() };
  const next =
    idx >= 0
      ? existingList.map((p, i) => (i === idx ? updated : p))
      : [updated, ...existingList];
  localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(next));
  return next;
}

export function deleteGuestProject(projectId: string): ProjectRecord[] {
  const next = loadGuestProjects().filter((p) => p.id !== projectId);
  localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(next));
  return next;
}

export function loadLocalBrandName(): string {
  const saved = localStorage.getItem(LOCAL_BRAND_KEY);
  if (!saved || saved === 'بشير 5D') return 'خدمات انشاء حميدي البشير';
  return saved;
}

export function saveLocalBrandName(name: string): void {
  localStorage.setItem(LOCAL_BRAND_KEY, name.trim().slice(0, 80) || 'خدمات انشاء حميدي البشير');
}

export const ADMIN_EMAIL = 'bachirofsat@gmail.com';
export const ADMIN_EMAILS = ['bachirofsat@gmail.com', 'bachirofst@gmail.com'];
export const ADMIN_PANEL_USERNAME = 'bachirofst@gmail.com';
const ADMIN_PANEL_PASS = 'hamidibachir1975';

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return ADMIN_EMAILS.includes(normalized);
}

export function verifyAdminPanelCredentials(username: string, password: string): boolean {
  const normalizedUser = username.trim().toLowerCase();
  return ADMIN_EMAILS.includes(normalizedUser) && password === ADMIN_PANEL_PASS;
}

const LOCAL_PRO_ORDERS_KEY = 'bachir5d_guest_pro_orders_v1';
const LOCAL_FB_LINK_KEY = 'bachir5d_facebook_url_v1';
const LOCAL_ADMIN_SESSION_KEY = 'bachir5d_admin_session_v1';
const LOCAL_CLIENT_SESSION_KEY = 'bachir5d_client_session_v1';
const LOCAL_USER_ACCOUNTS_KEY = 'bachir5d_user_accounts_v1';

export interface LocalClientSession {
  id: string;
  displayName: string;
  email: string;
  phone: string;
}

export function loadAdminPanelSession(): boolean {
  try {
    return localStorage.getItem(LOCAL_ADMIN_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveAdminPanelSession(active: boolean): void {
  try {
    if (active) localStorage.setItem(LOCAL_ADMIN_SESSION_KEY, '1');
    else localStorage.removeItem(LOCAL_ADMIN_SESSION_KEY);
  } catch {
    // ignore storage quota errors
  }
}

export function loadLocalClientSession(): LocalClientSession | null {
  try {
    const raw = localStorage.getItem(LOCAL_CLIENT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalClientSession;
    return parsed && parsed.id && parsed.displayName ? parsed : null;
  } catch {
    return null;
  }
}

export function saveLocalClientSession(session: LocalClientSession | null): void {
  try {
    if (session) localStorage.setItem(LOCAL_CLIENT_SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(LOCAL_CLIENT_SESSION_KEY);
  } catch {
    // ignore storage errors
  }
}

export function loadLocalUserAccounts(): UserAccountRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_USER_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UserAccountRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function upsertLocalUserAccount(account: UserAccountRecord): UserAccountRecord[] {
  const current = loadLocalUserAccounts();
  const idx = current.findIndex(
    (a) =>
      a.id === account.id ||
      (account.email && a.email && a.email.toLowerCase() === account.email.toLowerCase())
  );
  const now = Date.now();
  const next =
    idx >= 0
      ? current.map((a, i) => (i === idx ? { ...a, ...account, updatedAtMs: now } : a))
      : [{ ...account, createdAtMs: account.createdAtMs || now, updatedAtMs: now }, ...current];
  localStorage.setItem(LOCAL_USER_ACCOUNTS_KEY, JSON.stringify(next));
  return next;
}

export function updateLocalUserAccount(
  accountId: string,
  patch: Partial<Pick<UserAccountRecord, 'accountStatus' | 'proActive' | 'proPlan' | 'notes'>>
): UserAccountRecord[] {
  const next = loadLocalUserAccounts().map((a) =>
    a.id === accountId ? { ...a, ...patch, updatedAtMs: Date.now() } : a
  );
  localStorage.setItem(LOCAL_USER_ACCOUNTS_KEY, JSON.stringify(next));
  return next;
}

export function updateLocalProOrderStatus(
  orderId: string,
  status: 'approved' | 'rejected'
): ProSubscriptionOrder[] {
  const next = loadGuestProOrders().map((o) => (o.id === orderId ? { ...o, status } : o));
  localStorage.setItem(LOCAL_PRO_ORDERS_KEY, JSON.stringify(next));
  return next;
}

export function loadFacebookUrl(): string {
  return localStorage.getItem(LOCAL_FB_LINK_KEY) || 'https://www.facebook.com/';
}

export function saveFacebookUrl(url: string): void {
  localStorage.setItem(LOCAL_FB_LINK_KEY, url.trim() || 'https://www.facebook.com/');
}

export function loadGuestProOrders(): ProSubscriptionOrder[] {
  try {
    const raw = localStorage.getItem(LOCAL_PRO_ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProSubscriptionOrder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveGuestProOrder(order: ProSubscriptionOrder): ProSubscriptionOrder[] {
  const next = [order, ...loadGuestProOrders()].slice(0, 20);
  localStorage.setItem(LOCAL_PRO_ORDERS_KEY, JSON.stringify(next));
  return next;
}

export function subscribeProOrders(
  userId: string,
  isAdminUser: boolean,
  onData: (orders: ProSubscriptionOrder[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = 'proOrders';
  const q = isAdminUser
    ? query(collection(db, path))
    : query(collection(db, path), where('ownerId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: ProSubscriptionOrder[] = snapshot.docs.map((d) => {
        const raw = d.data();
        const ts = raw.createdAt as { toMillis?: () => number } | undefined;
        return {
          id: String(raw.id || d.id),
          ownerId: String(raw.ownerId),
          customerName: String(raw.customerName || ''),
          contactPhone: String(raw.contactPhone || ''),
          contactChannel: raw.contactChannel === 'facebook' ? 'facebook' : 'whatsapp',
          planType: raw.planType === 'annual' ? 'annual' : 'monthly',
          paymentMethod: raw.paymentMethod === 'flexy' ? 'flexy' : 'baridimob',
          baseAmountDzd: Number(raw.baseAmountDzd || 0),
          surchargeDzd: Number(raw.surchargeDzd || 0),
          totalAmountDzd: Number(raw.totalAmountDzd || 0),
          receiptNote: String(raw.receiptNote || ''),
          status: (raw.status as ProOrderStatus) || 'pending',
          createdAtMs: ts && typeof ts.toMillis === 'function' ? ts.toMillis() : Date.now(),
        };
      });
      items.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        if (onError && e instanceof Error) onError(e);
      }
    }
  );
}

export async function createProOrderInFirestore(
  userId: string,
  order: Omit<ProSubscriptionOrder, 'id' | 'ownerId' | 'status' | 'createdAtMs'>
): Promise<string> {
  const orderId = sanitizeId(`pro_${Date.now()}`);
  const path = `proOrders/${orderId}`;
  const baseAmountDzd = Math.round(order.baseAmountDzd);
  const surchargeDzd = Math.round(order.surchargeDzd);
  const totalAmountDzd = baseAmountDzd + surchargeDzd;

  try {
    await setDoc(doc(db, 'proOrders', orderId), {
      id: orderId,
      ownerId: userId,
      customerName: order.customerName.trim().slice(0, 100) || 'مشترك',
      contactPhone: order.contactPhone.trim().slice(0, 30),
      contactChannel: order.contactChannel,
      planType: order.planType,
      paymentMethod: order.paymentMethod,
      baseAmountDzd,
      surchargeDzd,
      totalAmountDzd,
      receiptNote: order.receiptNote.trim().slice(0, 240),
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return orderId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateProOrderStatusInFirestore(
  orderId: string,
  status: 'approved' | 'rejected'
): Promise<void> {
  const cleanId = sanitizeId(orderId);
  const path = `proOrders/${cleanId}`;
  try {
    await updateDoc(doc(db, 'proOrders', cleanId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function syncUserAccountInFirestore(user: User): Promise<void> {
  const accountId = sanitizeId(user.uid);
  const path = `userAccounts/${accountId}`;
  const displayName = (user.displayName || user.email?.split('@')[0] || 'مستخدم').trim().slice(0, 120);
  const email = (user.email || '').trim().slice(0, 160);

  try {
    const ref = doc(db, 'userAccounts', accountId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: accountId,
        ownerId: user.uid,
        email,
        displayName,
        phone: (user.phoneNumber || '').slice(0, 30),
        accountStatus: 'active',
        proActive: false,
        proPlan: 'free',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        displayName,
        email,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeUserAccounts(
  userId: string,
  isAdminUser: boolean,
  onData: (accounts: UserAccountRecord[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = 'userAccounts';
  const q = isAdminUser
    ? query(collection(db, path))
    : query(collection(db, path), where('ownerId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: UserAccountRecord[] = snapshot.docs.map((d) => {
        const raw = d.data();
        const createdTs = raw.createdAt as { toMillis?: () => number } | undefined;
        const updatedTs = raw.updatedAt as { toMillis?: () => number } | undefined;
        const status: UserAccountStatus =
          raw.accountStatus === 'suspended' || raw.accountStatus === 'pending'
            ? raw.accountStatus
            : 'active';
        const plan: 'free' | 'monthly' | 'annual' =
          raw.proPlan === 'monthly' || raw.proPlan === 'annual' ? raw.proPlan : 'free';
        return {
          id: String(raw.id || d.id),
          ownerId: String(raw.ownerId),
          email: String(raw.email || ''),
          displayName: String(raw.displayName || 'مستخدم'),
          phone: String(raw.phone || ''),
          accountStatus: status,
          proActive: Boolean(raw.proActive),
          proPlan: plan,
          notes: raw.notes ? String(raw.notes) : undefined,
          createdAtMs: createdTs && typeof createdTs.toMillis === 'function' ? createdTs.toMillis() : Date.now(),
          updatedAtMs: updatedTs && typeof updatedTs.toMillis === 'function' ? updatedTs.toMillis() : Date.now(),
        };
      });
      items.sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        if (onError && e instanceof Error) onError(e);
      }
    }
  );
}

export async function adminUpdateUserAccountInFirestore(
  accountId: string,
  patch: {
    accountStatus: UserAccountStatus;
    proActive: boolean;
    proPlan: 'free' | 'monthly' | 'annual';
    notes?: string;
  }
): Promise<void> {
  const cleanId = sanitizeId(accountId);
  const path = `userAccounts/${cleanId}`;
  try {
    const updatePayload: Record<string, unknown> = {
      accountStatus: patch.accountStatus,
      proActive: patch.proActive,
      proPlan: patch.proPlan,
      updatedAt: serverTimestamp(),
    };
    if (typeof patch.notes === 'string') {
      updatePayload.notes = patch.notes.slice(0, 240);
    }
    await updateDoc(doc(db, 'userAccounts', cleanId), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminCreateUserAccountInFirestore(input: {
  email: string;
  displayName: string;
  phone: string;
  accountStatus: UserAccountStatus;
  proActive: boolean;
  proPlan: 'free' | 'monthly' | 'annual';
  notes?: string;
}): Promise<string> {
  const accountId = sanitizeId(`acc_${Date.now()}`);
  const path = `userAccounts/${accountId}`;
  try {
    const payload: Record<string, unknown> = {
      id: accountId,
      ownerId: accountId,
      email: input.email.trim().slice(0, 160),
      displayName: input.displayName.trim().slice(0, 120) || 'مستخدم',
      phone: input.phone.trim().slice(0, 30),
      accountStatus: input.accountStatus,
      proActive: input.proActive,
      proPlan: input.proPlan,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (input.notes && input.notes.trim()) {
      payload.notes = input.notes.trim().slice(0, 240);
    }
    await setDoc(doc(db, 'userAccounts', accountId), payload);
    return accountId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
