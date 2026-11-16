import React, { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Crown,
  ExternalLink,
  LogIn,
  MessageCircle,
  Phone,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import {
  ContactChannel,
  PaymentMethod,
  ProPlanType,
  ProSubscriptionOrder,
} from '../types/planner';
import {
  BARIDIMOB_RIP,
  FLEXY_PHONE,
  PRO_PLANS,
  WHATSAPP_INTL,
} from './ProSubscriptionSection';
import { BRAND_LOGO_URL } from '../utils/assets';

interface ProSubscribeModalProps {
  isOpen: boolean;
  brandName: string;
  facebookUrl: string;
  userEmail?: string | null;
  isSignedIn: boolean;
  isUserProActive: boolean;
  onClose: () => void;
  onSignIn?: () => Promise<void>;
  onSubmitOrder: (
    order: Omit<ProSubscriptionOrder, 'id' | 'ownerId' | 'status' | 'createdAtMs'>
  ) => Promise<void>;
}

export const ProSubscribeModal: React.FC<ProSubscribeModalProps> = ({
  isOpen,
  brandName,
  facebookUrl,
  userEmail,
  isSignedIn,
  isUserProActive,
  onClose,
  onSignIn,
  onSubmitOrder,
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

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const pricing = useMemo(() => {
    const plan = PRO_PLANS[planType];
    const base = plan.baseDzd;
    const surcharge = paymentMethod === 'flexy' ? Math.round(base * 0.1) : 0;
    const total = base + surcharge;
    return { plan, base, surcharge, total };
  }, [planType, paymentMethod]);

  const activationMessage = useMemo(() => {
    const methodLabel =
      paymentMethod === 'baridimob'
        ? `بريدي موب (RIP: ${BARIDIMOB_RIP})`
        : `فليكسي +10% (${FLEXY_PHONE})`;
    const emailPart = userEmail ? `، البريد المسجل: ${userEmail}` : '';
    return `السلام عليكم ${brandName}، قمت بتحويل مبلغ ${pricing.total.toLocaleString('en-US')} د.ج لتفعيل ${pricing.plan.label} عبر ${methodLabel}. الاسم: ${customerName.trim() || '—'}، الهاتف: ${contactPhone.trim() || '—'}${emailPart}. مرفق صورة الوصل لتفعيل حسابي.`;
  }, [brandName, paymentMethod, pricing, customerName, contactPhone, userEmail]);

  const whatsappUrl = useMemo(
    () => `https://wa.me/${WHATSAPP_INTL}?text=${encodeURIComponent(activationMessage)}`,
    [activationMessage]
  );

  if (!isOpen) return null;

  const copyText = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Ignore clipboard permission denials
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
        'تم تسجيل طلب الاشتراك بنجاح! أرسل الآن لقطة شاشة الوصل عبر الواتساب أو الفيسبوك أعلاه ليقوم المشرف بتفعيل باقة برو على حسابك.'
      );
      setReceiptNote('');
    } catch {
      setFormError('تعذر تسجيل الطلب حالياً. تأكد من اتصالك وحاول مجدداً.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#181B20] shadow-2xl overflow-hidden"
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
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                <Crown className="w-3.5 h-3.5 shrink-0" />
                <span>دليل الاشتراك والتفعيل السريع · {brandName}</span>
              </div>
              <h2
                id="pro-modal-title"
                className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate"
              >
                الاشتراك في باقة برو (Pro) — تعليمات الدفع والتفعيل
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة الاشتراك"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-6 space-y-6 studio-scroll">
          {isUserProActive && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 px-4 py-3 text-xs text-emerald-800 dark:text-emerald-300">
              <div className="inline-flex items-center gap-2 font-semibold">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>حسابك مفعّل حالياً على باقة برو — يمكنك فتح جميع التصاميم الجزائرية الـ 200.</span>
              </div>
            </div>
          )}

          {/* Plan & Method Quick Configurator */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                اختر المدة:
              </div>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-900">
                {(['monthly', 'annual'] as ProPlanType[]).map((key) => {
                  const p = PRO_PLANS[key];
                  const active = planType === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPlanType(key)}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-white dark:bg-[#181B20] text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {key === 'monthly' ? 'شهري · 1,000 د.ج' : 'سنوي · 8,000 د.ج'}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                طريقة التحويل المحلي:
              </div>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('baridimob')}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                    paymentMethod === 'baridimob'
                      ? 'bg-white dark:bg-[#181B20] text-blue-700 dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5 shrink-0" />
                  <span>بريدي موب</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('flexy')}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                    paymentMethod === 'flexy'
                      ? 'bg-white dark:bg-[#181B20] text-amber-700 dark:text-amber-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5 shrink-0" />
                  <span>فليكسي (+10%)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Calculated Amount Summary Bar */}
          <div className="rounded-xl bg-slate-50 dark:bg-slate-900/70 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-white">
                {pricing.plan.label}
              </span>
              <span aria-hidden="true"> · </span>
              <span>
                {paymentMethod === 'baridimob'
                  ? 'تحويل بريدي موب بدون رسوم إضافية'
                  : `فليكسي بإضافة 10% (+${pricing.surcharge.toLocaleString('en-US')} د.ج)`}
              </span>
            </div>
            <div className="font-mono-nums text-lg font-bold text-blue-700 dark:text-blue-400 whitespace-nowrap">
              المبلغ المطلوب: {pricing.total.toLocaleString('en-US')} د.ج
            </div>
          </div>

          {/* Clear 3-Step Transfer & Screenshot Guide */}
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border-y border-slate-200 dark:border-slate-800">
            {/* Step 1: Local Bank / Flexy Transfer Coordinates */}
            <div className="py-5 space-y-4">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  01. قم بتحويل المبلغ عبر بريدي موب أو فليكسي
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  اختر إحدى الطريقتين التاليتين لإتمام التحويل المحلي بدقة:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* BaridiMob Coordinate */}
                <div
                  className={`rounded-xl p-4 transition-colors border ${
                    paymentMethod === 'baridimob'
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      <span>تحويل بريدي موب (BaridiMob / CCP)</span>
                    </span>
                    <span className="text-[11px] font-mono-nums font-semibold text-emerald-700 dark:text-emerald-400">
                      {pricing.base.toLocaleString('en-US')} د.ج
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    رقم الحساب البريدي (RIP):
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <code
                      dir="ltr"
                      className="text-sm sm:text-base font-bold font-mono-nums text-slate-900 dark:text-white select-all tracking-wide"
                    >
                      {BARIDIMOB_RIP}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyText('rip', BARIDIMOB_RIP)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                    >
                      {copiedKey === 'rip' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === 'rip' ? 'تم النسخ' : 'نسخ RIP'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                    افتح تطبيق <strong>BaridiMob</strong> ← التحويلات (Virements) ← أدخل رقم الـ RIP أعلاه وأرسل المبلغ بدون رسوم إضافية.
                  </p>
                </div>

                {/* Flexy +10% Coordinate */}
                <div
                  className={`rounded-xl p-4 transition-colors border ${
                    paymentMethod === 'flexy'
                      ? 'border-amber-600 bg-amber-50/50 dark:bg-amber-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                      <Smartphone className="w-4 h-4 text-amber-600" />
                      <span>فليكسي الهاتف (+10% عمولة)</span>
                    </span>
                    <span className="text-[11px] font-mono-nums font-semibold text-amber-700 dark:text-amber-400">
                      {Math.round(pricing.base * 1.1).toLocaleString('en-US')} د.ج
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    رقم الهاتف لاستقبال الفليكسي:
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <code
                      dir="ltr"
                      className="text-base font-bold font-mono-nums text-slate-900 dark:text-white select-all tracking-wider"
                    >
                      {FLEXY_PHONE}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyText('flexy', FLEXY_PHONE)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                    >
                      {copiedKey === 'flexy' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === 'flexy' ? 'تم النسخ' : 'نسخ الرقم'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                    أرسل رصيد فليكسي إلى الرقم <strong>{FLEXY_PHONE}</strong> بقيمة{' '}
                    <strong className="font-mono-nums">
                      {Math.round(pricing.base * 1.1).toLocaleString('en-US')} د.ج
                    </strong>{' '}
                    (سعر الباقة + 10%).
                  </p>
                </div>
              </div>
            </div>

            {/* Step 2: Take Transaction Screenshot */}
            <div className="py-5 space-y-2">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-600 shrink-0" />
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  02. التقط صورة (Screenshot) لوصل العملية
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                بعد إتمام التحويل، التقط <strong>لقطة شاشة واضحة لوصل الدفع</strong> في تطبيق بريدي موب (تظهر فيها القيمة، رقم العملية والتاريخ)، أو <strong>صورة رسالة تأكيد الفليكسي</strong> مع ذكر الرقم الذي أرسلت منه.
              </p>
            </div>

            {/* Step 3: Send Screenshot to Admin via WhatsApp or Facebook */}
            <div className="py-5 space-y-3">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  03. أرسل صورة الوصل إلى الإدارة لتفعيل حسابك فوراً
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  أرسل صورة الوصل عبر <strong>واتساب ({FLEXY_PHONE})</strong> أو <strong>حساب فيسبوك</strong> وأرفق بريدك الإلكتروني المسجل به في المنصة{' '}
                  {userEmail ? (
                    <span dir="ltr" className="font-mono-nums font-semibold text-slate-900 dark:text-white">
                      ({userEmail})
                    </span>
                  ) : (
                    <span>(أو رقم هاتفك)</span>
                  )}{' '}
                  لتتم مراجعة الوصل وتفعيل باقة برو مباشرة.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>إرسال صورة الوصل عبر واتساب (0696380965)</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </a>

                <a
                  href={facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-blue-600 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 px-4 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>إرسال الوصل عبر فيسبوك</span>
                </a>

                <button
                  type="button"
                  onClick={() => copyText('msg', activationMessage)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                >
                  {copiedKey === 'msg' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedKey === 'msg' ? 'تم نسخ نص الرسالة' : 'نسخ رسالة جاهزة للفيسبوك'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Step 4: Quick Activation Confirmation Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  04. سجّل طلب التفعيل في المنصة (اختياري لتسريع المطابقة)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  توثيق الطلب هنا يربطه مباشرة بحسابك ليظهر للمشرف فور إرسال الوصل.
                </p>
              </div>
              {!isSignedIn && onSignIn && (
                <button
                  type="button"
                  onClick={() => onSignIn()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 self-start"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>تسجيل الدخول بـ Google أولاً</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  رقم الهاتف / الواتساب
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
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  قناة إرسال صورة الوصل
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
                    واتساب
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
                  رقم مرجع التحويل أو وقت الإرسال (اختياري)
                </label>
                <input
                  type="text"
                  maxLength={240}
                  value={receiptNote}
                  onChange={(e) => setReceiptNote(e.target.value)}
                  placeholder="مثال: عملية رقم 8421 الساعة 14:30"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {formError && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400">{formError}</p>
            )}
            {submittedMsg && (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-3 text-xs font-medium text-emerald-800 dark:text-emerald-300 leading-relaxed">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{submittedMsg}</span>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                إغلاق
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 px-5 py-2.5 text-xs font-semibold text-white transition-colors whitespace-nowrap"
              >
                <Crown className="w-3.5 h-3.5" />
                <span>
                  {submitting
                    ? 'جارٍ تسجيل الطلب...'
                    : `توثيق طلب اشتراك برو (${pricing.total.toLocaleString('en-US')} د.ج)`}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
