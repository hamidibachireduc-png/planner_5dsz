import React, { useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  LogOut,
  MessageCircle,
  Moon,
  ShieldCheck,
  Sun,
  UserCheck,
} from 'lucide-react';
import { BRAND_LOGO_URL, TEMPLATE_IMAGES } from '../utils/assets';
import { FLEXY_PHONE, WHATSAPP_INTL } from './ProSubscriptionSection';

interface AuthGateScreenProps {
  brandName: string;
  isDarkTheme: boolean;
  authReady: boolean;
  suspendedAccount?: {
    displayName: string;
    email: string;
  } | null;
  onToggleTheme: () => void;
  onGoogleSignIn: () => Promise<void>;
  onClientLogin: (payload: { displayName: string; email: string; phone: string }) => void;
  onAdminLogin: (username: string, password: string) => boolean;
  onSignOut: () => Promise<void>;
}

export const AuthGateScreen: React.FC<AuthGateScreenProps> = ({
  brandName,
  isDarkTheme,
  authReady,
  suspendedAccount,
  onToggleTheme,
  onGoogleSignIn,
  onClientLogin,
  onAdminLogin,
  onSignOut,
}) => {
  const [mode, setMode] = useState<'member' | 'admin'>('member');

  // Member direct login fields
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [memberError, setMemberError] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);

  // Admin login fields
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  const handleGoogleClick = async () => {
    setMemberError(null);
    setGoogleBusy(true);
    try {
      await onGoogleSignIn();
    } catch {
      setMemberError('تعذر تسجيل الدخول عبر Google. يمكنك تجربة الدخول المباشر أدناه.');
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleClientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMemberError(null);
    if (clientName.trim().length < 2) {
      setMemberError('يرجى إدخال الاسم الكامل (حرفين على الأقل).');
      return;
    }
    if (!clientEmail.trim() && clientPhone.trim().length < 6) {
      setMemberError('يرجى إدخال البريد الإلكتروني أو رقم الهاتف لتسجيل دخولك.');
      return;
    }
    onClientLogin({
      displayName: clientName.trim(),
      email: clientEmail.trim(),
      phone: clientPhone.trim(),
    });
  };

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    if (!adminUser.trim() || !adminPass) {
      setAdminError('يرجى إدخال اسم المستخدم والرقم السري.');
      return;
    }
    const ok = onAdminLogin(adminUser, adminPass);
    if (!ok) {
      setAdminError('اسم المستخدم أو الرقم السري للوحة الإدارة غير صحيح.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F6F2] dark:bg-[#111315] text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Clean Minimal Top Bar */}
      <header className="border-b border-slate-200/80 dark:border-slate-800 bg-[#F7F6F2]/95 dark:bg-[#111315]/95">
        <div className="max-w-[1160px] mx-auto px-6 h-16 flex items-center justify-between gap-6">
          <div className="inline-flex items-center gap-2.5 font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white whitespace-nowrap shrink-0">
            <img
              src={BRAND_LOGO_URL}
              alt={brandName}
              className="w-9 h-9 rounded-full object-cover border border-amber-600/40 shrink-0"
            />
            <span>{brandName}</span>
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
        {suspendedAccount ? (
          <div className="w-full max-w-lg rounded-2xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-[#181B20] p-6 sm:p-8 space-y-5 text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                الحساب بانتظار التفعيل من الإدارة
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                مرحباً <strong>{suspendedAccount.displayName}</strong>{' '}
                {suspendedAccount.email ? `(${suspendedAccount.email})` : ''}، تم إيقاف أو تعليق هذا الحساب مؤقتاً من لوحة المدير. يرجى التواصل مع الإدارة لتفعيل الحساب.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-2">
              <a
                href={`https://wa.me/${WHATSAPP_INTL}?text=${encodeURIComponent(
                  `السلام عليكم، أرجو تفعيل حسابي في منصة ${brandName}: ${suspendedAccount.displayName} (${suspendedAccount.email})`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>تواصل عبر واتساب ({FLEXY_PHONE})</span>
              </a>
              <button
                type="button"
                onClick={() => void onSignOut()}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-[1040px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] overflow-hidden grid grid-cols-1 lg:grid-cols-12 shadow-sm">
            {/* Right/Start Visual Architectural Showcase */}
            <div className="lg:col-span-6 relative min-h-[260px] lg:min-h-[560px] bg-slate-900">
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
                    بوابة الدخول إلى استوديو تصميم المنازل والمخططات الهندسية
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                    سجّل دخولك للوصول إلى 200 تصميم بناء جزائري قابل للتعديل، مكتبة 567+ أثاث وأجهزة، حاسبة أسعار مواد البناء بالجزائر، وتصدير المخططات والفواتير بصيغة PDF.
                  </p>
                  <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-amber-200 font-medium">
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      رسم 2D ومعاينة 3D فورية
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      مزامنة وحفظ سحابي ومحلي
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Left/End Authentication Panel */}
            <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-center">
              {/* Segmented Tab: Member Login vs Admin Login */}
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 mb-6">
                <button
                  type="button"
                  onClick={() => setMode('member')}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2.5 px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                    mode === 'member'
                      ? 'bg-white dark:bg-[#181B20] text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>دخول الأعضاء والموقع</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('admin')}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2.5 px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                    mode === 'admin'
                      ? 'bg-white dark:bg-[#181B20] text-blue-700 dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>دخول الإدارة (المدير)</span>
                </button>
              </div>

              {mode === 'member' ? (
                <div className="space-y-5">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                      تسجيل الدخول للتصفح والتصميم
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      ادخل بحساب Google لمزامنة مشاريعك وتفعيل اشتراك برو سحابياً، أو سجّل بحساب مباشر.
                    </p>
                  </div>

                  {/* Google Auth Button */}
                  <button
                    type="button"
                    disabled={!authReady || googleBusy}
                    onClick={() => void handleGoogleClick()}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 px-4 py-3 text-sm font-semibold text-white transition-colors"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>
                      {googleBusy ? 'جارٍ الاتصال بحساب Google...' : 'تسجيل الدخول بحساب Google'}
                    </span>
                  </button>

                  <div className="relative flex items-center py-1">
                    <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
                    <span className="shrink-0 px-3 text-[11px] text-slate-400">
                      أو الدخول بحساب جديد / مباشر
                    </span>
                    <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
                  </div>

                  <form onSubmit={handleClientSubmit} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        الاسم الكامل
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={80}
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="مثال: كريم بن علي"
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          البريد الإلكتروني
                        </label>
                        <input
                          type="email"
                          dir="ltr"
                          maxLength={120}
                          value={clientEmail}
                          onChange={(e) => setClientEmail(e.target.value)}
                          placeholder="name@gmail.com"
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-right text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          رقم الهاتف / الواتساب
                        </label>
                        <input
                          type="tel"
                          dir="ltr"
                          maxLength={30}
                          value={clientPhone}
                          onChange={(e) => setClientPhone(e.target.value)}
                          placeholder="06XXXXXXXX"
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm font-mono-nums text-right text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {memberError && (
                      <p className="text-xs font-medium text-red-600 dark:text-red-400">
                        {memberError}
                      </p>
                    )}

                    <button
                      type="submit"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 px-4 py-2.5 text-xs font-semibold text-white transition-colors"
                    >
                      دخول وفتح المنصة
                    </button>
                  </form>
                </div>
              ) : (
                <form onSubmit={handleAdminSubmit} className="space-y-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                      دخول لوحة الإدارة الخاصة بالمدير
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      أدخل اسم المستخدم والرقم السري للوصول إلى لوحة إدارة الحسابات وتفعيل الاشتراكات.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      اسم المستخدم (البريد الإلكتروني)
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
                        aria-label="إظهار أو إخفاء كلمة المرور"
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                      >
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {adminError && (
                    <p className="text-xs font-medium text-red-600 dark:text-red-400">
                      {adminError}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>دخول لوحة الإدارة</span>
                  </button>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                    يمكن للمدير أيضاً تسجيل الدخول مباشرة عبر حساب Google المعتمد في تبويب الأعضاء.
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
