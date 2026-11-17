import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Calculator,
  Check,
  Download,
  ExternalLink,
  Minus,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { FloorPlanData } from '../types/planner';
import {
  GeneratedPlanVariant,
  generateEstimatedFloorPlanVariants,
} from '../utils/estimatePlanGenerator';
import { InvoiceModal } from './InvoiceModal';
import { TemplateBlueprintPreview } from './TemplateBlueprintPreview';
import {
  ALGERIA_REGIONS,
  AlgeriaMarketSnapshot,
  AlgeriaRegion,
  EstimatorInputs,
  FinishLevel,
  MATERIAL_CATEGORIES,
  MaterialCategory,
  SmartLaborInputs,
  buildRegionalReferenceSnapshot,
  computeAlgeriaConstructionEstimate,
  computeSmartLaborEstimate,
  estimateDimensionsFromSpaces,
  formatDzd,
  formatMillionCentimes,
} from '../data/algeriaMarketPrices';

export interface LinkedPlanMetrics {
  title: string;
  floorAreaSqm: number;
  wallLengthM: number;
  wallHeightM: number;
  columnsCount?: number;
  beamsLengthM?: number;
}

export interface GeneratedEstimatePlanPayload {
  title: string;
  floorPlan: FloorPlanData;
  variantTitle: string;
}

interface AlgeriaCostCalculatorProps {
  linkedPlan?: LinkedPlanMetrics;
  compactModal?: boolean;
  allowAiLiveSync?: boolean;
  onOpenProUpgrade?: () => void;
  onStartPlanFromEstimate?: (payload: GeneratedEstimatePlanPayload) => void;
}

const CUSTOM_OVERRIDES_KEY = 'bachir5d_algeria_price_overrides_v1';

export const AlgeriaCostCalculator: React.FC<AlgeriaCostCalculatorProps> = ({
  linkedPlan,
  compactModal = false,
  allowAiLiveSync = true,
  onOpenProUpgrade,
  onStartPlanFromEstimate,
}) => {
  const [region, setRegion] = useState<AlgeriaRegion>('center');
  const [snapshot, setSnapshot] = useState<AlgeriaMarketSnapshot>(() =>
    buildRegionalReferenceSnapshot('center')
  );
  const [loadingPrices, setLoadingPrices] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(allowAiLiveSync);

  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_OVERRIDES_KEY);
      return raw ? (JSON.parse(raw) as Record<string, number>) : {};
    } catch {
      return {};
    }
  });

  const [activeCat, setActiveCat] = useState<MaterialCategory | 'all'>('all');
  const [priceSearch, setPriceSearch] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showLayoutPicker, setShowLayoutPicker] = useState(false);

  const [autoSyncSpaces, setAutoSyncSpaces] = useState<boolean>(!linkedPlan);

  const [inputs, setInputs] = useState<EstimatorInputs>(() => ({
    floorAreaSqm: linkedPlan ? Math.max(15, Math.round(linkedPlan.floorAreaSqm)) : 112,
    floorsCount: 1,
    wallLengthM: linkedPlan ? Math.max(10, Math.round(linkedPlan.wallLengthM)) : 68,
    wallHeightM: linkedPlan ? Number(linkedPlan.wallHeightM.toFixed(2)) : 2.9,
    roomsCount: 3,
    salonsCount: 1,
    kitchensCount: 1,
    bathroomsCount: 1,
    garagesCount: 0,
    balconiesCount: 1,
    paintCoats: 2,
    finishLevel: 'standard',
    includeStructure: true,
    includePaint: true,
    includeTiling: true,
    includeLabor: true,
  }));

  const [smartLabor, setSmartLabor] = useState<SmartLaborInputs>(() => {
    const area = linkedPlan ? Math.max(15, Math.round(linkedPlan.floorAreaSqm)) : 112;
    const wallLen = linkedPlan ? Math.max(10, Math.round(linkedPlan.wallLengthM)) : 68;
    const wallH = linkedPlan ? Number(linkedPlan.wallHeightM.toFixed(2)) : 2.9;
    return {
      wallLengthM: wallLen,
      wallHeightM: wallH,
      plasterFaces: 2,
      columnsCount:
        linkedPlan?.columnsCount && linkedPlan.columnsCount > 0
          ? linkedPlan.columnsCount
          : Math.max(6, Math.round(area / 12)),
      beamsLengthM:
        linkedPlan?.beamsLengthM && linkedPlan.beamsLengthM > 0
          ? Math.round(linkedPlan.beamsLengthM)
          : Math.round(wallLen * 0.85),
      dalleAreaSqm: area,
      foundationLengthM: Math.round(Math.sqrt(area) * 4 + wallLen * 0.35),
      tilingAreaSqm: Math.round(area * 1.1),
      paintAreaSqm: Math.round(wallLen * wallH * 1.65 + area),
      placoAreaSqm: Math.round(area * 0.6),
      waterproofAreaSqm: area,
      plumbingPoints: 8,
      electricPoints: Math.max(16, Math.round(area * 0.3)),
      includeConcreteSupply: false,
    };
  });

  const [smartAutoSync, setSmartAutoSync] = useState<boolean>(true);

  const updateSpaceCount = (
    key:
      | 'roomsCount'
      | 'salonsCount'
      | 'kitchensCount'
      | 'bathroomsCount'
      | 'garagesCount'
      | 'balconiesCount',
    nextVal: number
  ) => {
    const clamped = Math.max(0, Math.min(20, Math.round(nextVal)));
    setInputs((prev) => {
      const updated: EstimatorInputs = {
        ...prev,
        [key]: clamped,
      };
      if (autoSyncSpaces) {
        const est = estimateDimensionsFromSpaces({
          roomsCount: updated.roomsCount ?? 3,
          salonsCount: updated.salonsCount ?? 1,
          kitchensCount: updated.kitchensCount ?? 1,
          bathroomsCount: updated.bathroomsCount ?? 1,
          garagesCount: updated.garagesCount ?? 0,
          balconiesCount: updated.balconiesCount ?? 1,
        });
        updated.floorAreaSqm = est.floorAreaSqm;
        updated.wallLengthM = est.wallLengthM;
      }
      return updated;
    });
  };

  useEffect(() => {
    if (!linkedPlan) return;
    setInputs((prev) => ({
      ...prev,
      floorAreaSqm: Math.max(15, Math.round(linkedPlan.floorAreaSqm)),
      wallLengthM: Math.max(10, Math.round(linkedPlan.wallLengthM)),
      wallHeightM: Number(linkedPlan.wallHeightM.toFixed(2)) || 2.9,
    }));
  }, [linkedPlan]);

  const fetchMarketPrices = useCallback(
    async (targetRegion: AlgeriaRegion, force = false) => {
      if (!allowAiLiveSync) {
        setSnapshot(buildRegionalReferenceSnapshot(targetRegion));
        if (force) {
          setFetchError(
            'التحديث المباشر للأسعار عبر الذكاء الاصطناعي مستثنى من الدخول المجاني ومتاح حصرياً لنسخة برو — تم عرض الأسعار المرجعية.'
          );
          onOpenProUpgrade?.();
        } else {
          setFetchError(null);
        }
        return;
      }

      setLoadingPrices(true);
      setFetchError(null);
      try {
        const res = await fetch(
          `/api/algeria-market-prices?region=${encodeURIComponent(targetRegion)}&force=${force ? '1' : '0'}`
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as AlgeriaMarketSnapshot;
        if (data && Array.isArray(data.prices)) {
          setSnapshot(data);
        }
      } catch {
        setSnapshot(buildRegionalReferenceSnapshot(targetRegion));
        setFetchError('تعذر الاتصال بخدمة التحديث المباشر حالياً — تم عرض الأسعار المرجعية المعتمدة.');
      } finally {
        setLoadingPrices(false);
      }
    },
    [allowAiLiveSync, onOpenProUpgrade]
  );

  useEffect(() => {
    void fetchMarketPrices(region, false);
  }, [region, fetchMarketPrices]);

  // Continuous auto-sync polling every 30 minutes when enabled & allowed
  useEffect(() => {
    if (!autoRefresh || !allowAiLiveSync) return;
    const timer = setInterval(() => {
      void fetchMarketPrices(region, false);
    }, 30 * 60 * 1000);
    return () => clearInterval(timer);
  }, [autoRefresh, allowAiLiveSync, region, fetchMarketPrices]);

  const effectivePrices = useMemo(() => {
    return snapshot.prices.map((item) => {
      const overrideKey = `${region}:${item.id}`;
      const custom = priceOverrides[overrideKey];
      return {
        ...item,
        priceDzd: typeof custom === 'number' && custom > 0 ? custom : item.priceDzd,
        isCustom: typeof custom === 'number' && custom > 0,
      };
    });
  }, [snapshot.prices, priceOverrides, region]);

  const estimate = useMemo(
    () => computeAlgeriaConstructionEstimate(inputs, effectivePrices),
    [inputs, effectivePrices]
  );

  const effectiveSmartLaborInputs = useMemo<SmartLaborInputs>(() => {
    if (!smartAutoSync) return smartLabor;
    const floors = Math.max(1, inputs.floorsCount || 1);
    const dalleArea = inputs.floorAreaSqm * floors;
    const autoCols =
      linkedPlan?.columnsCount && linkedPlan.columnsCount > 0
        ? linkedPlan.columnsCount * floors
        : Math.max(6, Math.round(inputs.floorAreaSqm / 12)) * floors;
    const autoBeams =
      linkedPlan?.beamsLengthM && linkedPlan.beamsLengthM > 0
        ? Math.round(linkedPlan.beamsLengthM * floors)
        : Math.round(inputs.wallLengthM * 0.85 * floors);
    const wetPts =
      (inputs.kitchensCount ?? 1) * 4 + (inputs.bathroomsCount ?? 1) * 4 + 2;
    const elecPts =
      ((inputs.roomsCount ?? 3) * 5 +
        (inputs.salonsCount ?? 1) * 8 +
        (inputs.kitchensCount ?? 1) * 6 +
        (inputs.bathroomsCount ?? 1) * 3) *
      floors;
    return {
      ...smartLabor,
      wallLengthM: Math.round(inputs.wallLengthM * floors),
      wallHeightM: inputs.wallHeightM,
      columnsCount: autoCols,
      beamsLengthM: autoBeams,
      dalleAreaSqm: dalleArea,
      foundationLengthM: Math.round(Math.sqrt(inputs.floorAreaSqm) * 4 + inputs.wallLengthM * 0.35),
      tilingAreaSqm: Math.round(dalleArea * 1.1),
      paintAreaSqm: estimate.paintAreaSqm,
      placoAreaSqm: Math.round(dalleArea * 0.6),
      waterproofAreaSqm: inputs.floorAreaSqm,
      plumbingPoints: Math.max(4, wetPts * floors),
      electricPoints: Math.max(10, elecPts),
    };
  }, [smartAutoSync, smartLabor, inputs, linkedPlan, estimate.paintAreaSqm]);

  const smartLaborEstimate = useMemo(
    () => computeSmartLaborEstimate(effectiveSmartLaborInputs, effectivePrices),
    [effectiveSmartLaborInputs, effectivePrices]
  );

  const filteredPriceRows = useMemo(() => {
    const q = priceSearch.trim().toLowerCase();
    return effectivePrices.filter((item) => {
      const catOk = activeCat === 'all' || item.category === activeCat;
      const qOk =
        !q || item.name.toLowerCase().includes(q) || item.notes.toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [effectivePrices, activeCat, priceSearch]);

  const handlePriceEdit = (id: string, nextVal: number) => {
    if (!Number.isFinite(nextVal) || nextVal <= 0) return;
    const key = `${region}:${id}`;
    const updated = { ...priceOverrides, [key]: Math.round(nextVal) };
    setPriceOverrides(updated);
    localStorage.setItem(CUSTOM_OVERRIDES_KEY, JSON.stringify(updated));
  };

  const handleResetOverrides = () => {
    const next: Record<string, number> = {};
    Object.entries(priceOverrides).forEach(([k, v]) => {
      if (!k.startsWith(`${region}:`)) next[k] = v;
    });
    setPriceOverrides(next);
    localStorage.setItem(CUSTOM_OVERRIDES_KEY, JSON.stringify(next));
  };

  const handleExportBoqJson = () => {
    const regionMeta = ALGERIA_REGIONS.find((r) => r.id === region);
    const payload = {
      title: linkedPlan ? `مقايسة ${linkedPlan.title}` : 'مقايسة مشروع بناء وتشطيب - السوق الجزائري',
      region: regionMeta?.label || region,
      updatedAtIso: snapshot.updatedAtIso,
      inputs,
      summary: {
        builtAreaSqm: estimate.builtAreaSqm,
        paintAreaSqm: estimate.paintAreaSqm,
        structureTotalDzd: estimate.structureTotalDzd,
        paintTotalDzd: estimate.paintTotalDzd,
        finishingTotalDzd: estimate.finishingTotalDzd,
        laborTotalDzd: estimate.laborTotalDzd,
        grandTotalDzd: estimate.grandTotalDzd,
        grandTotalMillionCentimes: Number((estimate.grandTotalDzd / 10000).toFixed(2)),
        costPerSqmDzd: estimate.costPerSqmDzd,
      },
      items: estimate.lines,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `algeria-cost-estimate-${region}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const activeRegionMeta = ALGERIA_REGIONS.find((r) => r.id === region) || ALGERIA_REGIONS[0];
  const hasRegionOverrides = Object.keys(priceOverrides).some((k) => k.startsWith(`${region}:`));
  const formattedUpdatedAt = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('ar-DZ', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(snapshot.updatedAtIso));
    } catch {
      return snapshot.updatedAtIso;
    }
  }, [snapshot.updatedAtIso]);

  return (
    <section
      id={compactModal ? undefined : 'cost-calculator'}
      className={compactModal ? 'space-y-6' : 'py-12 border-t border-slate-200 dark:border-slate-800'}
    >
      {/* Header & Live Algerian Market Bar */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>السوق الجزائري</span>
            <span aria-hidden="true">·</span>
            <span>
              {snapshot.sourceMode === 'live_search'
                ? 'محدّثة مباشرة عبر البحث الحي'
                : 'أسعار مرجعية محلية'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-nums">آخر تحديث: {formattedUpdatedAt}</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            حاسبة أسعار مواد البناء والدهن والتكاليف
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
            احسب كميات الإسمنت، الحديد، الآجر، الرمل، الطلاء، السيراميك واليد العاملة بالدينار الجزائري والمليون سنتيم وفق الأسعار المحدّثة في ولايتك.
          </p>
        </div>

        {/* Region Tabs + Refresh Action */}
        <div className="flex flex-wrap items-center gap-2 max-w-full shrink-0">
          <div className="flex flex-nowrap sm:flex-wrap items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg overflow-x-auto no-scrollbar max-w-full">
            {ALGERIA_REGIONS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRegion(r.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  region === r.id
                    ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void fetchMarketPrices(region, true)}
            disabled={loadingPrices}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 px-3.5 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingPrices ? 'animate-spin' : ''}`} />
            <span>
              {loadingPrices
                ? 'جارٍ التحديث...'
                : allowAiLiveSync
                  ? 'تحديث الأسعار الآن'
                  : 'تحديث مباشر بالذكاء الاصطناعي (برو)'}
            </span>
          </button>
        </div>
      </div>

      {/* Market Note & Auto-Refresh Control */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
          <div className="font-semibold text-slate-900 dark:text-white">
            نطاق منطقة {activeRegionMeta.label}: {activeRegionMeta.wilayasSample}
          </div>
          <p>{fetchError || snapshot.marketSummary}</p>
        </div>

        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer whitespace-nowrap shrink-0">
          <input
            type="checkbox"
            checked={allowAiLiveSync ? autoRefresh : false}
            disabled={!allowAiLiveSync}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
          />
          <span>
            {allowAiLiveSync
              ? 'تحديث مستمر تلقائي'
              : 'التحديث التلقائي بالذكاء الاصطناعي (نسخة برو)'}
          </span>
        </label>
      </div>

      {/* Main 2-Column Interactive Estimator + Live Totals */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        {/* Left/Start (5 cols): Project Parameters */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              01. مواصفات المشروع والكميات
            </h3>
            {linkedPlan && (
              <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                مربوط بالمخطط: {linkedPlan.title}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                مساحة الطابق (م²)
              </label>
              <input
                type="number"
                min={15}
                max={2000}
                step={5}
                value={inputs.floorAreaSqm}
                onChange={(e) => {
                  const nextArea = Math.max(10, Number(e.target.value) || 10);
                  setInputs((prev) => ({
                    ...prev,
                    floorAreaSqm: nextArea,
                    wallLengthM: Math.round(nextArea * 0.45),
                  }));
                }}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 font-mono-nums text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                عدد الطوابق
              </label>
              <input
                type="number"
                min={1}
                max={8}
                step={1}
                value={inputs.floorsCount}
                onChange={(e) =>
                  setInputs((prev) => ({
                    ...prev,
                    floorsCount: Math.max(1, Math.min(8, Number(e.target.value) || 1)),
                  }))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 font-mono-nums text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                أطوال الجدران التقديرية (م)
              </label>
              <input
                type="number"
                min={8}
                max={600}
                step={1}
                value={inputs.wallLengthM}
                onChange={(e) =>
                  setInputs((prev) => ({
                    ...prev,
                    wallLengthM: Math.max(8, Number(e.target.value) || 8),
                  }))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 font-mono-nums text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                ارتفاع السقف (م)
              </label>
              <input
                type="number"
                min={2.4}
                max={5}
                step={0.1}
                value={inputs.wallHeightM}
                onChange={(e) =>
                  setInputs((prev) => ({
                    ...prev,
                    wallHeightM: Math.max(2.4, Math.min(5, Number(e.target.value) || 2.9)),
                  }))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 font-mono-nums text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Space Counts (Bedrooms, Salons, Kitchens, Bathrooms, Garage, Balconies) */}
          <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                عدد الفضاءات (الغرف، المطبخ، الكراج...)
              </span>
              <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSyncSpaces}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setAutoSyncSpaces(checked);
                    if (checked) {
                      const est = estimateDimensionsFromSpaces({
                        roomsCount: inputs.roomsCount ?? 3,
                        salonsCount: inputs.salonsCount ?? 1,
                        kitchensCount: inputs.kitchensCount ?? 1,
                        bathroomsCount: inputs.bathroomsCount ?? 1,
                        garagesCount: inputs.garagesCount ?? 0,
                        balconiesCount: inputs.balconiesCount ?? 1,
                      });
                      setInputs((prev) => ({
                        ...prev,
                        floorAreaSqm: est.floorAreaSqm,
                        wallLengthM: est.wallLengthM,
                      }));
                    }
                  }}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>حساب المساحة تلقائياً</span>
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {(
                [
                  { key: 'roomsCount', label: 'غرف النوم', min: 0, max: 16 },
                  { key: 'salonsCount', label: 'الصالون', min: 0, max: 6 },
                  { key: 'kitchensCount', label: 'المطبخ', min: 0, max: 6 },
                  { key: 'bathroomsCount', label: 'الحمام / WC', min: 0, max: 8 },
                  { key: 'garagesCount', label: 'الكراج (المرآب)', min: 0, max: 6 },
                  { key: 'balconiesCount', label: 'شرفة / فناء', min: 0, max: 8 },
                ] as const
              ).map((sp) => {
                const val = Number(inputs[sp.key] ?? 0);
                return (
                  <div
                    key={sp.key}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-2.5 py-2 flex flex-col justify-between gap-1.5"
                  >
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                      {sp.label}
                    </span>
                    <div className="flex items-center justify-between gap-1">
                      <button
                        type="button"
                        onClick={() => updateSpaceCount(sp.key, Math.max(sp.min, val - 1))}
                        disabled={val <= sp.min}
                        aria-label={`إنقاص ${sp.label}`}
                        className="w-7 h-7 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-35"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-mono-nums font-bold text-sm text-slate-900 dark:text-white min-w-[20px] text-center">
                        {val}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateSpaceCount(sp.key, Math.min(sp.max, val + 1))}
                        disabled={val >= sp.max}
                        aria-label={`زيادة ${sp.label}`}
                        className="w-7 h-7 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-35"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Paint Coats & Finish Level */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="block font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                طبقات الدهن
              </span>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                {([2, 3] as const).map((coats) => (
                  <button
                    key={coats}
                    type="button"
                    onClick={() => setInputs((p) => ({ ...p, paintCoats: coats }))}
                    className={`py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                      inputs.paintCoats === coats
                        ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {coats} طبقات
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                مستوى التشطيب
              </span>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                {(
                  [
                    { id: 'economic', label: 'اقتصادي' },
                    { id: 'standard', label: 'متوسط' },
                    { id: 'luxury', label: 'فاخر' },
                  ] as { id: FinishLevel; label: string }[]
                ).map((lvl) => (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => setInputs((p) => ({ ...p, finishLevel: lvl.id }))}
                    className={`py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                      inputs.finishLevel === lvl.id
                        ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {lvl.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Calculation Scope Switches */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              الأشغال المشمولة في الحساب
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {(
                [
                  { key: 'includeStructure', label: 'البناء والهيكل' },
                  { key: 'includePaint', label: 'الدهن والأندوي' },
                  { key: 'includeTiling', label: 'السيراميك والجبس' },
                  { key: 'includeLabor', label: 'تكلفة اليد العاملة' },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.key}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                    inputs[opt.key]
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={inputs[opt.key]}
                    onChange={(e) =>
                      setInputs((prev) => ({ ...prev, [opt.key]: e.target.checked }))
                    }
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-medium truncate">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {onStartPlanFromEstimate && !linkedPlan && (
            <div className="space-y-2 pt-1">
              <div className="rounded-lg border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/25 px-3 py-2 text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
                <div className="font-bold">
                  سيتم توليد المخطط بكل الغرف المختارة ({inputs.floorAreaSqm} م²):
                </div>
                <div className="mt-0.5 text-blue-800/90 dark:text-blue-300">
                  {[
                    (inputs.roomsCount ?? 0) > 0 ? `${inputs.roomsCount} غرف نوم` : null,
                    (inputs.salonsCount ?? 0) > 0 ? `${inputs.salonsCount} صالون` : null,
                    (inputs.kitchensCount ?? 0) > 0 ? `${inputs.kitchensCount} مطبخ` : null,
                    (inputs.bathroomsCount ?? 0) > 0 ? `${inputs.bathroomsCount} حمام` : null,
                    (inputs.garagesCount ?? 0) > 0 ? `${inputs.garagesCount} كراج` : null,
                    (inputs.balconiesCount ?? 0) > 0 ? `${inputs.balconiesCount} شرفة` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'فضاء مفتوح'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLayoutPicker(true)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-3 text-xs font-semibold shadow-sm transition-colors"
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>
                  تصميم مخطط بالغرف المختارة ({inputs.floorAreaSqm} م² · 4 احتمالات للتوزيع)
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Right/End (7 cols): Cost Breakdown & BOQ */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] p-5 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            {/* Total Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  التكلفة الإجمالية التقديرية ({activeRegionMeta.label})
                </div>
                <div className="text-2xl sm:text-3xl font-bold font-mono-nums text-slate-900 dark:text-white mt-1">
                  {formatDzd(estimate.grandTotalDzd)}
                </div>
                <div className="text-xs font-medium font-mono-nums text-blue-700 dark:text-blue-400 mt-1">
                  ما يعادل {formatMillionCentimes(estimate.grandTotalDzd)} ·{' '}
                  {formatDzd(estimate.costPerSqmDzd)} / م²
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-center space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">المساحة المبنية</span>
                  <span className="font-mono-nums font-bold text-slate-900 dark:text-white">
                    {estimate.builtAreaSqm} م²
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">مساحة الدهن</span>
                  <span className="font-mono-nums font-bold text-slate-900 dark:text-white">
                    {estimate.paintAreaSqm} م²
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">عدد البنود</span>
                  <span className="font-mono-nums font-bold text-slate-900 dark:text-white">
                    {estimate.lines.length}
                  </span>
                </div>
              </div>
            </div>

            {/* 4 Category Sub-Totals */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5">
                <div className="text-slate-500 dark:text-slate-400">مواد الهيكل</div>
                <div className="font-mono-nums font-bold text-slate-900 dark:text-white mt-0.5">
                  {formatDzd(estimate.structureTotalDzd)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5">
                <div className="text-slate-500 dark:text-slate-400">الدهن والأندوي</div>
                <div className="font-mono-nums font-bold text-slate-900 dark:text-white mt-0.5">
                  {formatDzd(estimate.paintTotalDzd)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5">
                <div className="text-slate-500 dark:text-slate-400">السيراميك والجبس</div>
                <div className="font-mono-nums font-bold text-slate-900 dark:text-white mt-0.5">
                  {formatDzd(estimate.finishingTotalDzd)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5">
                <div className="text-slate-500 dark:text-slate-400">اليد العاملة</div>
                <div className="font-mono-nums font-bold text-slate-900 dark:text-white mt-0.5">
                  {formatDzd(estimate.laborTotalDzd)}
                </div>
              </div>
            </div>

            {/* Itemized BOQ Table */}
            {estimate.lines.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-xs text-slate-500">
                اختر قسماً واحداً على الأقل من «الأشغال المشمولة في الحساب» لعرض كشف الكميات والتكاليف.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg max-h-[340px] overflow-y-auto studio-scroll">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">المادة / الخدمة</th>
                      <th className="py-2.5 px-3 font-semibold">الكمية</th>
                      <th className="py-2.5 px-3 font-semibold">سعر الوحدة</th>
                      <th className="py-2.5 px-3 font-semibold">المجموع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {estimate.lines.map((line) => (
                      <tr
                        key={line.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                      >
                        <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">
                          {line.name}
                        </td>
                        <td className="py-2 px-3 font-mono-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {line.quantity.toLocaleString('fr-DZ')} {line.unit}
                        </td>
                        <td className="py-2 px-3 font-mono-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {formatDzd(line.unitPriceDzd)}
                        </td>
                        <td className="py-2 px-3 font-mono-nums font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {formatDzd(line.totalDzd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <span className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
              ملاحظة: جميع الأسعار والكميات المعروضة تقديرية استرشادية وليست نهائية.
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowInvoiceModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>فاتورة الحسابات التقديرية PDF</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة الكشف</span>
              </button>
              <button
                type="button"
                onClick={handleExportBoqJson}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
              >
                {savedNotice ? <Check className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                <span>{savedNotice ? 'تم التصدير' : 'تصدير المقايسة'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Smart Detailed Labor Calculator (Meter / Masonry / Plaster / Columns / Beams / Dalle) */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] p-5 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              01-ب. الحاسبة الذكية لليد العاملة بالمتر والعناصر الخرسانية (بيلي، سانتر، دالة كاملة)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              احسب أجرة البناء بالمتر المربع، طلية وتلبيس الجدار، أعمدة البوطون (البيليات)، السوانتر بالمتر الطولي، والدالة الكاملة وبقية الحرف.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={smartAutoSync}
                onChange={(e) => {
                  if (!e.target.checked) {
                    setSmartLabor(effectiveSmartLaborInputs);
                  }
                  setSmartAutoSync(e.target.checked);
                }}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>مزامنة تلقائية مع المخطط</span>
            </label>
            <label className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 px-3 py-1.5 cursor-pointer font-medium text-amber-900 dark:text-amber-200">
              <input
                type="checkbox"
                checked={smartLabor.includeConcreteSupply}
                onChange={(e) =>
                  setSmartLabor((prev) => ({
                    ...prev,
                    includeConcreteSupply: e.target.checked,
                  }))
                }
                className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
              />
              <span>احتساب تكلفة البوطون الجاهز ({smartLaborEstimate.concreteVolumeM3} م³)</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Interactive Meter & Structural Parameters */}
          <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2.5 text-xs">
            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                طول الجدران (م)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={effectiveSmartLaborInputs.wallLengthM}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value) || 0);
                  setSmartAutoSync(false);
                  setSmartLabor({ ...effectiveSmartLaborInputs, wallLengthM: val });
                }}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 font-mono-nums font-bold"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                ارتفاع الجدار (م)
              </label>
              <input
                type="number"
                min={2}
                max={6}
                step={0.1}
                value={effectiveSmartLaborInputs.wallHeightM}
                onChange={(e) => {
                  const val = Math.max(2, Number(e.target.value) || 2.8);
                  setSmartAutoSync(false);
                  setSmartLabor({ ...effectiveSmartLaborInputs, wallHeightM: val });
                }}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 font-mono-nums font-bold"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                طلية / تلبيس الجدار
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                {([1, 2] as const).map((faces) => (
                  <button
                    key={faces}
                    type="button"
                    onClick={() =>
                      setSmartLabor((p) => ({ ...p, plasterFaces: faces }))
                    }
                    className={`py-1 rounded font-semibold transition-colors ${
                      effectiveSmartLaborInputs.plasterFaces === faces
                        ? 'bg-white dark:bg-slate-950 text-blue-700 dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {faces === 1 ? 'وجه واحد' : 'وجهين'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                عدد البيليات (الأعمدة)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={effectiveSmartLaborInputs.columnsCount}
                onChange={(e) => {
                  const val = Math.max(0, Math.round(Number(e.target.value) || 0));
                  setSmartAutoSync(false);
                  setSmartLabor({ ...effectiveSmartLaborInputs, columnsCount: val });
                }}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 font-mono-nums font-bold"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                طول السوانتر (م طولي)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={effectiveSmartLaborInputs.beamsLengthM}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value) || 0);
                  setSmartAutoSync(false);
                  setSmartLabor({ ...effectiveSmartLaborInputs, beamsLengthM: val });
                }}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 font-mono-nums font-bold"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                الدالة الكاملة (م²)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={effectiveSmartLaborInputs.dalleAreaSqm}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value) || 0);
                  setSmartAutoSync(false);
                  setSmartLabor({ ...effectiveSmartLaborInputs, dalleAreaSqm: val });
                }}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 font-mono-nums font-bold"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                الأساسات واللونغرين (م)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={effectiveSmartLaborInputs.foundationLengthM}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value) || 0);
                  setSmartAutoSync(false);
                  setSmartLabor({ ...effectiveSmartLaborInputs, foundationLengthM: val });
                }}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 font-mono-nums font-bold"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                البلاط والسيراميك (م²)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={effectiveSmartLaborInputs.tilingAreaSqm}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value) || 0);
                  setSmartAutoSync(false);
                  setSmartLabor({ ...effectiveSmartLaborInputs, tilingAreaSqm: val });
                }}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 font-mono-nums font-bold"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                بلاكو بلاتر BA13 (م²)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={effectiveSmartLaborInputs.placoAreaSqm}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value) || 0);
                  setSmartAutoSync(false);
                  setSmartLabor({ ...effectiveSmartLaborInputs, placoAreaSqm: val });
                }}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 font-mono-nums font-bold"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                الكتامة والعزل (م²)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={effectiveSmartLaborInputs.waterproofAreaSqm}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value) || 0);
                  setSmartAutoSync(false);
                  setSmartLabor({ ...effectiveSmartLaborInputs, waterproofAreaSqm: val });
                }}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 font-mono-nums font-bold"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                نقاط الترصيص (ماء/غاز)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={effectiveSmartLaborInputs.plumbingPoints}
                onChange={(e) => {
                  const val = Math.max(0, Math.round(Number(e.target.value) || 0));
                  setSmartAutoSync(false);
                  setSmartLabor({ ...effectiveSmartLaborInputs, plumbingPoints: val });
                }}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 font-mono-nums font-bold"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                نقاط الكهرباء (إنارة/مآخذ)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={effectiveSmartLaborInputs.electricPoints}
                onChange={(e) => {
                  const val = Math.max(0, Math.round(Number(e.target.value) || 0));
                  setSmartAutoSync(false);
                  setSmartLabor({ ...effectiveSmartLaborInputs, electricPoints: val });
                }}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 font-mono-nums font-bold"
              />
            </div>
          </div>

          {/* Smart Labor Output Breakdown */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3">
                <div className="text-slate-500 dark:text-slate-400">بناء وتلبيس الجدران</div>
                <div className="font-mono-nums font-bold text-sm text-slate-900 dark:text-white mt-0.5">
                  {formatDzd(smartLaborEstimate.masonryAndPlasterTotalDzd)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3">
                <div className="text-slate-500 dark:text-slate-400">
                  البوطون (بيلي، سانتر، دالة)
                </div>
                <div className="font-mono-nums font-bold text-sm text-slate-900 dark:text-white mt-0.5">
                  {formatDzd(smartLaborEstimate.concreteAndStructureTotalDzd)}
                </div>
              </div>
              <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/30 p-3">
                <div className="text-blue-800 dark:text-blue-300 font-semibold">
                  إجمالي اليد العاملة التقديري
                </div>
                <div className="font-mono-nums font-bold text-base text-blue-900 dark:text-blue-200 mt-0.5">
                  {formatDzd(smartLaborEstimate.grandTotalDzd)}
                </div>
                <div className="text-[10px] font-mono-nums text-blue-700 dark:text-blue-400">
                  {formatMillionCentimes(smartLaborEstimate.grandTotalDzd)}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg max-h-[300px] overflow-y-auto studio-scroll">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 sticky top-0">
                  <tr>
                    <th className="py-2 px-3 font-semibold">البند بالمتر / العنصر</th>
                    <th className="py-2 px-3 font-semibold">الكمية</th>
                    <th className="py-2 px-3 font-semibold">سعر الوحدة</th>
                    <th className="py-2 px-3 font-semibold">التكلفة التقديرية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {smartLaborEstimate.lines.map((line) => (
                    <tr key={line.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-2 px-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {line.label}
                        </div>
                        <div className="text-[10px] text-slate-400">{line.formulaHint}</div>
                      </td>
                      <td className="py-2 px-3 font-mono-nums whitespace-nowrap text-slate-700 dark:text-slate-200">
                        {line.quantity.toLocaleString('fr-DZ')} {line.unit}
                      </td>
                      <td className="py-2 px-3 font-mono-nums whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {formatDzd(line.unitRateDzd)}
                      </td>
                      <td className="py-2 px-3 font-mono-nums font-bold whitespace-nowrap text-slate-900 dark:text-white">
                        {formatDzd(line.totalDzd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200">
              تنبيه: الأسعار المطبقة في الحاسبة الذكية مرتبطة بدليل أسعار اليد العاملة أدناه، وهي قيم تقديرية استرشادية وليست نهائية.
            </div>
          </div>
        </div>
      </div>

      {/* Live Editable Algerian Market Prices Directory */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              02. دليل أسعار السوق الجزائري اليوم (قابل للتخصيص حسب ولايتك)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              يمكنك تعديل أي سعر مباشرة ليُعاد حساب المقايسة أعلاه فوراً وفق أسعار موردك المحلي.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasRegionOverrides && (
              <button
                type="button"
                onClick={handleResetOverrides}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إرجاع أسعار السوق</span>
              </button>
            )}
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={priceSearch}
                onChange={(e) => setPriceSearch(e.target.value)}
                placeholder="ابحث عن إسمنت، حديد، طلاء..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pr-9 pl-3 py-1.5 text-xs text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-nowrap sm:flex-wrap items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full pb-1 sm:pb-0">
          {MATERIAL_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCat(cat.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                activeCat === cat.id
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Price Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {filteredPriceRows.map((item) => {
            const catLabel =
              MATERIAL_CATEGORIES.find((c) => c.id === item.category)?.label || item.category;
            return (
              <div
                key={item.id}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-3.5 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>{catLabel}</span>
                    <span className="inline-flex items-center gap-0.5 font-medium">
                      {item.trend === 'up' && (
                        <>
                          <ArrowUpRight className="w-3 h-3 text-amber-600" />
                          <span>مرتفع</span>
                        </>
                      )}
                      {item.trend === 'down' && (
                        <>
                          <ArrowDownRight className="w-3 h-3 text-emerald-600" />
                          <span>منخفض</span>
                        </>
                      )}
                      {item.trend === 'stable' && (
                        <>
                          <Minus className="w-3 h-3 text-slate-400" />
                          <span>مستقر</span>
                        </>
                      )}
                    </span>
                  </div>
                  <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white leading-snug">
                    {item.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {item.notes}
                  </p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      السعر ({item.unit})
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        step={item.priceDzd >= 1000 ? 50 : 1}
                        value={item.priceDzd}
                        onChange={(e) => handlePriceEdit(item.id, Number(e.target.value))}
                        aria-label={`سعر ${item.name}`}
                        className="w-24 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-left font-mono-nums text-xs font-bold text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                      />
                      <span className="text-[11px] font-medium text-slate-500">دج</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono-nums text-slate-400">
                    <span>
                      النطاق: {item.minPriceDzd.toLocaleString('fr-DZ')} –{' '}
                      {item.maxPriceDzd.toLocaleString('fr-DZ')} دج
                    </span>
                    {item.isCustom && (
                      <span className="text-blue-600 dark:text-blue-400 font-sans">معدل يدوياً</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Grounding Web Sources from Live Algerian Market Search */}
        {snapshot.sources.length > 0 && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <Calculator className="w-3.5 h-3.5 text-blue-600" />
              <span>مصادر البحث الحية المرجعية للسوق الجزائري:</span>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              {snapshot.sources.map((src) => (
                <a
                  key={src.uri}
                  href={src.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline max-w-xs truncate"
                >
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  <span className="truncate">{src.title}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {showLayoutPicker && onStartPlanFromEstimate && !linkedPlan && (
        <EstimatedLayoutPickerModal
          inputs={inputs}
          onClose={() => setShowLayoutPicker(false)}
          onSelectVariant={(variant) => {
            setShowLayoutPicker(false);
            onStartPlanFromEstimate({
              title: `مخطط ${variant.totalAreaSqm} م² (${variant.roomsSummary || 'مخصص'})`,
              floorPlan: structuredClone(variant.floorPlan),
              variantTitle: variant.title,
            });
          }}
        />
      )}

      {showInvoiceModal && (
        <InvoiceModal
          brandName="خدمات انشاء حميدي البشير"
          projectTitle={linkedPlan?.title || `مقايسة مشروع بمساحة ${inputs.floorAreaSqm} م²`}
          initialAreaSqm={inputs.floorAreaSqm}
          initialWallLengthM={inputs.wallLengthM}
          initialWallHeightM={inputs.wallHeightM}
          initialRegion={region}
          onClose={() => setShowInvoiceModal(false)}
        />
      )}
    </section>
  );
};

interface EstimatedLayoutPickerModalProps {
  inputs: EstimatorInputs;
  onClose: () => void;
  onSelectVariant: (variant: GeneratedPlanVariant) => void;
}

const EstimatedLayoutPickerModal: React.FC<EstimatedLayoutPickerModalProps> = ({
  inputs,
  onClose,
  onSelectVariant,
}) => {
  const variants = useMemo(() => generateEstimatedFloorPlanVariants(inputs), [inputs]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="اختيار احتمال توزيع الغرف والمطبخ"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60">
          <div>
            <h3 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              احتمالات توزيع الغرف والمطبخ والصالة ({inputs.floorAreaSqm} م²)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              تم توليد 4 مقترحات معمارية بالعدد الدقيق للغرف والفضاءات المختارة — اختر الاحتمال الأنسب لفتحه وتعديله في الاستوديو.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {variants.map((variant) => (
            <div
              key={variant.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 overflow-hidden flex flex-col justify-between hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
            >
              <div>
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-2 bg-white dark:bg-[#181B20]">
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {variant.title}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      {variant.subtitle}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                    {variant.badge}
                  </span>
                </div>

                <div className="h-56 w-full border-b border-slate-200 dark:border-slate-800 bg-[#FAF8F4] dark:bg-[#14181F]">
                  <TemplateBlueprintPreview
                    floorPlan={variant.floorPlan}
                    showRoomLabels={true}
                  />
                </div>

                <div className="p-3.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold">
                    <span className="text-slate-800 dark:text-slate-200">
                      {variant.roomsSummary}
                    </span>
                    <span className="font-mono-nums text-blue-700 dark:text-blue-400">
                      {variant.totalAreaSqm} م² · {variant.floorPlan.rooms.length} فضاء
                    </span>
                  </div>
                  <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                    {variant.placementNotes.map((note, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="px-3.5 pb-3.5">
                <button
                  type="button"
                  onClick={() => onSelectVariant(variant)}
                  className="w-full rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500 text-white py-2 text-xs font-semibold transition-colors"
                >
                  تصميم وفتح هذا الاحتمال في الاستوديو
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
