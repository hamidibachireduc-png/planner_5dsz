import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  Camera,
  Check,
  Copy,
  Download,
  FileDown,
  Grid3X3,
  ImagePlus,
  Images,
  Plus,
  Receipt,
  Trash2,
  X,
} from 'lucide-react';
import {
  ALGERIA_REGIONS,
  AlgeriaRegion,
  FinishLevel,
  buildRegionalReferenceSnapshot,
  computeAlgeriaConstructionEstimate,
  formatDzd,
  formatMillionCentimes,
} from '../data/algeriaMarketPrices';
import {
  FloorPlanData,
  FurnitureItem,
  InvoiceCustomItem,
  InvoiceCustomerInfo,
  ProjectShowcaseImage,
} from '../types/planner';
import { InvoicePdfRow, exportInvoiceToPdf } from '../utils/invoicePdfExporter';

interface InvoiceModalProps {
  brandName: string;
  projectTitle: string;
  floorPlan?: FloorPlanData;
  initialAreaSqm?: number;
  initialWallLengthM?: number;
  initialWallHeightM?: number;
  initialRegion?: AlgeriaRegion;
  showcaseImages?: ProjectShowcaseImage[];
  onUpdateShowcaseImages?: React.Dispatch<React.SetStateAction<ProjectShowcaseImage[]>>;
  onCapture2D?: () => string | null;
  onCapture3D?: () => string | null;
  focusShowcaseSection?: boolean;
  onUpdateFurniturePrice?: (furnitureId: string, nextPriceDzd: number | undefined) => void;
  onClose: () => void;
}

interface GroupedFurnitureRow {
  groupKey: string;
  name: string;
  dimensionsLabel: string;
  itemIds: string[];
  quantity: number;
  unitPriceDzd: number | undefined;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  brandName,
  projectTitle,
  floorPlan,
  initialAreaSqm = 100,
  initialWallLengthM = 45,
  initialWallHeightM = 2.8,
  initialRegion = 'center',
  showcaseImages,
  onUpdateShowcaseImages,
  onCapture2D,
  onCapture3D,
  focusShowcaseSection = false,
  onUpdateFurniturePrice,
  onClose,
}) => {
  const [region, setRegion] = useState<AlgeriaRegion>(initialRegion);
  const [floorsCount, setFloorsCount] = useState<number>(1);
  const [finishLevel, setFinishLevel] = useState<FinishLevel>('standard');
  const [includeFurniture, setIncludeFurniture] = useState<boolean>(
    Boolean(floorPlan && floorPlan.furniture.length > 0)
  );
  const [pricedOnlyFurniture, setPricedOnlyFurniture] = useState<boolean>(false);
  const [includeConstruction, setIncludeConstruction] = useState<boolean>(true);
  const [includeStructure, setIncludeStructure] = useState<boolean>(true);
  const [includePaint, setIncludePaint] = useState<boolean>(true);
  const [includeTiling, setIncludeTiling] = useState<boolean>(true);
  const [includeLabor, setIncludeLabor] = useState<boolean>(true);

  // Local fallback price map when InvoiceModal is opened standalone without floorPlan mutation handler
  const [localPriceOverrides, setLocalPriceOverrides] = useState<Record<string, number | undefined>>({});

  // Showcase gallery state (uses parent state if supplied, otherwise internal)
  const [localShowcase, setLocalShowcase] = useState<ProjectShowcaseImage[]>([]);
  const activeShowcase = showcaseImages ?? localShowcase;
  const setShowcase = onUpdateShowcaseImages ?? setLocalShowcase;
  const [showcaseFeedback, setShowcaseFeedback] = useState<string | null>(null);
  const showcaseUploadRef = useRef<HTMLInputElement | null>(null);
  const showcaseSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (focusShowcaseSection && showcaseSectionRef.current) {
      showcaseSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [focusShowcaseSection]);

  const [customer, setCustomer] = useState<InvoiceCustomerInfo>(() => ({
    customerName: '',
    customerPhone: '',
    wilaya: 'الجزائر',
    invoiceNumber: `INV-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`,
    dateStr: new Date().toLocaleDateString('ar-DZ'),
    discountPct: 0,
    notes: 'ملاحظة: هذه القيم والكميات تقديرية استرشادية فقط وليست نهائية.',
  }));

  const [customItems, setCustomItems] = useState<InvoiceCustomItem[]>([
    {
      id: 'svc_design',
      label: 'أتعاب التصميم الهندسي والمعاينة 2D/3D',
      quantity: 1,
      unit: 'مشروع',
      unitPriceDzd: 0,
    },
  ]);

  const [newCustomLabel, setNewCustomLabel] = useState('');
  const [newCustomQty, setNewCustomQty] = useState(1);
  const [newCustomUnit, setNewCustomUnit] = useState('وحدة');
  const [newCustomPrice, setNewCustomPrice] = useState(0);

  const [exportingPdf, setExportingPdf] = useState(false);
  const [copiedNotice, setCopiedNotice] = useState(false);

  const computedPlanArea = useMemo(() => {
    if (!floorPlan || floorPlan.rooms.length === 0) return Math.max(15, initialAreaSqm);
    const sum = floorPlan.rooms.reduce(
      (acc, r) => acc + Math.max(0, r.width) * Math.max(0, r.depth),
      0
    );
    return Math.max(15, Math.round(sum));
  }, [floorPlan, initialAreaSqm]);

  const computedWallLength = useMemo(() => {
    if (!floorPlan || floorPlan.walls.length === 0) return Math.max(10, initialWallLengthM);
    const sum = floorPlan.walls.reduce(
      (acc, w) => acc + Math.hypot(w.x2 - w.x1, w.z2 - w.z1),
      0
    );
    return Math.max(10, Math.round(sum));
  }, [floorPlan, initialWallLengthM]);

  const groupedFurniture = useMemo<GroupedFurnitureRow[]>(() => {
    const items: FurnitureItem[] = floorPlan?.furniture || [];
    const map = new Map<string, GroupedFurnitureRow>();

    for (const f of items) {
      const effectivePrice =
        Object.prototype.hasOwnProperty.call(localPriceOverrides, f.id)
          ? localPriceOverrides[f.id]
          : f.priceDzd;

      const dims = `${f.width.toFixed(2)}×${f.depth.toFixed(2)} m`;
      const key = `${f.catalogId || f.type}__${f.name}__${effectivePrice ?? 'none'}`;
      const existing = map.get(key);
      if (existing) {
        existing.quantity += 1;
        existing.itemIds.push(f.id);
      } else {
        map.set(key, {
          groupKey: key,
          name: f.name,
          dimensionsLabel: dims,
          itemIds: [f.id],
          quantity: 1,
          unitPriceDzd: effectivePrice,
        });
      }
    }

    const list = Array.from(map.values());
    return pricedOnlyFurniture
      ? list.filter((g) => typeof g.unitPriceDzd === 'number' && g.unitPriceDzd > 0)
      : list;
  }, [floorPlan, localPriceOverrides, pricedOnlyFurniture]);

  const constructionEstimate = useMemo(() => {
    const snapshot = buildRegionalReferenceSnapshot(region);
    return computeAlgeriaConstructionEstimate(
      {
        floorAreaSqm: computedPlanArea,
        floorsCount,
        wallLengthM: computedWallLength,
        wallHeightM: floorPlan?.wallHeight || initialWallHeightM || 2.8,
        paintCoats: 2,
        finishLevel,
        includeStructure,
        includePaint,
        includeTiling,
        includeLabor,
      },
      snapshot.prices
    );
  }, [
    region,
    computedPlanArea,
    floorsCount,
    computedWallLength,
    floorPlan?.wallHeight,
    initialWallHeightM,
    finishLevel,
    includeStructure,
    includePaint,
    includeTiling,
    includeLabor,
  ]);

  const furnitureSubtotalDzd = useMemo(() => {
    if (!includeFurniture) return 0;
    return groupedFurniture.reduce((sum, row) => {
      if (typeof row.unitPriceDzd !== 'number' || row.unitPriceDzd <= 0) return sum;
      return sum + row.unitPriceDzd * row.quantity;
    }, 0);
  }, [includeFurniture, groupedFurniture]);

  const constructionSubtotalDzd = includeConstruction ? constructionEstimate.grandTotalDzd : 0;

  const customSubtotalDzd = useMemo(() => {
    return customItems.reduce(
      (sum, c) => sum + Math.max(0, c.quantity) * Math.max(0, c.unitPriceDzd),
      0
    );
  }, [customItems]);

  const subtotalBeforeDiscountDzd =
    furnitureSubtotalDzd + constructionSubtotalDzd + customSubtotalDzd;
  const discountPct = Math.min(80, Math.max(0, Number(customer.discountPct) || 0));
  const discountDzd = Math.round((subtotalBeforeDiscountDzd * discountPct) / 100);
  const grandTotalDzd = Math.max(0, subtotalBeforeDiscountDzd - discountDzd);

  const handleGroupPriceChange = (row: GroupedFurnitureRow, rawValue: string) => {
    const trimmed = rawValue.trim();
    const parsed = trimmed === '' ? undefined : Math.max(0, Math.round(Number(trimmed) || 0));
    setLocalPriceOverrides((prev) => {
      const next = { ...prev };
      row.itemIds.forEach((id) => {
        next[id] = parsed;
      });
      return next;
    });
    if (onUpdateFurniturePrice) {
      row.itemIds.forEach((id) => {
        onUpdateFurniturePrice(id, parsed);
      });
    }
  };

  const handleAddCustomItem = () => {
    if (!newCustomLabel.trim()) return;
    setCustomItems((prev) => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        label: newCustomLabel.trim(),
        quantity: Math.max(1, Number(newCustomQty) || 1),
        unit: newCustomUnit.trim() || 'وحدة',
        unitPriceDzd: Math.max(0, Math.round(Number(newCustomPrice) || 0)),
      },
    ]);
    setNewCustomLabel('');
    setNewCustomQty(1);
    setNewCustomPrice(0);
  };

  const notifyShowcase = (msg: string) => {
    setShowcaseFeedback(msg);
    setTimeout(() => setShowcaseFeedback(null), 2600);
  };

  const handleCapture2DPhoto = () => {
    if (!onCapture2D) return;
    const dataUrl = onCapture2D();
    if (!dataUrl) {
      notifyShowcase('تعذر التقاط المخطط 2D — تأكد من فتح العرض ثنائي الأبعاد.');
      return;
    }
    const item: ProjectShowcaseImage = {
      id: `img_2d_${Date.now()}`,
      source: '2d',
      title: `مخطط هندسي 2D (${activeShowcase.length + 1})`,
      caption: `${projectTitle} — توزيع المساحات والقياسات`,
      dataUrl,
      selectedForClient: true,
    };
    setShowcase((prev) => [...prev, item]);
    notifyShowcase('تمت إضافة صورة المخطط 2D للعرض');
  };

  const handleCapture3DPhoto = () => {
    if (!onCapture3D) return;
    const dataUrl = onCapture3D();
    if (!dataUrl) {
      notifyShowcase('تعذر التقاط المنظور 3D — تأكد من فتح العرض ثلاثي الأبعاد.');
      return;
    }
    const item: ProjectShowcaseImage = {
      id: `img_3d_${Date.now()}`,
      source: '3d',
      title: `منظور ثلاثي الأبعاد (${activeShowcase.length + 1})`,
      caption: `${projectTitle} — معاينة 3D للزبون`,
      dataUrl,
      selectedForClient: true,
    };
    setShowcase((prev) => [...prev, item]);
    notifyShowcase('تمت إضافة لقطة المنظور 3D للعرض');
  };

  const handleUploadShowcaseFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    const loaded: ProjectShowcaseImage[] = [];
    for (const file of files) {
      const dataUrl = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
      if (dataUrl) {
        loaded.push({
          id: `img_up_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          source: 'upload',
          title: file.name.replace(/\.[^.]+$/, '') || 'صورة مشروع',
          caption: 'صورة مرفقة للعرض على الزبون',
          dataUrl,
          selectedForClient: true,
        });
      }
    }
    if (loaded.length > 0) {
      setShowcase((prev) => [...prev, ...loaded]);
      notifyShowcase(`تمت إضافة ${loaded.length} صورة للمعرض`);
    }
  };

  const downloadSingleImage = (img: ProjectShowcaseImage, index: number) => {
    const a = document.createElement('a');
    a.href = img.dataUrl;
    const safeTitle = (img.title || `photo-${index + 1}`)
      .trim()
      .replace(/[/\\?%*:|"<>]/g, '-')
      .replace(/\s+/g, '_');
    a.download = `${safeTitle}.png`;
    a.click();
  };

  const handleDownloadSelectedImages = () => {
    const selected = activeShowcase.filter((s) => s.selectedForClient);
    if (selected.length === 0) {
      notifyShowcase('اختر صورة واحدة على الأقل لتنزيلها');
      return;
    }
    selected.forEach((img, idx) => {
      window.setTimeout(() => downloadSingleImage(img, idx), idx * 180);
    });
    notifyShowcase(`جارٍ تنزيل ${selected.length} صورة مختارة للزبون`);
  };

  const handleExportPdf = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      const rows: InvoicePdfRow[] = [];

      if (includeFurniture) {
        groupedFurniture.forEach((g) => {
          const hasPrice = typeof g.unitPriceDzd === 'number' && g.unitPriceDzd >= 0;
          rows.push({
            section: 'furniture',
            title: g.name,
            subtitle: `الأبعاد: ${g.dimensionsLabel}`,
            quantityLabel: `${g.quantity} قطعة`,
            unitPriceDzd: hasPrice ? g.unitPriceDzd! : null,
            totalDzd: hasPrice ? g.unitPriceDzd! * g.quantity : null,
          });
        });
      }

      if (includeConstruction) {
        constructionEstimate.lines.forEach((l) => {
          rows.push({
            section: 'construction',
            title: l.name,
            quantityLabel: `${l.quantity.toLocaleString('fr-DZ')} ${l.unit}`,
            unitPriceDzd: l.unitPriceDzd,
            totalDzd: l.totalDzd,
          });
        });
      }

      customItems.forEach((c) => {
        if (c.unitPriceDzd <= 0 && !c.label.trim()) return;
        rows.push({
          section: 'custom',
          title: c.label,
          quantityLabel: `${c.quantity} ${c.unit}`,
          unitPriceDzd: c.unitPriceDzd,
          totalDzd: c.quantity * c.unitPriceDzd,
        });
      });

      const regionLabel =
        ALGERIA_REGIONS.find((r) => r.id === region)?.label || 'الوسط';

      const selectedImagesForPdf = activeShowcase
        .filter((s) => s.selectedForClient)
        .map((s) => ({
          title: s.title,
          caption: s.caption,
          dataUrl: s.dataUrl,
        }));

      await exportInvoiceToPdf({
        brandName,
        projectTitle,
        customer,
        regionLabel,
        builtAreaSqm: constructionEstimate.builtAreaSqm,
        furnitureSubtotalDzd,
        constructionSubtotalDzd,
        customSubtotalDzd,
        subtotalBeforeDiscountDzd,
        discountDzd,
        grandTotalDzd,
        rows,
        showcaseImages: selectedImagesForPdf,
      });
    } finally {
      setExportingPdf(false);
    }
  };

  const handleCopySummary = async () => {
    const regionLabel = ALGERIA_REGIONS.find((r) => r.id === region)?.label || 'الوسط';
    const text = [
      `📄 فاتورة تقديرية ومقايسة أولية — ${brandName}`,
      `رقم الفاتورة: ${customer.invoiceNumber} | التاريخ: ${customer.dateStr}`,
      `المشروع: ${projectTitle}`,
      customer.customerName ? `العميل: ${customer.customerName} (${customer.wilaya})` : `المنطقة: ${regionLabel}`,
      `-----------------------------`,
      includeFurniture ? `• الأثاث والأجهزة المسعرة: ${formatDzd(furnitureSubtotalDzd)}` : null,
      includeConstruction ? `• أشغال البناء والدهن (${constructionEstimate.builtAreaSqm} م²): ${formatDzd(constructionSubtotalDzd)}` : null,
      customSubtotalDzd > 0 ? `• بنود إضافية: ${formatDzd(customSubtotalDzd)}` : null,
      discountDzd > 0 ? `• التخفيض (${discountPct}%): -${formatDzd(discountDzd)}` : null,
      `-----------------------------`,
      `✅ الإجمالي التقديري: ${formatDzd(grandTotalDzd)} (${formatMillionCentimes(grandTotalDzd)})`,
      `⚠️ ملاحظة هامة: هذه القيم والأسعار تقديرية استرشادية فقط وليست نهائية.`,
      `للتواصل: 0696380965`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2400);
    } catch {
      // ignore clipboard restrictions
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2.5 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-modal-title"
    >
      <div className="w-full max-w-5xl max-h-[92dvh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#F7F6F2] dark:bg-[#111315] shadow-2xl overflow-hidden">
        {/* Top Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-white dark:bg-[#181B20] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 sm:gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="invoice-modal-title"
                className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate"
              >
                فاتورة تقديرية وعرض صور المشروع للزبون — {projectTitle}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                تقدير أولي للأثاث وتكاليف البناء بالسوق الجزائري + تصدير صور المشروع المختارة للزبون
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
          >
            <X className="w-4 h-4" />
            <span>إغلاق</span>
          </button>
        </div>

        {/* Prominent Estimation Disclaimer */}
        <div className="px-4 sm:px-6 py-2.5 bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-900/70 flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200 shrink-0">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="font-semibold">
            ملاحظة هامة: جميع الأسعار والكميات والقيم المذكورة في هذه الفاتورة تقديرية استرشادية فقط وليست نهائية، وتخضع للمعاينة الفعلية وسعر السوق وقت التنفيذ.
          </span>
        </div>

        {/* Scrollable Invoice Content */}
        <div className="flex-1 overflow-y-auto studio-scroll p-4 sm:p-6 space-y-5 sm:space-y-6">
          {/* 1. Customer & Invoice Metadata */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
            <div>
              <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                اسم العميل / صاحب المشروع
              </label>
              <input
                type="text"
                value={customer.customerName}
                onChange={(e) => setCustomer((p) => ({ ...p, customerName: e.target.value }))}
                placeholder="مثال: محمد بن علي"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                رقم الهاتف
              </label>
              <input
                type="text"
                value={customer.customerPhone}
                onChange={(e) => setCustomer((p) => ({ ...p, customerPhone: e.target.value }))}
                placeholder="06XXXXXXXX"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 font-mono-nums text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                الولاية
              </label>
              <input
                type="text"
                value={customer.wilaya}
                onChange={(e) => setCustomer((p) => ({ ...p, wilaya: e.target.value }))}
                placeholder="الجزائر / وهران / سطيف..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                رقم الفاتورة
              </label>
              <input
                type="text"
                value={customer.invoiceNumber}
                onChange={(e) => setCustomer((p) => ({ ...p, invoiceNumber: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 font-mono-nums text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                نسبة التخفيض (%)
              </label>
              <input
                type="number"
                min={0}
                max={80}
                step={1}
                value={customer.discountPct}
                onChange={(e) =>
                  setCustomer((p) => ({
                    ...p,
                    discountPct: Math.min(80, Math.max(0, Number(e.target.value) || 0)),
                  }))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 font-mono-nums text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* 2. Section A: Furniture & Appliances (Optional pricing per item) */}
          {floorPlan && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeFurniture}
                    onChange={(e) => setIncludeFurniture(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    أولاً: الأثاث والأجهزة المنزلية ({floorPlan.furniture.length} عنصراً)
                  </span>
                </label>

                <div className="flex items-center gap-4 text-xs">
                  <label className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pricedOnlyFurniture}
                      onChange={(e) => setPricedOnlyFurniture(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>إظهار العناصر المسعّرة فقط</span>
                  </label>
                  <span className="font-mono-nums font-bold text-blue-700 dark:text-blue-400">
                    المجموع: {formatDzd(furnitureSubtotalDzd)}
                  </span>
                </div>
              </div>

              {includeFurniture && (
                groupedFurniture.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">
                    لا توجد عناصر أثاث أو أجهزة مضافة (أو مسعّرة) في المخطط حالياً. يمكنك إضافة أسعار اختيارية لأي عنصر هنا أو من خصائص العنصر.
                  </p>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg max-h-64 overflow-y-auto studio-scroll">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 sticky top-0">
                        <tr>
                          <th className="py-2 px-3">التسمية والأبعاد</th>
                          <th className="py-2 px-3">الكمية</th>
                          <th className="py-2 px-3">السعر الفردي (د.ج · اختياري)</th>
                          <th className="py-2 px-3">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {groupedFurniture.map((row) => {
                          const total =
                            typeof row.unitPriceDzd === 'number' && row.unitPriceDzd > 0
                              ? row.unitPriceDzd * row.quantity
                              : null;
                          return (
                            <tr key={row.groupKey}>
                              <td className="py-2 px-3">
                                <div className="font-semibold text-slate-900 dark:text-white">
                                  {row.name}
                                </div>
                                <div className="text-[11px] font-mono-nums text-slate-400">
                                  {row.dimensionsLabel}
                                </div>
                              </td>
                              <td className="py-2 px-3 font-mono-nums font-semibold">
                                {row.quantity}
                              </td>
                              <td className="py-2 px-3">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    min={0}
                                    step={500}
                                    value={row.unitPriceDzd ?? ''}
                                    placeholder="اختياري"
                                    onChange={(e) => handleGroupPriceChange(row, e.target.value)}
                                    className="w-28 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1 font-mono-nums text-slate-900 dark:text-white"
                                  />
                                  {row.unitPriceDzd !== undefined && (
                                    <button
                                      type="button"
                                      onClick={() => handleGroupPriceChange(row, '')}
                                      className="text-[11px] text-slate-400 hover:text-red-500"
                                      title="إزالة السعر"
                                    >
                                      مسح
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-3 font-mono-nums font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                {total !== null ? formatDzd(total) : 'غير مسعّر'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          )}

          {/* 3. Section B: Algerian Construction & Finishing Costs */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeConstruction}
                  onChange={(e) => setIncludeConstruction(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-display text-sm font-bold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-blue-600" />
                  <span>
                    ثانياً: تكاليف مواد البناء والدهن واليد العاملة ({constructionEstimate.builtAreaSqm} م²)
                  </span>
                </span>
              </label>

              <span className="font-mono-nums font-bold text-blue-700 dark:text-blue-400 text-xs">
                المجموع: {formatDzd(constructionSubtotalDzd)}
              </span>
            </div>

            {includeConstruction && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                      المنطقة (السوق الجزائري)
                    </label>
                    <select
                      value={region}
                      onChange={(e) => setRegion(e.target.value as AlgeriaRegion)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-slate-900 dark:text-white"
                    >
                      {ALGERIA_REGIONS.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label} ({r.wilayasSample})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                      عدد الطوابق
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={floorsCount}
                      onChange={(e) =>
                        setFloorsCount(Math.max(1, Math.min(8, Number(e.target.value) || 1)))
                      }
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 font-mono-nums text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                      مستوى التشطيب
                    </label>
                    <select
                      value={finishLevel}
                      onChange={(e) => setFinishLevel(e.target.value as FinishLevel)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-slate-900 dark:text-white"
                    >
                      <option value="economic">اقتصادي</option>
                      <option value="standard">متوسط (قياسي)</option>
                      <option value="luxury">فاخر (لوكس)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {[
                    { checked: includeStructure, set: setIncludeStructure, label: 'البناء والهيكل' },
                    { checked: includePaint, set: setIncludePaint, label: 'الدهن والأندوي' },
                    { checked: includeTiling, set: setIncludeTiling, label: 'السيراميك والجبس' },
                    { checked: includeLabor, set: setIncludeLabor, label: 'اليد العاملة' },
                  ].map((opt) => (
                    <label
                      key={opt.label}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={opt.checked}
                        onChange={(e) => opt.set(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 4. Section C: Custom Extra Services / Items */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
                ثالثاً: بنود ومصاريف إضافية (نقل، تركيب، أتعاب...)
              </span>
              <span className="font-mono-nums font-bold text-blue-700 dark:text-blue-400">
                المجموع: {formatDzd(customSubtotalDzd)}
              </span>
            </div>

            {customItems.length > 0 && (
              <div className="space-y-2">
                {customItems.map((c) => (
                  <div
                    key={c.id}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center rounded-lg border border-slate-200 dark:border-slate-800 p-2 bg-slate-50/50 dark:bg-slate-900/40"
                  >
                    <input
                      type="text"
                      value={c.label}
                      onChange={(e) =>
                        setCustomItems((prev) =>
                          prev.map((x) => (x.id === c.id ? { ...x, label: e.target.value } : x))
                        )
                      }
                      className="sm:col-span-5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-slate-900 dark:text-white"
                    />
                    <input
                      type="number"
                      min={1}
                      value={c.quantity}
                      onChange={(e) =>
                        setCustomItems((prev) =>
                          prev.map((x) =>
                            x.id === c.id
                              ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) }
                              : x
                          )
                        )
                      }
                      className="sm:col-span-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 font-mono-nums"
                    />
                    <input
                      type="number"
                      min={0}
                      step={500}
                      value={c.unitPriceDzd}
                      onChange={(e) =>
                        setCustomItems((prev) =>
                          prev.map((x) =>
                            x.id === c.id
                              ? { ...x, unitPriceDzd: Math.max(0, Number(e.target.value) || 0) }
                              : x
                          )
                        )
                      }
                      placeholder="السعر (د.ج)"
                      className="sm:col-span-3 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 font-mono-nums"
                    />
                    <div className="sm:col-span-2 flex items-center justify-between gap-2">
                      <span className="font-mono-nums font-bold">
                        {formatDzd(c.quantity * c.unitPriceDzd)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setCustomItems((prev) => prev.filter((x) => x.id !== c.id))
                        }
                        className="text-red-500 hover:text-red-700 p-1"
                        title="حذف البند"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
              <input
                type="text"
                value={newCustomLabel}
                onChange={(e) => setNewCustomLabel(e.target.value)}
                placeholder="بند جديد (مثال: تكلفة التوصيل والتركيب)"
                className="sm:col-span-5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5"
              />
              <input
                type="number"
                min={1}
                value={newCustomQty}
                onChange={(e) => setNewCustomQty(Math.max(1, Number(e.target.value) || 1))}
                placeholder="الكمية"
                className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 font-mono-nums"
              />
              <input
                type="text"
                value={newCustomUnit}
                onChange={(e) => setNewCustomUnit(e.target.value)}
                placeholder="الوحدة"
                className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5"
              />
              <div className="sm:col-span-3 flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={newCustomPrice}
                  onChange={(e) => setNewCustomPrice(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="السعر دج"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 font-mono-nums"
                />
                <button
                  type="button"
                  onClick={handleAddCustomItem}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-900 dark:bg-blue-600 text-white px-3 py-1.5 font-semibold whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-500 dark:text-slate-400 mb-1">
                ملاحظات الفاتورة (تظهر أسفل ملف PDF)
              </label>
              <input
                type="text"
                value={customer.notes}
                onChange={(e) => setCustomer((p) => ({ ...p, notes: e.target.value }))}
                placeholder="مثال: هذه القيم تقديرية وليست نهائية — تخضع للمعاينة الميدانية"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5"
              />
            </div>
          </div>

          {/* 5. Section D: Client Project Showcase Photo Selection & Export */}
          <div
            ref={showcaseSectionRef}
            className="rounded-xl border border-indigo-200 dark:border-indigo-900/70 bg-white dark:bg-[#181B20] p-4 space-y-3.5 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <div className="font-display text-sm font-bold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
                  <Images className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>رابعاً: تصدير صور المشروع للعرض على الزبون</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  التقط لقطات من المخطط 2D أو المنظور 3D أو ارفع صوراً واختر ما يُعرض للزبون ضمن ملف الفاتورة التقديرية PDF أو كصور مستقلة.
                </p>
              </div>

              <span className="font-mono-nums font-bold text-indigo-700 dark:text-indigo-300">
                المحددة للزبون: {activeShowcase.filter((s) => s.selectedForClient).length} / {activeShowcase.length}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onCapture2D && (
                <button
                  type="button"
                  onClick={handleCapture2DPhoto}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/30 hover:bg-blue-100 px-3 py-1.5 font-semibold text-blue-700 dark:text-blue-300 transition-colors"
                >
                  <Grid3X3 className="w-3.5 h-3.5" />
                  <span>التقاط المخطط 2D</span>
                </button>
              )}

              {onCapture3D && (
                <button
                  type="button"
                  onClick={handleCapture3DPhoto}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/30 hover:bg-indigo-100 px-3 py-1.5 font-semibold text-indigo-700 dark:text-indigo-300 transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>التقاط المنظور 3D</span>
                </button>
              )}

              <input
                ref={showcaseUploadRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleUploadShowcaseFiles}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => showcaseUploadRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-1.5 font-semibold text-slate-700 dark:text-slate-200 transition-colors"
              >
                <ImagePlus className="w-3.5 h-3.5" />
                <span>رفع صور من الجهاز</span>
              </button>

              {activeShowcase.some((s) => s.selectedForClient) && (
                <button
                  type="button"
                  onClick={handleDownloadSelectedImages}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/30 hover:bg-emerald-100 px-3 py-1.5 font-semibold text-emerald-700 dark:text-emerald-300 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تنزيل الصور المختارة</span>
                </button>
              )}

              {showcaseFeedback && (
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  {showcaseFeedback}
                </span>
              )}
            </div>

            {activeShowcase.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-5 text-center text-slate-500 dark:text-slate-400">
                لا توجد صور مضافة بعد. اضغط على «التقاط المخطط 2D» أو «التقاط المنظور 3D» أو ارفع صوراً ليتم إدراجها للزبون مع الفاتورة التقديرية.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeShowcase.map((img, idx) => (
                  <div
                    key={img.id}
                    className={`rounded-xl border p-2.5 space-y-2 transition-colors ${
                      img.selectedForClient
                        ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 opacity-75'
                    }`}
                  >
                    <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950">
                      <img
                        src={img.dataUrl}
                        alt={img.title}
                        className="w-full h-full object-contain"
                      />
                      <span className="absolute top-1.5 right-1.5 rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {img.source === '2d' ? 'مخطط 2D' : img.source === '3d' ? 'منظور 3D' : 'صورة مرفقة'}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <input
                        type="text"
                        value={img.title}
                        onChange={(e) =>
                          setShowcase((prev) =>
                            prev.map((x) => (x.id === img.id ? { ...x, title: e.target.value } : x))
                          )
                        }
                        placeholder="عنوان اللقطة"
                        className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 font-semibold text-slate-900 dark:text-white"
                      />
                      <input
                        type="text"
                        value={img.caption || ''}
                        onChange={(e) =>
                          setShowcase((prev) =>
                            prev.map((x) => (x.id === img.id ? { ...x, caption: e.target.value } : x))
                          )
                        }
                        placeholder="وصف مختصر للزبون (اختياري)"
                        className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-[11px] text-slate-600 dark:text-slate-300"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/70 dark:border-slate-800">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={img.selectedForClient}
                          onChange={(e) =>
                            setShowcase((prev) =>
                              prev.map((x) =>
                                x.id === img.id ? { ...x, selectedForClient: e.target.checked } : x
                              )
                            )
                          }
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>عرض للزبون</span>
                      </label>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => downloadSingleImage(img, idx)}
                          className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                          title="تنزيل هذه الصورة"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setShowcase((prev) => prev.filter((x) => x.id !== img.id))
                          }
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                          title="حذف الصورة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sticky Grand Total & Export Actions Footer */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 pb-safe bg-white dark:bg-[#181B20] border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 shrink-0">
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              المجموع التقديري {discountDzd > 0 ? `(بعد تخفيض ${discountPct}%)` : ''} ·{' '}
              <span className="text-amber-700 dark:text-amber-400 font-semibold">
                القيم تقديرية وليست نهائية
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-2.5">
              <span className="text-xl sm:text-2xl font-bold font-mono-nums text-slate-900 dark:text-white">
                {formatDzd(grandTotalDzd)}
              </span>
              <span className="text-xs font-semibold font-mono-nums text-blue-700 dark:text-blue-400">
                ({formatMillionCentimes(grandTotalDzd)})
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {copiedNotice ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedNotice ? 'تم نسخ الملخص' : 'نسخ الملخص'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 px-4 py-2 text-xs font-semibold text-white transition-colors"
            >
              <FileDown className="w-4 h-4" />
              <span>
                {exportingPdf
                  ? 'جارٍ إنشاء الفاتورة...'
                  : 'تحميل الفاتورة التقديرية والصور PDF'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
