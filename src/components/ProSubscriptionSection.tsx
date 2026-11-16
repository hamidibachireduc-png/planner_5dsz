import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  MessageCircle,
  Phone,
  ShieldCheck,
  Smartphone,
  XCircle,
} from 'lucide-react';
import {
  ContactChannel,
  PaymentMethod,
  ProPlanType,
  ProSubscriptionOrder,
} from '../types/planner';

export const BARIDIMOB_RIP = '00799999000468867263';
export const FLEXY_PHONE = '0696380965';
export const WHATSAPP_INTL = '213696380965';

export const PRO_PLANS: Record<ProPlanType, { label: string; period: string; baseDzd: number }> = {
  monthly: { label: 'باقة برو الشهرية', period: 'شهر واحد (1,000 د.ج/شهر)', baseDzd: 1000 },
  annual: { label: 'باقة برو السنوية', period: 'سنة كاملة (توفير 33% — 4 أشهر مجانية)', baseDzd: 8000 },
};

interface ProSubscriptionSectionProps {
  brandName: string;
  isAdmin: boolean;
  isSignedIn: boolean;
  facebookUrl: string;
  orders: ProSubscriptionOrder[];
  onSaveFacebookUrl: (url: string) => void;
  onSubmitOrder: (
    order: Omit<ProSubscriptionOrder, 'id' | 'ownerId' | 'status' | 'createdAtMs'>
  ) => Promise<void>;
  onUpdateOrderStatus: (orderId: string, status: 'approved' | 'rejected') => Promise<void>;
  onOpenSubscribeModal?: () => void;
}

export const ProSubscriptionSection: React.FC<ProSubscriptionSectionProps> = ({
  brandName,
  isAdmin,
  isSignedIn,
  facebookUrl,
  orders,
  onSaveFacebookUrl,
  onSubmitOrder,
  onUpdateOrderStatus,
  onOpenSubscribeModal,
}) => {
  const [planType, setPlanType] = useState<ProPlanType>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('baridimob');
  const [contactChannel, setContactChannel] = useState<ContactChannel>('whatsapp');
  const [customerName, setCustomerName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [receiptNote, setReceiptNote] = useState('');

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedMsg, setSubmittedMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fbDraft, setFbDraft] = useState(facebookUrl);
  const [fbSaved, setFbSaved] = useState(false);

  const pricing = useMemo(() => {
    const plan = PRO_PLANS[planType];
    const base = plan.baseDzd;
    const surcharge = paymentMethod === 'flexy' ? Math.round(base * 0.1) : 0;
    const total = base + surcharge;
    return { plan, base, surcharge, total };
  }, [planType, paymentMethod]);

  const isUserProActive = useMemo(
    () => orders.some((o) => o.status === 'approved'),
    [orders]
  );

  const whatsappText = useMemo(() => {
    const methodLabel =
      paymentMethod === 'baridimob'
        ? `بريدي موب (RIP: ${BARIDIMOB_RIP})`
        : `فليكسي +10% (${FLEXY_PHONE})`;
    return encodeURIComponent(
      `السلام عليكم ${brandName}، أرغب في تفعيل الاشتراك برو (${pricing.plan.label}) عبر ${methodLabel} بمبلغ ${pricing.total.toLocaleString('en-US')} د.ج. الاسم: ${customerName || '—'}، الهاتف: ${contactPhone || '—'}`
    );
  }, [brandName, paymentMethod, pricing, customerName, contactPhone]);

  const copyText = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Clipboard fallback ignored if blocked
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmittedMsg(null);

    if (customerName.trim().length < 2) {
      setFormError('يرجى إدخال الاسم الكامل.');
      return;
    }
    if (contactPhone.trim().length < 6) {
      setFormError('يرجى إدخال رقم هاتف أو واتساب صحيح.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitOrder({
        customerName: customerName.trim(),
        contactPhone: contactPhone.trim(),
        contactChannel,
        planType,
        paymentMethod,
        baseAmountDzd: pricing.base,
        surchargeDzd: pricing.surcharge,
        totalAmountDzd: pricing.total,
        receiptNote: receiptNote.trim(),
      });
      setSubmittedMsg(
        'تم تسجيل طلب الاشتراك بنجاح. أرسل صورة الوصل أو تأكيد الفليكسي عبر الواتساب أو الفيسبوك ليتم التفعيل.'
      );
      setReceiptNote('');
    } catch {
      setFormError('تعذر إرسال الطلب حالياً. تأكد من اتصالك وحاول مجدداً.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="pro" className="py-12 border-t border-slate-200 dark:border-slate-800">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            الاشتراك برو (Pro) — 1,000 د.ج شهرياً عبر بريدي موب أو فليكسي
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5 max-w-2xl">
            افتح جميع التصاميم الجزائرية الـ 200 (180 تصميماً حصرياً لبرو + 20 مجانياً)، ومشاريع سحابية غير محدودة وتصدير PDF هندسي متكامل. ادفع عبر بريدي موب بـ 1,000 د.ج شهرياً أو عبر فليكسي بإضافة 10% (1,100 د.ج).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {isUserProActive && (
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>حسابك مفعّل على باقة برو</span>
            </div>
          )}
          {onOpenSubscribeModal && (
            <button
              type="button"
              onClick={onOpenSubscribeModal}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>اشترك في برو · تعليمات الدفع والتفعيل</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Right/Start Column: Plan + Payment Instructions */}
        <div className="lg:col-span-7 space-y-5">
          {/* Step 1: Plan Selection */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] p-6 space-y-4">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              01. اختر مدة الاشتراك
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['monthly', 'annual'] as ProPlanType[]).map((key) => {
                const p = PRO_PLANS[key];
                const flexyTotal = Math.round(p.baseDzd * 1.1);
                const selected = planType === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPlanType(key)}
                    className={`rounded-xl border p-4 text-right transition-colors ${
                      selected
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/30'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-bold text-sm text-slate-900 dark:text-white">
                        {p.label}
                      </span>
                      {selected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {p.period}
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-slate-800 space-y-1">
                      <div className="text-lg font-bold font-mono-nums text-slate-900 dark:text-white">
                        {p.baseDzd.toLocaleString('en-US')} د.ج{' '}
                        <span className="text-xs font-normal text-slate-500">بريدي موب</span>
                      </div>
                      <div className="text-xs font-mono-nums text-slate-600 dark:text-slate-300">
                        أو {flexyTotal.toLocaleString('en-US')} د.ج فليكسي (+10%)
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Payment Method & Official Coordinates */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] p-6 space-y-4">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              02. اختر وسيلة الدفع وأرسل المبلغ
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* BaridiMob Option */}
              <button
                type="button"
                onClick={() => setPaymentMethod('baridimob')}
                className={`rounded-xl border p-4 text-right transition-colors ${
                  paymentMethod === 'baridimob'
                    ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/30'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 font-display font-bold text-sm text-slate-900 dark:text-white">
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    <span>بريدي موب (BaridiMob)</span>
                  </span>
                  <span className="text-xs font-mono-nums font-semibold text-emerald-700 dark:text-emerald-400">
                    بدون زيادة
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                  تحويل بريدي مباشر إلى رقم الحساب (RIP)
                </p>
              </button>

              {/* Flexy +10% Option */}
              <button
                type="button"
                onClick={() => setPaymentMethod('flexy')}
                className={`rounded-xl border p-4 text-right transition-colors ${
                  paymentMethod === 'flexy'
                    ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/30'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 font-display font-bold text-sm text-slate-900 dark:text-white">
                    <Smartphone className="w-4 h-4 text-amber-600" />
                    <span>فليكسي (Flexy)</span>
                  </span>
                  <span className="text-xs font-mono-nums font-semibold text-amber-700 dark:text-amber-400">
                    +10%
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                  تعبئة رصيد إلى رقم الهاتف بإضافة 10% على السعر
                </p>
              </button>
            </div>

            {/* Active Payment Details Box */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4 space-y-3">
              {paymentMethod === 'baridimob' ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      رقم الحساب البريدي (RIP) لبريدي موب
                    </div>
                    <div
                      dir="ltr"
                      className="text-base sm:text-lg font-bold font-mono-nums text-slate-900 dark:text-white tracking-wide mt-0.5 select-all"
                    >
                      {BARIDIMOB_RIP}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText('rip', BARIDIMOB_RIP)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors self-start sm:self-auto whitespace-nowrap shrink-0"
                  >
                    {copiedKey === 'rip' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedKey === 'rip' ? 'تم نسخ RIP' : 'نسخ رقم RIP'}</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      رقم الهاتف لتحويل فليكسي (مع إضافة 10%)
                    </div>
                    <div
                      dir="ltr"
                      className="text-lg font-bold font-mono-nums text-slate-900 dark:text-white tracking-wider mt-0.5 select-all"
                    >
                      {FLEXY_PHONE}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText('flexy', FLEXY_PHONE)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors self-start sm:self-auto whitespace-nowrap shrink-0"
                  >
                    {copiedKey === 'flexy' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedKey === 'flexy' ? 'تم نسخ الرقم' : 'نسخ رقم الفليكسي'}</span>
                  </button>
                </div>
              )}

              {/* Transparent Price Breakdown */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span>قيمة الاشتراك ({pricing.plan.label})</span>
                  <span className="font-mono-nums">{pricing.base.toLocaleString('en-US')} د.ج</span>
                </div>
                {paymentMethod === 'flexy' && (
                  <div className="flex items-center justify-between text-amber-700 dark:text-amber-400">
                    <span>إضافة فليكسي (10%)</span>
                    <span className="font-mono-nums">
                      +{pricing.surcharge.toLocaleString('en-US')} د.ج
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm font-bold text-slate-900 dark:text-white pt-1">
                  <span>المبلغ الإجمالي المطلوب تحويله</span>
                  <span className="font-mono-nums text-blue-700 dark:text-blue-400">
                    {pricing.total.toLocaleString('en-US')} د.ج
                  </span>
                </div>
              </div>
            </div>

            {/* Direct WhatsApp & Facebook Receipt Contact */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <a
                href={`https://wa.me/${WHATSAPP_INTL}?text=${whatsappText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
              >
                <MessageCircle className="w-4 h-4" />
                <span>إرسال الوصل عبر واتساب (0696380965)</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </a>

              <a
                href={facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-blue-600 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 px-4 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>مراسلة عبر حساب فيسبوك</span>
              </a>
            </div>
          </div>
        </div>

        {/* Left/End Column: Activation Order Form & Order Status */}
        <div className="lg:col-span-5 space-y-5">
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] p-6 space-y-4"
          >
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              03. تأكيد طلب التفعيل
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              سجّل بياناتك هنا بعد التحويل لتوثيق الطلب وتفعيله مباشرة على حسابك.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                الاسم الكامل
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="مثال: حميدي البشير"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                رقم الهاتف للتواصل أو التفعيل
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="tel"
                  required
                  dir="ltr"
                  maxLength={30}
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="0696380965"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pr-9 pl-3 py-2 text-sm font-mono-nums text-right text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                قناة إرسال الوصل المفضلة
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setContactChannel('whatsapp')}
                  className={`py-2 rounded-lg border text-xs font-medium transition-colors ${
                    contactChannel === 'whatsapp'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  واتساب (0696380965)
                </button>
                <button
                  type="button"
                  onClick={() => setContactChannel('facebook')}
                  className={`py-2 rounded-lg border text-xs font-medium transition-colors ${
                    contactChannel === 'facebook'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  فيسبوك
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                مرجع التحويل أو ملاحظة (اختياري)
              </label>
              <input
                type="text"
                maxLength={240}
                value={receiptNote}
                onChange={(e) => setReceiptNote(e.target.value)}
                placeholder="رقم العملية أو وقت التحويل"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            {formError && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400">{formError}</p>
            )}
            {submittedMsg && (
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 leading-relaxed">
                {submittedMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 py-2.5 text-sm font-semibold text-white transition-colors"
            >
              {submitting
                ? 'جارٍ تسجيل الطلب...'
                : `تأكيد طلب اشتراك برو (${pricing.total.toLocaleString('en-US')} د.ج)`}
            </button>

            {!isSignedIn && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
                بعد مراجعة الوصل، يرسل لك المدير اسم المستخدم والرقم السري للدخول مباشرة إلى باقة برو.
              </p>
            )}
          </form>

          {/* Owner Facebook Link Quick Configurator (shown to admin so he can paste his exact FB profile URL) */}
          {isAdmin && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] p-4 space-y-2.5">
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                إعداد رابط حساب فيسبوك الخاص بك (للمالك)
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  dir="ltr"
                  value={fbDraft}
                  onChange={(e) => setFbDraft(e.target.value)}
                  placeholder="https://www.facebook.com/your.profile"
                  className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    onSaveFacebookUrl(fbDraft);
                    setFbSaved(true);
                    setTimeout(() => setFbSaved(false), 2000);
                  }}
                  className="rounded-lg bg-slate-900 dark:bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white whitespace-nowrap shrink-0"
                >
                  {fbSaved ? 'تم الحفظ' : 'حفظ الرابط'}
                </button>
              </div>
            </div>
          )}

          {/* Orders List (User's own orders or All orders if Admin) */}
          {orders.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] p-5 space-y-3">
              <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                {isAdmin ? 'طلبات الاشتراك برو الواردة' : 'طلبات الاشتراك المسجلة'}
              </h4>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {orders.map((ord) => (
                  <div key={ord.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {ord.customerName} · {ord.contactPhone}
                      </span>
                      <span className="font-mono-nums font-bold text-slate-900 dark:text-white">
                        {ord.totalAmountDzd.toLocaleString('en-US')} د.ج
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>
                        {ord.planType === 'annual' ? 'سنوي' : 'شهري'} ·{' '}
                        {ord.paymentMethod === 'flexy' ? 'فليكسي (+10%)' : 'بريدي موب'} ·{' '}
                        {ord.contactChannel === 'whatsapp' ? 'واتساب' : 'فيسبوك'}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${
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
                    </div>
                    {isAdmin && ord.status === 'pending' && (
                      <div className="flex items-center gap-2 pt-1.5">
                        <button
                          type="button"
                          onClick={() => onUpdateOrderStatus(ord.id, 'approved')}
                          className="rounded-md bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white"
                        >
                          تفعيل برو
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateOrderStatus(ord.id, 'rejected')}
                          className="rounded-md border border-red-200 dark:border-red-900 px-2.5 py-1 text-[11px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          رفض
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
