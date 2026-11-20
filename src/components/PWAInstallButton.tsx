import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) return;
    }
    setShowGuideModal(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700/80 bg-emerald-50/90 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 font-semibold transition-colors whitespace-nowrap shrink-0 ${
          compact ? 'px-2.5 py-1.5 text-xs min-h-[36px]' : 'px-3.5 py-2 text-xs min-h-[38px]'
        } ${className}`}
        title="تثبيت داري كتطبيق على الهاتف أو الحاسوب"
      >
        {isInstallable ? (
          <Download className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
        )}
        <span>{isInstallable ? 'تثبيت التطبيق' : 'تطبيق الهاتف'}</span>
      </button>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="تثبيت تطبيق داري على الهاتف"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#181B20] p-5 shadow-2xl space-y-4 text-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  تثبيت «داري» كتطبيق على هاتفك
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  تطبيق ويب تقدمي (PWA) جاهز للعمل بوضع الشاشة الكاملة دون متصفح
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="إغلاق"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-2 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                <p className="font-semibold text-blue-700 dark:text-blue-400">
                  على أجهزة iPhone و iPad (متصفح Safari):
                </p>
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>افتح التطبيق في رابط مباشر عبر متصفح Safari.</li>
                  <li>
                    اضغط على زر <strong>المشاركة (Share)</strong> في شريط المتصفح بالأسفل.
                  </li>
                  <li>
                    اختر <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong> ثم{' '}
                    <strong>إضافة</strong>.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                  التثبيت المباشر على أندرويد (Android / Chrome):
                </p>
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>افتح رابط التطبيق في متصفح Chrome على هاتفك (في نافذة مستقلة).</li>
                  <li>
                    من قائمة المتصفح (النقاط الثلاث ⋮) اختر{' '}
                    <strong>تثبيت التطبيق</strong> أو{' '}
                    <strong>إضافة إلى الشاشة الرئيسية</strong>.
                  </li>
                  <li>سيتم تثبيت «داري» بأيقونته الرسمية ويعمل كتطبيق مستقل تماماً.</li>
                </ol>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3 text-[11px] text-slate-600 dark:text-slate-300">
                  لاستخراج ملف <strong>APK</strong>: انسخ رابط التطبيق المنشور وضعه في{' '}
                  <span dir="ltr" className="font-mono-nums font-semibold">
                    pwabuilder.com
                  </span>{' '}
                  أو استخدم إعدادات Capacitor المرفقة في المشروع مع Android Studio.
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-blue-700 py-2.5 text-xs font-semibold text-white transition-colors"
            >
              فهمت
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-[75] flex items-center gap-2 rounded-lg border border-amber-400 bg-amber-600 px-3 py-2 text-xs font-semibold text-white shadow-lg"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>وضع عدم الاتصال — أدوات التصميم والمشاريع المحفوظة تعمل محلياً</span>
    </div>
  );
};
