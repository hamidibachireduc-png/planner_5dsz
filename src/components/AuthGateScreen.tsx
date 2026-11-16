import React, { useState } from 'react';
import {
  CheckCircle2,
  Crown,
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  MessageCircle,
  Moon,
  ShieldCheck,
  Sun,
  UserCheck,
} from 'lucide-react';
import { ProSubscriptionOrder } from '../types/planner';
import { BRAND_LOGO_URL, TEMPLATE_IMAGES } from '../utils/assets';
import { GUEST_MAX_DESIGNS } from '../utils/authStore';
import { ProSubscribeModal } from './ProSubscribeModal';
import { FLEXY_PHONE, WHATSAPP_INTL } from './ProSubscriptionSection';

interface AuthGateScreenProps {
  brandName: string;
  facebookUrl: string;
  isDarkTheme: boolean;
  guestDesignsUsed: number;
  onToggleTheme: () => void;
  onLogin: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  onGuestLogin: () => void;
  onSubmitProOrder: (
    order: Omit<ProSubscriptionOrder, 'id' | 'ownerId' | 'status' | 'createdAtMs'>
  ) => Promise<void>;
}

export const AuthGateScreen: React.FC<AuthGateScreenProps> = ({
  brandName,
  facebookUrl,
  isDarkTheme,
  guestDesignsUsed,
  onToggleTheme,
  onLogin,
  onGuestLogin,
  onSubmitProOrder,
}) => {
  const [mode, setMode] = useState<'subscriber' | 'admin'>('subscriber');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showProModal, setShowProModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    try {
      const result = await onLogin(username, password);
      if (!result.ok) {
        setErrorMsg(result.error || 'اسم المستخدم أو الرقم السري غير صحيح.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#F7F6F2] dark:bg-[#111315] text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Clean Minimal Top Bar */}
      <header className="border-b border-slate-200/80 dark:border-slate-800 bg-[#F7F6F2]/95 dark:bg-[#111315]/95">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-6">
          <div className="inline-flex items-center gap-2 sm:gap-2.5 font-display text-sm sm:text-lg font-bold text-slate-900 dark:text-white min-w-0 shrink">
            <img
              src={BRAND_LOGO_URL}
              alt={brandName}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border border-amber-600/40 shrink-0"
            />
            <span className="truncate">{brandName}</span>
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            {isDarkTheme ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{isDarkTheme ? 'الوضع الفاتح' : 'الوضع الداكن'}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-[1040px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] overflow-hidden grid grid-cols-1 lg:grid-cols-12 shadow-sm">
          {/* Right/Start Visual Showcase */}
          <div className="lg:col-span-6 relative min-h-[260px] lg:min-h-[540px] bg-slate-900">
            <img
              src={TEMPLATE_IMAGES.heroModernVilla}
              alt="استوديو التصميم المعماري ثنائي وثلاثي الأبعاد"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20 p-6 sm:p-8 flex flex-col justify-between">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-white/90">
                <img
                  src={BRAND_LOGO_URL}
                  alt={brandName}
                  className="w-10 h-10 rounded-full object-cover border border-amber-400/60"
                />
                <span>منصة {brandName}</span>
              </div>

              <div className="space-y-3">
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-white leading-snug [text-wrap:balance]">
                  بوابة الدخول إلى استوديو تصميم المنازل والمخططات 2D و 3D
                </h1>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  ادخل باسم المستخدم والرقم السري المفعّل من الإدارة للاستفادة من 200 تصميم بناء جزائري قابل للتعديل، مكتبة 567+ أثاث وأجهزة، حاسبة أسعار مواد البناء، وتصدير المخططات PDF.
                </p>
                <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-amber-200 font-medium">
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    دخول مباشر بدون تعقيدات
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    حفظ المشاريع داخل جهازك
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Left/End Login Form */}
          <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-center">
            {/* Switch between Subscriber & Admin */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('subscriber');
                  setErrorMsg(null);
                }}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2.5 px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                  mode === 'subscriber'
                    ? 'bg-white dark:bg-[#181B20] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>دخول المشتركين</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('admin');
                  setErrorMsg(null);
                }}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2.5 px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                  mode === 'admin'
                    ? 'bg-white dark:bg-[#181B20] text-blue-700 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>دخول المدير</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {mode === 'admin'
                    ? 'دخول المدير — لوحة الإدارة وتوليد الحسابات'
                    : 'دخول المشتركين باسم المستخدم والرقم السري'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {mode === 'admin'
                    ? 'أدخل بريد الإدارة والرقم السري لفتح لوحة التحكم وإنشاء حسابات المشتركين.'
                    : 'أدخل اسم المستخدم والرقم السري الذي حصلت عليه من الإدارة للدخول إلى المنصة.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  اسم المستخدم
                </label>
                <input
                  type="text"
                  dir="ltr"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={mode === 'admin' ? 'bachirofst@gmail.com' : 'مثال: ahmed2026'}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm text-left text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  الرقم السري
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    dir="ltr"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'admin' ? '••••••••••••' : 'أدخل الرقم السري'}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pr-9 pl-10 py-2.5 text-sm text-left text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((s) => !s)}
                    aria-label="إظهار أو إخفاء الرقم السري"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 px-4 py-3 text-sm font-semibold text-white transition-colors"
              >
                {mode === 'admin' ? <ShieldCheck className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                <span>
                  {busy
                    ? 'جارٍ التحقق...'
                    : mode === 'admin'
                    ? 'دخول لوحة الإدارة'
                    : 'دخول للموقع'}
                </span>
              </button>
            </form>

            {/* Temporary Public Preview & Helpful Pro CTA for New Visitors */}
            {mode === 'subscriber' && (
              <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 space-y-4">
                {/* Temporary Guest Preview Box */}
                <div className="rounded-xl border border-amber-300/80 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/25 p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-300">
                      <Eye className="w-4 h-4 shrink-0" />
                      <span>دخول مؤقت ومعاينة للعامة (تصميم واحد فقط)</span>
                    </div>
                    <span className="text-[11px] font-mono-nums font-semibold text-amber-800 dark:text-amber-400">
                      {guestDesignsUsed >= GUEST_MAX_DESIGNS
                        ? 'تم استهلاك الحصة المجانية'
                        : 'متاح: 1 تصميم'}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-900/85 dark:text-amber-200/85 leading-relaxed">
                    يمكنك الدخول مؤقتاً لمعاينة المنصة ومكتبة الأثاث وحاسبة الأسعار وإنشاء{' '}
                    <strong>تصميم واحد فقط</strong> للتجربة. لإنشاء تصاميم متعددة وفتح كل القوالب الـ 200 يلزم الاشتراك في <strong>نسخة برو</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={onGuestLogin}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-amber-600 bg-white dark:bg-slate-900 hover:bg-amber-600 hover:text-white dark:hover:bg-amber-600 text-amber-900 dark:text-amber-300 px-3.5 py-2 text-xs font-semibold transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>دخول مؤقت ومعاينة المنصة الآن</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    ليس لديك اسم مستخدم ورقم سري بعد؟
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    اشترك في باقة برو (1,000 د.ج شهرياً عبر بريدي موب أو فليكسي +10%) وسيقوم المدير بإرسال اسم المستخدم والرقم السري الخاص بك مباشرة.
                  </p>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShowProModal(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-600 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 px-3 py-2 text-xs font-semibold transition-colors"
                    >
                      <Crown className="w-3.5 h-3.5" />
                      <span>تعليمات الاشتراك برو</span>
                    </button>
                    <a
                      href={`https://wa.me/${WHATSAPP_INTL}?text=${encodeURIComponent(
                        `السلام عليكم ${brandName}، أريد الحصول على اسم مستخدم ورقم سري للدخول إلى المنصة.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>اطلب حساباً عبر واتساب ({FLEXY_PHONE})</span>
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <ProSubscribeModal
        isOpen={showProModal}
        brandName={brandName}
        facebookUrl={facebookUrl}
        isSignedIn={false}
        isUserProActive={false}
        onClose={() => setShowProModal(false)}
        onSubmitOrder={onSubmitProOrder}
      />
    </div>
  );
};
