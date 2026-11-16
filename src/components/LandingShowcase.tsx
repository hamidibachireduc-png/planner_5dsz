import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crown,
  Download,
  Eye,
  FolderOpen,
  HardDriveDownload,
  Home,
  ImagePlus,
  Lock,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { BRAND_LOGO_URL, TEMPLATE_IMAGES } from '../utils/assets';
import {
  ActiveAuthSession,
  getFreePromoDaysRemaining,
  isFreePromoMonthActive,
} from '../utils/authStore';
import { formatDzd } from '../data/algeriaMarketPrices';
import {
  CatalogItemDef,
  FURNITURE_CATALOG,
  FURNITURE_CATEGORIES,
  StarterTemplate,
} from '../data/catalog';
import { ALGERIAN_TEMPLATES_200, TEMPLATE_STATS } from '../data/algerianTemplates';
import {
  FloorPlanData,
  FurnitureCategory,
  ProSubscriptionOrder,
  ProjectRecord,
} from '../types/planner';
import {
  downloadAllProjectsBackup,
  downloadProjectToDevice,
  parseImportedProjectFile,
} from '../utils/projectFileIo';
import { AlgeriaCostCalculator } from './AlgeriaCostCalculator';
import { ProSubscribeModal } from './ProSubscribeModal';
import { ProSubscriptionSection } from './ProSubscriptionSection';
import { TemplateBlueprintPreview } from './TemplateBlueprintPreview';

interface LandingShowcaseProps {
  brandName: string;
  sessionUser: ActiveAuthSession;
  isAdminAuthorized: boolean;
  isUserProActive: boolean;
  isGuestSession?: boolean;
  guestDesignsUsed?: number;
  projects: ProjectRecord[];
  loadingProjects: boolean;
  proOrders: ProSubscriptionOrder[];
  facebookUrl: string;
  isDarkTheme: boolean;
  onToggleTheme: () => void;
  onUpdateBrandName: (name: string) => Promise<void>;
  onSignOut: () => void;
  onOpenAdminPanel: () => void;
  onOpenNewBlank: () => void;
  onOpenSketchModal: () => void;
  onOpenTemplate: (template: StarterTemplate) => void;
  onOpenWithCatalogItem: (item: CatalogItemDef) => void;
  onOpenProject: (project: ProjectRecord) => void;
  onDuplicateProject: (project: ProjectRecord) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onImportProjects: (
    imported: { title: string; templateKey?: string; floorPlanData: FloorPlanData }[],
    openFirst?: boolean
  ) => Promise<void>;
  onSaveFacebookUrl: (url: string) => void;
  onSubmitProOrder: (
    order: Omit<ProSubscriptionOrder, 'id' | 'ownerId' | 'status' | 'createdAtMs'>
  ) => Promise<void>;
  onUpdateProOrderStatus: (orderId: string, status: 'approved' | 'rejected') => Promise<void>;
}

const ImageWithFallback: React.FC<{
  src: string;
  alt: string;
  className?: string;
}> = ({ src, alt, className = '' }) => {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900 text-slate-600 dark:text-slate-300 p-6 ${className}`}
      >
        <Home className="w-8 h-8 mb-2 opacity-70" />
        <span className="text-xs font-medium text-center">{alt}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};

export const LandingShowcase: React.FC<LandingShowcaseProps> = ({
  brandName,
  sessionUser,
  isAdminAuthorized,
  isUserProActive,
  isGuestSession = false,
  guestDesignsUsed = 0,
  projects,
  loadingProjects,
  proOrders,
  facebookUrl,
  isDarkTheme,
  onToggleTheme,
  onUpdateBrandName,
  onSignOut,
  onOpenAdminPanel,
  onOpenNewBlank,
  onOpenSketchModal,
  onOpenTemplate,
  onOpenWithCatalogItem,
  onOpenProject,
  onDuplicateProject,
  onDeleteProject,
  onImportProjects,
  onSaveFacebookUrl,
  onSubmitProOrder,
  onUpdateProOrderStatus,
}) => {
  const [templateFilter, setTemplateFilter] = useState<'all' | 'apartments' | 'studios' | 'villas' | 'duplex'>('all');
  const [templateTierFilter, setTemplateTierFilter] = useState<'all' | 'free' | 'pro'>('all');
  const [templateSearch, setTemplateSearch] = useState('');
  const [templatePage, setTemplatePage] = useState(1);
  const [lockedTemplateModal, setLockedTemplateModal] = useState<StarterTemplate | null>(null);
  const [showProSubscribeModal, setShowProSubscribeModal] = useState(false);
  const [quickPreview, setQuickPreview] = useState<{
    title: string;
    subtitle: string;
    floorPlan: FloorPlanData;
    project?: ProjectRecord;
    template?: StarterTemplate;
  } | null>(null);

  useEffect(() => {
    if (!quickPreview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setQuickPreview(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [quickPreview]);

  const [catalogFilter, setCatalogFilter] = useState<FurnitureCategory | 'all'>('all');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogPage, setCatalogPage] = useState(1);

  const [openImportedDirectly, setOpenImportedDirectly] = useState(true);
  const [importNotice, setImportNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [importingFile, setImportingFile] = useState(false);
  const deviceImportInputRef = useRef<HTMLInputElement | null>(null);

  const [brandDraft, setBrandDraft] = useState(brandName);
  const [brandSaved, setBrandSaved] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const TEMPLATES_PER_PAGE = 12;
  const CATALOG_PER_PAGE = 16;

  const filteredTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    return ALGERIAN_TEMPLATES_200.filter((t) => {
      const catMatch = templateFilter === 'all' || t.category === templateFilter;
      const tierMatch =
        templateTierFilter === 'all' ||
        (templateTierFilter === 'free' ? !t.isPro : Boolean(t.isPro));
      const queryMatch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.wilaya && t.wilaya.toLowerCase().includes(q)) ||
        (t.facadeLabel && t.facadeLabel.toLowerCase().includes(q));
      return catMatch && tierMatch && queryMatch;
    });
  }, [templateFilter, templateTierFilter, templateSearch]);

  const totalTemplatePages = Math.max(1, Math.ceil(filteredTemplates.length / TEMPLATES_PER_PAGE));
  const safeTemplatePage = Math.min(templatePage, totalTemplatePages);
  const pagedTemplates = useMemo(() => {
    const start = (safeTemplatePage - 1) * TEMPLATES_PER_PAGE;
    return filteredTemplates.slice(start, start + TEMPLATES_PER_PAGE);
  }, [filteredTemplates, safeTemplatePage]);

  const handleSelectTemplateCard = (tpl: StarterTemplate) => {
    if (tpl.isPro && !isUserProActive) {
      setLockedTemplateModal(tpl);
      return;
    }
    onOpenTemplate(tpl);
  };

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    return FURNITURE_CATALOG.filter((item) => {
      const catMatch = catalogFilter === 'all' || item.category === catalogFilter;
      const searchMatch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.styleTag && item.styleTag.toLowerCase().includes(q));
      return catMatch && searchMatch;
    });
  }, [catalogFilter, catalogSearch]);

  const totalCatalogPages = Math.max(1, Math.ceil(filteredCatalog.length / CATALOG_PER_PAGE));
  const safeCatalogPage = Math.min(catalogPage, totalCatalogPages);
  const visibleCatalog = useMemo(() => {
    const start = (safeCatalogPage - 1) * CATALOG_PER_PAGE;
    return filteredCatalog.slice(start, start + CATALOG_PER_PAGE);
  }, [filteredCatalog, safeCatalogPage]);

  const handleDeviceImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportingFile(true);
    setImportNotice(null);
    try {
      const importedList = await parseImportedProjectFile(file);
      await onImportProjects(importedList, openImportedDirectly);
      setImportNotice({
        kind: 'ok',
        text:
          importedList.length === 1
            ? `تم استيراد مشروع «${importedList[0].title}» بنجاح وحفظه في مكتبتك.`
            : `تم استيراد ${importedList.length} مشاريع من جهازك وحفظها بنجاح.`,
      });
    } catch (err) {
      setImportNotice({
        kind: 'err',
        text: err instanceof Error ? err.message : 'تعذر قراءة ملف المشروع.',
      });
    } finally {
      setImportingFile(false);
    }
  };

  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandDraft.trim()) return;
    await onUpdateBrandName(brandDraft.trim());
    setBrandSaved(true);
    setTimeout(() => setBrandSaved(false), 2400);
  };

  return (
    <div className="min-h-screen bg-[#F7F6F2] dark:bg-[#111315] text-slate-900 dark:text-slate-100">
      {/* Strict 3-Zone Top Bar Contract (Desktop) + Clean Mobile Menu */}
      <header className="border-b border-slate-200/80 dark:border-slate-800 bg-[#F7F6F2]/95 dark:bg-[#111315]/95 sticky top-0 z-30">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-8">
          {/* Zone 1: Official Circular Emblem + Single-line Brand Wordmark */}
          <a
            href="#top"
            className="inline-flex items-center gap-2 sm:gap-2.5 font-display text-sm sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white min-w-0 shrink"
          >
            <img
              src={BRAND_LOGO_URL}
              alt={brandName}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border border-amber-600/40 shrink-0"
            />
            <span className="truncate">{brandName}</span>
          </a>

          {/* Zone 2: 5 Concise Single-Line Nav Links */}
          <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a
              href="#templates"
              className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              القوالب
            </a>
            <a
              href="#catalog-showcase"
              className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              الأثاث والأجهزة
            </a>
            <a
              href="#projects"
              className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              مشاريعي
            </a>
            <a
              href="#cost-calculator"
              className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              حاسبة التكاليف
            </a>
            <button
              type="button"
              onClick={() => setShowProSubscribeModal(true)}
              className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              اشتراك برو
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action + Mobile Menu Trigger */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenNewBlank}
              className="px-3 sm:px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 min-h-[38px]"
            >
              افتح المصمم
            </button>
            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label="قائمة التنقل"
              className="md:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 min-h-[38px] min-w-[38px] flex items-center justify-center"
            >
              {mobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer Navigation */}
        {mobileNavOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] px-4 py-3 space-y-1 text-sm font-medium">
            <a
              href="#templates"
              onClick={() => setMobileNavOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              القوالب الجزائرية ({TEMPLATE_STATS.total})
            </a>
            <a
              href="#catalog-showcase"
              onClick={() => setMobileNavOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              مكتبة الأثاث والأجهزة ({FURNITURE_CATALOG.length})
            </a>
            <a
              href="#projects"
              onClick={() => setMobileNavOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              مشاريعي المحفوظة ({projects.length})
            </a>
            <a
              href="#cost-calculator"
              onClick={() => setMobileNavOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              حاسبة أسعار مواد البناء والدهن
            </a>
            <button
              type="button"
              onClick={() => {
                setMobileNavOpen(false);
                onOpenSketchModal();
              }}
              className="w-full text-right rounded-lg px-3 py-2.5 text-blue-700 dark:text-blue-400 font-semibold hover:bg-blue-50 dark:hover:bg-blue-950/30 flex items-center gap-2"
            >
              <ImagePlus className="w-4 h-4 shrink-0" />
              <span>تصميم من ورقة مرسومة (برو)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileNavOpen(false);
                setShowProSubscribeModal(true);
              }}
              className="w-full text-right rounded-lg px-3 py-2.5 text-amber-700 dark:text-amber-400 font-semibold hover:bg-amber-50 dark:hover:bg-amber-950/30"
            >
              الاشتراك في باقة برو (Pro)
            </button>
            <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onToggleTheme}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 py-2 text-xs font-semibold"
              >
                {isDarkTheme ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                <span>{isDarkTheme ? 'الوضع الفاتح' : 'الوضع الداكن'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileNavOpen(false);
                  onSignOut();
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 py-2 text-xs font-semibold text-red-600 dark:text-red-400"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>
        )}
      </header>

      <main id="top" className="max-w-[1200px] mx-auto px-4 sm:px-6">
        {/* Free 1-Month Promo or Temporary Public Preview & Pro Upgrade Alert Banner */}
        {isFreePromoMonthActive() ? (
          <div className="mt-6 rounded-xl border border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/90 dark:bg-emerald-950/35 px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-sm font-bold text-emerald-900 dark:text-emerald-300">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  عرض خاص: التطبيق مجاني بالكامل لمدة شهر (متبقي {getFreePromoDaysRemaining()} يوماً حتى 16 ديسمبر 2026)
                </span>
              </div>
              <p className="text-xs text-emerald-900/85 dark:text-emerald-200/85 leading-relaxed">
                جميع التصاميم الـ 200، مشاريع غير محدودة، التصميم من ورقة مرسومة، ومعاينة الكاميرا 2D في الفضاء الحقيقي مفتوحة مجاناً للجميع طوال فترة العرض.
              </p>
            </div>
            {isGuestSession && (
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={onSignOut}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/70 dark:border-emerald-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>دخول بحساب مشترك أو مدير</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          isGuestSession && (
            <div className="mt-6 rounded-xl border border-amber-300 dark:border-amber-800/80 bg-amber-50/90 dark:bg-amber-950/35 px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-300">
                  <Crown className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    الدخول المؤقت والمعاينة للعامة —{' '}
                    {guestDesignsUsed >= 1 || projects.length >= 1
                      ? 'تم استهلاك التصميم الوحيد المتاح (1 / 1)'
                      : 'متاح لك إنشاء تصميم واحد مجاني للتجربة'}
                  </span>
                </div>
                <p className="text-xs text-amber-900/85 dark:text-amber-200/85 leading-relaxed">
                  للاستمرار في إنشاء تصاميم جديدة غير محدودة، فتح جميع التصاميم الجزائرية الـ 200، والحصول على اسم مستخدم ورقم سري دائم، يرجى الاشتراك في <strong>نسخة برو</strong> (1,000 د.ج شهرياً).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowProSubscribeModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 px-4 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap"
                >
                  <Crown className="w-3.5 h-3.5" />
                  <span>اشترك في نسخة برو</span>
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/70 dark:border-amber-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>تسجيل الدخول بحساب مشترك</span>
                </button>
              </div>
            </div>
          )
        )}

        {/* Hero 2-Column Split */}
        <section className="pt-12 pb-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-5 flex flex-col justify-between py-2">
              <div className="space-y-5">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  استوديو التصميم المعماري ثنائي وثلاثي الأبعاد · {brandName}
                </p>
                <h1 className="font-display font-bold text-[clamp(2.1rem,3.6vw,3.1rem)] leading-[1.2] text-slate-900 dark:text-white [text-wrap:balance]">
                  صمّم مخطط منزلك الهندسي واستعرضه بالبعد الثلاثي فوراً
                </h1>
                <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300 max-w-xl">
                  ارسم الغرف والجدران بدقة المتر، أضف الأبواب والنوافذ، ورتّب الأثاث والخامات ثم انتقل بضغطة واحدة إلى جولة ثلاثية الأبعاد واقعية داخل مشروعك.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onOpenNewBlank}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>ابدأ مشروعاً جديداً</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenSketchModal}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-400 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 px-4 py-3 text-sm font-semibold text-amber-900 dark:text-amber-300 transition-colors whitespace-nowrap shrink-0"
                >
                  <ImagePlus className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>تصميم من ورقة مرسومة</span>
                  {!isUserProActive ? (
                    <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  )}
                </button>
                <a
                  href="#templates"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>تصفح القوالب الجاهزة</span>
                  <ArrowLeft className="w-4 h-4" />
                </a>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="h-full min-h-[320px] lg:min-h-[420px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 relative">
                <ImageWithFallback
                  src={TEMPLATE_IMAGES.heroModernVilla}
                  alt="تصميم فيلا حديثة بإضاءة طبيعية وإطلالة على الحديقة"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-6">
                  <p className="text-xs font-medium text-white/90">
                    معاينة معمارية مباشرة · انتقال فوري بين المخطط الهندسي والعرض ثلاثي الأبعاد
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 4-Column Studio Facts Strip */}
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 border-y border-slate-200 dark:border-slate-800 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-slate-200 dark:divide-slate-800">
            <div className="py-5 px-4">
              <div className="text-2xl font-bold font-mono-nums text-slate-900 dark:text-white">
                2D / 3D
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                تزامن فوري ومقسم للشاشة
              </div>
            </div>
            <div className="py-5 px-4">
              <div className="text-2xl font-bold font-mono-nums text-slate-900 dark:text-white">
                {FURNITURE_CATALOG.length}+
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                قطعة أثاث وجهاز منزلي 3D
              </div>
            </div>
            <div className="py-5 px-4">
              <div className="text-2xl font-bold font-mono-nums text-slate-900 dark:text-white">
                0.25 m
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                دقة المحاذاة الهندسية وحاسبة المساحات
              </div>
            </div>
            <div className="py-5 px-4">
              <div className="text-2xl font-bold font-mono-nums text-slate-900 dark:text-white">
                {TEMPLATE_STATS.total} تصميم
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                بناءات جزائرية ({TEMPLATE_STATS.freeCount} مجاني · {TEMPLATE_STATS.proCount} برو)
              </div>
            </div>
          </div>
        </section>

        {/* 200 Editable Algerian Building Designs (10% Free / 90% Pro) */}
        <section id="templates" className="py-12">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                مكتبة التصاميم الجزائرية القابلة للتعديل ({TEMPLATE_STATS.total} تصميماً)
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {TEMPLATE_STATS.freeCount} تصميماً مجانياً (10%)
                </span>{' '}
                متاحاً للتعديل الفوري، و{' '}
                <span className="font-semibold text-amber-700 dark:text-amber-400">
                  {TEMPLATE_STATS.proCount} تصميماً حصرياً باشتراك برو (90%)
                </span>{' '}
                بسعر 1,000 د.ج شهرياً فقط.
              </p>
            </div>

            <div className="relative w-full lg:w-72 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={templateSearch}
                onChange={(e) => {
                  setTemplateSearch(e.target.value);
                  setTemplatePage(1);
                }}
                placeholder="ابحث بالولاية أو النوع (وهران، F4، وسط الدار...)"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#181B20] pr-9 pl-3 py-2 text-xs text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Filter Bar: Categories + Free/Pro Access Tier */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-7">
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg max-w-full overflow-x-auto no-scrollbar sm:flex-wrap self-start">
              {(
                [
                  { id: 'all', label: `الكل (${TEMPLATE_STATS.total})` },
                  { id: 'apartments', label: 'شقق سكنية (60)' },
                  { id: 'villas', label: 'فيلات ومنازل (60)' },
                  { id: 'duplex', label: 'دوبلكس (40)' },
                  { id: 'studios', label: 'استوديو وشاليه (40)' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setTemplateFilter(tab.id);
                    setTemplatePage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    templateFilter === tab.id
                      ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg max-w-full overflow-x-auto no-scrollbar self-start">
              {(
                [
                  { id: 'all', label: 'كل الباقات' },
                  { id: 'free', label: `مجاني 10% (${TEMPLATE_STATS.freeCount})` },
                  { id: 'pro', label: `برو 90% (${TEMPLATE_STATS.proCount})` },
                ] as const
              ).map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => {
                    setTemplateTierFilter(tier.id);
                    setTemplatePage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    templateTierFilter === tier.id
                      ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tier.label}
                </button>
              ))}
            </div>
          </div>

          {pagedTemplates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-sm text-slate-500">
              لا توجد تصاميم مطابقة للبحث الحالي. جرّب تغيير الولاية أو نوع البناء.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {pagedTemplates.map((tpl) => {
                  const locked = Boolean(tpl.isPro && !isUserProActive);
                  return (
                    <article
                      key={tpl.key}
                      className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] overflow-hidden flex flex-col"
                    >
                      <div className="aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-slate-900 relative border-b border-slate-100 dark:border-slate-800">
                        {tpl.imageUrl ? (
                          <ImageWithFallback
                            src={tpl.imageUrl}
                            alt={tpl.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <TemplateBlueprintPreview
                            floorPlan={tpl.floorPlan}
                            className="transition-transform duration-300 group-hover:scale-[1.02]"
                          />
                        )}

                        <div
                          className={`absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold shadow-sm ${
                            !tpl.isPro
                              ? 'bg-emerald-600 text-white'
                              : isUserProActive
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-900/90 text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          {!tpl.isPro ? (
                            <span>مجاني</span>
                          ) : isUserProActive ? (
                            <>
                              <Crown className="w-3 h-3" />
                              <span>برو مفعّل</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3" />
                              <span>برو · 1,000 د.ج/شهر</span>
                            </>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuickPreview({
                              title: tpl.title,
                              subtitle: `${tpl.categoryLabel} · ${tpl.areaSqm} م² · ${tpl.roomsCount} غرف`,
                              floorPlan: tpl.floorPlan,
                              template: tpl,
                            });
                          }}
                          title="معاينة سريعة للمخطط 2D"
                          className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-md bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[11px] font-semibold text-slate-800 dark:text-slate-100 hover:bg-blue-600 hover:text-white hover:border-blue-600 shadow-sm transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          <span>معاينة 2D</span>
                        </button>
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between gap-3.5">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono-nums mb-1">
                            <span>{tpl.categoryLabel}</span>
                            <span aria-hidden="true">·</span>
                            <span>{tpl.areaSqm} م²</span>
                            <span aria-hidden="true">·</span>
                            <span>{tpl.roomsCount} غرف</span>
                            {tpl.facadeLabel && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{tpl.facadeLabel}</span>
                              </>
                            )}
                          </div>
                          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white leading-snug">
                            {tpl.title}
                          </h3>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed line-clamp-2">
                            {tpl.description}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectTemplateCard(tpl)}
                            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition-colors ${
                              locked
                                ? 'border-amber-300 dark:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 hover:bg-amber-600 hover:text-white hover:border-amber-600'
                                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-blue-600 hover:text-white hover:border-blue-600 dark:hover:bg-blue-600 dark:hover:border-blue-600'
                            }`}
                          >
                            {locked ? (
                              <>
                                <Lock className="w-3.5 h-3.5" />
                                <span>فتح باشتراك برو</span>
                              </>
                            ) : (
                              <span>فتح وتعديل 2D/3D</span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setQuickPreview({
                                title: tpl.title,
                                subtitle: `${tpl.categoryLabel} · ${tpl.areaSqm} م² · ${tpl.roomsCount} غرف`,
                                floorPlan: tpl.floorPlan,
                                template: tpl,
                              })
                            }
                            title="معاينة سريعة"
                            aria-label={`معاينة سريعة ${tpl.title}`}
                            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Clean Pagination Controls */}
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-800 pt-5">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-nums">
                  عرض {(safeTemplatePage - 1) * TEMPLATES_PER_PAGE + 1} –{' '}
                  {Math.min(safeTemplatePage * TEMPLATES_PER_PAGE, filteredTemplates.length)} من أصل{' '}
                  {filteredTemplates.length} تصميم
                </div>

                {totalTemplatePages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={safeTemplatePage <= 1}
                      onClick={() => setTemplatePage((p) => Math.max(1, p - 1))}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#181B20] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                      <span>السابق</span>
                    </button>

                    <span className="px-3 text-xs font-mono-nums font-semibold text-slate-700 dark:text-slate-200">
                      صفحة {safeTemplatePage} / {totalTemplatePages}
                    </span>

                    <button
                      type="button"
                      disabled={safeTemplatePage >= totalTemplatePages}
                      onClick={() => setTemplatePage((p) => Math.min(totalTemplatePages, p + 1))}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#181B20] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
                    >
                      <span>التالي</span>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {/* Full Luxury Algerian Furniture & Home Appliances Catalog Showcase (560+ items) */}
        <section id="catalog-showcase" className="py-12 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                مكتبة تصاميم الأثاث والأجهزة المنزلية ({FURNITURE_CATALOG.length} تصميماً)
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                تضم نماذج جزائرية فاخرة (قسنطيني، عاصمي، وهراني، تلمساني، قبائلي، صحراوي) وأجهزة كهرومنزلية حديثة بأبعاد 2D/3D وسعر تقديري اختياري لكل عنصر.
              </p>
            </div>

            <div className="relative w-full lg:w-72 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => {
                  setCatalogSearch(e.target.value);
                  setCatalogPage(1);
                }}
                placeholder="ابحث (سدّاري قسنطيني، مكيف 18000، رخام...)"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#181B20] pr-9 pl-3 py-2 text-xs text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 mb-6 overflow-x-auto no-scrollbar pb-1 md:flex-wrap">
            {FURNITURE_CATEGORIES.map((cat) => {
              const count =
                cat.id === 'all'
                  ? FURNITURE_CATALOG.length
                  : FURNITURE_CATALOG.filter((i) => i.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setCatalogFilter(cat.id);
                    setCatalogPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                    catalogFilter === cat.id
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {cat.label} ({count})
                </button>
              );
            })}
          </div>

          {visibleCatalog.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500">
              لا توجد نتائج مطابقة لبحثك. جرّب كلمة أخرى أو اختر فئة مختلفة.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {visibleCatalog.map((item) => {
                  const catLabel =
                    FURNITURE_CATEGORIES.find((c) => c.id === item.category)?.label || item.category;
                  return (
                    <div
                      key={item.catalogId}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                            {item.styleTag ? `${catLabel} · ${item.styleTag}` : catLabel}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span
                              className="w-3.5 h-3.5 rounded border border-black/10"
                              style={{ backgroundColor: item.defaultPrimary }}
                              title="اللون الأساسي"
                            />
                            <span
                              className="w-3.5 h-3.5 rounded border border-black/10"
                              style={{ backgroundColor: item.defaultAccent }}
                              title="لون التفاصيل"
                            />
                          </div>
                        </div>
                        <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white leading-snug">
                          {item.name}
                        </h3>
                        <div className="flex items-center justify-between gap-2 text-[11px] font-mono-nums">
                          <span className="text-slate-500 dark:text-slate-400">
                            {item.width.toFixed(2)} × {item.depth.toFixed(2)} × {item.height.toFixed(2)} m
                          </span>
                          {typeof item.defaultPriceDzd === 'number' && (
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">
                              {formatDzd(item.defaultPriceDzd)}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onOpenWithCatalogItem(item)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-blue-600 hover:text-white hover:border-blue-600 dark:hover:bg-blue-600 dark:hover:border-blue-600 py-2 text-xs font-semibold transition-colors"
                      >
                        إضافة لمشروع جديد
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Catalog Pagination Bar */}
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-800 pt-5">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-nums">
                  عرض {(safeCatalogPage - 1) * CATALOG_PER_PAGE + 1} –{' '}
                  {Math.min(safeCatalogPage * CATALOG_PER_PAGE, filteredCatalog.length)} من أصل{' '}
                  {filteredCatalog.length} تصميماً (السعر اختياري وقابل للتعديل داخل الاستوديو)
                </div>

                {totalCatalogPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={safeCatalogPage <= 1}
                      onClick={() => setCatalogPage((p) => Math.max(1, p - 1))}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#181B20] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                      <span>السابق</span>
                    </button>

                    <span className="px-3 text-xs font-mono-nums font-semibold text-slate-700 dark:text-slate-200">
                      صفحة {safeCatalogPage} / {totalCatalogPages}
                    </span>

                    <button
                      type="button"
                      disabled={safeCatalogPage >= totalCatalogPages}
                      onClick={() => setCatalogPage((p) => Math.min(totalCatalogPages, p + 1))}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#181B20] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
                    >
                      <span>التالي</span>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {/* User Saved Projects, Cloud Sync & Device Save / Import */}
        <section id="projects" className="py-12 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                مشاريعي المحفوظة والحفظ داخل الجهاز
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                {isFreePromoMonthActive()
                  ? 'الشهر المجاني المفتوح مفعّل: يمكنك إنشاء وحفظ عدد غير محدود من المشاريع والوصول لجميع التصاميم والأدوات مجاناً حتى 16 ديسمبر 2026.'
                  : isGuestSession
                    ? 'أنت تتصفح عبر الدخول المؤقت للعامة (مسموح بإنشاء تصميم واحد فقط). اشترك في نسخة برو للاستفادة من مشاريع غير محدودة.'
                    : `مرحباً ${sessionUser.displayName} (${sessionUser.username}) — ${
                        isUserProActive ? 'باقة برو مفعّلة بالكامل' : 'الخطة المجانية'
                      }. احفظ مشاريعك في المتصفح أو نزّلها داخل جهازك.`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
              {isAdminAuthorized && (
                <button
                  type="button"
                  onClick={onOpenAdminPanel}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/30 px-3.5 py-2 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors whitespace-nowrap shrink-0"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>لوحة الإدارة (إدارة المشتركين)</span>
                </button>
              )}
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>تسجيل الخروج</span>
              </button>
              <button
                type="button"
                onClick={onOpenSketchModal}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 px-3.5 py-2 text-xs font-semibold text-amber-800 dark:text-amber-300 transition-colors whitespace-nowrap shrink-0"
              >
                <ImagePlus className="w-3.5 h-3.5" />
                <span>من ورقة مرسومة (برو)</span>
              </button>
              <button
                type="button"
                onClick={onOpenNewBlank}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>مشروع جديد</span>
              </button>
            </div>
          </div>

          {/* Dedicated Device Save & Import Bar */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] p-4 sm:p-5 mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <HardDriveDownload className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  حفظ المشروع داخل جهاز المستخدم واستيراده (.json)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  نزّل أي مشروع على هاتفك أو حاسوبك للاحتفاظ بنسخة خاصة أو مشاركتها، وأعد استيرادها للتعديل في أي وقت.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <input
                ref={deviceImportInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleDeviceImportChange}
                className="hidden"
              />
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={openImportedDirectly}
                  onChange={(e) => setOpenImportedDirectly(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>فتح مباشرة بعد الاستيراد</span>
              </label>
              <button
                type="button"
                disabled={importingFile}
                onClick={() => deviceImportInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 px-3.5 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{importingFile ? 'جارٍ الاستيراد...' : 'استيراد من الجهاز'}</span>
              </button>
              {projects.length > 0 && (
                <button
                  type="button"
                  onClick={() => downloadAllProjectsBackup(projects, brandName)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>حفظ كل المشاريع بالجهاز ({projects.length})</span>
                </button>
              )}
            </div>
          </div>

          {importNotice && (
            <div
              className={`mb-5 rounded-lg border px-4 py-2.5 text-xs font-medium flex items-center justify-between ${
                importNotice.kind === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                  : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300'
              }`}
            >
              <span>{importNotice.text}</span>
              <button
                type="button"
                onClick={() => setImportNotice(null)}
                className="text-current opacity-60 hover:opacity-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {loadingProjects ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] p-10 text-center text-sm text-slate-500">
              جارٍ تحميل مشاريعك المحفوظة...
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-[#181B20]/70 p-10 text-center space-y-3">
              <FolderOpen className="w-8 h-8 mx-auto text-slate-400" />
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                لا توجد مشاريع محفوظة بعد
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                ابدأ بتصميم مخطط جديد، أو استورد ملف مشروع محفوظاً من جهازك (.json) بالأعلى.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {projects.map((proj) => (
                <div
                  key={proj.id}
                  className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] overflow-hidden flex flex-col justify-between"
                >
                  {/* Live 2D Blueprint Thumbnail */}
                  <button
                    type="button"
                    onClick={() =>
                      setQuickPreview({
                        title: proj.title,
                        subtitle: `${proj.roomCount} غرف · ${proj.totalAreaSqm} م² · ${
                          proj.floorPlanData?.furniture?.length || 0
                        } قطعة أثاث`,
                        floorPlan: proj.floorPlanData,
                        project: proj,
                      })
                    }
                    className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-right focus:outline-none"
                    title="اضغط للمعاينة السريعة للمخطط ثنائي الأبعاد"
                  >
                    <TemplateBlueprintPreview
                      floorPlan={proj.floorPlanData}
                      className="transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                    <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-md bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-100 shadow-sm group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-colors">
                      <Eye className="w-3 h-3" />
                      <span>معاينة سريعة</span>
                    </span>
                  </button>

                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono-nums mb-1">
                        <span>{proj.roomCount} غرف</span>
                        <span aria-hidden="true">·</span>
                        <span>{proj.totalAreaSqm} م²</span>
                        {proj.floorPlanData?.furniture?.length ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{proj.floorPlanData.furniture.length} أثاث</span>
                          </>
                        ) : null}
                      </div>
                      <h3 className="font-display text-base font-bold text-slate-900 dark:text-white truncate">
                        {proj.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => onOpenProject(proj)}
                        className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 py-2 text-xs font-semibold text-white transition-colors"
                      >
                        متابعة التصميم
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setQuickPreview({
                            title: proj.title,
                            subtitle: `${proj.roomCount} غرف · ${proj.totalAreaSqm} م² · ${
                              proj.floorPlanData?.furniture?.length || 0
                            } قطعة أثاث`,
                            floorPlan: proj.floorPlanData,
                            project: proj,
                          })
                        }
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                        title="معاينة سريعة للمخطط ثنائي الأبعاد"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          downloadProjectToDevice({
                            title: proj.title,
                            brandName,
                            templateKey: proj.templateKey,
                            floorPlanData: proj.floorPlanData,
                          })
                        }
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                        title="حفظ في جهاز المستخدم (.json)"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDuplicateProject(proj)}
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                        title="نسخ المشروع"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteProject(proj.id)}
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        title="حذف المشروع"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Capabilities Asymmetric Bento */}
        <section id="capabilities" className="py-12 border-t border-slate-200 dark:border-slate-800">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-8">
            مزايا وإمكانات استوديو {brandName}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] p-6 space-y-2">
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                01. الرسم الهندسي الدقيق ثنائي الأبعاد (2D CAD)
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                ارسم الغرف والجدران بحرية مع محاذاة تلقائية للشبكة بدقة 0.25 متر، وسحب مباشر للأبواب والنوافذ والأقواس مع إظهار اتجاهات الفتح والقياسات الهندسية الحية.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] p-6 space-y-2">
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                02. حاسبة المساحات الحية
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                حساب فوري لمساحة كل غرفة، المساحة الإجمالية (م² / ft²)، المحيط، أطوال الجدران وصافي مساحة الطلاء وكميات كل خامة أرضية.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] p-6 space-y-2">
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                03. تجول ثلاثي الأبعاد فوري
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                معاينة حية بإضاءة نهارية وغروبية وليلية مع وضع المشي الداخلي (WASD) والتقاط صور عالية الدقة من داخل الغرف.
              </p>
            </div>
            <div className="md:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] p-6 space-y-2">
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                04. مكتبة {FURNITURE_CATALOG.length}+ قطعة أثاث وأجهزة منزلية ذكية
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                تجهيز كامل لغرف المعيشة والنوم والمطبخ والحمام بالإضافة إلى الأجهزة المنزلية (غسالات، مكيفات، ثلاجات، شاشات، روبوت تنظيف) مع تغيير الأبعاد والألوان والباركيه والرخام.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] p-6 space-y-2">
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                05. شاشة مقسمة وتصدير كامل
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                وضع (2D + 3D) لمشاهدة كل جدار وقطعة أثاث تتشكل ثلاثياً أثناء تحريكها، مع تصدير المخططات بصيغة JSON.
              </p>
            </div>
            <div className="md:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] p-6 space-y-2">
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                06. حفظ محلي مباشر واشتراك برو
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                احفظ مشاريعك مباشرة داخل جهازك بصيغة JSON واستفد من باقة برو عبر بريدي موب أو فليكسي (+10%) مع تأكيد فوري عبر الواتساب أو الفيسبوك والحصول على اسم مستخدم ورقم سري مباشر.
              </p>
            </div>
          </div>
        </section>

        {/* Live Algerian Construction, Paint & Labor Cost Calculator */}
        <AlgeriaCostCalculator onStartPlanFromEstimate={() => onOpenNewBlank()} />

        {/* Pro Subscription (BaridiMob & Flexy +10%) */}
        <ProSubscriptionSection
          brandName={brandName}
          isAdmin={isAdminAuthorized}
          isSignedIn={true}
          facebookUrl={facebookUrl}
          orders={proOrders}
          onSaveFacebookUrl={onSaveFacebookUrl}
          onSubmitOrder={onSubmitProOrder}
          onUpdateOrderStatus={onUpdateProOrderStatus}
          onOpenSubscribeModal={() => setShowProSubscribeModal(true)}
        />

        {/* Studio Personalization & Appearance Settings */}
        <section id="brand" className="py-12 border-t border-slate-200 dark:border-slate-800">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#181B20] p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4 max-w-xl">
              <img
                src={BRAND_LOGO_URL}
                alt={brandName}
                className="w-20 h-20 rounded-full object-cover border-2 border-amber-600/40 shrink-0"
              />
              <div className="space-y-1.5">
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  هوية المنصة والمظهر العام
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  شعار {brandName} الرسمي المعتمد — يمكنك تعديل اسم استوديو التصميم أو التبديل بين الوضع الفاتح والداكن.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveBrand} className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={brandDraft}
                onChange={(e) => setBrandDraft(e.target.value)}
                maxLength={60}
                placeholder="مثال: بشير 5D"
                className="w-56 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
              >
                {brandSaved && <Check className="w-3.5 h-3.5" />}
                <span>{brandSaved ? 'تم التحديث' : 'اعتماد الاسم'}</span>
              </button>
              <button
                type="button"
                onClick={onToggleTheme}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                {isDarkTheme ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                <span>{isDarkTheme ? 'الوضع الفاتح' : 'الوضع الداكن'}</span>
              </button>
            </form>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-8 mt-6">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="inline-flex items-center gap-2 font-display font-bold text-sm text-slate-800 dark:text-slate-200">
            <img
              src={BRAND_LOGO_URL}
              alt={brandName}
              className="w-7 h-7 rounded-full object-cover border border-amber-600/40 shrink-0"
            />
            <span>{brandName}</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-5">
            <a href="#templates" className="hover:text-slate-900 dark:hover:text-white">
              التصاميم (200)
            </a>
            <a href="#catalog-showcase" className="hover:text-slate-900 dark:hover:text-white">
              الأثاث والأجهزة
            </a>
            <a href="#projects" className="hover:text-slate-900 dark:hover:text-white">
              مشاريعي
            </a>
            <a href="#capabilities" className="hover:text-slate-900 dark:hover:text-white">
              المزايا
            </a>
            <a href="#cost-calculator" className="hover:text-slate-900 dark:hover:text-white">
              حاسبة التكاليف
            </a>
            <button
              type="button"
              onClick={() => setShowProSubscribeModal(true)}
              className="hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              اشتراك برو
            </button>
            {isAdminAuthorized && (
              <button
                type="button"
                onClick={onOpenAdminPanel}
                className="hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                لوحة الإدارة
              </button>
            )}
            <a href="#brand" className="hover:text-slate-900 dark:hover:text-white">
              الهوية
            </a>
          </div>
          <div>© {new Date().getFullYear()} {brandName} · منصة التصميم المعماري</div>
        </div>
      </footer>

      {/* Pro Upgrade Gate Modal when clicking one of the 180 Pro designs */}
      {lockedTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#181B20] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="inline-flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <Crown className="w-4 h-4 text-amber-500" />
                <span>تصميم حصري لمشتركي باقة برو (Pro)</span>
              </div>
              <button
                type="button"
                onClick={() => setLockedTemplateModal(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="h-44 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                <TemplateBlueprintPreview floorPlan={lockedTemplateModal.floorPlan} />
              </div>

              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-nums">
                  {lockedTemplateModal.categoryLabel} · {lockedTemplateModal.areaSqm} م² ·{' '}
                  {lockedTemplateModal.roomsCount} غرف
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  {lockedTemplateModal.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                  هذا التصميم الجزائري ضمن مكتبة الـ <strong>180 تصميماً (90%)</strong> المخصصة لمشتركي باقة برو. يمكنك فتح وتعديل جميع التصاميم الـ 200 فوراً مقابل{' '}
                  <strong>1,000 د.ج شهرياً</strong> عبر بريدي موب (أو <strong>1,100 د.ج</strong> عبر فليكسي +10%).
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setLockedTemplateModal(null);
                    setShowProSubscribeModal(true);
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white transition-colors text-center"
                >
                  <Crown className="w-3.5 h-3.5" />
                  <span>اشترك في برو (1,000 د.ج/شهر)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTemplateTierFilter('free');
                    setTemplatePage(1);
                    setLockedTemplateModal(null);
                  }}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  تصفح الـ 20 تصميماً المجاني (10%)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick 2D Floor Plan Preview Modal */}
      {quickPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-2.5 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-preview-title"
          onClick={() => setQuickPreview(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[92dvh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#181B20] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400">
                  <Eye className="w-3.5 h-3.5 shrink-0" />
                  <span>المعاينة السريعة للمخطط ثنائي الأبعاد (2D)</span>
                </div>
                <h3
                  id="quick-preview-title"
                  className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate mt-0.5"
                >
                  {quickPreview.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-nums">
                  {quickPreview.subtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickPreview(null)}
                aria-label="إغلاق المعاينة السريعة"
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 studio-scroll">
              <div className="aspect-[16/10] w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                <TemplateBlueprintPreview
                  floorPlan={quickPreview.floorPlan}
                  showRoomLabels={true}
                />
              </div>

              {/* Compact Blueprint Specs & Rooms List */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-3.5 py-2.5">
                  <div className="text-slate-500 dark:text-slate-400">الغرف</div>
                  <div className="font-mono-nums text-base font-bold text-slate-900 dark:text-white">
                    {quickPreview.floorPlan.rooms.length}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-3.5 py-2.5">
                  <div className="text-slate-500 dark:text-slate-400">الجدران</div>
                  <div className="font-mono-nums text-base font-bold text-slate-900 dark:text-white">
                    {quickPreview.floorPlan.walls.length}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-3.5 py-2.5">
                  <div className="text-slate-500 dark:text-slate-400">الأبواب والنوافذ</div>
                  <div className="font-mono-nums text-base font-bold text-slate-900 dark:text-white">
                    {quickPreview.floorPlan.openings.length}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-3.5 py-2.5">
                  <div className="text-slate-500 dark:text-slate-400">الأثاث والأجهزة</div>
                  <div className="font-mono-nums text-base font-bold text-slate-900 dark:text-white">
                    {quickPreview.floorPlan.furniture.length}
                  </div>
                </div>
              </div>

              {quickPreview.floorPlan.rooms.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    تفاصيل الغرف والأبعاد:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {quickPreview.floorPlan.rooms.map((room) => (
                      <div
                        key={room.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs"
                      >
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {room.name}
                        </span>
                        <span className="font-mono-nums text-slate-500 dark:text-slate-400 shrink-0">
                          {room.width.toFixed(1)}×{room.depth.toFixed(1)} م ({(room.width * room.depth).toFixed(1)} م²)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0 pb-safe">
              <button
                type="button"
                onClick={() =>
                  downloadProjectToDevice({
                    title: quickPreview.title,
                    brandName,
                    templateKey: quickPreview.project?.templateKey || quickPreview.template?.key,
                    floorPlanData: quickPreview.floorPlan,
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تنزيل (.json)</span>
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuickPreview(null)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  إغلاق
                </button>
                {quickPreview.project && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = quickPreview.project!;
                      setQuickPreview(null);
                      onOpenProject(target);
                    }}
                    className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors"
                  >
                    فتح في مساحة العمل
                  </button>
                )}
                {quickPreview.template && (
                  <button
                    type="button"
                    onClick={() => {
                      const tpl = quickPreview.template!;
                      setQuickPreview(null);
                      handleSelectTemplateCard(tpl);
                    }}
                    className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors"
                  >
                    {quickPreview.template.isPro && !isUserProActive
                      ? 'فتح باشتراك برو'
                      : 'فتح وتعديل'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pro Subscription Instructional Modal */}
      <ProSubscribeModal
        isOpen={showProSubscribeModal}
        brandName={brandName}
        facebookUrl={facebookUrl}
        userEmail={sessionUser.username}
        isSignedIn={true}
        isUserProActive={isUserProActive}
        onClose={() => setShowProSubscribeModal(false)}
        onSubmitOrder={onSubmitProOrder}
      />
    </div>
  );
};
