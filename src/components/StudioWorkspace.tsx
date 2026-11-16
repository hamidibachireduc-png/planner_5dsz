import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Box,
  Calculator,
  Check,
  Columns2,
  Copy,
  Crown,
  DoorOpen,
  Download,
  Eye,
  EyeOff,
  FileText,
  Grid3X3,
  ImagePlus,
  Layers,
  Magnet,
  Menu,
  Moon,
  MousePointer,
  PenTool,
  PlusSquare,
  Receipt,
  Redo2,
  RotateCw,
  Ruler,
  Save,
  Search,
  SlidersHorizontal,
  Sofa,
  Square,
  Sun,
  Trash2,
  Undo2,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import { formatDzd } from '../data/algeriaMarketPrices';
import { BRAND_LOGO_URL } from '../utils/assets';
import {
  FLOOR_STYLES,
  FURNITURE_CATALOG,
  FURNITURE_CATEGORIES,
  MATERIAL_SWATCHES,
  WALL_COLOR_SWATCHES,
  computeFloorPlanMetrics,
} from '../data/catalog';
import {
  EditorTool,
  FloorPlanData,
  FurnitureCategory,
  FurnitureItem,
  RoomFloorStyle,
  SelectionTarget,
  SketchUnderlayConfig,
  UnitType,
  ViewMode,
} from '../types/planner';
import { AlgeriaCostCalculator } from './AlgeriaCostCalculator';
import { Canvas2D } from './Canvas2D';
import { InvoiceModal } from './InvoiceModal';
import { SketchToPlanModal } from './SketchToPlanModal';
import { Viewport3D } from './Viewport3D';
import { exportFloorPlanToPdf } from '../utils/pdfExporter';
import { downloadProjectToDevice, parseImportedProjectFile } from '../utils/projectFileIo';

interface StudioWorkspaceProps {
  brandName: string;
  projectId: string;
  initialTitle: string;
  initialPlan: FloorPlanData;
  initialUnderlay?: SketchUnderlayConfig | null;
  isDarkTheme: boolean;
  isSignedIn: boolean;
  isGuestSession?: boolean;
  isUserProActive?: boolean;
  onOpenProUpgrade?: () => void;
  onToggleTheme: () => void;
  onSaveProject: (title: string, plan: FloorPlanData) => Promise<void>;
  onBackToGallery: () => void;
}

export const StudioWorkspace: React.FC<StudioWorkspaceProps> = ({
  brandName,
  initialTitle,
  initialPlan,
  initialUnderlay = null,
  isDarkTheme,
  isSignedIn,
  isGuestSession = false,
  isUserProActive = false,
  onOpenProUpgrade,
  onToggleTheme,
  onSaveProject,
  onBackToGallery,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [floorPlan, setFloorPlan] = useState<FloorPlanData>(initialPlan);
  const [history, setHistory] = useState<FloorPlanData[]>([initialPlan]);
  const [historyIdx, setHistoryIdx] = useState(0);

  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? '2d' : 'split'
  );
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [selection, setSelection] = useState<SelectionTarget>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'catalog' | 'calculator'>('catalog');
  const [mobileSheet, setMobileSheet] = useState<
    null | 'tools' | 'catalog' | 'calculator' | 'inspector'
  >(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [show3DAreaDrawer, setShow3DAreaDrawer] = useState(false);
  const [showCostModal, setShowCostModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showSketchModal, setShowSketchModal] = useState(false);
  const [sketchUnderlay, setSketchUnderlay] = useState<SketchUnderlayConfig | null>(
    initialUnderlay
  );
  const [catalogCategory, setCatalogCategory] = useState<FurnitureCategory | 'all'>('all');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [useCatalogPrices, setUseCatalogPrices] = useState(true);
  const [catalogVisibleLimit, setCatalogVisibleLimit] = useState(36);
  const importFileRef = React.useRef<HTMLInputElement | null>(null);

  const [saving, setSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Close mobile inspector sheet automatically if selection is cleared
  useEffect(() => {
    if (!selection && mobileSheet === 'inspector') {
      setMobileSheet(null);
    }
  }, [selection, mobileSheet]);

  const metrics = useMemo(() => computeFloorPlanMetrics(floorPlan), [floorPlan]);

  const areaReport = useMemo(() => {
    const unitFactorArea = floorPlan.unit === 'ft' ? 10.7639 : 1;
    const unitFactorLen = floorPlan.unit === 'ft' ? 3.28084 : 1;
    const areaUnitLabel = floorPlan.unit === 'ft' ? 'ft²' : 'م²';
    const lenUnitLabel = floorPlan.unit === 'ft' ? 'ft' : 'm';

    const roomRows = floorPlan.rooms.map((room) => {
      const w = Math.max(0, room.width);
      const d = Math.max(0, room.depth);
      const areaSqm = w * d;
      const perimeterM = 2 * (w + d);
      const styleMeta = FLOOR_STYLES.find((fs) => fs.id === room.floorStyle);
      return {
        id: room.id,
        name: room.name || 'غرفة',
        width: w,
        depth: d,
        areaSqm,
        perimeterM,
        sharePct: metrics.totalAreaSqm > 0 ? (areaSqm / metrics.totalAreaSqm) * 100 : 0,
        floorStyle: room.floorStyle,
        floorLabel: styleMeta?.label || room.floorStyle,
        previewColor: styleMeta?.previewColor || '#C59B6D',
      };
    });

    const totalPerimeterM = roomRows.reduce((sum, r) => sum + r.perimeterM, 0);

    const grossWallLengthM = floorPlan.walls.reduce(
      (sum, w) => sum + Math.hypot(w.x2 - w.x1, w.z2 - w.z1),
      0
    );
    const grossWallAreaSqm = floorPlan.walls.reduce(
      (sum, w) => sum + Math.hypot(w.x2 - w.x1, w.z2 - w.z1) * (w.height || floorPlan.wallHeight),
      0
    );
    const openingsAreaSqm = floorPlan.openings.reduce(
      (sum, op) => sum + Math.max(0, op.width * op.height),
      0
    );
    const netWallAreaSqm = Math.max(0, grossWallAreaSqm - openingsAreaSqm);

    const materialMap = new Map<
      RoomFloorStyle,
      { floorStyle: RoomFloorStyle; label: string; previewColor: string; areaSqm: number }
    >();
    roomRows.forEach((r) => {
      const existing = materialMap.get(r.floorStyle);
      if (existing) {
        existing.areaSqm += r.areaSqm;
      } else {
        materialMap.set(r.floorStyle, {
          floorStyle: r.floorStyle,
          label: r.floorLabel,
          previewColor: r.previewColor,
          areaSqm: r.areaSqm,
        });
      }
    });

    return {
      unitFactorArea,
      unitFactorLen,
      areaUnitLabel,
      lenUnitLabel,
      roomRows,
      totalAreaSqm: metrics.totalAreaSqm,
      totalAreaSqft: metrics.totalAreaSqm * 10.7639,
      totalPerimeterM,
      grossWallLengthM,
      netWallAreaSqm,
      byMaterial: Array.from(materialMap.values()).sort((a, b) => b.areaSqm - a.areaSqm),
    };
  }, [floorPlan, metrics.totalAreaSqm]);

  const updateFloorPlan = useCallback(
    (next: FloorPlanData, commitHistory = true) => {
      setFloorPlan(next);
      if (commitHistory) {
        setHistory((prev) => {
          const sliced = prev.slice(0, historyIdx + 1);
          const updated = [...sliced, next].slice(-30);
          setHistoryIdx(updated.length - 1);
          return updated;
        });
      }
    },
    [historyIdx]
  );

  const handleUndo = useCallback(() => {
    if (historyIdx <= 0) return;
    const prevIdx = historyIdx - 1;
    setHistoryIdx(prevIdx);
    setFloorPlan(history[prevIdx]);
    setSelection(null);
  }, [history, historyIdx]);

  const handleRedo = useCallback(() => {
    if (historyIdx >= history.length - 1) return;
    const nextIdx = historyIdx + 1;
    setHistoryIdx(nextIdx);
    setFloorPlan(history[nextIdx]);
    setSelection(null);
  }, [history, historyIdx]);

  const deleteSelection = useCallback(() => {
    if (!selection) return;
    if (selection.kind === 'furniture') {
      updateFloorPlan({
        ...floorPlan,
        furniture: floorPlan.furniture.filter((f) => f.id !== selection.id),
      });
    } else if (selection.kind === 'room') {
      updateFloorPlan({
        ...floorPlan,
        rooms: floorPlan.rooms.filter((r) => r.id !== selection.id),
      });
    } else if (selection.kind === 'wall') {
      updateFloorPlan({
        ...floorPlan,
        walls: floorPlan.walls.filter((w) => w.id !== selection.id),
        openings: floorPlan.openings.filter((o) => o.wallId !== selection.id),
      });
    } else if (selection.kind === 'opening') {
      updateFloorPlan({
        ...floorPlan,
        openings: floorPlan.openings.filter((o) => o.id !== selection.id),
      });
    }
    setSelection(null);
  }, [selection, floorPlan, updateFloorPlan]);

  // Keyboard shortcuts: Delete selected, Ctrl+Z / Ctrl+Y
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelection();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteSelection, handleUndo, handleRedo]);

  const filteredCatalog = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    return FURNITURE_CATALOG.filter((item) => {
      const matchCat = catalogCategory === 'all' || item.category === catalogCategory;
      const matchQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.styleTag && item.styleTag.toLowerCase().includes(q));
      return matchCat && matchQuery;
    });
  }, [catalogCategory, catalogQuery]);

  const visibleSidebarCatalog = useMemo(
    () => filteredCatalog.slice(0, catalogVisibleLimit),
    [filteredCatalog, catalogVisibleLimit]
  );

  const addCatalogItemToCenter = (def: (typeof FURNITURE_CATALOG)[number]) => {
    let cx = 0;
    let cz = 0;
    if (floorPlan.rooms.length > 0) {
      const r = floorPlan.rooms[0];
      cx = Number((r.x + r.width / 2).toFixed(2));
      cz = Number((r.z + r.depth / 2).toFixed(2));
    }
    const offset = (floorPlan.furniture.length % 4) * 0.25;
    const newItem: FurnitureItem = {
      id: `furn_${Date.now()}`,
      catalogId: def.catalogId,
      type: def.type,
      name: def.name,
      category: def.category,
      x: cx + offset,
      z: cz + offset,
      rotation: 0,
      width: def.width,
      depth: def.depth,
      height: def.height,
      primaryColor: def.defaultPrimary,
      accentColor: def.defaultAccent,
      ...(useCatalogPrices && typeof def.defaultPriceDzd === 'number'
        ? { priceDzd: def.defaultPriceDzd }
        : {}),
    };
    updateFloorPlan({
      ...floorPlan,
      furniture: [...floorPlan.furniture, newItem],
    });
    setSelection({ kind: 'furniture', id: newItem.id });
    setActiveTool('select');
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveFeedback(null);
    try {
      await onSaveProject(title, floorPlan);
      setSaveFeedback(isSignedIn ? 'تم حفظ المشروع بنجاح' : 'تم الحفظ محلياً');
      setTimeout(() => setSaveFeedback(null), 2600);
    } catch {
      setSaveFeedback('تعذر الحفظ، حاول مجدداً');
    } finally {
      setSaving(false);
    }
  };

  const handleExportJson = () => {
    downloadProjectToDevice({
      title,
      brandName,
      floorPlanData: floorPlan,
    });
    setSaveFeedback('تم حفظ نسخة في جهازك');
    setTimeout(() => setSaveFeedback(null), 2600);
  };

  const handleImportDeviceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const imported = await parseImportedProjectFile(file);
      const first = imported[0];
      if (!first) return;
      setTitle(first.title);
      updateFloorPlan(first.floorPlanData, true);
      setSelection(null);
      setSaveFeedback(`تم استيراد: ${first.title}`);
      setTimeout(() => setSaveFeedback(null), 3000);
    } catch (err) {
      setSaveFeedback(err instanceof Error ? err.message : 'تعذر استيراد الملف');
      setTimeout(() => setSaveFeedback(null), 3200);
    }
  };

  const handleExportPdf = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      await exportFloorPlanToPdf({
        title,
        brandName,
        floorPlan,
      });
    } catch (err) {
      console.error('PDF export error:', err);
      setSaveFeedback('تعذر تصدير ملف PDF');
      setTimeout(() => setSaveFeedback(null), 2600);
    } finally {
      setExportingPdf(false);
    }
  };

  const selectedRoom =
    selection?.kind === 'room'
      ? floorPlan.rooms.find((r) => r.id === selection.id)
      : undefined;
  const selectedWall =
    selection?.kind === 'wall'
      ? floorPlan.walls.find((w) => w.id === selection.id)
      : undefined;
  const selectedOpening =
    selection?.kind === 'opening'
      ? floorPlan.openings.find((o) => o.id === selection.id)
      : undefined;
  const selectedFurniture =
    selection?.kind === 'furniture'
      ? floorPlan.furniture.find((f) => f.id === selection.id)
      : undefined;

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-[#F7F6F2] dark:bg-[#111315] text-slate-900 dark:text-slate-100">
      {/* Studio Top Bar */}
      <header className="h-14 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] px-2.5 sm:px-4 flex items-center justify-between gap-2 sm:gap-3 z-30 relative">
        {/* Right/Start: Back + Editable Title */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1 sm:flex-initial">
          <button
            type="button"
            onClick={onBackToGallery}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 min-h-[36px]"
            aria-label="العودة للمشاريع"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span className="hidden xs:inline sm:inline">المشاريع</span>
          </button>

          <img
            src={BRAND_LOGO_URL}
            alt={brandName}
            className="w-8 h-8 rounded-full object-cover border border-amber-600/40 shrink-0 hidden sm:block"
          />

          <span className="font-display font-bold text-sm text-blue-700 dark:text-blue-400 hidden xl:inline whitespace-nowrap shrink-0">
            {brandName}
          </span>

          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden xl:block" />

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="اسم المشروع"
            className="w-full min-w-[80px] max-w-[140px] sm:max-w-none sm:w-44 lg:w-52 rounded-md border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-blue-500 bg-transparent px-1.5 sm:px-2 py-1 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none truncate"
          />

          <button
            type="button"
            onClick={() => {
              if (viewMode === '3d') {
                setShow3DAreaDrawer((v) => !v);
              } else {
                setSidebarTab((t) => (t === 'calculator' ? 'catalog' : 'calculator'));
              }
            }}
            className={`hidden lg:inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-mono-nums transition-colors whitespace-nowrap shrink-0 ${
              (viewMode !== '3d' && sidebarTab === 'calculator') ||
              (viewMode === '3d' && show3DAreaDrawer)
                ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            title="فتح حاسبة المساحات الحية"
          >
            <Calculator className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>
              {metrics.roomCount} غرف · {(areaReport.totalAreaSqm * areaReport.unitFactorArea).toFixed(1)}{' '}
              {areaReport.areaUnitLabel}
            </span>
          </button>
        </div>

        {/* Center: 2D / Split / 3D Switcher */}
        <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 sm:p-1 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('2d')}
            className={`inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              viewMode === '2d'
                ? 'bg-white dark:bg-slate-950 text-blue-700 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">مخطط</span>
            <span>2D</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('split')}
            className={`inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'split'
                ? 'bg-white dark:bg-slate-950 text-blue-700 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">2D + 3D</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('3d')}
            className={`inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              viewMode === '3d'
                ? 'bg-white dark:bg-slate-950 text-blue-700 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">منظور</span>
            <span>3D</span>
          </button>
        </div>

        {/* Left/End: Undo/Redo, Units, Theme, Export, Save + Mobile Menu */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="hidden md:flex items-center gap-1">
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyIdx <= 0}
              className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35"
              title="تراجع"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={historyIdx >= history.length - 1}
              className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35"
              title="إعادة"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              updateFloorPlan({
                ...floorPlan,
                unit: floorPlan.unit === 'm' ? 'ft' : 'm',
              })
            }
            className="hidden lg:inline-flex items-center px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-mono-nums text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            title="تبديل وحدة القياس"
          >
            {floorPlan.unit === 'm' ? 'متر (m)' : 'قدم (ft)'}
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            className="hidden sm:inline-flex p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            title={isDarkTheme ? 'الوضع النهاري' : 'الوضع الداكن'}
          >
            {isDarkTheme ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <input
            ref={importFileRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportDeviceFile}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => setShowSketchModal(true)}
            className="hidden lg:inline-flex items-center gap-1 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/30 px-2.5 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors whitespace-nowrap shrink-0"
            title="إدراج وتحويل تصميم من ورقة مرسومة (برو)"
          >
            <ImagePlus className="w-3.5 h-3.5" />
            <span>من ورقة (برو)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowInvoiceModal(true)}
            className="hidden lg:inline-flex items-center gap-1 rounded-lg border border-amber-300 dark:border-amber-700/70 bg-amber-50/80 dark:bg-amber-950/30 px-2.5 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors whitespace-nowrap shrink-0"
            title="عرض وتصدير فاتورة الحسابات والمقايسة"
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>فاتورة الحسابات</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exportingPdf}
            className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 px-2.5 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            title="تصدير المخطط ثنائي الأبعاد مع القياسات والأثاث بصيغة PDF للطباعة"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{exportingPdf ? 'جارٍ التصدير...' : 'PDF'}</span>
          </button>

          <button
            type="button"
            onClick={() => importFileRef.current?.click()}
            className="hidden lg:inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            title="استيراد ملف مشروع من جهازك (.json)"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>استيراد</span>
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            className="hidden lg:inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            title="حفظ المشروع كملف في جهازك (.json)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>حفظ بالجهاز</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1 sm:gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 px-2.5 sm:px-3.5 py-1.5 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 min-h-[36px]"
          >
            {saveFeedback ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            <span>{saving ? '...' : saveFeedback || 'حفظ'}</span>
          </button>

          {/* Compact More Actions Dropdown for Phones & Tablets */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="المزيد من الخيارات"
            className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {/* Mobile/Tablet Overflow Actions Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden absolute top-14 left-2.5 right-2.5 sm:right-auto sm:w-72 z-50 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#181B20] shadow-xl p-2 space-y-1 text-xs">
            <div className="grid grid-cols-2 gap-1.5 pb-1.5 border-b border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  handleUndo();
                  setMobileMenuOpen(false);
                }}
                disabled={historyIdx <= 0}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 py-2 font-medium disabled:opacity-40"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>تراجع</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleRedo();
                  setMobileMenuOpen(false);
                }}
                disabled={historyIdx >= history.length - 1}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 py-2 font-medium disabled:opacity-40"
              >
                <Redo2 className="w-3.5 h-3.5" />
                <span>إعادة</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setShowCostModal(true);
              }}
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 text-right"
            >
              <Calculator className="w-4 h-4 text-blue-600" />
              <span>حاسبة أسعار مواد البناء والدهن</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setShowSketchModal(true);
              }}
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-right"
            >
              <ImagePlus className="w-4 h-4" />
              <span>تصميم من ورقة مرسومة (برو)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setShowInvoiceModal(true);
              }}
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-right"
            >
              <Receipt className="w-4 h-4" />
              <span>فاتورة الحسابات الشاملة PDF</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                void handleExportPdf();
              }}
              disabled={exportingPdf}
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-right"
            >
              <FileText className="w-4 h-4" />
              <span>{exportingPdf ? 'جارٍ التصدير...' : 'تصدير المخطط الهندسي PDF'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                handleExportJson();
              }}
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 text-right"
            >
              <Download className="w-4 h-4" />
              <span>حفظ المشروع في الجهاز (.json)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                importFileRef.current?.click();
              }}
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 text-right"
            >
              <Upload className="w-4 h-4" />
              <span>استيراد مشروع من الجهاز (.json)</span>
            </button>

            <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  updateFloorPlan({
                    ...floorPlan,
                    unit: floorPlan.unit === 'm' ? 'ft' : 'm',
                  });
                }}
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 py-2 font-mono-nums"
              >
                <Ruler className="w-3.5 h-3.5" />
                <span>{floorPlan.unit === 'm' ? 'متر (m)' : 'قدم (ft)'}</span>
              </button>
              <button
                type="button"
                onClick={onToggleTheme}
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 py-2"
              >
                {isDarkTheme ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                <span>{isDarkTheme ? 'نهاري' : 'داكن'}</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {isGuestSession && (
        <div className="px-3 sm:px-4 py-1.5 bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-900 flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs shrink-0">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 text-amber-900 dark:text-amber-200 font-medium">
            <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              معاينة مؤقتة (تصميم واحد فقط) — اشترك في برو لفتح 200 تصميم.
            </span>
          </div>
          {onOpenProUpgrade && (
            <button
              type="button"
              onClick={onOpenProUpgrade}
              className="inline-flex items-center gap-1 rounded-md bg-amber-600 hover:bg-amber-700 px-2.5 sm:px-3 py-1 text-[11px] font-semibold text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Crown className="w-3 h-3" />
              <span>اشتراك برو</span>
            </button>
          )}
        </div>
      )}

      {/* Main Workspace Area */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Desktop Catalog & Drafting Sidebar (Hidden on < lg; mobile uses bottom sheet dock) */}
        {viewMode !== '3d' && (
          <aside className="hidden lg:flex w-72 shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] flex-col min-h-0 z-20">
            {/* Drafting Tools Section */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  أدوات الرسم الهندسي
                </span>
                <button
                  type="button"
                  onClick={() => setSnapEnabled((s) => !s)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    snapEnabled
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                  title="تفعيل أو إيقاف المحاذاة التلقائية للشبكة"
                >
                  <Magnet className="w-3 h-3" />
                  <span>محاذاة</span>
                </button>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {(
                  [
                    { id: 'select', label: 'تحديد', Icon: MousePointer },
                    { id: 'room', label: 'غرفة', Icon: PlusSquare },
                    { id: 'wall', label: 'جدار', Icon: PenTool },
                    { id: 'door', label: 'باب', Icon: DoorOpen },
                    { id: 'window', label: 'نافذة', Icon: Square },
                  ] as const
                ).map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTool(id)}
                    className={`flex flex-col items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                      activeTool === id
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Sidebar Mode Switcher: Catalog vs Real-Time Area Calculator */}
            <div className="px-3 pt-2.5 pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setSidebarTab('catalog')}
                  className={`py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    sidebarTab === 'catalog'
                      ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  الأثاث والأجهزة
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarTab('calculator')}
                  className={`inline-flex items-center justify-center gap-1 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    sidebarTab === 'calculator'
                      ? 'bg-white dark:bg-slate-950 text-blue-700 dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>حاسبة المساحات</span>
                </button>
              </div>
            </div>

            {sidebarTab === 'catalog' ? (
              <>
                {/* Furniture Catalog Search & Categories */}
                <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={catalogQuery}
                      onChange={(e) => {
                        setCatalogQuery(e.target.value);
                        setCatalogVisibleLimit(36);
                      }}
                      placeholder={`ابحث في ${FURNITURE_CATALOG.length} تصميماً فاخراً...`}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pr-8 pl-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {FURNITURE_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setCatalogCategory(cat.id);
                          setCatalogVisibleLimit(36);
                        }}
                        className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                          catalogCategory === cat.id
                            ? 'bg-slate-900 dark:bg-blue-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer pt-0.5">
                    <span className="inline-flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={useCatalogPrices}
                        onChange={(e) => setUseCatalogPrices(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>إدراج السعر التقديري (اختياري)</span>
                    </span>
                    <span className="font-mono-nums text-slate-400">
                      {filteredCatalog.length} تصميم
                    </span>
                  </label>
                </div>

                {/* Catalog Items List */}
                <div className="flex-1 overflow-y-auto studio-scroll p-3 space-y-2">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    اسحب العنصر للمخطط أو انقر لإضافته مباشرة
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {visibleSidebarCatalog.map((def) => (
                      <button
                        key={def.catalogId}
                        type="button"
                        draggable
                        onDragStart={(e) =>
                          e.dataTransfer.setData(
                            'application/bachir5d-furniture',
                            JSON.stringify({
                              ...def,
                              defaultPriceDzd: useCatalogPrices ? def.defaultPriceDzd : undefined,
                            })
                          )
                        }
                        onClick={() => addCatalogItemToCenter(def)}
                        className="group flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-2.5 text-right hover:border-blue-500 dark:hover:border-blue-500 transition-colors cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-7 h-7 rounded-md shrink-0 border border-black/10"
                            style={{ backgroundColor: def.defaultPrimary }}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                              {def.name}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono-nums">
                              <span>
                                {def.width.toFixed(2)}×{def.depth.toFixed(2)} m
                              </span>
                              {typeof def.defaultPriceDzd === 'number' && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                                    {formatDzd(def.defaultPriceDzd)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          + إضافة
                        </span>
                      </button>
                    ))}
                  </div>
                  {visibleSidebarCatalog.length < filteredCatalog.length && (
                    <button
                      type="button"
                      onClick={() => setCatalogVisibleLimit((n) => n + 48)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      عرض المزيد ({filteredCatalog.length - visibleSidebarCatalog.length} متبقي)
                    </button>
                  )}
                </div>
              </>
            ) : (
              /* Real-Time Architectural Area Calculator Panel */
              <div className="flex-1 overflow-y-auto studio-scroll p-3.5 space-y-4">
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>إجمالي المساحة الأرضية</span>
                    <span>{metrics.roomCount} غرف</span>
                  </div>
                  <div className="text-2xl font-bold font-mono-nums text-slate-900 dark:text-white">
                    {(areaReport.totalAreaSqm * areaReport.unitFactorArea).toFixed(1)}{' '}
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      {areaReport.areaUnitLabel}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono-nums text-slate-500 dark:text-slate-400">
                    {floorPlan.unit === 'm'
                      ? `${areaReport.totalAreaSqft.toFixed(0)} ft²`
                      : `${areaReport.totalAreaSqm.toFixed(1)} م²`}
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    <span>
                      المحيط {(areaReport.totalPerimeterM * areaReport.unitFactorLen).toFixed(1)}{' '}
                      {areaReport.lenUnitLabel}
                    </span>
                  </div>
                </div>

                {/* Structural Wall & Paint Area Metrics */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      أطوال الجدران
                    </div>
                    <div className="text-sm font-bold font-mono-nums text-slate-900 dark:text-white mt-0.5">
                      {(areaReport.grossWallLengthM * areaReport.unitFactorLen).toFixed(1)}{' '}
                      {areaReport.lenUnitLabel}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      صافي مساحة الطلاء
                    </div>
                    <div className="text-sm font-bold font-mono-nums text-slate-900 dark:text-white mt-0.5">
                      {(areaReport.netWallAreaSqm * areaReport.unitFactorArea).toFixed(1)}{' '}
                      {areaReport.areaUnitLabel}
                    </div>
                  </div>
                </div>

                {/* Room-by-Room Breakdown */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      تفصيل الغرف (مباشر)
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTool('room')}
                      className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      + رسم غرفة
                    </button>
                  </div>

                  {areaReport.roomRows.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-4 text-center text-xs text-slate-500">
                      لا توجد غرف مرسومة حالياً. اختر أداة «غرفة» لبدء الحساب.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                      {areaReport.roomRows.map((room) => {
                        const isSel = selection?.kind === 'room' && selection.id === room.id;
                        return (
                          <button
                            key={room.id}
                            type="button"
                            onClick={() => setSelection({ kind: 'room', id: room.id })}
                            className={`w-full p-2.5 text-right transition-colors ${
                              isSel
                                ? 'bg-blue-50 dark:bg-blue-950/40'
                                : 'bg-white dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                {room.name}
                              </span>
                              <span className="text-xs font-bold font-mono-nums text-blue-700 dark:text-blue-400 shrink-0">
                                {(room.areaSqm * areaReport.unitFactorArea).toFixed(1)}{' '}
                                {areaReport.areaUnitLabel}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono-nums mt-1">
                              <span>
                                {(room.width * areaReport.unitFactorLen).toFixed(2)}×
                                {(room.depth * areaReport.unitFactorLen).toFixed(2)}{' '}
                                {areaReport.lenUnitLabel}
                              </span>
                              <span>{room.sharePct.toFixed(0)}%</span>
                            </div>
                            <div className="mt-1.5 h-1 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-blue-600 transition-all duration-150"
                                style={{ width: `${Math.min(100, room.sharePct)}%` }}
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Flooring Material Totals */}
                {areaReport.byMaterial.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                      كميات الأرضيات حسب الخامة
                    </span>
                    <div className="space-y-1.5">
                      {areaReport.byMaterial.map((m) => (
                        <div
                          key={m.floorStyle}
                          className="flex items-center justify-between gap-2 text-xs py-1"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-3.5 h-3.5 rounded border border-black/10 shrink-0"
                              style={{ backgroundColor: m.previewColor }}
                            />
                            <span className="text-slate-700 dark:text-slate-300 truncate">
                              {m.label}
                            </span>
                          </div>
                          <span className="font-mono-nums font-semibold text-slate-900 dark:text-white shrink-0">
                            {(m.areaSqm * areaReport.unitFactorArea).toFixed(1)}{' '}
                            {areaReport.areaUnitLabel}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowCostModal(true)}
                    className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 py-2.5 px-3 text-xs font-semibold text-white transition-colors"
                  >
                    حاسبة أسعار البناء والدهن (السوق الجزائري)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInvoiceModal(true)}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 py-2 px-3 text-xs font-semibold text-amber-800 dark:text-amber-300 transition-colors"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>فاتورة الحسابات الشاملة PDF</span>
                  </button>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    تحسب التكاليف تلقائياً بالدينار الجزائري حسب مساحة غرفك وأطوال الجدران وأسعار الأثاث الاختيارية.
                  </p>
                </div>
              </div>
            )}
          </aside>
        )}

        {/* Center Viewports (2D, Split stacked on mobile / side-by-side on md+, or Full 3D) */}
        <main className="flex-1 flex flex-col md:flex-row min-w-0 min-h-0 relative">
          {(viewMode === '2d' || viewMode === 'split') && (
            <div
              className={`relative ${
                viewMode === 'split'
                  ? 'w-full md:w-1/2 h-1/2 md:h-full border-b md:border-b-0 md:border-l border-slate-200 dark:border-slate-800'
                  : 'w-full h-full'
              } min-w-0 min-h-0`}
            >
              <Canvas2D
                floorPlan={floorPlan}
                activeTool={activeTool}
                selection={selection}
                snapEnabled={snapEnabled}
                isDarkTheme={isDarkTheme}
                sketchUnderlay={sketchUnderlay}
                onSelect={setSelection}
                onChangeFloorPlan={updateFloorPlan}
                onToolResetToSelect={() => setActiveTool('select')}
              />

              {/* Compact Underlay Controls when a Paper Sketch Underlay is active */}
              {sketchUnderlay && (
                <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 px-2.5 py-1.5 text-[11px] shadow-md max-w-[62vw]">
                  <button
                    type="button"
                    onClick={() =>
                      setSketchUnderlay((u) => (u ? { ...u, visible: !u.visible } : null))
                    }
                    className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600"
                    title="إظهار / إخفاء خلفية الورقة"
                  >
                    {sketchUnderlay.visible ? (
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span className="hidden sm:inline">الورقة</span>
                  </button>
                  <input
                    type="range"
                    min={0.1}
                    max={0.85}
                    step={0.05}
                    value={sketchUnderlay.opacity}
                    onChange={(e) =>
                      setSketchUnderlay((u) =>
                        u ? { ...u, opacity: Number(e.target.value), visible: true } : null
                      )
                    }
                    aria-label="شفافية صورة الورقة"
                    className="w-16 sm:w-20 accent-blue-600 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => setSketchUnderlay(null)}
                    aria-label="إزالة خلفية الورقة"
                    className="p-0.5 rounded text-slate-400 hover:text-red-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {(viewMode === '3d' || viewMode === 'split') && (
            <div
              className={`${
                viewMode === 'split' ? 'w-full md:w-1/2 h-1/2 md:h-full' : 'w-full h-full'
              } min-w-0 min-h-0`}
            >
              <Viewport3D
                floorPlan={floorPlan}
                selection={selection}
                onSelect={setSelection}
                isDarkTheme={isDarkTheme}
              />
            </div>
          )}

          {/* Desktop Contextual Properties Inspector (Hidden on < lg; mobile uses bottom sheet) */}
          {selection && viewMode !== '3d' && (
            <div className="hidden lg:flex w-72 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] flex-col min-h-0 overflow-y-auto studio-scroll p-4 z-20">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>
                    {selectedRoom && 'خصائص الغرفة'}
                    {selectedWall && 'خصائص الجدار'}
                    {selectedOpening &&
                      (selectedOpening.type === 'door' ? 'خصائص الباب' : 'خصائص النافذة')}
                    {selectedFurniture && selectedFurniture.name}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelection(null)}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Room Inspector */}
              {selectedRoom && (
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                      اسم الغرفة
                    </label>
                    <input
                      type="text"
                      value={selectedRoom.name}
                      onChange={(e) =>
                        updateFloorPlan({
                          ...floorPlan,
                          rooms: floorPlan.rooms.map((r) =>
                            r.id === selectedRoom.id ? { ...r, name: e.target.value } : r
                          ),
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                        العرض (m)
                      </label>
                      <input
                        type="number"
                        step={0.25}
                        min={1}
                        max={30}
                        value={selectedRoom.width}
                        onChange={(e) =>
                          updateFloorPlan({
                            ...floorPlan,
                            rooms: floorPlan.rooms.map((r) =>
                              r.id === selectedRoom.id
                                ? { ...r, width: Math.max(1, Number(e.target.value) || 1) }
                                : r
                            ),
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 font-mono-nums"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                        الطول (m)
                      </label>
                      <input
                        type="number"
                        step={0.25}
                        min={1}
                        max={30}
                        value={selectedRoom.depth}
                        onChange={(e) =>
                          updateFloorPlan({
                            ...floorPlan,
                            rooms: floorPlan.rooms.map((r) =>
                              r.id === selectedRoom.id
                                ? { ...r, depth: Math.max(1, Number(e.target.value) || 1) }
                                : r
                            ),
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 font-mono-nums"
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-2.5 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                      <Ruler className="w-3.5 h-3.5 text-blue-600" />
                      <span>المساحة الحية</span>
                    </span>
                    <span className="font-mono-nums font-bold text-slate-900 dark:text-white">
                      {(selectedRoom.width * selectedRoom.depth * areaReport.unitFactorArea).toFixed(1)}{' '}
                      {areaReport.areaUnitLabel}
                    </span>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-300 mb-2">
                      مادة الأرضية (3D)
                    </label>
                    <div className="space-y-1.5">
                      {FLOOR_STYLES.map((fs) => (
                        <button
                          key={fs.id}
                          type="button"
                          onClick={() =>
                            updateFloorPlan({
                              ...floorPlan,
                              rooms: floorPlan.rooms.map((r) =>
                                r.id === selectedRoom.id
                                  ? { ...r, floorStyle: fs.id as RoomFloorStyle }
                                  : r
                              ),
                            })
                          }
                          className={`w-full flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-right transition-colors ${
                            selectedRoom.floorStyle === fs.id
                              ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                              : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <span
                            className="w-4 h-4 rounded border border-black/10 shrink-0"
                            style={{ backgroundColor: fs.previewColor }}
                          />
                          <span className="truncate">{fs.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Wall Inspector */}
              {selectedWall && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                        الارتفاع (m)
                      </label>
                      <input
                        type="number"
                        step={0.1}
                        min={2}
                        max={5}
                        value={selectedWall.height}
                        onChange={(e) =>
                          updateFloorPlan({
                            ...floorPlan,
                            walls: floorPlan.walls.map((w) =>
                              w.id === selectedWall.id
                                ? { ...w, height: Math.max(2, Number(e.target.value) || 2.8) }
                                : w
                            ),
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 font-mono-nums"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                        السماكة (m)
                      </label>
                      <input
                        type="number"
                        step={0.02}
                        min={0.08}
                        max={0.5}
                        value={selectedWall.thickness}
                        onChange={(e) =>
                          updateFloorPlan({
                            ...floorPlan,
                            walls: floorPlan.walls.map((w) =>
                              w.id === selectedWall.id
                                ? { ...w, thickness: Math.max(0.08, Number(e.target.value) || 0.16) }
                                : w
                            ),
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 font-mono-nums"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-300 mb-2">
                      طلاء الجدار
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {WALL_COLOR_SWATCHES.map((sw) => (
                        <button
                          key={sw.color}
                          type="button"
                          onClick={() =>
                            updateFloorPlan({
                              ...floorPlan,
                              walls: floorPlan.walls.map((w) =>
                                w.id === selectedWall.id ? { ...w, color: sw.color } : w
                              ),
                            })
                          }
                          className={`h-8 rounded-lg border transition-transform ${
                            selectedWall.color === sw.color
                              ? 'border-blue-600 ring-2 ring-blue-500/30 scale-105'
                              : 'border-slate-300 dark:border-slate-700'
                          }`}
                          style={{ backgroundColor: sw.color }}
                          title={sw.label}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Opening Inspector */}
              {selectedOpening && (
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                      العرض ({selectedOpening.width.toFixed(2)} m)
                    </label>
                    <input
                      type="range"
                      min={0.6}
                      max={3.5}
                      step={0.05}
                      value={selectedOpening.width}
                      onChange={(e) =>
                        updateFloorPlan({
                          ...floorPlan,
                          openings: floorPlan.openings.map((o) =>
                            o.id === selectedOpening.id
                              ? { ...o, width: Number(e.target.value) }
                              : o
                          ),
                        })
                      }
                      className="w-full accent-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                      الارتفاع ({selectedOpening.height.toFixed(2)} m)
                    </label>
                    <input
                      type="range"
                      min={0.8}
                      max={2.6}
                      step={0.05}
                      value={selectedOpening.height}
                      onChange={(e) =>
                        updateFloorPlan({
                          ...floorPlan,
                          openings: floorPlan.openings.map((o) =>
                            o.id === selectedOpening.id
                              ? { ...o, height: Number(e.target.value) }
                              : o
                          ),
                        })
                      }
                      className="w-full accent-blue-600"
                    />
                  </div>
                  {selectedOpening.type === 'door' && (
                    <button
                      type="button"
                      onClick={() =>
                        updateFloorPlan({
                          ...floorPlan,
                          openings: floorPlan.openings.map((o) =>
                            o.id === selectedOpening.id
                              ? { ...o, swing: o.swing === 'out' ? 'in' : 'out' }
                              : o
                          ),
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 py-2 font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      عكس اتجاه فتح الباب
                    </button>
                  )}
                </div>
              )}

              {/* Furniture Inspector */}
              {selectedFurniture && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                        عرض
                      </label>
                      <input
                        type="number"
                        step={0.05}
                        min={0.25}
                        max={6}
                        value={selectedFurniture.width}
                        onChange={(e) =>
                          updateFloorPlan({
                            ...floorPlan,
                            furniture: floorPlan.furniture.map((f) =>
                              f.id === selectedFurniture.id
                                ? { ...f, width: Math.max(0.25, Number(e.target.value) || 0.5) }
                                : f
                            ),
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1 font-mono-nums"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                        عمق
                      </label>
                      <input
                        type="number"
                        step={0.05}
                        min={0.25}
                        max={6}
                        value={selectedFurniture.depth}
                        onChange={(e) =>
                          updateFloorPlan({
                            ...floorPlan,
                            furniture: floorPlan.furniture.map((f) =>
                              f.id === selectedFurniture.id
                                ? { ...f, depth: Math.max(0.25, Number(e.target.value) || 0.5) }
                                : f
                            ),
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1 font-mono-nums"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                        ارتفاع
                      </label>
                      <input
                        type="number"
                        step={0.05}
                        min={0.03}
                        max={3.5}
                        value={selectedFurniture.height}
                        onChange={(e) =>
                          updateFloorPlan({
                            ...floorPlan,
                            furniture: floorPlan.furniture.map((f) =>
                              f.id === selectedFurniture.id
                                ? { ...f, height: Math.max(0.03, Number(e.target.value) || 0.5) }
                                : f
                            ),
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1 font-mono-nums"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-slate-600 dark:text-slate-300">
                        تدوير العنصر
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateFloorPlan({
                            ...floorPlan,
                            furniture: floorPlan.furniture.map((f) =>
                              f.id === selectedFurniture.id
                                ? { ...f, rotation: f.rotation + Math.PI / 4 }
                                : f
                            ),
                          })
                        }
                        className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium"
                      >
                        <RotateCw className="w-3 h-3" />
                        <span>+45°</span>
                      </button>
                    </div>
                    <input
                      type="range"
                      min={-Math.PI}
                      max={Math.PI}
                      step={Math.PI / 12}
                      value={selectedFurniture.rotation}
                      onChange={(e) =>
                        updateFloorPlan({
                          ...floorPlan,
                          furniture: floorPlan.furniture.map((f) =>
                            f.id === selectedFurniture.id
                              ? { ...f, rotation: Number(e.target.value) }
                              : f
                          ),
                        })
                      }
                      className="w-full accent-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-300 mb-2">
                      اللون الأساسي
                    </label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {MATERIAL_SWATCHES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() =>
                            updateFloorPlan({
                              ...floorPlan,
                              furniture: floorPlan.furniture.map((f) =>
                                f.id === selectedFurniture.id ? { ...f, primaryColor: c } : f
                              ),
                            })
                          }
                          className={`h-7 rounded-md border ${
                            selectedFurniture.primaryColor === c
                              ? 'border-blue-600 ring-2 ring-blue-500/30'
                              : 'border-slate-300 dark:border-slate-700'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-slate-700 dark:text-slate-200">
                        السعر التقديري (د.ج · اختياري)
                      </label>
                      {selectedFurniture.priceDzd !== undefined && (
                        <button
                          type="button"
                          onClick={() =>
                            updateFloorPlan({
                              ...floorPlan,
                              furniture: floorPlan.furniture.map((f) =>
                                f.id === selectedFurniture.id ? { ...f, priceDzd: undefined } : f
                              ),
                            })
                          }
                          className="text-[11px] text-red-500 hover:underline"
                        >
                          بدون سعر
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      min={0}
                      step={500}
                      value={selectedFurniture.priceDzd ?? ''}
                      placeholder="اتركه فارغاً أو أدخل السعر"
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        const nextPrice =
                          raw === '' ? undefined : Math.max(0, Math.round(Number(raw) || 0));
                        updateFloorPlan({
                          ...floorPlan,
                          furniture: floorPlan.furniture.map((f) =>
                            f.id === selectedFurniture.id ? { ...f, priceDzd: nextPrice } : f
                          ),
                        });
                      }}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 font-mono-nums text-slate-900 dark:text-white"
                    />
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {typeof selectedFurniture.priceDzd === 'number'
                        ? `يُحتسب في فاتورة الحسابات: ${formatDzd(selectedFurniture.priceDzd)}`
                        : 'اختياري — يمكنك فتح فاتورة الحسابات لتسعيره لاحقاً.'}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const copy: FurnitureItem = {
                        ...selectedFurniture,
                        id: `furn_${Date.now()}`,
                        x: selectedFurniture.x + 0.5,
                        z: selectedFurniture.z + 0.5,
                      };
                      updateFloorPlan({
                        ...floorPlan,
                        furniture: [...floorPlan.furniture, copy],
                      });
                      setSelection({ kind: 'furniture', id: copy.id });
                    }}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 py-2 font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>تكرار العنصر</span>
                  </button>
                </div>
              )}

              {/* Delete Action */}
              <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={deleteSelection}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 py-2 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف العنصر المحدد</span>
                </button>
              </div>
            </div>
          )}

          {/* Compact Area Summary Modal-Card when toggled in pure 3D mode (no backdrop-blur over WebGL) */}
          {viewMode === '3d' && show3DAreaDrawer && (
            <div className="absolute top-4 right-4 z-20 w-[min(18rem,calc(100vw-2rem))] max-h-[75dvh] overflow-y-auto studio-scroll rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 p-4 shadow-lg space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                  <Calculator className="w-3.5 h-3.5 text-blue-600" />
                  <span>حاسبة المساحات الحية</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShow3DAreaDrawer(false)}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">الإجمالي</span>
                <span className="text-lg font-bold font-mono-nums text-slate-900 dark:text-white">
                  {(areaReport.totalAreaSqm * areaReport.unitFactorArea).toFixed(1)}{' '}
                  {areaReport.areaUnitLabel}
                </span>
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {areaReport.roomRows.map((room) => (
                  <div key={room.id} className="py-2 flex items-center justify-between text-xs">
                    <span className="text-slate-700 dark:text-slate-200 truncate">{room.name}</span>
                    <span className="font-mono-nums font-semibold text-slate-900 dark:text-white shrink-0">
                      {(room.areaSqm * areaReport.unitFactorArea).toFixed(1)} {areaReport.areaUnitLabel}
                    </span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowCostModal(true)}
                className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 py-2 text-xs font-semibold text-white transition-colors"
              >
                حساب تكلفة المواد والدهن (دج)
              </button>
              <button
                type="button"
                onClick={() => setShowInvoiceModal(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-950/30 py-2 text-xs font-semibold text-amber-800 dark:text-amber-300 transition-colors"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>فاتورة الحسابات PDF</span>
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Mobile & Tablet Bottom Quick Dock (< lg) */}
      <nav
        aria-label="أدوات الهاتف"
        className="lg:hidden shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] px-2 py-1.5 pb-safe flex items-center justify-around gap-1 z-30"
      >
        {viewMode !== '3d' && (
          <button
            type="button"
            onClick={() => setMobileSheet((s) => (s === 'tools' ? null : 'tools'))}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[11px] font-medium min-h-[44px] transition-colors ${
              mobileSheet === 'tools' || activeTool !== 'select'
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>الأدوات</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setMobileSheet((s) => (s === 'catalog' ? null : 'catalog'))}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[11px] font-medium min-h-[44px] transition-colors ${
            mobileSheet === 'catalog'
              ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400'
              : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          <Sofa className="w-4 h-4" />
          <span>الأثاث</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileSheet((s) => (s === 'calculator' ? null : 'calculator'))}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[11px] font-medium min-h-[44px] transition-colors ${
            mobileSheet === 'calculator'
              ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400'
              : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>
            {(areaReport.totalAreaSqm * areaReport.unitFactorArea).toFixed(0)}{' '}
            {areaReport.areaUnitLabel}
          </span>
        </button>

        <button
          type="button"
          disabled={!selection}
          onClick={() => setMobileSheet((s) => (s === 'inspector' ? null : 'inspector'))}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[11px] font-medium min-h-[44px] transition-colors disabled:opacity-40 ${
            mobileSheet === 'inspector'
              ? 'bg-blue-600 text-white'
              : selection
              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>الخصائص</span>
        </button>
      </nav>

      {/* Mobile & Tablet Slide-Up Bottom Sheet */}
      {mobileSheet && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-slate-950/45 flex flex-col justify-end"
          onClick={() => setMobileSheet(null)}
        >
          <div
            className="w-full max-h-[78dvh] bg-white dark:bg-[#181B20] rounded-t-2xl border-t border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {mobileSheet === 'tools' && 'أدوات الرسم الهندسي'}
                {mobileSheet === 'catalog' && `مكتبة الأثاث والأجهزة (${FURNITURE_CATALOG.length})`}
                {mobileSheet === 'calculator' && 'حاسبة المساحات الحية والتكاليف'}
                {mobileSheet === 'inspector' &&
                  (selectedRoom?.name ||
                    selectedFurniture?.name ||
                    (selectedWall ? 'خصائص الجدار' : 'خصائص العنصر'))}
              </span>
              <button
                type="button"
                onClick={() => setMobileSheet(null)}
                aria-label="إغلاق اللوحة"
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto studio-scroll p-4 space-y-4">
              {mobileSheet === 'tools' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-5 gap-1.5">
                    {(
                      [
                        { id: 'select', label: 'تحديد', Icon: MousePointer },
                        { id: 'room', label: 'غرفة', Icon: PlusSquare },
                        { id: 'wall', label: 'جدار', Icon: PenTool },
                        { id: 'door', label: 'باب', Icon: DoorOpen },
                        { id: 'window', label: 'نافذة', Icon: Square },
                      ] as const
                    ).map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setActiveTool(id);
                          setMobileSheet(null);
                        }}
                        className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl text-xs font-medium min-h-[56px] transition-colors ${
                          activeTool === id
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setSnapEnabled((s) => !s)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border ${
                        snapEnabled
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Magnet className="w-4 h-4" />
                      <span>{snapEnabled ? 'المحاذاة مفعّلة' : 'المحاذاة معطّلة'}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleUndo}
                        disabled={historyIdx <= 0}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium disabled:opacity-40"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        <span>تراجع</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleRedo}
                        disabled={historyIdx >= history.length - 1}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium disabled:opacity-40"
                      >
                        <Redo2 className="w-3.5 h-3.5" />
                        <span>إعادة</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {mobileSheet === 'catalog' && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={catalogQuery}
                      onChange={(e) => {
                        setCatalogQuery(e.target.value);
                        setCatalogVisibleLimit(36);
                      }}
                      placeholder={`ابحث في ${FURNITURE_CATALOG.length} تصميماً...`}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pr-9 pl-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    {FURNITURE_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setCatalogCategory(cat.id);
                          setCatalogVisibleLimit(36);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 ${
                          catalogCategory === cat.id
                            ? 'bg-slate-900 dark:bg-blue-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {visibleSidebarCatalog.map((def) => (
                      <button
                        key={def.catalogId}
                        type="button"
                        onClick={() => {
                          addCatalogItemToCenter(def);
                          setMobileSheet(null);
                        }}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-3 text-right active:border-blue-600"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-7 h-7 rounded-md shrink-0 border border-black/10"
                            style={{ backgroundColor: def.defaultPrimary }}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                              {def.name}
                            </div>
                            <div className="text-[11px] font-mono-nums text-slate-500 dark:text-slate-400">
                              {def.width.toFixed(2)}×{def.depth.toFixed(2)} m
                              {typeof def.defaultPriceDzd === 'number'
                                ? ` · ${formatDzd(def.defaultPriceDzd)}`
                                : ''}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                          + إضافة
                        </span>
                      </button>
                    ))}
                  </div>
                  {visibleSidebarCatalog.length < filteredCatalog.length && (
                    <button
                      type="button"
                      onClick={() => setCatalogVisibleLimit((n) => n + 48)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-xs font-semibold"
                    >
                      عرض المزيد ({filteredCatalog.length - visibleSidebarCatalog.length} متبقي)
                    </button>
                  )}
                </div>
              )}

              {mobileSheet === 'calculator' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3.5 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-500">إجمالي المساحة ({metrics.roomCount} غرف)</div>
                      <div className="text-2xl font-bold font-mono-nums text-slate-900 dark:text-white">
                        {(areaReport.totalAreaSqm * areaReport.unitFactorArea).toFixed(1)}{' '}
                        {areaReport.areaUnitLabel}
                      </div>
                    </div>
                    <div className="text-left text-xs font-mono-nums text-slate-500">
                      <div>الجدران: {(areaReport.grossWallLengthM * areaReport.unitFactorLen).toFixed(1)} {areaReport.lenUnitLabel}</div>
                      <div>الطلاء: {(areaReport.netWallAreaSqm * areaReport.unitFactorArea).toFixed(1)} {areaReport.areaUnitLabel}</div>
                    </div>
                  </div>

                  {areaReport.roomRows.length > 0 && (
                    <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                      {areaReport.roomRows.map((room) => (
                        <button
                          key={room.id}
                          type="button"
                          onClick={() => {
                            setSelection({ kind: 'room', id: room.id });
                            setMobileSheet('inspector');
                          }}
                          className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          <span className="font-semibold text-slate-900 dark:text-white">{room.name}</span>
                          <span className="font-mono-nums text-blue-700 dark:text-blue-400 font-bold">
                            {(room.areaSqm * areaReport.unitFactorArea).toFixed(1)} {areaReport.areaUnitLabel}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMobileSheet(null);
                        setShowCostModal(true);
                      }}
                      className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 py-2.5 text-xs font-semibold text-white"
                    >
                      حاسبة أسعار البناء والدهن (دج)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileSheet(null);
                        setShowInvoiceModal(true);
                      }}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-950/30 py-2.5 text-xs font-semibold text-amber-800 dark:text-amber-300"
                    >
                      <Receipt className="w-4 h-4" />
                      <span>فاتورة الحسابات PDF</span>
                    </button>
                  </div>
                </div>
              )}

              {mobileSheet === 'inspector' && selection && (
                <div className="space-y-4 text-xs">
                  {selectedRoom && (
                    <div className="space-y-3">
                      <div>
                        <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">اسم الغرفة</label>
                        <input
                          type="text"
                          value={selectedRoom.name}
                          onChange={(e) =>
                            updateFloorPlan({
                              ...floorPlan,
                              rooms: floorPlan.rooms.map((r) =>
                                r.id === selectedRoom.id ? { ...r, name: e.target.value } : r
                              ),
                            })
                          }
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">العرض (m)</label>
                          <input
                            type="number"
                            step={0.25}
                            min={1}
                            max={30}
                            value={selectedRoom.width}
                            onChange={(e) =>
                              updateFloorPlan({
                                ...floorPlan,
                                rooms: floorPlan.rooms.map((r) =>
                                  r.id === selectedRoom.id ? { ...r, width: Math.max(1, Number(e.target.value) || 1) } : r
                                ),
                              })
                            }
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 font-mono-nums"
                          />
                        </div>
                        <div>
                          <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">الطول (m)</label>
                          <input
                            type="number"
                            step={0.25}
                            min={1}
                            max={30}
                            value={selectedRoom.depth}
                            onChange={(e) =>
                              updateFloorPlan({
                                ...floorPlan,
                                rooms: floorPlan.rooms.map((r) =>
                                  r.id === selectedRoom.id ? { ...r, depth: Math.max(1, Number(e.target.value) || 1) } : r
                                ),
                              })
                            }
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 font-mono-nums"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {FLOOR_STYLES.map((fs) => (
                          <button
                            key={fs.id}
                            type="button"
                            onClick={() =>
                              updateFloorPlan({
                                ...floorPlan,
                                rooms: floorPlan.rooms.map((r) =>
                                  r.id === selectedRoom.id ? { ...r, floorStyle: fs.id as RoomFloorStyle } : r
                                ),
                              })
                            }
                            className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-right ${
                              selectedRoom.floorStyle === fs.id
                                ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                                : 'border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            <span className="w-4 h-4 rounded shrink-0" style={{ backgroundColor: fs.previewColor }} />
                            <span className="truncate">{fs.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedWall && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-medium mb-1">الارتفاع (m)</label>
                          <input
                            type="number"
                            step={0.1}
                            min={2}
                            max={5}
                            value={selectedWall.height}
                            onChange={(e) =>
                              updateFloorPlan({
                                ...floorPlan,
                                walls: floorPlan.walls.map((w) =>
                                  w.id === selectedWall.id ? { ...w, height: Math.max(2, Number(e.target.value) || 2.8) } : w
                                ),
                              })
                            }
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 font-mono-nums"
                          />
                        </div>
                        <div>
                          <label className="block font-medium mb-1">السماكة (m)</label>
                          <input
                            type="number"
                            step={0.02}
                            min={0.08}
                            max={0.5}
                            value={selectedWall.thickness}
                            onChange={(e) =>
                              updateFloorPlan({
                                ...floorPlan,
                                walls: floorPlan.walls.map((w) =>
                                  w.id === selectedWall.id ? { ...w, thickness: Math.max(0.08, Number(e.target.value) || 0.16) } : w
                                ),
                              })
                            }
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 font-mono-nums"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {WALL_COLOR_SWATCHES.map((sw) => (
                          <button
                            key={sw.color}
                            type="button"
                            onClick={() =>
                              updateFloorPlan({
                                ...floorPlan,
                                walls: floorPlan.walls.map((w) =>
                                  w.id === selectedWall.id ? { ...w, color: sw.color } : w
                                ),
                              })
                            }
                            className={`h-9 rounded-lg border ${
                              selectedWall.color === sw.color ? 'border-blue-600 ring-2 ring-blue-500/30' : 'border-slate-300 dark:border-slate-700'
                            }`}
                            style={{ backgroundColor: sw.color }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedOpening && (
                    <div className="space-y-3">
                      <div>
                        <label className="block font-medium mb-1">العرض ({selectedOpening.width.toFixed(2)} m)</label>
                        <input
                          type="range"
                          min={0.6}
                          max={3.5}
                          step={0.05}
                          value={selectedOpening.width}
                          onChange={(e) =>
                            updateFloorPlan({
                              ...floorPlan,
                              openings: floorPlan.openings.map((o) =>
                                o.id === selectedOpening.id ? { ...o, width: Number(e.target.value) } : o
                              ),
                            })
                          }
                          className="w-full accent-blue-600"
                        />
                      </div>
                      {selectedOpening.type === 'door' && (
                        <button
                          type="button"
                          onClick={() =>
                            updateFloorPlan({
                              ...floorPlan,
                              openings: floorPlan.openings.map((o) =>
                                o.id === selectedOpening.id ? { ...o, swing: o.swing === 'out' ? 'in' : 'out' } : o
                              ),
                            })
                          }
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 py-2.5 font-medium"
                        >
                          عكس اتجاه فتح الباب
                        </button>
                      )}
                    </div>
                  )}

                  {selectedFurniture && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block font-medium mb-1">عرض</label>
                          <input
                            type="number"
                            step={0.05}
                            min={0.25}
                            max={6}
                            value={selectedFurniture.width}
                            onChange={(e) =>
                              updateFloorPlan({
                                ...floorPlan,
                                furniture: floorPlan.furniture.map((f) =>
                                  f.id === selectedFurniture.id ? { ...f, width: Math.max(0.25, Number(e.target.value) || 0.5) } : f
                                ),
                              })
                            }
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1.5 font-mono-nums"
                          />
                        </div>
                        <div>
                          <label className="block font-medium mb-1">عمق</label>
                          <input
                            type="number"
                            step={0.05}
                            min={0.25}
                            max={6}
                            value={selectedFurniture.depth}
                            onChange={(e) =>
                              updateFloorPlan({
                                ...floorPlan,
                                furniture: floorPlan.furniture.map((f) =>
                                  f.id === selectedFurniture.id ? { ...f, depth: Math.max(0.25, Number(e.target.value) || 0.5) } : f
                                ),
                              })
                            }
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1.5 font-mono-nums"
                          />
                        </div>
                        <div>
                          <label className="block font-medium mb-1">ارتفاع</label>
                          <input
                            type="number"
                            step={0.05}
                            min={0.03}
                            max={3.5}
                            value={selectedFurniture.height}
                            onChange={(e) =>
                              updateFloorPlan({
                                ...floorPlan,
                                furniture: floorPlan.furniture.map((f) =>
                                  f.id === selectedFurniture.id ? { ...f, height: Math.max(0.03, Number(e.target.value) || 0.5) } : f
                                ),
                              })
                            }
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1.5 font-mono-nums"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateFloorPlan({
                              ...floorPlan,
                              furniture: floorPlan.furniture.map((f) =>
                                f.id === selectedFurniture.id ? { ...f, rotation: f.rotation + Math.PI / 4 } : f
                              ),
                            })
                          }
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 py-2 font-medium"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          <span>تدوير +45°</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const copy: FurnitureItem = {
                              ...selectedFurniture,
                              id: `furn_${Date.now()}`,
                              x: selectedFurniture.x + 0.5,
                              z: selectedFurniture.z + 0.5,
                            };
                            updateFloorPlan({
                              ...floorPlan,
                              furniture: [...floorPlan.furniture, copy],
                            });
                            setSelection({ kind: 'furniture', id: copy.id });
                          }}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 py-2 font-medium"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>تكرار</span>
                        </button>
                      </div>
                      <div>
                        <label className="block font-medium mb-1">السعر التقديري (د.ج · اختياري)</label>
                        <input
                          type="number"
                          min={0}
                          step={500}
                          value={selectedFurniture.priceDzd ?? ''}
                          placeholder="اختياري"
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            const nextPrice = raw === '' ? undefined : Math.max(0, Math.round(Number(raw) || 0));
                            updateFloorPlan({
                              ...floorPlan,
                              furniture: floorPlan.furniture.map((f) =>
                                f.id === selectedFurniture.id ? { ...f, priceDzd: nextPrice } : f
                              ),
                            });
                          }}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 font-mono-nums"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      deleteSelection();
                      setMobileSheet(null);
                    }}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 py-2.5 text-xs font-semibold text-red-700 dark:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>حذف العنصر المحدد</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Linked Algerian Market Construction & Paint Cost Calculator Modal */}
      {showCostModal && (
        <div
          className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-2.5 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="حاسبة أسعار مواد البناء والدهن في السوق الجزائري"
        >
          <div className="w-full max-w-5xl max-h-[92dvh] overflow-y-auto studio-scroll rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#F7F6F2] dark:bg-[#111315] p-4 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                تقدير تكلفة مشروع «{title}» حسب السوق الجزائري
              </span>
              <button
                type="button"
                onClick={() => setShowCostModal(false)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <X className="w-3.5 h-3.5" />
                <span>إغلاق</span>
              </button>
            </div>
            <AlgeriaCostCalculator
              compactModal
              linkedPlan={{
                title,
                floorAreaSqm: Math.max(15, areaReport.totalAreaSqm),
                wallLengthM: Math.max(10, areaReport.grossWallLengthM),
                wallHeightM: floorPlan.wallHeight || 2.8,
              }}
            />
          </div>
        </div>
      )}

      {/* Project Invoice Modal (Furniture optional prices + Algerian Construction BOQ + Custom items) */}
      {showInvoiceModal && (
        <InvoiceModal
          brandName={brandName}
          projectTitle={title}
          floorPlan={floorPlan}
          initialAreaSqm={Math.max(15, areaReport.totalAreaSqm)}
          initialWallLengthM={Math.max(10, areaReport.grossWallLengthM)}
          initialWallHeightM={floorPlan.wallHeight || 2.8}
          onUpdateFurniturePrice={(furnitureId, nextPriceDzd) => {
            updateFloorPlan(
              {
                ...floorPlan,
                furniture: floorPlan.furniture.map((f) =>
                  f.id === furnitureId ? { ...f, priceDzd: nextPriceDzd } : f
                ),
              },
              false
            );
          }}
          onClose={() => setShowInvoiceModal(false)}
        />
      )}

      {/* Pro Sketch-to-Design Modal inside Workspace */}
      <SketchToPlanModal
        isOpen={showSketchModal}
        brandName={brandName}
        isUserProActive={isUserProActive}
        currentPlan={floorPlan}
        onClose={() => setShowSketchModal(false)}
        onOpenProUpgrade={() => {
          setShowSketchModal(false);
          onOpenProUpgrade?.();
        }}
        onApplySketchPlan={({ title: nextTitle, floorPlan: nextPlan, underlay }) => {
          if (nextTitle && title === 'منزل جديد') {
            setTitle(nextTitle);
          }
          if (nextPlan.rooms.length > 0 || nextPlan.walls.length > 0) {
            updateFloorPlan(nextPlan, true);
          }
          if (underlay) {
            setSketchUnderlay(underlay);
          }
          setSelection(null);
        }}
      />
    </div>
  );
};
