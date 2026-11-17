import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Box,
  Building2,
  Calculator,
  Camera,
  Check,
  ChevronDown,
  Columns2,
  Compass,
  Copy,
  Crown,
  DoorOpen,
  Download,
  Eye,
  EyeOff,
  FileText,
  Grid3X3,
  ImagePlus,
  Images,
  Layers,
  Lock,
  Magnet,
  Menu,
  Moon,
  MousePointer,
  Move,
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
  Wallet,
  Wrench,
  X,
} from 'lucide-react';
import { formatDzd, formatMillionCentimes } from '../data/algeriaMarketPrices';
import { BRAND_LOGO_URL } from '../utils/assets';
import { getFreePromoDaysRemaining, isFreePromoMonthActive } from '../utils/authStore';
import {
  DRAWING_SPACE_PRESETS,
  FLOOR_STYLES,
  FURNITURE_CATALOG,
  FURNITURE_CATEGORIES,
  MATERIAL_SWATCHES,
  StyleOrigin,
  WALL_COLOR_SWATCHES,
  computeFloorPlanMetrics,
  computeFurnitureTotalCostDzd,
} from '../data/catalog';
import {
  analyzeRoomWalls,
  deleteRoomWithWalls,
  duplicateRoomCascade,
  getWallLength,
  groupOrEnsureRoomWalls,
  moveRoomCascade,
  resizeRoomWithWalls,
  setWallLengthPreservingAngle,
  updateRoomGroupedWalls,
} from '../utils/roomWallUtils';
import {
  computePlanStructureMetrics,
  generateAutoColumnsAndBeams,
} from '../utils/structureUtils';
import {
  DrawingSpacePreset,
  EditorTool,
  FloorPlanData,
  FurnitureCategory,
  FurnitureItem,
  ProjectShowcaseImage,
  Room,
  RoomFloorStyle,
  SelectionTarget,
  SketchUnderlayConfig,
  StructuralColumn,
  UnitType,
  ViewMode,
  Wall,
} from '../types/planner';
import { AlgeriaCostCalculator } from './AlgeriaCostCalculator';
import { CameraArPreviewModal } from './CameraArPreviewModal';
import { Canvas2D } from './Canvas2D';
import {
  GuidedTourOverlay,
  GuidedTourStep,
  isGuidedTourCompleted,
  markGuidedTourCompleted,
} from './GuidedTourOverlay';
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
  isAiArProActive?: boolean;
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
  isAiArProActive = false,
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
  const [activeSpacePreset, setActiveSpacePreset] = useState<DrawingSpacePreset>(
    DRAWING_SPACE_PRESETS[0]
  );
  const [spaceMenuOpen, setSpaceMenuOpen] = useState(false);
  const [selection, setSelection] = useState<SelectionTarget>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [autoMeasureEnabled, setAutoMeasureEnabled] = useState(true);
  const [showFurnitureCostWidget, setShowFurnitureCostWidget] = useState(true);
  const [roomGroupFeedback, setRoomGroupFeedback] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'catalog' | 'calculator'>('catalog');
  const [mobileSheet, setMobileSheet] = useState<
    null | 'tools' | 'catalog' | 'calculator' | 'inspector'
  >(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [show3DAreaDrawer, setShow3DAreaDrawer] = useState(false);
  const [showCostModal, setShowCostModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [focusShowcaseInInvoice, setFocusShowcaseInInvoice] = useState(false);
  const [showcaseImages, setShowcaseImages] = useState<ProjectShowcaseImage[]>([]);
  const [showSketchModal, setShowSketchModal] = useState(false);
  const [showCameraArModal, setShowCameraArModal] = useState(false);
  const [sketchUnderlay, setSketchUnderlay] = useState<SketchUnderlayConfig | null>(
    initialUnderlay
  );
  const [catalogCategory, setCatalogCategory] = useState<FurnitureCategory | 'all'>('all');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [finishOriginFilter, setFinishOriginFilter] = useState<'all' | StyleOrigin>('all');
  const [useCatalogPrices, setUseCatalogPrices] = useState(true);
  const [catalogVisibleLimit, setCatalogVisibleLimit] = useState(36);
  const importFileRef = React.useRef<HTMLInputElement | null>(null);
  const capture2DRef = React.useRef<(() => string | null) | null>(null);
  const capture3DRef = React.useRef<(() => string | null) | null>(null);

  const [saving, setSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [showGuidedTour, setShowGuidedTour] = useState<boolean>(() => !isGuidedTourCompleted());
  const [tourStepIdx, setTourStepIdx] = useState(0);

  // Close mobile inspector sheet automatically if selection is cleared
  useEffect(() => {
    if (!selection && mobileSheet === 'inspector') {
      setMobileSheet(null);
    }
  }, [selection, mobileSheet]);

  const metrics = useMemo(() => computeFloorPlanMetrics(floorPlan), [floorPlan]);
  const structureMetrics = useMemo(() => computePlanStructureMetrics(floorPlan), [floorPlan]);
  const furnitureCostSummary = useMemo(
    () => computeFurnitureTotalCostDzd(floorPlan.furniture),
    [floorPlan.furniture]
  );

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

  const insertPresetRoom = useCallback(
    (preset: DrawingSpacePreset) => {
      let x = -preset.defaultWidth / 2;
      let z = -preset.defaultDepth / 2;

      if (floorPlan.rooms.length > 0) {
        let maxX = -Infinity;
        let minZ = Infinity;
        for (const r of floorPlan.rooms) {
          maxX = Math.max(maxX, r.x + r.width);
          minZ = Math.min(minZ, r.z);
        }
        x = Number((maxX + 0.25).toFixed(2));
        z = Number(minZ.toFixed(2));
      } else if (floorPlan.walls.length > 0) {
        let maxX = -Infinity;
        let minZ = Infinity;
        for (const w of floorPlan.walls) {
          maxX = Math.max(maxX, w.x1, w.x2);
          minZ = Math.min(minZ, w.z1, w.z2);
        }
        x = Number((maxX + 0.25).toFixed(2));
        z = Number(minZ.toFixed(2));
      }

      const sameCount = floorPlan.rooms.filter(
        (r) => r.name === preset.roomName || r.name.startsWith(`${preset.roomName} `)
      ).length;
      const roomName = sameCount === 0 ? preset.roomName : `${preset.roomName} ${sameCount + 1}`;
      const ts = Date.now();
      const roomId = `room_${ts}`;
      const h = floorPlan.wallHeight;
      const w = preset.defaultWidth;
      const d = preset.defaultDepth;

      const newRoom: Room = {
        id: roomId,
        name: roomName,
        x,
        z,
        width: w,
        depth: d,
        floorStyle: preset.floorStyle,
      };
      const newWalls: Wall[] = [
        { id: `w_${ts}_1`, x1: x, z1: z, x2: x + w, z2: z, thickness: 0.16, height: h, color: '#F5F2EB' },
        { id: `w_${ts}_2`, x1: x + w, z1: z, x2: x + w, z2: z + d, thickness: 0.16, height: h, color: '#F5F2EB' },
        { id: `w_${ts}_3`, x1: x + w, z1: z + d, x2: x, z2: z + d, thickness: 0.16, height: h, color: '#F5F2EB' },
        { id: `w_${ts}_4`, x1: x, z1: z + d, x2: x, z2: z, thickness: 0.16, height: h, color: '#F5F2EB' },
      ];

      updateFloorPlan(
        {
          ...floorPlan,
          rooms: [...floorPlan.rooms, newRoom],
          walls: [...floorPlan.walls, ...newWalls],
        },
        true
      );
      setActiveSpacePreset(preset);
      setSelection({ kind: 'room', id: roomId });
      setActiveTool('select');
      setSpaceMenuOpen(false);
    },
    [floorPlan, updateFloorPlan]
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
      updateFloorPlan(deleteRoomWithWalls(floorPlan, selection.id, true), true);
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
    } else if (selection.kind === 'column') {
      updateFloorPlan({
        ...floorPlan,
        columns: (floorPlan.columns || []).filter((c) => c.id !== selection.id),
      });
    } else if (selection.kind === 'beam') {
      updateFloorPlan({
        ...floorPlan,
        beams: (floorPlan.beams || []).filter((b) => b.id !== selection.id),
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
  const selectedColumn =
    selection?.kind === 'column'
      ? (floorPlan.columns || []).find((c) => c.id === selection.id)
      : undefined;
  const selectedBeam =
    selection?.kind === 'beam'
      ? (floorPlan.beams || []).find((b) => b.id === selection.id)
      : undefined;
  const selectedRoomWallsInfo = useMemo(
    () => (selectedRoom ? analyzeRoomWalls(floorPlan, selectedRoom.id) : null),
    [floorPlan, selectedRoom]
  );
  const selectedRoomMatchedWalls = useMemo(() => {
    if (!selectedRoomWallsInfo) return [];
    return floorPlan.walls.filter((w) => selectedRoomWallsInfo.matched.allMatchedIds.has(w.id));
  }, [floorPlan.walls, selectedRoomWallsInfo]);

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
            data-tour-id="tour-cost-header"
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
        <div
          data-tour-id="tour-viewport-modes"
          className="flex items-center gap-0.5 sm:gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 sm:p-1 rounded-lg shrink-0"
        >
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

          <button
            type="button"
            onClick={() => {
              setTourStepIdx(0);
              setShowGuidedTour(true);
            }}
            className="hidden lg:inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            title="بدء الجولة الإرشادية للتعرف على أدوات التصميم وحاسبة اليد العاملة والبيليات"
          >
            <Compass className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>جولة إرشادية</span>
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
            {isAiArProActive ? <ImagePlus className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            <span>من ورقة (برو)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCameraArModal(true)}
            className="hidden lg:inline-flex items-center gap-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/30 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors whitespace-nowrap shrink-0"
            title="معاينة المخطط 2D في الفضاء الحقيقي بالكاميرا (برو)"
          >
            {isAiArProActive ? <Camera className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            <span>كاميرا 2D (برو)</span>
          </button>

          <div
            data-tour-id="tour-client-invoice"
            className="hidden lg:flex items-center gap-1.5 shrink-0"
          >
            <button
              type="button"
              onClick={() => {
                setFocusShowcaseInInvoice(true);
                setShowInvoiceModal(true);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/30 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors whitespace-nowrap shrink-0"
              title="التقاط واختيار صور المشروع للعرض على الزبون بفاتورة تقديرية"
            >
              <Images className="w-3.5 h-3.5" />
              <span>صور للزبون</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFocusShowcaseInInvoice(false);
                setShowInvoiceModal(true);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-300 dark:border-amber-700/70 bg-amber-50/80 dark:bg-amber-950/30 px-2.5 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors whitespace-nowrap shrink-0"
              title="عرض وتصدير الفاتورة التقديرية وصور المشروع"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>فاتورة تقديرية</span>
            </button>
          </div>

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
                setTourStepIdx(0);
                setShowGuidedTour(true);
              }}
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 text-right"
            >
              <Compass className="w-4 h-4 text-blue-600" />
              <span>بدء الجولة الإرشادية لمساحة العمل</span>
            </button>

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
              {isAiArProActive ? <ImagePlus className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              <span>تصميم من ورقة مرسومة (برو)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setShowCameraArModal(true);
              }}
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 font-semibold text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-right"
            >
              {isAiArProActive ? <Camera className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              <span>معاينة المخطط بالكاميرا (برو)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setFocusShowcaseInInvoice(true);
                setShowInvoiceModal(true);
              }}
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-right"
            >
              <Images className="w-4 h-4" />
              <span>تصدير صور المشروع للزبون</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setFocusShowcaseInInvoice(false);
                setShowInvoiceModal(true);
              }}
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-right"
            >
              <Receipt className="w-4 h-4" />
              <span>فاتورة تقديرية وصور المشروع PDF</span>
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

      {isFreePromoMonthActive() ? (
        <div className="px-3 sm:px-4 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 border-b border-emerald-200 dark:border-emerald-900 flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs shrink-0">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 text-emerald-900 dark:text-emerald-200 font-medium">
            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              الشهر المجاني المفتوح: 200 تصميم جزائري وأدوات الرسم ومشاريع غير محدودة متاحة مجاناً حتى 16 ديسمبر 2026 (يستثنى التصميم من ورقة، الواقع المعزز، والذكاء الاصطناعي الحصرية لنسخة برو).
            </span>
          </div>
        </div>
      ) : (
        isGuestSession && (
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
        )
      )}

      {/* Main Workspace Area */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Desktop Catalog & Drafting Sidebar (Hidden on < lg; mobile uses bottom sheet dock) */}
        {viewMode !== '3d' && (
          <aside className="hidden lg:flex w-72 shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] flex-col min-h-0 z-20">
            {/* Drafting Tools Section */}
            <div
              data-tour-id="tour-drafting-tools"
              className="p-2.5 border-b border-slate-200 dark:border-slate-800 space-y-2"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                  أدوات الرسم
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setAutoMeasureEnabled((v) => !v)}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                      autoMeasureEnabled
                        ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                        : 'text-slate-500 dark:text-slate-400 border border-transparent'
                    }`}
                    title="إظهار أو إخفاء القياس التلقائي للأبعاد على الجدران المختارة وأثناء الرسم"
                  >
                    <Ruler className="w-3 h-3" />
                    <span>القياس التلقائي</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSnapEnabled((s) => !s)}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                      snapEnabled
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                        : 'text-slate-500 dark:text-slate-400 border border-transparent'
                    }`}
                    title="تفعيل أو إيقاف المحاذاة التلقائية للشبكة"
                  >
                    <Magnet className="w-3 h-3" />
                    <span>محاذاة</span>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-6 gap-1">
                {(
                  [
                    { id: 'select', label: 'تحديد', Icon: MousePointer },
                    { id: 'room', label: 'غرفة', Icon: PlusSquare },
                    { id: 'wall', label: 'جدار', Icon: PenTool },
                    { id: 'door', label: 'باب', Icon: DoorOpen },
                    { id: 'window', label: 'نافذة', Icon: Square },
                    { id: 'arch', label: 'قوس', Icon: Columns2 },
                  ] as const
                ).map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setActiveTool(id);
                      if (id !== 'room') {
                        setSpaceMenuOpen(false);
                      }
                    }}
                    className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                      activeTool === id
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Optional Structural Columns & Beams (البيليات والسوانتر) */}
              <div
                data-tour-id="tour-structure-tools"
                className="pt-1.5 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                    <Building2 className="w-3 h-3 text-slate-500" />
                    <span>الأعمدة والسوانتر (اختياري)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateFloorPlan({
                        ...floorPlan,
                        showStructureLayer: floorPlan.showStructureLayer === false ? true : false,
                      })
                    }
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                      floorPlan.showStructureLayer !== false
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                    title="إظهار أو إخفاء طبقة الأعمدة والسوانتر"
                  >
                    {floorPlan.showStructureLayer !== false ? (
                      <Eye className="w-3 h-3" />
                    ) : (
                      <EyeOff className="w-3 h-3" />
                    )}
                    <span>{floorPlan.showStructureLayer !== false ? 'مرئي' : 'مخفي'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTool('column');
                      setSpaceMenuOpen(false);
                    }}
                    className={`py-1 px-1.5 rounded-lg text-[10px] font-semibold transition-colors ${
                      activeTool === 'column'
                        ? 'bg-slate-800 dark:bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    + بيلي (عمود)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTool('beam');
                      setSpaceMenuOpen(false);
                    }}
                    className={`py-1 px-1.5 rounded-lg text-[10px] font-semibold transition-colors ${
                      activeTool === 'beam'
                        ? 'bg-slate-800 dark:bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    + سانتر
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const generated = generateAutoColumnsAndBeams(floorPlan);
                      updateFloorPlan(
                        {
                          ...floorPlan,
                          columns: generated.columns,
                          beams: generated.beams,
                          showStructureLayer: true,
                        },
                        true
                      );
                    }}
                    className="py-1 px-1.5 rounded-lg border border-blue-200 dark:border-blue-800/80 bg-blue-50/70 dark:bg-blue-950/40 hover:bg-blue-100 text-[10px] font-semibold text-blue-700 dark:text-blue-300 transition-colors"
                    title="توزيع تلقائي لأعمدة البيلي والسوانتر على زوايا الغرف والجدران"
                  >
                    توزيع تلقائي
                  </button>
                </div>
                {(structureMetrics.columnsCount > 0 || structureMetrics.beamsCount > 0) && (
                  <div className="text-[10px] font-mono-nums text-slate-500 dark:text-slate-400 flex items-center justify-between px-0.5">
                    <span>{structureMetrics.columnsCount} بيلي</span>
                    <span>
                      {structureMetrics.beamsCount} سانتر ({structureMetrics.totalBeamsLengthM.toFixed(1)} م)
                    </span>
                  </div>
                )}
              </div>

              {/* Space Type Dropdown (Auto-expands when room tool is active; auto-hides when inactive) */}
              <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSpaceMenuOpen((v) => !v)}
                    className="flex items-center justify-between gap-1.5 flex-1 min-w-0 px-2 py-1 rounded-md text-[11px] font-medium bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
                    title="إظهار أو إخفاء خيارات نوع الفضاء"
                  >
                    <span className="truncate">
                      نوع الفضاء: <strong className="text-blue-700 dark:text-blue-300">{activeSpacePreset.label.split(' ')[0]}</strong>
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform ${
                        activeTool === 'room' || spaceMenuOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertPresetRoom(activeSpacePreset)}
                    className="px-2 py-1 rounded-md border border-blue-200 dark:border-blue-800/80 bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-[10px] font-semibold text-blue-700 dark:text-blue-300 whitespace-nowrap shrink-0 transition-colors"
                    title={`إدراج ${activeSpacePreset.label} مباشرة على المخطط`}
                  >
                    + إدراج
                  </button>
                </div>

                {(activeTool === 'room' || spaceMenuOpen) && (
                  <div className="mt-1.5 space-y-1.5">
                    <select
                      value={activeSpacePreset.id}
                      onChange={(e) => {
                        const chosen = DRAWING_SPACE_PRESETS.find((p) => p.id === e.target.value);
                        if (chosen) {
                          setActiveSpacePreset(chosen);
                          setActiveTool('room');
                        }
                      }}
                      aria-label="نوع الفضاء (رسم أو إدراج)"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                    >
                      {DRAWING_SPACE_PRESETS.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.label} ({preset.defaultWidth}×{preset.defaultDepth} م)
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => insertPresetRoom(activeSpacePreset)}
                      className="w-full py-1.5 px-2 rounded-lg border border-blue-200 dark:border-blue-800/80 bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-[11px] font-semibold text-blue-700 dark:text-blue-300 transition-colors"
                    >
                      + إدراج {activeSpacePreset.label} تلقائياً
                    </button>
                  </div>
                )}
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
                {/* Furniture Catalog Search & Category Dropdown */}
                <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1 min-w-0">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={catalogQuery}
                        onChange={(e) => {
                          setCatalogQuery(e.target.value);
                          setCatalogVisibleLimit(36);
                        }}
                        placeholder={`بحث (${FURNITURE_CATALOG.length})...`}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pr-7 pl-2 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <select
                      value={catalogCategory}
                      onChange={(e) => {
                        setCatalogCategory(e.target.value as FurnitureCategory | 'all');
                        setCatalogVisibleLimit(36);
                      }}
                      aria-label="تصنيف الأثاث والأجهزة"
                      className="w-28 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-1.5 py-1.5 text-[11px] font-medium text-slate-800 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                    >
                      {FURNITURE_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer">
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

                {/* Estimated Furniture Cost Card */}
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/70 dark:bg-emerald-950/30 p-3 space-y-1">
                  <div className="flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-200 font-semibold">
                    <span className="inline-flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>تكلفة الأثاث التقديرية</span>
                    </span>
                    <span className="font-mono-nums">{furnitureCostSummary.totalCount} قطعة</span>
                  </div>
                  <div className="text-lg font-bold font-mono-nums text-emerald-950 dark:text-emerald-100">
                    {formatDzd(furnitureCostSummary.totalDzd)}
                  </div>
                  <div className="text-[11px] font-mono-nums text-emerald-800/85 dark:text-emerald-300/85">
                    {formatMillionCentimes(furnitureCostSummary.totalDzd)}
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
                    data-tour-id="tour-sidebar-cost-cta"
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
                roomPreset={activeSpacePreset}
                selection={selection}
                snapEnabled={snapEnabled}
                autoMeasureEnabled={autoMeasureEnabled}
                isDarkTheme={isDarkTheme}
                sketchUnderlay={sketchUnderlay}
                onSelect={setSelection}
                onChangeFloorPlan={updateFloorPlan}
                onToolResetToSelect={() => {
                  setActiveTool('select');
                  setSpaceMenuOpen(false);
                }}
                onCaptureReady={(fn) => {
                  capture2DRef.current = fn;
                }}
              />

              {/* Compact Floating Furniture Cost Dashboard */}
              <div className="absolute top-3 left-3 z-20 max-w-[230px]">
                {showFurnitureCostWidget ? (
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-white/95 dark:bg-slate-900/95 shadow-md p-2.5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 font-bold text-slate-800 dark:text-slate-100 text-[11px]">
                        <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>تكلفة الأثاث التقديرية</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowFurnitureCostWidget(false)}
                        aria-label="طي لوحة التكلفة"
                        className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="font-mono-nums font-bold text-sm text-emerald-700 dark:text-emerald-300">
                      {formatDzd(furnitureCostSummary.totalDzd)}
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[10px] font-mono-nums text-slate-500 dark:text-slate-400">
                      <span>{formatMillionCentimes(furnitureCostSummary.totalDzd)}</span>
                      <span>{furnitureCostSummary.totalCount} قطعة</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowInvoiceModal(true)}
                      className="w-full inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white py-1 px-2 text-[10px] font-semibold transition-colors"
                    >
                      <Receipt className="w-3 h-3" />
                      <span>عرض الفاتورة التفصيلية</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowFurnitureCostWidget(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white/95 dark:bg-slate-900/95 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 shadow-sm hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                    title="إظهار لوحة التكلفة التقديرية للأثاث"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span className="font-mono-nums">{formatDzd(furnitureCostSummary.totalDzd)}</span>
                  </button>
                )}
              </div>

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
                onCaptureReady={(fn) => {
                  capture3DRef.current = fn;
                }}
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
                      (selectedOpening.type === 'door'
                        ? 'خصائص الباب'
                        : selectedOpening.type === 'arch'
                          ? 'خصائص القوس المعماري'
                          : 'خصائص النافذة')}
                    {selectedFurniture && selectedFurniture.name}
                    {selectedColumn && `خصائص العمود (${selectedColumn.label || 'بيلي'})`}
                    {selectedBeam && `خصائص السانتر (${selectedBeam.label || 'حزام'})`}
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
                        min={1.5}
                        max={30}
                        value={selectedRoom.width}
                        onChange={(e) =>
                          updateFloorPlan(
                            resizeRoomWithWalls(
                              floorPlan,
                              selectedRoom.id,
                              Math.max(1.5, Number(e.target.value) || 1.5),
                              selectedRoom.depth
                            )
                          )
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
                        min={1.5}
                        max={30}
                        value={selectedRoom.depth}
                        onChange={(e) =>
                          updateFloorPlan(
                            resizeRoomWithWalls(
                              floorPlan,
                              selectedRoom.id,
                              selectedRoom.width,
                              Math.max(1.5, Number(e.target.value) || 1.5)
                            )
                          )
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

                  {/* Full Room Move (Walls + Interior Furniture) */}
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200">
                        <Move className="w-3.5 h-3.5 text-blue-600" />
                        <span>تحريك الغرفة كاملة (0.5م)</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateFloorPlan(
                            moveRoomCascade(floorPlan, selectedRoom.id, selectedRoom.x + 0.5, selectedRoom.z, true),
                            true
                          )
                        }
                        className="inline-flex items-center justify-center gap-0.5 rounded border border-slate-200 dark:border-slate-700 py-1 hover:bg-slate-50 dark:hover:bg-slate-800"
                        title="تحريك لليمين"
                      >
                        <ArrowRight className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateFloorPlan(
                            moveRoomCascade(floorPlan, selectedRoom.id, selectedRoom.x - 0.5, selectedRoom.z, true),
                            true
                          )
                        }
                        className="inline-flex items-center justify-center gap-0.5 rounded border border-slate-200 dark:border-slate-700 py-1 hover:bg-slate-50 dark:hover:bg-slate-800"
                        title="تحريك لليسار"
                      >
                        <ArrowLeft className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateFloorPlan(
                            moveRoomCascade(floorPlan, selectedRoom.id, selectedRoom.x, selectedRoom.z - 0.5, true),
                            true
                          )
                        }
                        className="inline-flex items-center justify-center gap-0.5 rounded border border-slate-200 dark:border-slate-700 py-1 hover:bg-slate-50 dark:hover:bg-slate-800"
                        title="تحريك للأعلى"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateFloorPlan(
                            moveRoomCascade(floorPlan, selectedRoom.id, selectedRoom.x, selectedRoom.z + 0.5, true),
                            true
                          )
                        }
                        className="inline-flex items-center justify-center gap-0.5 rounded border border-slate-200 dark:border-slate-700 py-1 hover:bg-slate-50 dark:hover:bg-slate-800"
                        title="تحريك للأسفل"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Group Room Walls & Bulk Edit */}
                  {selectedRoomWallsInfo && (
                    <div className="rounded-lg border border-blue-200 dark:border-blue-900/70 bg-blue-50/40 dark:bg-blue-950/20 p-2.5 space-y-2">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-blue-900 dark:text-blue-200">
                          حوائط الغرفة المجمّعة ({selectedRoomMatchedWalls.length}/4)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const grouped = groupOrEnsureRoomWalls(floorPlan, selectedRoom.id);
                            updateFloorPlan(grouped.plan, true);
                            setRoomGroupFeedback('تم جمع وتوحيد حوائط الغرفة الأربعة');
                            setTimeout(() => setRoomGroupFeedback(null), 2400);
                          }}
                          className="rounded-md bg-blue-600 hover:bg-blue-700 px-2 py-1 text-[10px] font-semibold text-white whitespace-nowrap"
                        >
                          جمع وتوحيد الحوائط
                        </button>
                      </div>
                      {roomGroupFeedback && (
                        <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                          {roomGroupFeedback}
                        </div>
                      )}
                      {selectedRoomMatchedWalls.length > 0 && (
                        <>
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <label className="block text-[10px] text-slate-600 dark:text-slate-300 mb-0.5">
                                ارتفاع الحوائط (m)
                              </label>
                              <input
                                type="number"
                                step={0.1}
                                min={2}
                                max={5}
                                value={selectedRoomMatchedWalls[0]?.height || floorPlan.wallHeight}
                                onChange={(e) =>
                                  updateFloorPlan(
                                    updateRoomGroupedWalls(floorPlan, selectedRoom.id, {
                                      height: Math.max(2, Number(e.target.value) || 2.8),
                                    })
                                  )
                                }
                                className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 font-mono-nums text-[11px]"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-600 dark:text-slate-300 mb-0.5">
                                سماكة الحوائط (m)
                              </label>
                              <input
                                type="number"
                                step={0.02}
                                min={0.08}
                                max={0.5}
                                value={selectedRoomMatchedWalls[0]?.thickness || 0.16}
                                onChange={(e) =>
                                  updateFloorPlan(
                                    updateRoomGroupedWalls(floorPlan, selectedRoom.id, {
                                      thickness: Math.max(0.08, Number(e.target.value) || 0.16),
                                    })
                                  )
                                }
                                className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 font-mono-nums text-[11px]"
                              />
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {WALL_COLOR_SWATCHES.slice(0, 6).map((sw) => (
                              <button
                                key={sw.color}
                                type="button"
                                onClick={() =>
                                  updateFloorPlan(
                                    updateRoomGroupedWalls(floorPlan, selectedRoom.id, { color: sw.color })
                                  )
                                }
                                className="w-5 h-5 rounded border border-slate-300 dark:border-slate-600"
                                style={{ backgroundColor: sw.color }}
                                title={`تطبيق طلاء ${sw.label} على حوائط الغرفة`}
                              />
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-1 pt-1">
                            {selectedRoomMatchedWalls.map((w, idx) => (
                              <button
                                key={w.id}
                                type="button"
                                onClick={() => setSelection({ kind: 'wall', id: w.id })}
                                className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-mono-nums hover:border-blue-500"
                              >
                                حائط {idx + 1} · {getWallLength(w).toFixed(2)}m
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Duplicate & Delete Full Room */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const res = duplicateRoomCascade(floorPlan, selectedRoom.id);
                        if (res) {
                          updateFloorPlan(res.plan, true);
                          setSelection({ kind: 'room', id: res.newRoomId });
                        }
                      }}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 py-1.5 text-[11px] font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Copy className="w-3.5 h-3.5 text-blue-600" />
                      <span>تكرار الغرفة</span>
                    </button>
                    <button
                      type="button"
                      onClick={deleteSelection}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 py-1.5 text-[11px] font-semibold text-red-700 dark:text-red-400 hover:bg-red-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف الغرفة</span>
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="block font-medium text-slate-600 dark:text-slate-300">
                        السيراميك والأرضية (3D)
                      </label>
                      {floorPlan.rooms.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            updateFloorPlan({
                              ...floorPlan,
                              rooms: floorPlan.rooms.map((r) => ({
                                ...r,
                                floorStyle: selectedRoom.floorStyle,
                              })),
                            })
                          }
                          className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          تطبيق على كل الغرف
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 dark:bg-slate-900 p-1 text-[11px]">
                      {(
                        [
                          { id: 'all', label: 'الكل' },
                          { id: 'algerian', label: 'جزائري' },
                          { id: 'international', label: 'عالمي' },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setFinishOriginFilter(tab.id)}
                          className={`rounded-md py-1 font-medium transition-colors ${
                            finishOriginFilter === tab.id
                              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-1.5 max-h-60 overflow-y-auto pl-1">
                      {FLOOR_STYLES.filter(
                        (fs) => finishOriginFilter === 'all' || fs.origin === finishOriginFilter
                      ).map((fs) => (
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
                          className={`w-full flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-right transition-colors ${
                            selectedRoom.floorStyle === fs.id
                              ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                              : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-4 h-4 rounded border border-black/15 shrink-0"
                              style={{ backgroundColor: fs.previewColor }}
                            />
                            <span className="truncate">{fs.label}</span>
                          </div>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                              fs.origin === 'algerian'
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                : 'bg-slate-500/15 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {fs.origin === 'algerian' ? 'جزائري' : 'عالمي'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Wall Inspector */}
              {selectedWall && (
                <div className="space-y-4 text-xs">
                  {/* Dedicated Wall Length Control */}
                  <div className="rounded-lg border border-blue-200 dark:border-blue-900/70 bg-blue-50/50 dark:bg-blue-950/20 p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-blue-900 dark:text-blue-200 inline-flex items-center gap-1">
                        <Ruler className="w-3.5 h-3.5 text-blue-600" />
                        <span>طول الحائط (m)</span>
                      </label>
                      <span className="font-mono-nums font-bold text-blue-700 dark:text-blue-300">
                        {getWallLength(selectedWall).toFixed(2)} m
                      </span>
                    </div>
                    <input
                      type="number"
                      step={0.1}
                      min={0.5}
                      max={40}
                      value={Number(getWallLength(selectedWall).toFixed(2))}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (!Number.isFinite(val) || val < 0.5) return;
                        updateFloorPlan({
                          ...floorPlan,
                          walls: floorPlan.walls.map((w) =>
                            w.id === selectedWall.id ? setWallLengthPreservingAngle(w, val) : w
                          ),
                        });
                      }}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 font-mono-nums"
                    />
                    <div className="grid grid-cols-6 gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateFloorPlan({
                            ...floorPlan,
                            walls: floorPlan.walls.map((w) =>
                              w.id === selectedWall.id
                                ? setWallLengthPreservingAngle(w, Math.max(0.5, getWallLength(w) - 0.5))
                                : w
                            ),
                          })
                        }
                        className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1 text-[10px] font-mono-nums font-semibold hover:border-blue-500"
                      >
                        -0.5
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateFloorPlan({
                            ...floorPlan,
                            walls: floorPlan.walls.map((w) =>
                              w.id === selectedWall.id
                                ? setWallLengthPreservingAngle(w, getWallLength(w) + 0.5)
                                : w
                            ),
                          })
                        }
                        className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1 text-[10px] font-mono-nums font-semibold hover:border-blue-500"
                      >
                        +0.5
                      </button>
                      {[2, 3, 4, 5].map((presetLen) => (
                        <button
                          key={presetLen}
                          type="button"
                          onClick={() =>
                            updateFloorPlan({
                              ...floorPlan,
                              walls: floorPlan.walls.map((w) =>
                                w.id === selectedWall.id
                                  ? setWallLengthPreservingAngle(w, presetLen)
                                  : w
                              ),
                            })
                          }
                          className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1 text-[10px] font-mono-nums font-semibold hover:border-blue-500"
                        >
                          {presetLen}م
                        </button>
                      ))}
                    </div>
                  </div>

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
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="block font-medium text-slate-600 dark:text-slate-300">
                        طلاء وصباغة الجدار
                      </label>
                      {floorPlan.walls.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            updateFloorPlan({
                              ...floorPlan,
                              walls: floorPlan.walls.map((w) => ({
                                ...w,
                                color: selectedWall.color,
                              })),
                            })
                          }
                          className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          تطبيق على كل الجدران
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 dark:bg-slate-900 p-1 text-[11px]">
                      {(
                        [
                          { id: 'all', label: 'الكل' },
                          { id: 'algerian', label: 'جزائري' },
                          { id: 'international', label: 'عالمي' },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setFinishOriginFilter(tab.id)}
                          className={`rounded-md py-1 font-medium transition-colors ${
                            finishOriginFilter === tab.id
                              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      {WALL_COLOR_SWATCHES.filter(
                        (sw) => finishOriginFilter === 'all' || sw.origin === finishOriginFilter
                      ).map((sw) => (
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
                            selectedWall.color.toLowerCase() === sw.color.toLowerCase()
                              ? 'border-blue-600 ring-2 ring-blue-500/30 scale-105'
                              : 'border-slate-300 dark:border-slate-700'
                          }`}
                          style={{ backgroundColor: sw.color }}
                          title={`${sw.label}${sw.finish ? ` (${sw.finish})` : ''}`}
                        />
                      ))}
                    </div>

                    {(() => {
                      const activeSwatch = WALL_COLOR_SWATCHES.find(
                        (sw) => sw.color.toLowerCase() === selectedWall.color.toLowerCase()
                      );
                      return (
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 px-2.5 py-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {activeSwatch ? activeSwatch.label : 'لون صباغة مخصص'}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {activeSwatch
                                ? `${activeSwatch.origin === 'algerian' ? 'نمط جزائري' : 'نمط عالمي'}${
                                    activeSwatch.finish ? ` · ${activeSwatch.finish}` : ''
                                  }`
                                : selectedWall.color.toUpperCase()}
                            </div>
                          </div>
                          <label className="inline-flex items-center gap-1.5 cursor-pointer shrink-0 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200">
                            <input
                              type="color"
                              value={selectedWall.color || '#F5F2EB'}
                              onChange={(e) =>
                                updateFloorPlan({
                                  ...floorPlan,
                                  walls: floorPlan.walls.map((w) =>
                                    w.id === selectedWall.id ? { ...w, color: e.target.value } : w
                                  ),
                                })
                              }
                              className="w-4 h-4 rounded border-0 p-0 bg-transparent cursor-pointer"
                            />
                            <span>مخصص</span>
                          </label>
                        </div>
                      );
                    })()}
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

              {/* Structural Column Inspector */}
              {selectedColumn && (
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                      رمز العمود (بيلي)
                    </label>
                    <input
                      type="text"
                      value={selectedColumn.label || ''}
                      onChange={(e) =>
                        updateFloorPlan({
                          ...floorPlan,
                          columns: (floorPlan.columns || []).map((c) =>
                            c.id === selectedColumn.id ? { ...c, label: e.target.value } : c
                          ),
                        })
                      }
                      placeholder="P1"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                        العرض (m)
                      </label>
                      <input
                        type="number"
                        step={0.05}
                        min={0.2}
                        max={1.2}
                        value={selectedColumn.width}
                        onChange={(e) =>
                          updateFloorPlan({
                            ...floorPlan,
                            columns: (floorPlan.columns || []).map((c) =>
                              c.id === selectedColumn.id
                                ? { ...c, width: Math.max(0.2, Number(e.target.value) || 0.3) }
                                : c
                            ),
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1 font-mono-nums"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                        العمق (m)
                      </label>
                      <input
                        type="number"
                        step={0.05}
                        min={0.2}
                        max={1.2}
                        value={selectedColumn.depth}
                        onChange={(e) =>
                          updateFloorPlan({
                            ...floorPlan,
                            columns: (floorPlan.columns || []).map((c) =>
                              c.id === selectedColumn.id
                                ? { ...c, depth: Math.max(0.2, Number(e.target.value) || 0.3) }
                                : c
                            ),
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1 font-mono-nums"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                        الارتفاع (m)
                      </label>
                      <input
                        type="number"
                        step={0.1}
                        min={2}
                        max={6}
                        value={selectedColumn.height}
                        onChange={(e) =>
                          updateFloorPlan({
                            ...floorPlan,
                            columns: (floorPlan.columns || []).map((c) =>
                              c.id === selectedColumn.id
                                ? { ...c, height: Math.max(2, Number(e.target.value) || 2.8) }
                                : c
                            ),
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1 font-mono-nums"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const cols = floorPlan.columns || [];
                      const copy: StructuralColumn = {
                        ...selectedColumn,
                        id: `col_${Date.now()}`,
                        label: `P${cols.length + 1}`,
                        x: Number((selectedColumn.x + 1).toFixed(2)),
                      };
                      updateFloorPlan({ ...floorPlan, columns: [...cols, copy] }, true);
                      setSelection({ kind: 'column', id: copy.id });
                    }}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 py-2 font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>تكرار العمود</span>
                  </button>
                </div>
              )}

              {/* Structural Beam Inspector */}
              {selectedBeam && (
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                      تسمية السانتر
                    </label>
                    <input
                      type="text"
                      value={selectedBeam.label || ''}
                      onChange={(e) =>
                        updateFloorPlan({
                          ...floorPlan,
                          beams: (floorPlan.beams || []).map((b) =>
                            b.id === selectedBeam.id ? { ...b, label: e.target.value } : b
                          ),
                        })
                      }
                      placeholder="S1"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5"
                    />
                  </div>
                  <div className="rounded-lg border border-blue-200 dark:border-blue-900/70 bg-blue-50/50 dark:bg-blue-950/20 p-2.5 flex items-center justify-between">
                    <span className="font-semibold text-blue-900 dark:text-blue-200">الطول الحالي</span>
                    <span className="font-mono-nums font-bold text-blue-700 dark:text-blue-300">
                      {Math.hypot(selectedBeam.x2 - selectedBeam.x1, selectedBeam.z2 - selectedBeam.z1).toFixed(2)} m
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                        العرض (m)
                      </label>
                      <input
                        type="number"
                        step={0.05}
                        min={0.15}
                        max={0.8}
                        value={selectedBeam.width}
                        onChange={(e) =>
                          updateFloorPlan({
                            ...floorPlan,
                            beams: (floorPlan.beams || []).map((b) =>
                              b.id === selectedBeam.id
                                ? { ...b, width: Math.max(0.15, Number(e.target.value) || 0.25) }
                                : b
                            ),
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1 font-mono-nums"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                        السقوط/الارتفاع (m)
                      </label>
                      <input
                        type="number"
                        step={0.05}
                        min={0.2}
                        max={0.9}
                        value={selectedBeam.height}
                        onChange={(e) =>
                          updateFloorPlan({
                            ...floorPlan,
                            beams: (floorPlan.beams || []).map((b) =>
                              b.id === selectedBeam.id
                                ? { ...b, height: Math.max(0.2, Number(e.target.value) || 0.35) }
                                : b
                            ),
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1 font-mono-nums"
                      />
                    </div>
                  </div>
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
            data-tour-id="tour-mobile-tools"
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
          data-tour-id="tour-mobile-calc"
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
                    (selectedColumn ? `خصائص العمود (${selectedColumn.label || 'بيلي'})` : null) ||
                    (selectedBeam ? `خصائص السانتر (${selectedBeam.label || 'حزام'})` : null) ||
                    (selectedOpening
                      ? selectedOpening.type === 'door'
                        ? 'خصائص الباب'
                        : selectedOpening.type === 'arch'
                          ? 'خصائص القوس المعماري'
                          : 'خصائص النافذة'
                      : selectedWall
                        ? 'خصائص الجدار'
                        : 'خصائص العنصر'))}
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
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'select', label: 'تحديد', Icon: MousePointer },
                        { id: 'room', label: 'غرفة', Icon: PlusSquare },
                        { id: 'wall', label: 'جدار', Icon: PenTool },
                        { id: 'door', label: 'باب', Icon: DoorOpen },
                        { id: 'window', label: 'نافذة', Icon: Square },
                        { id: 'arch', label: 'قوس', Icon: Columns2 },
                      ] as const
                    ).map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setActiveTool(id);
                          if (id === 'room') {
                            setSpaceMenuOpen(true);
                          } else {
                            setSpaceMenuOpen(false);
                            setMobileSheet(null);
                          }
                        }}
                        className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-medium min-h-[54px] transition-colors ${
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

                  {/* Mobile Structural Columns & Beams */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <span className="inline-flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>أعمدة البناء (البيليات والسوانتر · اختياري)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateFloorPlan({
                            ...floorPlan,
                            showStructureLayer: floorPlan.showStructureLayer === false ? true : false,
                          })
                        }
                        className="text-[11px] font-semibold text-blue-600 dark:text-blue-400"
                      >
                        {floorPlan.showStructureLayer !== false ? 'إخفاء الطبقة' : 'إظهار الطبقة'}
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTool('column');
                          setMobileSheet(null);
                        }}
                        className={`py-2 px-2 rounded-xl text-xs font-semibold ${
                          activeTool === 'column'
                            ? 'bg-slate-800 dark:bg-blue-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        + بيلي (عمود)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTool('beam');
                          setMobileSheet(null);
                        }}
                        className={`py-2 px-2 rounded-xl text-xs font-semibold ${
                          activeTool === 'beam'
                            ? 'bg-slate-800 dark:bg-blue-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        + سانتر
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const generated = generateAutoColumnsAndBeams(floorPlan);
                          updateFloorPlan(
                            {
                              ...floorPlan,
                              columns: generated.columns,
                              beams: generated.beams,
                              showStructureLayer: true,
                            },
                            true
                          );
                          setMobileSheet(null);
                        }}
                        className="py-2 px-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/30 text-xs font-semibold text-blue-700 dark:text-blue-300"
                      >
                        توزيع تلقائي
                      </button>
                    </div>
                  </div>

                  {/* Mobile Space Type Dropdown (Auto-expands when room tool is active) */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <button
                      type="button"
                      onClick={() => setSpaceMenuOpen((v) => !v)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      <span>
                        نوع الفضاء (رسم أو إدراج):{' '}
                        <strong className="text-blue-600 dark:text-blue-400">
                          {activeSpacePreset.label}
                        </strong>
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${
                          activeTool === 'room' || spaceMenuOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {(activeTool === 'room' || spaceMenuOpen) && (
                      <div className="space-y-2">
                        <select
                          value={activeSpacePreset.id}
                          onChange={(e) => {
                            const chosen = DRAWING_SPACE_PRESETS.find((p) => p.id === e.target.value);
                            if (chosen) {
                              setActiveSpacePreset(chosen);
                              setActiveTool('room');
                            }
                          }}
                          aria-label="نوع الفضاء (رسم أو إدراج)"
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-xs font-medium text-slate-800 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                        >
                          {DRAWING_SPACE_PRESETS.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                              {preset.label} ({preset.defaultWidth}×{preset.defaultDepth} م)
                            </option>
                          ))}
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTool('room');
                              setMobileSheet(null);
                            }}
                            className="py-2.5 px-3 rounded-xl border border-blue-600 text-blue-700 dark:text-blue-300 text-xs font-semibold"
                          >
                            رسم بالسحب على المخطط
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              insertPresetRoom(activeSpacePreset);
                              setMobileSheet(null);
                            }}
                            className="py-2.5 px-3 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow-sm"
                          >
                            + إدراج تلقائي
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setMobileSheet(null);
                      setShowCameraArModal(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/30 text-xs font-semibold text-indigo-700 dark:text-indigo-300"
                  >
                    {isAiArProActive ? <Camera className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    <span>معاينة المخطط 2D في الفضاء الحقيقي بالكاميرا (برو)</span>
                  </button>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAutoMeasureEnabled((v) => !v)}
                        className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-semibold border ${
                          autoMeasureEnabled
                            ? 'border-sky-600 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <Ruler className="w-3.5 h-3.5" />
                        <span>القياس التلقائي</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSnapEnabled((s) => !s)}
                        className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-semibold border ${
                          snapEnabled
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <Magnet className="w-3.5 h-3.5" />
                        <span>محاذاة</span>
                      </button>
                    </div>

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

                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/70 dark:bg-emerald-950/30 p-3 flex items-center justify-between gap-2">
                    <div>
                      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                        <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>تكلفة الأثاث التقديرية ({furnitureCostSummary.totalCount} قطعة)</span>
                      </div>
                      <div className="text-base font-bold font-mono-nums text-emerald-950 dark:text-emerald-100 mt-0.5">
                        {formatDzd(furnitureCostSummary.totalDzd)}
                      </div>
                    </div>
                    <span className="text-[11px] font-mono-nums text-emerald-800/85 dark:text-emerald-300/85">
                      {formatMillionCentimes(furnitureCostSummary.totalDzd)}
                    </span>
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
                            min={1.5}
                            max={30}
                            value={selectedRoom.width}
                            onChange={(e) =>
                              updateFloorPlan(
                                resizeRoomWithWalls(
                                  floorPlan,
                                  selectedRoom.id,
                                  Math.max(1.5, Number(e.target.value) || 1.5),
                                  selectedRoom.depth
                                )
                              )
                            }
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 font-mono-nums"
                          />
                        </div>
                        <div>
                          <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">الطول (m)</label>
                          <input
                            type="number"
                            step={0.25}
                            min={1.5}
                            max={30}
                            value={selectedRoom.depth}
                            onChange={(e) =>
                              updateFloorPlan(
                                resizeRoomWithWalls(
                                  floorPlan,
                                  selectedRoom.id,
                                  selectedRoom.width,
                                  Math.max(1.5, Number(e.target.value) || 1.5)
                                )
                              )
                            }
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 font-mono-nums"
                          />
                        </div>
                      </div>

                      {/* Mobile Full Room Move & Group Walls */}
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 space-y-2">
                        <div className="font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1">
                          <Move className="w-3.5 h-3.5 text-blue-600" />
                          <span>تحريك الغرفة كاملة (0.5م)</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              updateFloorPlan(
                                moveRoomCascade(floorPlan, selectedRoom.id, selectedRoom.x + 0.5, selectedRoom.z, true),
                                true
                              )
                            }
                            className="flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 py-1.5"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateFloorPlan(
                                moveRoomCascade(floorPlan, selectedRoom.id, selectedRoom.x - 0.5, selectedRoom.z, true),
                                true
                              )
                            }
                            className="flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 py-1.5"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateFloorPlan(
                                moveRoomCascade(floorPlan, selectedRoom.id, selectedRoom.x, selectedRoom.z - 0.5, true),
                                true
                              )
                            }
                            className="flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 py-1.5"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateFloorPlan(
                                moveRoomCascade(floorPlan, selectedRoom.id, selectedRoom.x, selectedRoom.z + 0.5, true),
                                true
                              )
                            }
                            className="flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 py-1.5"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {selectedRoomWallsInfo && (
                        <div className="rounded-xl border border-blue-200 dark:border-blue-900/70 bg-blue-50/40 dark:bg-blue-950/20 p-2.5 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-blue-900 dark:text-blue-200">
                              حوائط الغرفة المجمّعة ({selectedRoomMatchedWalls.length}/4)
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const grouped = groupOrEnsureRoomWalls(floorPlan, selectedRoom.id);
                                updateFloorPlan(grouped.plan, true);
                                setRoomGroupFeedback('تم جمع وتوحيد حوائط الغرفة');
                                setTimeout(() => setRoomGroupFeedback(null), 2400);
                              }}
                              className="rounded-md bg-blue-600 text-white px-2.5 py-1 text-[11px] font-semibold"
                            >
                              جمع وتوحيد الحوائط
                            </button>
                          </div>
                          {selectedRoomMatchedWalls.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {selectedRoomMatchedWalls.map((w, idx) => (
                                <button
                                  key={w.id}
                                  type="button"
                                  onClick={() => setSelection({ kind: 'wall', id: w.id })}
                                  className="px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-mono-nums"
                                >
                                  حائط {idx + 1} · {getWallLength(w).toFixed(2)}m
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          const res = duplicateRoomCascade(floorPlan, selectedRoom.id);
                          if (res) {
                            updateFloorPlan(res.plan, true);
                            setSelection({ kind: 'room', id: res.newRoomId });
                          }
                        }}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 py-2 font-semibold"
                      >
                        <Copy className="w-4 h-4 text-blue-600" />
                        <span>تكرار الغرفة كاملة (مع الحوائط والأثاث)</span>
                      </button>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-600 dark:text-slate-300">
                            السيراميك والأرضية (3D)
                          </span>
                          {floorPlan.rooms.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                updateFloorPlan({
                                  ...floorPlan,
                                  rooms: floorPlan.rooms.map((r) => ({
                                    ...r,
                                    floorStyle: selectedRoom.floorStyle,
                                  })),
                                })
                              }
                              className="text-[11px] font-medium text-blue-600 dark:text-blue-400"
                            >
                              تطبيق على كل الغرف
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 dark:bg-slate-900 p-1 text-[11px]">
                          {(
                            [
                              { id: 'all', label: 'الكل' },
                              { id: 'algerian', label: 'جزائري' },
                              { id: 'international', label: 'عالمي' },
                            ] as const
                          ).map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setFinishOriginFilter(tab.id)}
                              className={`rounded-md py-1.5 font-medium ${
                                finishOriginFilter === tab.id
                                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {FLOOR_STYLES.filter(
                            (fs) => finishOriginFilter === 'all' || fs.origin === finishOriginFilter
                          ).map((fs) => (
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
                              className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-right ${
                                selectedRoom.floorStyle === fs.id
                                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                                  : 'border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              <span
                                className="w-4 h-4 rounded border border-black/15 shrink-0"
                                style={{ backgroundColor: fs.previewColor }}
                              />
                              <span className="truncate">{fs.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedWall && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-blue-200 dark:border-blue-900/70 bg-blue-50/50 dark:bg-blue-950/20 p-2.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="font-semibold text-blue-900 dark:text-blue-200">
                            طول الحائط (m)
                          </label>
                          <span className="font-mono-nums font-bold text-blue-700 dark:text-blue-300">
                            {getWallLength(selectedWall).toFixed(2)} m
                          </span>
                        </div>
                        <input
                          type="number"
                          step={0.1}
                          min={0.5}
                          max={40}
                          value={Number(getWallLength(selectedWall).toFixed(2))}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (!Number.isFinite(val) || val < 0.5) return;
                            updateFloorPlan({
                              ...floorPlan,
                              walls: floorPlan.walls.map((w) =>
                                w.id === selectedWall.id ? setWallLengthPreservingAngle(w, val) : w
                              ),
                            });
                          }}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono-nums"
                        />
                        <div className="grid grid-cols-6 gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              updateFloorPlan({
                                ...floorPlan,
                                walls: floorPlan.walls.map((w) =>
                                  w.id === selectedWall.id
                                    ? setWallLengthPreservingAngle(w, Math.max(0.5, getWallLength(w) - 0.5))
                                    : w
                                ),
                              })
                            }
                            className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 text-[11px] font-mono-nums font-semibold"
                          >
                            -0.5
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateFloorPlan({
                                ...floorPlan,
                                walls: floorPlan.walls.map((w) =>
                                  w.id === selectedWall.id
                                    ? setWallLengthPreservingAngle(w, getWallLength(w) + 0.5)
                                    : w
                                ),
                              })
                            }
                            className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 text-[11px] font-mono-nums font-semibold"
                          >
                            +0.5
                          </button>
                          {[2, 3, 4, 5].map((presetLen) => (
                            <button
                              key={presetLen}
                              type="button"
                              onClick={() =>
                                updateFloorPlan({
                                  ...floorPlan,
                                  walls: floorPlan.walls.map((w) =>
                                    w.id === selectedWall.id
                                      ? setWallLengthPreservingAngle(w, presetLen)
                                      : w
                                  ),
                                })
                              }
                              className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 text-[11px] font-mono-nums font-semibold"
                            >
                              {presetLen}م
                            </button>
                          ))}
                        </div>
                      </div>

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
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-600 dark:text-slate-300">
                          طلاء وصباغة الجدار
                        </span>
                        {floorPlan.walls.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              updateFloorPlan({
                                ...floorPlan,
                                walls: floorPlan.walls.map((w) => ({
                                  ...w,
                                  color: selectedWall.color,
                                })),
                              })
                            }
                            className="text-[11px] font-medium text-blue-600 dark:text-blue-400"
                          >
                            تطبيق على كل الجدران
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 dark:bg-slate-900 p-1 text-[11px]">
                        {(
                          [
                            { id: 'all', label: 'الكل' },
                            { id: 'algerian', label: 'جزائري' },
                            { id: 'international', label: 'عالمي' },
                          ] as const
                        ).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setFinishOriginFilter(tab.id)}
                            className={`rounded-md py-1.5 font-medium ${
                              finishOriginFilter === tab.id
                                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {WALL_COLOR_SWATCHES.filter(
                          (sw) => finishOriginFilter === 'all' || sw.origin === finishOriginFilter
                        ).map((sw) => (
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
                              selectedWall.color.toLowerCase() === sw.color.toLowerCase()
                                ? 'border-blue-600 ring-2 ring-blue-500/30'
                                : 'border-slate-300 dark:border-slate-700'
                            }`}
                            style={{ backgroundColor: sw.color }}
                            title={sw.label}
                          />
                        ))}
                      </div>
                      {(() => {
                        const activeSwatch = WALL_COLOR_SWATCHES.find(
                          (sw) => sw.color.toLowerCase() === selectedWall.color.toLowerCase()
                        );
                        return (
                          <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 px-2.5 py-2">
                            <span className="truncate font-medium">
                              {activeSwatch ? activeSwatch.label : selectedWall.color.toUpperCase()}
                            </span>
                            <label className="inline-flex items-center gap-1.5 cursor-pointer shrink-0 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px]">
                              <input
                                type="color"
                                value={selectedWall.color || '#F5F2EB'}
                                onChange={(e) =>
                                  updateFloorPlan({
                                    ...floorPlan,
                                    walls: floorPlan.walls.map((w) =>
                                      w.id === selectedWall.id ? { ...w, color: e.target.value } : w
                                    ),
                                  })
                                }
                                className="w-4 h-4 rounded border-0 p-0 bg-transparent"
                              />
                              <span>مخصص</span>
                            </label>
                          </div>
                        );
                      })()}
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

                  {selectedColumn && (
                    <div className="space-y-3">
                      <div>
                        <label className="block font-medium mb-1">رمز العمود (بيلي)</label>
                        <input
                          type="text"
                          value={selectedColumn.label || ''}
                          onChange={(e) =>
                            updateFloorPlan({
                              ...floorPlan,
                              columns: (floorPlan.columns || []).map((c) =>
                                c.id === selectedColumn.id ? { ...c, label: e.target.value } : c
                              ),
                            })
                          }
                          placeholder="P1"
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block font-medium mb-1">العرض (m)</label>
                          <input
                            type="number"
                            step={0.05}
                            min={0.2}
                            max={1.2}
                            value={selectedColumn.width}
                            onChange={(e) =>
                              updateFloorPlan({
                                ...floorPlan,
                                columns: (floorPlan.columns || []).map((c) =>
                                  c.id === selectedColumn.id
                                    ? { ...c, width: Math.max(0.2, Number(e.target.value) || 0.3) }
                                    : c
                                ),
                              })
                            }
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1.5 font-mono-nums"
                          />
                        </div>
                        <div>
                          <label className="block font-medium mb-1">العمق (m)</label>
                          <input
                            type="number"
                            step={0.05}
                            min={0.2}
                            max={1.2}
                            value={selectedColumn.depth}
                            onChange={(e) =>
                              updateFloorPlan({
                                ...floorPlan,
                                columns: (floorPlan.columns || []).map((c) =>
                                  c.id === selectedColumn.id
                                    ? { ...c, depth: Math.max(0.2, Number(e.target.value) || 0.3) }
                                    : c
                                ),
                              })
                            }
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1.5 font-mono-nums"
                          />
                        </div>
                        <div>
                          <label className="block font-medium mb-1">الارتفاع (m)</label>
                          <input
                            type="number"
                            step={0.1}
                            min={2}
                            max={6}
                            value={selectedColumn.height}
                            onChange={(e) =>
                              updateFloorPlan({
                                ...floorPlan,
                                columns: (floorPlan.columns || []).map((c) =>
                                  c.id === selectedColumn.id
                                    ? { ...c, height: Math.max(2, Number(e.target.value) || 2.8) }
                                    : c
                                ),
                              })
                            }
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1.5 font-mono-nums"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedBeam && (
                    <div className="space-y-3">
                      <div>
                        <label className="block font-medium mb-1">تسمية السانتر</label>
                        <input
                          type="text"
                          value={selectedBeam.label || ''}
                          onChange={(e) =>
                            updateFloorPlan({
                              ...floorPlan,
                              beams: (floorPlan.beams || []).map((b) =>
                                b.id === selectedBeam.id ? { ...b, label: e.target.value } : b
                              ),
                            })
                          }
                          placeholder="S1"
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-medium mb-1">العرض (m)</label>
                          <input
                            type="number"
                            step={0.05}
                            min={0.15}
                            max={0.8}
                            value={selectedBeam.width}
                            onChange={(e) =>
                              updateFloorPlan({
                                ...floorPlan,
                                beams: (floorPlan.beams || []).map((b) =>
                                  b.id === selectedBeam.id
                                    ? { ...b, width: Math.max(0.15, Number(e.target.value) || 0.25) }
                                    : b
                                ),
                              })
                            }
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1.5 font-mono-nums"
                          />
                        </div>
                        <div>
                          <label className="block font-medium mb-1">الارتفاع (m)</label>
                          <input
                            type="number"
                            step={0.05}
                            min={0.2}
                            max={0.9}
                            value={selectedBeam.height}
                            onChange={(e) =>
                              updateFloorPlan({
                                ...floorPlan,
                                beams: (floorPlan.beams || []).map((b) =>
                                  b.id === selectedBeam.id
                                    ? { ...b, height: Math.max(0.2, Number(e.target.value) || 0.35) }
                                    : b
                                ),
                              })
                            }
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1.5 font-mono-nums"
                          />
                        </div>
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
              allowAiLiveSync={isAiArProActive}
              onOpenProUpgrade={() => {
                setShowCostModal(false);
                onOpenProUpgrade?.();
              }}
              onStartPlanFromEstimate={(payload) => {
                updateFloorPlan(payload.floorPlan, true);
                if (payload.title && (title === 'منزل جديد' || title.startsWith('مخطط '))) {
                  setTitle(payload.title);
                }
                setSelection(null);
                setShowCostModal(false);
              }}
              linkedPlan={{
                title,
                floorAreaSqm: Math.max(15, areaReport.totalAreaSqm),
                wallLengthM: Math.max(10, areaReport.grossWallLengthM),
                wallHeightM: floorPlan.wallHeight || 2.8,
                columnsCount: structureMetrics.columnsCount,
                beamsLengthM: structureMetrics.totalBeamsLengthM,
              }}
            />
          </div>
        </div>
      )}

      {/* Project Invoice Modal (Furniture optional prices + Algerian Construction BOQ + Custom items + Client Showcase) */}
      {showInvoiceModal && (
        <InvoiceModal
          brandName={brandName}
          projectTitle={title}
          floorPlan={floorPlan}
          initialAreaSqm={Math.max(15, areaReport.totalAreaSqm)}
          initialWallLengthM={Math.max(10, areaReport.grossWallLengthM)}
          initialWallHeightM={floorPlan.wallHeight || 2.8}
          showcaseImages={showcaseImages}
          onUpdateShowcaseImages={setShowcaseImages}
          onCapture2D={() => capture2DRef.current?.() ?? null}
          onCapture3D={() => capture3DRef.current?.() ?? null}
          focusShowcaseSection={focusShowcaseInInvoice}
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
          onClose={() => {
            setShowInvoiceModal(false);
            setFocusShowcaseInInvoice(false);
          }}
        />
      )}

      {/* Pro Sketch-to-Design Modal inside Workspace */}
      <SketchToPlanModal
        isOpen={showSketchModal}
        brandName={brandName}
        isUserProActive={isAiArProActive}
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

      {/* Pro Real-Space Camera AR 2D Floorplan Preview */}
      <CameraArPreviewModal
        isOpen={showCameraArModal}
        projectTitle={title}
        floorPlan={floorPlan}
        isUserProActive={isAiArProActive}
        onClose={() => setShowCameraArModal(false)}
        onOpenProUpgrade={() => {
          setShowCameraArModal(false);
          onOpenProUpgrade?.();
        }}
      />

      {/* Interactive Workspace Guided Tour Overlay */}
      <GuidedTourOverlay
        isOpen={showGuidedTour}
        steps={[
          {
            id: 'viewport-modes',
            selector: '[data-tour-id="tour-viewport-modes"]',
            categoryLabel: 'تخطيط مساحة العمل',
            title: 'طرق العرض المتزامنة (2D + 3D)',
            description:
              'تنقّل فوراً بين المخطط الهندسي الثنائي الأبعاد (2D)، العرض المزدوج، أو المجسم الثلاثي الأبعاد التفاعلي (3D). كل تعديل على الجدران أو الأثاث ينعكس لحظياً.',
          },
          {
            id: 'drafting-tools',
            selector: '[data-tour-id="tour-drafting-tools"]',
            mobileSelector: '[data-tour-id="tour-mobile-tools"]',
            categoryLabel: 'أدوات الرسم الهندسي',
            title: 'رسم الغرف والجدران والقياس التلقائي',
            description:
              'أضف غرفاً كاملة، جدراناً، أبواباً، ونوافذ بدقة المتر مع تفعيل خيار «القياس التلقائي» لإظهار الأبعاد مباشرة أثناء الرسم.',
            onEnter: () => {
              if (viewMode === '3d') setViewMode('split');
            },
          },
          {
            id: 'structure-tools',
            selector: '[data-tour-id="tour-structure-tools"]',
            mobileSelector: '[data-tour-id="tour-mobile-tools"]',
            categoryLabel: 'أدوات البناء والخرسانة',
            title: 'أعمدة البناء (البيليات والسوانتر)',
            description:
              'ضع أعمدة الخرسانة (بيلي) والكمرات العلوية (سانتر) يدوياً في أي نقطة، أو استخدم التوزيع التلقائي لتثبيت الأعمدة على زوايا الغرف والجدران.',
            onEnter: () => {
              if (viewMode === '3d') setViewMode('split');
            },
            actionLabel: 'توزيع البيليات والسوانتر تلقائياً الآن',
            onAction: () => {
              const generated = generateAutoColumnsAndBeams(floorPlan);
              updateFloorPlan(
                {
                  ...floorPlan,
                  columns: generated.columns,
                  beams: generated.beams,
                  showStructureLayer: true,
                },
                true
              );
            },
          },
          {
            id: 'labor-calculator',
            selector: '[data-tour-id="tour-sidebar-cost-cta"]',
            mobileSelector: '[data-tour-id="tour-mobile-calc"]',
            categoryLabel: 'حاسبة اليد العاملة الذكية',
            title: 'حساب اليد العاملة بالمتر والبيلي والسانتر والدالة',
            description:
              'من هنا تفتح حاسبة السوق الجزائري المحدثة مع الحاسبة الذكية لليد العاملة بالمتر (بناء وتلبيس الجدار، البيلي، السانتر، الدالة الكاملة، والبلاط والدهان) إضافة إلى التعديل المباشر لاقتراحات المخطط.',
            onEnter: () => {
              if (viewMode === '3d') setViewMode('split');
              setSidebarTab('calculator');
            },
            actionLabel: 'فتح حاسبة اليد العاملة الذكية الآن',
            onAction: () => {
              markGuidedTourCompleted();
              setShowGuidedTour(false);
              setShowCostModal(true);
            },
          },
          {
            id: 'client-invoice',
            selector: '[data-tour-id="tour-client-invoice"]',
            mobileSelector: '[data-tour-id="tour-cost-header"]',
            categoryLabel: 'التصدير والزبائن',
            title: 'صور المشروع للزبون والفاتورة التقديرية PDF',
            description:
              'التقط ورتب صور المشروع (2D و3D أو صوراً مرفوعة) وأصدر فاتورة تقديرية شاملة بصيغة PDF لعرضها على الزبون مع التنبيه بأن القيم تقديرية وليست نهائية.',
            actionLabel: 'فتح معرض صور الزبون والفاتورة التقديرية',
            onAction: () => {
              markGuidedTourCompleted();
              setShowGuidedTour(false);
              setFocusShowcaseInInvoice(true);
              setShowInvoiceModal(true);
            },
          },
        ]}
        currentStepIdx={tourStepIdx}
        onChangeStep={setTourStepIdx}
        onFinish={() => {
          markGuidedTourCompleted();
          setShowGuidedTour(false);
        }}
      />
    </div>
  );
};
