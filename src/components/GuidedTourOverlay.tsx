import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Compass, X } from 'lucide-react';

const TOUR_STORAGE_KEY = 'bachir5d_guided_tour_v1_done';

export function isGuidedTourCompleted(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(TOUR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markGuidedTourCompleted(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, 'true');
  } catch {
    // ignore storage errors
  }
}

export interface GuidedTourStep {
  id: string;
  selector: string;
  mobileSelector?: string;
  categoryLabel: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  onEnter?: () => void;
}

interface GuidedTourOverlayProps {
  isOpen: boolean;
  steps: GuidedTourStep[];
  currentStepIdx: number;
  onChangeStep: (nextIdx: number) => void;
  onFinish: () => void;
}

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const GuidedTourOverlay: React.FC<GuidedTourOverlayProps> = ({
  isOpen,
  steps,
  currentStepIdx,
  onChangeStep,
  onFinish,
}) => {
  const [rect, setRect] = useState<HighlightRect | null>(null);
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  const step = steps[currentStepIdx];

  useEffect(() => {
    if (!isOpen || !step) return;
    step.onEnter?.();
  }, [isOpen, currentStepIdx]);

  useEffect(() => {
    if (!isOpen || !step) return;

    const measureTarget = () => {
      setViewportSize({ w: window.innerWidth, h: window.innerHeight });
      const isMobile = window.innerWidth < 1024;
      const selectorToTry =
        isMobile && step.mobileSelector ? step.mobileSelector : step.selector;
      const el =
        (document.querySelector(selectorToTry) as HTMLElement | null) ||
        (document.querySelector(step.selector) as HTMLElement | null);

      if (!el) {
        setRect(null);
        return;
      }

      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) {
        setRect(null);
        return;
      }

      const pad = 6;
      setRect({
        top: Math.max(4, r.top - pad),
        left: Math.max(4, r.left - pad),
        width: Math.min(window.innerWidth - 8, r.width + pad * 2),
        height: Math.min(window.innerHeight - 8, r.height + pad * 2),
      });
    };

    const rafId = window.requestAnimationFrame(measureTarget);
    const timerId = window.setTimeout(measureTarget, 90);
    window.addEventListener('resize', measureTarget);
    window.addEventListener('scroll', measureTarget, true);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
      window.removeEventListener('resize', measureTarget);
      window.removeEventListener('scroll', measureTarget, true);
    };
  }, [isOpen, step]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onFinish();
      } else if (e.key === 'ArrowLeft') {
        if (currentStepIdx < steps.length - 1) onChangeStep(currentStepIdx + 1);
        else onFinish();
      } else if (e.key === 'ArrowRight') {
        if (currentStepIdx > 0) onChangeStep(currentStepIdx - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, currentStepIdx, steps.length, onChangeStep, onFinish]);

  if (!isOpen || !step) return null;

  const isFirst = currentStepIdx === 0;
  const isLast = currentStepIdx === steps.length - 1;

  // Compute safe popover card coordinates that never clip off-screen
  const cardWidth = Math.min(390, viewportSize.w - 24);
  const estimatedCardHeight = 250;
  let cardStyle: React.CSSProperties = {
    width: `${cardWidth}px`,
    top: `${Math.max(16, (viewportSize.h - estimatedCardHeight) / 2)}px`,
    left: `${Math.max(12, (viewportSize.w - cardWidth) / 2)}px`,
  };

  if (rect && viewportSize.w >= 640) {
    const spaceBelow = viewportSize.h - (rect.top + rect.height);
    const spaceAbove = rect.top;
    const spaceLeft = rect.left;
    const spaceRight = viewportSize.w - (rect.left + rect.width);

    if (spaceBelow >= estimatedCardHeight + 20) {
      cardStyle = {
        width: `${cardWidth}px`,
        top: `${rect.top + rect.height + 14}px`,
        left: `${Math.min(
          viewportSize.w - cardWidth - 12,
          Math.max(12, rect.left + rect.width / 2 - cardWidth / 2)
        )}px`,
      };
    } else if (spaceAbove >= estimatedCardHeight + 20) {
      cardStyle = {
        width: `${cardWidth}px`,
        top: `${Math.max(12, rect.top - estimatedCardHeight - 14)}px`,
        left: `${Math.min(
          viewportSize.w - cardWidth - 12,
          Math.max(12, rect.left + rect.width / 2 - cardWidth / 2)
        )}px`,
      };
    } else if (spaceLeft >= cardWidth + 24) {
      cardStyle = {
        width: `${cardWidth}px`,
        top: `${Math.min(
          viewportSize.h - estimatedCardHeight - 12,
          Math.max(12, rect.top)
        )}px`,
        left: `${rect.left - cardWidth - 16}px`,
      };
    } else if (spaceRight >= cardWidth + 24) {
      cardStyle = {
        width: `${cardWidth}px`,
        top: `${Math.min(
          viewportSize.h - estimatedCardHeight - 12,
          Math.max(12, rect.top)
        )}px`,
        left: `${rect.left + rect.width + 16}px`,
      };
    }
  } else if (rect && viewportSize.w < 640) {
    // On mobile, dock cleanly above bottom nav or below header
    const targetInBottomHalf = rect.top > viewportSize.h * 0.45;
    cardStyle = {
      width: `${cardWidth}px`,
      left: `${Math.max(12, (viewportSize.w - cardWidth) / 2)}px`,
      ...(targetInBottomHalf ? { top: '68px' } : { bottom: '74px' }),
    };
  }

  return (
    <div
      className="fixed inset-0 z-[70]"
      role="dialog"
      aria-modal="true"
      aria-label="الجولة الإرشادية في مساحة العمل"
    >
      {/* Dimmed Backdrop when target is not highlighted */}
      {!rect && (
        <div
          className="fixed inset-0 bg-slate-950/75"
          onClick={onFinish}
        />
      )}

      {/* Spotlight Cutout Frame around active target */}
      {rect && (
        <>
          <div
            className="fixed inset-0"
            onClick={onFinish}
            aria-hidden="true"
          />
          <div
            className="fixed rounded-xl border-2 border-blue-500 pointer-events-none transition-transform duration-150"
            style={{
              top: `${rect.top}px`,
              left: `${rect.left}px`,
              width: `${rect.width}px`,
              height: `${rect.height}px`,
              boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.74)',
            }}
          />
        </>
      )}

      {/* Tour Guidance Card */}
      <div
        className="fixed z-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#181B20] shadow-2xl p-4 sm:p-5 space-y-3.5 text-right"
        style={cardStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Clean typographic header (no static pill boxes) */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 dark:text-blue-400">
              <Compass className="w-3.5 h-3.5 shrink-0" />
              <span>
                الخطوة {currentStepIdx + 1} من {steps.length}
              </span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{step.categoryLabel}</span>
            </div>
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white leading-snug">
              {step.title}
            </h3>
          </div>

          <button
            type="button"
            onClick={onFinish}
            aria-label="إغلاق الجولة الإرشادية"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
          {step.description}
        </p>

        {/* Optional direct interactive action inside the step */}
        {step.actionLabel && step.onAction && (
          <button
            type="button"
            onClick={step.onAction}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 transition-colors"
          >
            <span>{step.actionLabel}</span>
          </button>
        )}

        {/* Step Progress Indicators */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1.5" aria-label="تقدم الجولة">
            {steps.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onChangeStep(idx)}
                aria-label={`الانتقال إلى الخطوة ${idx + 1}`}
                className={`h-2 rounded-full transition-opacity ${
                  idx === currentStepIdx
                    ? 'w-5 bg-blue-600'
                    : idx < currentStepIdx
                      ? 'w-2 bg-blue-400/70'
                      : 'w-2 bg-slate-300 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            {!isFirst && (
              <button
                type="button"
                onClick={() => onChangeStep(currentStepIdx - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 min-h-[36px]"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>السابق</span>
              </button>
            )}

            <button
              type="button"
              onClick={onFinish}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white whitespace-nowrap shrink-0 min-h-[36px]"
            >
              تخطي
            </button>

            {isLast ? (
              <button
                type="button"
                onClick={onFinish}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 min-h-[36px]"
              >
                <Check className="w-3.5 h-3.5" />
                <span>إنهاء الجولة</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onChangeStep(currentStepIdx + 1)}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 min-h-[36px]"
              >
                <span>التالي</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
