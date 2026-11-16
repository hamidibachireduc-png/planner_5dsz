import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Crown,
  Download,
  ExternalLink,
  KeyRound,
  LogOut,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  UserX,
  X,
  XCircle,
} from 'lucide-react';
import { ProSubscriptionOrder } from '../types/planner';
import { BRAND_LOGO_URL } from '../utils/assets';
import {
  SubscriberAccount,
  generateUniversalPasskey,
  sanitizeId,
} from '../utils/authStore';
import { BARIDIMOB_RIP, FLEXY_PHONE, WHATSAPP_INTL } from './ProSubscriptionSection';

interface AdminPanelModalProps {
  isOpen: boolean;
  brandName: string;
  subscribers: SubscriberAccount[];
  orders: ProSubscriptionOrder[];
  facebookUrl: string;
  onClose: () => void;
  onCreateSubscriber: (sub: SubscriberAccount) => Promise<void>;
  onUpdateSubscriber: (id: string, patch: Partial<SubscriberAccount>) => Promise<void>;
  onDeleteSubscriber: (id: string, username: string) => Promise<void>;
  onUpdateOrderStatus: (orderId: string, status: 'approved' | 'rejected') => Promise<void>;
  onSaveFacebookUrl: (url: string) => void;
  onImportSubscribers: (subs: SubscriberAccount[]) => Promise<void>;
  onLogout: () => void;
}

function suggestUsername(displayName: string, phone?: string): string {
  const digits = (phone || '').replace(/\D/g, '').slice(-4);
  const latin = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 10);
  if (latin.length >= 3) {
    return `${latin}${digits || Math.floor(10 + Math.random() * 89)}`;
  }
  return `user${digits || Math.floor(1000 + Math.random() * 8999)}`;
}

function formatPlanLabel(plan: 'free' | 'monthly' | 'annual'): string {
  if (plan === 'annual') return 'برو سنوي';
  if (plan === 'monthly') return 'برو شهري';
  return 'مجاني';
}

function buildCredentialsMessage(
  brandName: string,
  sub: SubscriberAccount
): string {
  const expiryText = sub.expiresAtMs
    ? `صالح لغاية ${new Date(sub.expiresAtMs).toLocaleDateString('ar-DZ')}`
    : 'دائم بدون تاريخ انتهاء';
  const siteUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  return [
    `مرحباً ${sub.displayName}، تم تفعيل حسابك في منصة ${brandName} (${formatPlanLabel(sub.proPlan)} · ${expiryText}).`,
    `اسم المستخدم: ${sub.username}`,
    `الرقم السري: ${sub.password}`,
    siteUrl ? `رابط الدخول: ${siteUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  brandName,
  subscribers,
  orders,
  facebookUrl,
  onClose,
  onCreateSubscriber,
  onUpdateSubscriber,
  onDeleteSubscriber,
  onUpdateOrderStatus,
  onSaveFacebookUrl,
  onImportSubscribers,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'accounts' | 'orders' | 'settings'>('accounts');
  const [searchQuery, setSearchQuery] = useState('');
  const [accountFilter, setAccountFilter] = useState<'all' | 'pro' | 'active' | 'suspended'>('all');

  // Create Subscriber form state
  const [showAddForm, setShowAddForm] = useState(true);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPlan, setNewPlan] = useState<'free' | 'monthly' | 'annual'>('monthly');
  const [durationDays, setDurationDays] = useState<number | null>(30);
  const [passMode, setPassMode] = useState<'universal' | 'custom'>('universal');
  const [customPass, setCustomPass] = useState('');

  const [lastIssued, setLastIssued] = useState<SubscriberAccount | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // Settings
  const [fbDraft, setFbDraft] = useState(facebookUrl);
  const [fbSaved, setFbSaved] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setFbDraft(facebookUrl);
  }, [facebookUrl]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const stats = useMemo(() => {
    const total = subscribers.length;
    const activeCount = subscribers.filter((s) => s.active).length;
    const proCount = subscribers.filter((s) => s.proActive).length;
    const suspendedCount = subscribers.filter((s) => !s.active).length;
    const pendingOrders = orders.filter((o) => o.status === 'pending').length;
    return { total, activeCount, proCount, suspendedCount, pendingOrders };
  }, [subscribers, orders]);

  const filteredSubscribers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return subscribers.filter((sub) => {
      const filterMatch =
        accountFilter === 'all' ||
        (accountFilter === 'pro' && sub.proActive) ||
        (accountFilter === 'active' && sub.active) ||
        (accountFilter === 'suspended' && !sub.active);
      const queryMatch =
        !q ||
        sub.displayName.toLowerCase().includes(q) ||
        sub.username.toLowerCase().includes(q) ||
        (sub.phone || '').toLowerCase().includes(q);
      return filterMatch && queryMatch;
    });
  }, [subscribers, accountFilter, searchQuery]);

  if (!isOpen) return null;

  const copyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2200);
    } catch {
      // Ignore clipboard denials
    }
  };

  const handlePlanChange = (nextPlan: 'free' | 'monthly' | 'annual') => {
    setNewPlan(nextPlan);
    if (nextPlan === 'monthly') setDurationDays(30);
    else if (nextPlan === 'annual') setDurationDays(365);
    else setDurationDays(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newName.trim();
    const cleanUsername = (newUsername.trim() || suggestUsername(cleanName, newPhone)).replace(/\s+/g, '');
    if (cleanName.length < 2 || cleanUsername.length < 2) {
      setActionMsg('يرجى إدخال اسم المشترك واسم المستخدم.');
      return;
    }

    let finalPassword = customPass.trim();
    let expiresAtMs: number | null =
      durationDays && durationDays > 0 ? Date.now() + durationDays * 86400000 : null;
    let isUniversalPasskey = false;

    if (passMode === 'universal') {
      const generated = generateUniversalPasskey(cleanUsername, newPlan, durationDays);
      finalPassword = generated.password;
      expiresAtMs = generated.expiresAtMs;
      isUniversalPasskey = true;
    } else if (finalPassword.length < 4) {
      setActionMsg('الرقم السري المخصص يجب أن يحتوي على 4 أحرف أو أرقام على الأقل.');
      return;
    }

    const newSub: SubscriberAccount = {
      id: sanitizeId(`sub_${cleanUsername}_${Date.now()}`),
      displayName: cleanName,
      username: cleanUsername,
      password: finalPassword,
      proActive: newPlan !== 'free',
      proPlan: newPlan,
      active: true,
      expiresAtMs,
      phone: newPhone.trim() || undefined,
      createdAtMs: Date.now(),
      isUniversalPasskey,
    };

    setBusyId('__create__');
    setActionMsg(null);
    try {
      await onCreateSubscriber(newSub);
      setLastIssued(newSub);
      setNewName('');
      setNewUsername('');
      setNewPhone('');
      setCustomPass('');
      setActionMsg(`تم إنشاء حساب «${newSub.displayName}» وتوليد بيانات الدخول بنجاح.`);
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleActive = async (sub: SubscriberAccount) => {
    setBusyId(sub.id);
    setActionMsg(null);
    const nextActive = !sub.active;
    try {
      await onUpdateSubscriber(sub.id, { active: nextActive });
      setActionMsg(
        nextActive
          ? `تم تفعيل حساب «${sub.displayName}».`
          : `تم تعطيل حساب «${sub.displayName}».`
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleChangeSubPlan = async (
    sub: SubscriberAccount,
    nextPlan: 'free' | 'monthly' | 'annual'
  ) => {
    setBusyId(sub.id);
    setActionMsg(null);
    const days = nextPlan === 'monthly' ? 30 : nextPlan === 'annual' ? 365 : null;
    try {
      const patch: Partial<SubscriberAccount> = {
        proPlan: nextPlan,
        proActive: nextPlan !== 'free',
        active: nextPlan !== 'free' ? true : sub.active,
      };
      if (sub.isUniversalPasskey) {
        const regenerated = generateUniversalPasskey(sub.username, nextPlan, days);
        patch.password = regenerated.password;
        patch.expiresAtMs = regenerated.expiresAtMs;
      }
      await onUpdateSubscriber(sub.id, patch);
      setActionMsg(
        `تم تحديث باقة «${sub.displayName}» إلى ${formatPlanLabel(nextPlan)}${
          sub.isUniversalPasskey ? ' مع تحديث الرقم السري العابر للأجهزة.' : '.'
        }`
      );
    } finally {
      setBusyId(null);
    }
  };

  const handlePrefillFromOrder = (ord: ProSubscriptionOrder) => {
    setNewName(ord.customerName);
    setNewPhone(ord.contactPhone);
    setNewUsername(suggestUsername(ord.customerName, ord.contactPhone));
    handlePlanChange(ord.planType);
    setPassMode('universal');
    setShowAddForm(true);
    setActiveTab('accounts');
    setActionMsg(`تم تعبئة بيانات «${ord.customerName}» — اضغط «توليد وحفظ الحساب» ثم أرسل له بيانات الدخول.`);
  };

  const handleExportJson = () => {
    const payload = {
      format: 'bachir5d_subscribers_v1',
      exportedAt: new Date().toISOString(),
      subscribers,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subscribers_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text()) as { subscribers?: SubscriberAccount[] } | SubscriberAccount[];
      const list = Array.isArray(raw) ? raw : Array.isArray(raw.subscribers) ? raw.subscribers : [];
      const valid = list.filter((s) => s && typeof s.username === 'string' && typeof s.password === 'string');
      if (valid.length === 0) {
        setActionMsg('لم يتم العثور على حسابات صالحة في الملف.');
        return;
      }
      await onImportSubscribers(valid);
      setActionMsg(`تم استيراد ${valid.length} حساب مشترك بنجاح.`);
    } catch {
      setActionMsg('تعذر قراءة ملف النسخ الاحتياطي للمشتركين.');
    }
  };

  const builtinSnippet = `export const BUILTIN_SUBSCRIBERS: SubscriberAccount[] = ${JSON.stringify(
    subscribers,
    null,
    2
  )};`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-panel-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#181B20] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={BRAND_LOGO_URL}
              alt={brandName}
              className="w-10 h-10 rounded-full object-cover border border-amber-600/40 shrink-0"
            />
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>لوحة الإدارة المباشرة · {brandName}</span>
              </div>
              <h2
                id="admin-panel-title"
                className="font-display text-lg font-bold text-slate-900 dark:text-white truncate"
              >
                إصدار حسابات المشتركين (اسم مستخدم + رقم سري مباشر)
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق لوحة الإدارة"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs & KPI Summary */}
        <div className="px-6 pt-4 pb-3 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 self-start">
            <button
              type="button"
              onClick={() => setActiveTab('accounts')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'accounts'
                  ? 'bg-white dark:bg-[#181B20] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>المشتركين والحسابات ({stats.total})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'orders'
                  ? 'bg-white dark:bg-[#181B20] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>طلبات الاشتراك الواردة ({orders.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'bg-white dark:bg-[#181B20] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>الإعدادات والنسخ الاحتياطي</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono-nums">
            <span>النشطة: {stats.activeCount}</span>
            <span aria-hidden="true">·</span>
            <span className="text-blue-700 dark:text-blue-400 font-semibold">
              برو مفعّل: {stats.proCount}
            </span>
            <span aria-hidden="true">·</span>
            <span>معطّلة: {stats.suspendedCount}</span>
            {stats.pendingOrders > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-amber-700 dark:text-amber-400 font-semibold">
                  طلبات معلقة: {stats.pendingOrders}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 studio-scroll">
          {actionMsg && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
              <span>{actionMsg}</span>
              <button
                type="button"
                onClick={() => setActionMsg(null)}
                className="text-emerald-600 hover:text-emerald-900 dark:hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {activeTab === 'accounts' && (
            <div className="space-y-5">
              {/* Newly Issued Credentials Quick Card */}
              {lastIssued && (
                <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/30 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2 text-xs font-bold text-blue-800 dark:text-blue-300">
                      <KeyRound className="w-4 h-4" />
                      <span>جاهز للإرسال للمشترك: {lastIssued.displayName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLastIssued(null)}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-slate-500">اسم المستخدم: </span>
                        <code dir="ltr" className="font-mono-nums font-bold text-slate-900 dark:text-white select-all">
                          {lastIssued.username}
                        </code>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyText('last_u', lastIssued.username)}
                        className="text-blue-600 hover:underline text-[11px] font-semibold"
                      >
                        {copiedId === 'last_u' ? 'تم النسخ' : 'نسخ'}
                      </button>
                    </div>
                    <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-slate-500">الرقم السري: </span>
                        <code dir="ltr" className="font-mono-nums font-bold text-emerald-700 dark:text-emerald-400 select-all">
                          {lastIssued.password}
                        </code>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyText('last_p', lastIssued.password)}
                        className="text-blue-600 hover:underline text-[11px] font-semibold"
                      >
                        {copiedId === 'last_p' ? 'تم النسخ' : 'نسخ'}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        copyText('last_full', buildCredentialsMessage(brandName, lastIssued))
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors"
                    >
                      {copiedId === 'last_full' ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {copiedId === 'last_full' ? 'تم نسخ رسالة التفعيل' : 'نسخ بيانات الدخول كاملة'}
                      </span>
                    </button>

                    <a
                      href={`https://wa.me/${
                        lastIssued.phone
                          ? `213${lastIssued.phone.replace(/\D/g, '').replace(/^0/, '')}`
                          : WHATSAPP_INTL
                      }?text=${encodeURIComponent(buildCredentialsMessage(brandName, lastIssued))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>إرسال عبر واتساب</span>
                      <ExternalLink className="w-3 h-3 opacity-80" />
                    </a>
                  </div>
                </div>
              )}

              {/* Controls Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ابحث بالاسم، اسم المستخدم، الهاتف..."
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pr-9 pl-3 py-2 text-xs text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900">
                    {(
                      [
                        { id: 'all', label: 'الكل' },
                        { id: 'pro', label: 'برو' },
                        { id: 'active', label: 'نشط' },
                        { id: 'suspended', label: 'معطّل' },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setAccountFilter(f.id)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                          accountFilter === f.id
                            ? 'bg-white dark:bg-[#181B20] text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddForm((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showAddForm ? 'إخفاء نموذج الإنشاء' : 'إنشاء اسم مستخدم ورقم سري'}</span>
                </button>
              </div>

              {/* Create Subscriber Form */}
              {showAddForm && (
                <form
                  onSubmit={handleCreateSubmit}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-3.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      إنشاء حساب مشترك جديد وتوليد الرقم السري
                    </div>
                    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-200/80 dark:bg-slate-800 self-start">
                      <button
                        type="button"
                        onClick={() => setPassMode('universal')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                          passMode === 'universal'
                            ? 'bg-white dark:bg-slate-950 text-blue-700 dark:text-blue-400 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        مفتاح يعمل على كل الأجهزة وGitHub
                      </button>
                      <button
                        type="button"
                        onClick={() => setPassMode('custom')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                          passMode === 'custom'
                            ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        رقم سري مخصص (يدوي)
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">اسم المشترك</label>
                      <input
                        type="text"
                        required
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="مثال: أحمد بن علي"
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">اسم المستخدم للدخول</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          dir="ltr"
                          required
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          placeholder="ahmed2026"
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-left font-mono-nums text-slate-900 dark:text-white"
                        />
                        <button
                          type="button"
                          title="اقتراح اسم مستخدم"
                          onClick={() => setNewUsername(suggestUsername(newName || 'client', newPhone))}
                          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-500 hover:text-blue-600"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">رقم الهاتف (اختياري)</label>
                      <input
                        type="tel"
                        dir="ltr"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        placeholder="06XXXXXXXX"
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-left font-mono-nums text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">الباقة</label>
                      <select
                        value={newPlan}
                        onChange={(e) =>
                          handlePlanChange(e.target.value as 'free' | 'monthly' | 'annual')
                        }
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white"
                      >
                        <option value="monthly">برو شهري (1,000 د.ج)</option>
                        <option value="annual">برو سنوي (8,000 د.ج)</option>
                        <option value="free">حساب مجاني</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">مدة الصلاحية</label>
                      <select
                        value={durationDays === null ? '0' : String(durationDays)}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setDurationDays(v === 0 ? null : v);
                        }}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white"
                      >
                        <option value="30">30 يوماً (شهر)</option>
                        <option value="365">365 يوماً (سنة)</option>
                        <option value="0">دائم (بدون انتهاء)</option>
                      </select>
                    </div>
                  </div>

                  {passMode === 'custom' ? (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                      <input
                        type="text"
                        dir="ltr"
                        required
                        value={customPass}
                        onChange={(e) => setCustomPass(e.target.value)}
                        placeholder="أدخل الرقم السري المخصص (مثال: 123456)"
                        className="sm:w-72 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-left font-mono-nums text-slate-900 dark:text-white"
                      />
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        ملاحظة: الرقم السري المخصص يُحفظ في قاعدة البيانات المحلية/الخادم. للاستضافة الثابتة على GitHub Pages دون خادم، يُنصح باختيار «مفتاح يعمل على كل الأجهزة».
                      </span>
                    </div>
                  ) : (
                    <p className="text-[11px] text-blue-700 dark:text-blue-400">
                      يولّد النظام رقماً سرياً مشفراً (مثل HB-M...-......) يتحقق منه الموقع تلقائياً في هاتف وجهاز المشترك حتى على استضافة GitHub Pages بدون أي خادم أو Firestore.
                    </p>
                  )}

                  <div className="flex justify-end gap-2">
                    <button
                      type="submit"
                      disabled={busyId === '__create__'}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition-colors"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>{busyId === '__create__' ? 'جارٍ الحفظ...' : 'توليد وحفظ الحساب'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Subscribers List */}
              {filteredSubscribers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-xs text-slate-500">
                  لا توجد حسابات مشتركين مسجلة بعد. أنشئ أول اسم مستخدم ورقم سري من النموذج أعلاه وأرسله للمشترك.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-[#181B20]">
                  {filteredSubscribers.map((sub) => {
                    const isBusy = busyId === sub.id;
                    const expired = Boolean(sub.expiresAtMs && Date.now() > sub.expiresAtMs);
                    return (
                      <div
                        key={sub.id}
                        className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                            <span>{sub.displayName}</span>
                            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                            <span
                              className={`text-xs font-semibold ${
                                !sub.active
                                  ? 'text-red-600 dark:text-red-400'
                                  : expired
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-emerald-700 dark:text-emerald-400'
                              }`}
                            >
                              {!sub.active ? 'معطّل' : expired ? 'منتهي الصلاحية' : 'نشط'}
                            </span>
                            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                            <span
                              className={`text-xs font-semibold ${
                                sub.proActive
                                  ? 'text-amber-700 dark:text-amber-400'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {formatPlanLabel(sub.proPlan)}
                            </span>
                            {sub.expiresAtMs && (
                              <>
                                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                                <span className="text-[11px] font-normal font-mono-nums text-slate-500">
                                  ينتهي: {new Date(sub.expiresAtMs).toLocaleDateString('ar-DZ')}
                                </span>
                              </>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300 font-mono-nums">
                            <span>
                              المستخدم:{' '}
                              <code dir="ltr" className="font-bold text-slate-900 dark:text-white select-all">
                                {sub.username}
                              </code>
                            </span>
                            <span>
                              الرقم السري:{' '}
                              <code dir="ltr" className="font-bold text-blue-700 dark:text-blue-400 select-all">
                                {sub.password}
                              </code>
                            </span>
                            {sub.phone && <span dir="ltr">{sub.phone}</span>}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => copyText(sub.id, buildCredentialsMessage(brandName, sub))}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                          >
                            {copiedId === sub.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{copiedId === sub.id ? 'تم النسخ' : 'نسخ الدخول'}</span>
                          </button>

                          <a
                            href={`https://wa.me/${
                              sub.phone
                                ? `213${sub.phone.replace(/\D/g, '').replace(/^0/, '')}`
                                : WHATSAPP_INTL
                            }?text=${encodeURIComponent(buildCredentialsMessage(brandName, sub))}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white whitespace-nowrap"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>واتساب</span>
                          </a>

                          {!sub.proActive ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleChangeSubPlan(sub, 'monthly')}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-2.5 py-1.5 text-xs font-semibold text-white whitespace-nowrap"
                            >
                              <Crown className="w-3.5 h-3.5" />
                              <span>تفعيل برو</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleChangeSubPlan(sub, 'free')}
                              className="rounded-lg border border-amber-300 dark:border-amber-800 px-2.5 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 disabled:opacity-50 whitespace-nowrap"
                            >
                              إرجاع لمجاني
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleToggleActive(sub)}
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap ${
                              sub.active
                                ? 'border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            {sub.active ? (
                              <>
                                <UserX className="w-3.5 h-3.5" />
                                <span>تعطيل</span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>تفعيل</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void onDeleteSubscriber(sub.id, sub.username)}
                            aria-label="حذف الحساب"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="space-y-3">
              {orders.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-xs text-slate-500">
                  لا توجد طلبات اشتراك مسجلة حتى الآن.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-[#181B20]">
                  {orders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                          <span>{ord.customerName}</span>
                          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                          <span dir="ltr" className="font-mono-nums text-xs">
                            {ord.contactPhone}
                          </span>
                          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                          <span className="font-mono-nums text-blue-700 dark:text-blue-400">
                            {ord.totalAmountDzd.toLocaleString('en-US')} د.ج
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {ord.planType === 'annual' ? 'باقة سنوية' : 'باقة شهرية'} ·{' '}
                          {ord.paymentMethod === 'flexy' ? 'فليكسي (+10%)' : 'بريدي موب'} ·{' '}
                          {ord.contactChannel === 'whatsapp' ? 'واتساب' : 'فيسبوك'}
                          {ord.receiptNote ? ` · مرجع: ${ord.receiptNote}` : ''}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold px-2 ${
                            ord.status === 'approved'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : ord.status === 'rejected'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {ord.status === 'approved' && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {ord.status === 'rejected' && <XCircle className="w-3.5 h-3.5" />}
                          {ord.status === 'pending' && <Clock className="w-3.5 h-3.5" />}
                          <span>
                            {ord.status === 'approved'
                              ? 'مفعّل'
                              : ord.status === 'rejected'
                              ? 'مرفوض'
                              : 'قيد المراجعة'}
                          </span>
                        </span>

                        <button
                          type="button"
                          onClick={() => handlePrefillFromOrder(ord)}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>إنشاء حساب من الطلب</span>
                        </button>

                        {ord.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => void onUpdateOrderStatus(ord.id, 'approved')}
                              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                            >
                              تأكيد
                            </button>
                            <button
                              type="button"
                              onClick={() => void onUpdateOrderStatus(ord.id, 'rejected')}
                              className="rounded-lg border border-red-200 dark:border-red-900 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                              رفض
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
                <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  رابط صفحة / حساب فيسبوك لاستلام وصولات الدفع
                </h4>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="url"
                    dir="ltr"
                    value={fbDraft}
                    onChange={(e) => setFbDraft(e.target.value)}
                    placeholder="https://www.facebook.com/your.profile"
                    className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onSaveFacebookUrl(fbDraft);
                      setFbSaved(true);
                      setTimeout(() => setFbSaved(false), 2000);
                    }}
                    className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white whitespace-nowrap"
                  >
                    {fbSaved ? 'تم حفظ الرابط' : 'حفظ رابط فيسبوك'}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
                <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  النسخ الاحتياطي وتصدير قائمة المشتركين
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  احفظ نسخة JSON من قائمة المشتركين داخل جهازك أو استوردها على جهاز آخر، أو انسخ قائمة الحسابات المخصصة إذا أردت تضمينها مباشرة في مستودع GitHub.
                </p>
                <div className="flex flex-wrap items-center gap-2.5">
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportJson}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تصدير المشتركين (.json)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => importInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>استيراد ملف مشتركين</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => copyText('builtin_ts', builtinSnippet)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-400 px-3.5 py-2 text-xs font-semibold hover:bg-blue-50 dark:hover:bg-blue-950/30"
                  >
                    {copiedId === 'builtin_ts' ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedId === 'builtin_ts' ? 'تم النسخ' : 'نسخ قائمة BUILTIN_SUBSCRIBERS'}</span>
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="font-bold text-slate-900 dark:text-white">
                  إحداثيات الدفع المعتمدة حالياً:
                </div>
                <div className="font-mono-nums">
                  بريدي موب (RIP): <strong dir="ltr">{BARIDIMOB_RIP}</strong>
                </div>
                <div className="font-mono-nums">
                  هاتف فليكسي / واتساب: <strong dir="ltr">{FLEXY_PHONE}</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>تسجيل الخروج من جلسة الإدارة</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
