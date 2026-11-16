import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Crown,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
  X,
  XCircle,
} from 'lucide-react';
import {
  ProSubscriptionOrder,
  UserAccountRecord,
  UserAccountStatus,
} from '../types/planner';
import { BRAND_LOGO_URL } from '../utils/assets';
import { BARIDIMOB_RIP, FLEXY_PHONE } from './ProSubscriptionSection';

interface AdminPanelModalProps {
  isOpen: boolean;
  brandName: string;
  isAdminAuthorized: boolean;
  isCloudAdminSignedIn: boolean;
  accounts: UserAccountRecord[];
  orders: ProSubscriptionOrder[];
  facebookUrl: string;
  onClose: () => void;
  onAdminLogin: (username: string, password: string) => boolean;
  onAdminLogout: () => void;
  onGoogleSyncSignIn: () => Promise<void>;
  onUpdateAccount: (
    accountId: string,
    patch: {
      accountStatus: UserAccountStatus;
      proActive: boolean;
      proPlan: 'free' | 'monthly' | 'annual';
      notes?: string;
    }
  ) => Promise<void>;
  onCreateAccount: (input: {
    email: string;
    displayName: string;
    phone: string;
    accountStatus: UserAccountStatus;
    proActive: boolean;
    proPlan: 'free' | 'monthly' | 'annual';
    notes?: string;
  }) => Promise<void>;
  onUpdateOrderStatus: (orderId: string, status: 'approved' | 'rejected') => Promise<void>;
  onSaveFacebookUrl: (url: string) => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  brandName,
  isAdminAuthorized,
  isCloudAdminSignedIn,
  accounts,
  orders,
  facebookUrl,
  onClose,
  onAdminLogin,
  onAdminLogout,
  onGoogleSyncSignIn,
  onUpdateAccount,
  onCreateAccount,
  onUpdateOrderStatus,
  onSaveFacebookUrl,
}) => {
  const [activeTab, setActiveTab] = useState<'accounts' | 'orders' | 'settings'>('accounts');
  const [searchQuery, setSearchQuery] = useState('');
  const [accountFilter, setAccountFilter] = useState<'all' | 'pro' | 'active' | 'suspended'>('all');

  // Inline Admin login gate if opened by non-admin
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Add/Activate Account form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPlan, setNewPlan] = useState<'free' | 'monthly' | 'annual'>('monthly');
  const [newStatus, setNewStatus] = useState<UserAccountStatus>('active');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // Settings
  const [fbDraft, setFbDraft] = useState(facebookUrl);
  const [fbSaved, setFbSaved] = useState(false);

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
    const total = accounts.length;
    const activeCount = accounts.filter((a) => a.accountStatus === 'active').length;
    const proCount = accounts.filter((a) => a.proActive).length;
    const suspendedCount = accounts.filter((a) => a.accountStatus === 'suspended').length;
    const pendingOrders = orders.filter((o) => o.status === 'pending').length;
    return { total, activeCount, proCount, suspendedCount, pendingOrders };
  }, [accounts, orders]);

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return accounts.filter((acc) => {
      const filterMatch =
        accountFilter === 'all' ||
        (accountFilter === 'pro' && acc.proActive) ||
        (accountFilter === 'active' && acc.accountStatus === 'active') ||
        (accountFilter === 'suspended' && acc.accountStatus === 'suspended');
      const queryMatch =
        !q ||
        acc.displayName.toLowerCase().includes(q) ||
        acc.email.toLowerCase().includes(q) ||
        acc.phone.toLowerCase().includes(q);
      return filterMatch && queryMatch;
    });
  }, [accounts, accountFilter, searchQuery]);

  if (!isOpen) return null;

  const handleAdminGateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const ok = onAdminLogin(adminUser, adminPass);
    if (!ok) {
      setLoginError('بيانات الدخول غير صحيحة. تأكد من اسم المستخدم والرقم السري.');
    } else {
      setAdminPass('');
    }
  };

  const handleToggleAccountActivation = async (acc: UserAccountRecord) => {
    setBusyId(acc.id);
    setActionMsg(null);
    const nextStatus: UserAccountStatus = acc.accountStatus === 'active' ? 'suspended' : 'active';
    try {
      await onUpdateAccount(acc.id, {
        accountStatus: nextStatus,
        proActive: acc.proActive,
        proPlan: acc.proPlan,
      });
      setActionMsg(
        nextStatus === 'active'
          ? `تم تفعيل حساب «${acc.displayName}» بنجاح.`
          : `تم تعطيل حساب «${acc.displayName}».`
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleSetProPlan = async (
    acc: UserAccountRecord,
    plan: 'free' | 'monthly' | 'annual'
  ) => {
    setBusyId(acc.id);
    setActionMsg(null);
    const proActive = plan !== 'free';
    try {
      await onUpdateAccount(acc.id, {
        accountStatus: proActive ? 'active' : acc.accountStatus,
        proActive,
        proPlan: plan,
      });
      setActionMsg(
        proActive
          ? `تم تفعيل باقة برو (${plan === 'annual' ? 'سنوي' : 'شهري'}) لحساب «${acc.displayName}».`
          : `تم إرجاع حساب «${acc.displayName}» إلى الخطة المجانية.`
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleAddAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim().length < 2) return;
    setBusyId('__create__');
    setActionMsg(null);
    try {
      await onCreateAccount({
        displayName: newName.trim(),
        email: newEmail.trim(),
        phone: newPhone.trim(),
        accountStatus: newStatus,
        proActive: newPlan !== 'free',
        proPlan: newPlan,
      });
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setShowAddForm(false);
      setActionMsg('تمت إضافة الحساب وتفعيل صلاحياته بنجاح.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-panel-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#181B20] shadow-2xl overflow-hidden"
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
                <span>لوحة الإدارة والتحكم · {brandName}</span>
              </div>
              <h2
                id="admin-panel-title"
                className="font-display text-lg font-bold text-slate-900 dark:text-white truncate"
              >
                إدارة وتفعيل الحسابات واشتراكات برو
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

        {/* Body */}
        {!isAdminAuthorized ? (
          <div className="p-6 sm:p-10 flex justify-center overflow-y-auto">
            <form onSubmit={handleAdminGateSubmit} className="w-full max-w-md space-y-4">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                <Lock className="w-5 h-5 text-blue-600" />
                <h3 className="font-display text-base font-bold">
                  تسجيل دخول المدير
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                أدخل اسم المستخدم والرقم السري الخاص بلوحة الإدارة لفتح أدوات تفعيل الحسابات وطلبات برو.
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  اسم المستخدم
                </label>
                <input
                  type="text"
                  dir="ltr"
                  required
                  value={adminUser}
                  onChange={(e) => setAdminUser(e.target.value)}
                  placeholder="bachirofst@gmail.com"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm text-left text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  الرقم السري
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    dir="ltr"
                    required
                    value={adminPass}
                    onChange={(e) => setAdminPass(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pl-10 pr-3.5 py-2.5 text-sm text-left text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {loginError && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">{loginError}</p>
              )}

              <button
                type="submit"
                className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 py-2.5 text-sm font-semibold text-white transition-colors"
              >
                دخول لوحة الإدارة
              </button>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Cloud Sync Banner if logged in via Admin credentials without Google Auth */}
            {!isCloudAdminSignedIn && (
              <div className="px-6 py-3 bg-amber-50/80 dark:bg-amber-950/30 border-b border-amber-200/70 dark:border-amber-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className="text-amber-900 dark:text-amber-300">
                  تم الدخول عبر بيانات المدير المحلية. لمزامنة وتفعيل الحسابات عبر قاعدة بيانات السحابة (Firestore) لجميع المستخدمين، اربط بحساب Google الإداري:
                </span>
                <button
                  type="button"
                  onClick={() => void onGoogleSyncSignIn()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-1.5 text-[11px] font-semibold text-white whitespace-nowrap shrink-0 self-start sm:self-auto"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>ربط حساب Google</span>
                </button>
              </div>
            )}

            {/* Tabs & KPI Summary */}
            <div className="px-6 pt-4 pb-3 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 self-start">
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
                  <span>تفعيل الحسابات ({stats.total})</span>
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
                  <span>طلبات الاشتراك ({orders.length})</span>
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
                  <span>الإعدادات</span>
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

            {/* Scrollable Tab Content */}
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
                <div className="space-y-4">
                  {/* Controls Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative w-64">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="ابحث بالاسم، البريد، أو الهاتف..."
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
                      <span>إضافة وتفعيل حساب</span>
                    </button>
                  </div>

                  {/* Manual Add/Activate Form */}
                  {showAddForm && (
                    <form
                      onSubmit={handleAddAccountSubmit}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-3"
                    >
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        إنشاء أو تفعيل حساب عضو جديد
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                        <input
                          type="text"
                          required
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="الاسم الكامل"
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white"
                        />
                        <input
                          type="email"
                          dir="ltr"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="email@gmail.com"
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-left text-slate-900 dark:text-white"
                        />
                        <input
                          type="tel"
                          dir="ltr"
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                          placeholder="06XXXXXXXX"
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-left font-mono-nums text-slate-900 dark:text-white"
                        />
                        <select
                          value={newPlan}
                          onChange={(e) =>
                            setNewPlan(e.target.value as 'free' | 'monthly' | 'annual')
                          }
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white"
                        >
                          <option value="monthly">باقة برو شهري</option>
                          <option value="annual">باقة برو سنوي</option>
                          <option value="free">حساب مجاني</option>
                        </select>
                        <select
                          value={newStatus}
                          onChange={(e) => setNewStatus(e.target.value as UserAccountStatus)}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white"
                        >
                          <option value="active">حساب نشط ومفعّل</option>
                          <option value="suspended">معلّق / معطّل</option>
                        </select>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowAddForm(false)}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"
                        >
                          إلغاء
                        </button>
                        <button
                          type="submit"
                          disabled={busyId === '__create__'}
                          className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-1.5 text-xs font-semibold text-white"
                        >
                          {busyId === '__create__' ? 'جارٍ الحفظ...' : 'حفظ وتفعيل'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Accounts List */}
                  {filteredAccounts.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-xs text-slate-500">
                      لا توجد حسابات مطابقة حالياً. يظهر هنا كل عضو يدخل إلى المنصة تلقائياً أو الحسابات المضافة يدوياً.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-[#181B20]">
                      {filteredAccounts.map((acc) => {
                        const isBusy = busyId === acc.id;
                        const isActive = acc.accountStatus === 'active';
                        return (
                          <div
                            key={acc.id}
                            className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                                <span>{acc.displayName}</span>
                                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                                <span
                                  className={`text-xs font-semibold ${
                                    isActive
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : 'text-red-600 dark:text-red-400'
                                  }`}
                                >
                                  {isActive ? 'حساب مفعّل' : 'حساب معطّل'}
                                </span>
                                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                                <span
                                  className={`text-xs font-semibold ${
                                    acc.proActive
                                      ? 'text-amber-700 dark:text-amber-400'
                                      : 'text-slate-500 dark:text-slate-400'
                                  }`}
                                >
                                  {acc.proActive
                                    ? `برو مفعّل (${acc.proPlan === 'annual' ? 'سنوي' : 'شهري'})`
                                    : 'خطة مجانية'}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono-nums">
                                {acc.email && <span dir="ltr">{acc.email}</span>}
                                {acc.phone && <span dir="ltr">{acc.phone}</span>}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              {!acc.proActive ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => void handleSetProPlan(acc, 'monthly')}
                                    className="inline-flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-white transition-colors whitespace-nowrap"
                                  >
                                    <Crown className="w-3.5 h-3.5" />
                                    <span>تفعيل برو (شهري)</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => void handleSetProPlan(acc, 'annual')}
                                    className="inline-flex items-center gap-1 rounded-lg border border-blue-600 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap"
                                  >
                                    <span>برو سنوي</span>
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleSetProPlan(acc, 'free')}
                                  className="rounded-lg border border-amber-300 dark:border-amber-800 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 disabled:opacity-50 transition-colors whitespace-nowrap"
                                >
                                  إلغاء برو
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleToggleAccountActivation(acc)}
                                className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                                  isActive
                                    ? 'border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                }`}
                              >
                                {isActive ? (
                                  <>
                                    <UserX className="w-3.5 h-3.5" />
                                    <span>تعطيل الحساب</span>
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="w-3.5 h-3.5" />
                                    <span>تفعيل الحساب</span>
                                  </>
                                )}
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
                      لا توجد طلبات اشتراك برو مسجلة حتى الآن.
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

                          <div className="flex items-center gap-2 shrink-0">
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

                            {ord.status !== 'approved' && (
                              <button
                                type="button"
                                onClick={() => void onUpdateOrderStatus(ord.id, 'approved')}
                                className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                              >
                                تفعيل برو والحساب
                              </button>
                            )}
                            {ord.status === 'pending' && (
                              <button
                                type="button"
                                onClick={() => void onUpdateOrderStatus(ord.id, 'rejected')}
                                className="rounded-lg border border-red-200 dark:border-red-900 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                              >
                                رفض
                              </button>
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
                onClick={onAdminLogout}
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
        )}
      </div>
    </div>
  );
};
