/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Crown, LogOut, X } from 'lucide-react';
import { AdminPanelModal } from './components/AdminPanelModal';
import { AuthGateScreen } from './components/AuthGateScreen';
import { LandingShowcase } from './components/LandingShowcase';
import { ProSubscribeModal } from './components/ProSubscribeModal';
import { SketchToPlanModal } from './components/SketchToPlanModal';
import { StudioWorkspace } from './components/StudioWorkspace';
import {
  CatalogItemDef,
  StarterTemplate,
  computeFloorPlanMetrics,
  createBlankFloorPlan,
} from './data/catalog';
import {
  FloorPlanData,
  ProSubscriptionOrder,
  ProjectRecord,
  SketchUnderlayConfig,
} from './types/planner';
import {
  ActiveAuthSession,
  GUEST_MAX_DESIGNS,
  SubscriberAccount,
  authenticateUserOrAdmin,
  createGuestSession,
  deleteLocalProject,
  deleteSubscriberOnServer,
  incrementGuestDesignsUsed,
  isFreePromoMonthActive,
  loadActiveSession,
  loadFacebookUrl,
  loadGuestDesignsUsed,
  loadLocalBrandName,
  loadLocalProOrders,
  loadLocalProjects,
  loadSubscribers,
  pushSubscriberToServer,
  sanitizeId,
  saveActiveSession,
  saveFacebookUrl,
  saveLocalBrandName,
  saveLocalProOrder,
  saveLocalProject,
  saveSubscribers,
  setRevokedUsername,
  syncSubscribersFromServer,
  updateLocalProOrderStatus,
} from './utils/authStore';

interface ActiveProjectSession {
  projectId: string;
  isExisting: boolean;
  title: string;
  templateKey?: string;
  plan: FloorPlanData;
  underlay?: SketchUnderlayConfig | null;
}

export default function App() {
  const [authSession, setAuthSession] = useState<ActiveAuthSession | null>(() =>
    loadActiveSession()
  );
  const [guestDesignsUsed, setGuestDesignsUsed] = useState<number>(() =>
    loadGuestDesignsUsed()
  );
  const [guestLimitReason, setGuestLimitReason] = useState<string | null>(null);
  const [showGlobalProModal, setShowGlobalProModal] = useState(false);
  const [showSketchModal, setShowSketchModal] = useState(false);

  const [subscribers, setSubscribers] = useState<SubscriberAccount[]>(() => loadSubscribers());
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  const [brandName, setBrandName] = useState<string>(() => loadLocalBrandName());
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(false);

  const [projects, setProjects] = useState<ProjectRecord[]>(() => loadLocalProjects());
  const [proOrders, setProOrders] = useState<ProSubscriptionOrder[]>(() => loadLocalProOrders());
  const [facebookUrl, setFacebookUrl] = useState<string>(() => loadFacebookUrl());
  const [activeProject, setActiveProject] = useState<ActiveProjectSession | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const freePromoActive = isFreePromoMonthActive();
  const isAdminAuthorized = authSession?.role === 'admin';
  const isGuestSession = authSession?.role === 'guest';
  const hasReachedGuestLimit = Boolean(
    !freePromoActive &&
      isGuestSession &&
      (guestDesignsUsed >= GUEST_MAX_DESIGNS || projects.length >= GUEST_MAX_DESIGNS)
  );

  const matchedSubscriber =
    authSession?.role === 'subscriber'
      ? subscribers.find(
          (s) => s.username.trim().toLowerCase() === authSession.username.trim().toLowerCase()
        )
      : undefined;

  const hasPaidOrAdminPro = Boolean(
    isAdminAuthorized ||
      (matchedSubscriber ? matchedSubscriber.proActive && matchedSubscriber.active : authSession?.proActive)
  );

  const isUserProActive = Boolean(freePromoActive || hasPaidOrAdminPro);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkTheme) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [isDarkTheme]);

  // Keep page <title> aligned with personalized brand name
  useEffect(() => {
    document.title = `${brandName} | من إعداد وتصميم الأستاذ حميدي البشير · 0696380965`;
  }, [brandName]);

  // Sync subscribers from optional Node backend if running (silently skips on static GitHub Pages)
  useEffect(() => {
    void syncSubscribersFromServer().then((synced) => {
      if (synced) setSubscribers(synced);
    });
  }, []);

  const handleLogin = async (
    username: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const res = await authenticateUserOrAdmin(username, password);
    if (res.ok && res.session) {
      setAuthSession(res.session);
      setGuestLimitReason(null);
      if (res.session.role === 'admin') {
        setShowAdminPanel(true);
      }
      return { ok: true };
    }
    return { ok: false, error: res.error };
  };

  const handleGuestLogin = () => {
    const session = createGuestSession();
    setAuthSession(session);
    setGuestLimitReason(null);
  };

  const handleSignOut = () => {
    setActiveProject(null);
    setShowAdminPanel(false);
    setGuestLimitReason(null);
    setShowGlobalProModal(false);
    saveActiveSession(null);
    setAuthSession(null);
  };

  const consumeGuestDesignSlotOrAlert = (reason: string): boolean => {
    if (!isGuestSession || freePromoActive) return true;
    if (hasReachedGuestLimit) {
      setGuestLimitReason(reason);
      return false;
    }
    const nextUsed = incrementGuestDesignsUsed();
    setGuestDesignsUsed(nextUsed);
    return true;
  };

  const handleUpdateBrandName = async (nextName: string) => {
    const cleaned = nextName.trim() || 'داري';
    setBrandName(cleaned);
    saveLocalBrandName(cleaned);
  };

  const handleOpenNewBlank = () => {
    if (
      !consumeGuestDesignSlotOrAlert(
        'انتهت حصة الدخول المؤقت — يُسمح للزائر بإنشاء تصميم واحد فقط للتجربة. اشترك في نسخة برو لإنشاء تصاميم غير محدودة.'
      )
    ) {
      return;
    }
    setActiveProject({
      projectId: sanitizeId(`proj_${Date.now()}`),
      isExisting: false,
      title: 'منزل جديد',
      plan: createBlankFloorPlan(),
    });
  };

  const handleOpenGeneratedPlan = (payload: {
    title: string;
    floorPlan: FloorPlanData;
  }) => {
    if (
      !consumeGuestDesignSlotOrAlert(
        'انتهت حصة الدخول المؤقت — يُسمح للزائر بإنشاء تصميم واحد فقط للتجربة. اشترك في نسخة برو لإنشاء تصاميم غير محدودة.'
      )
    ) {
      return;
    }
    setActiveProject({
      projectId: sanitizeId(`proj_${Date.now()}`),
      isExisting: false,
      title: payload.title,
      plan: structuredClone(payload.floorPlan),
    });
  };

  const handleOpenTemplate = (tpl: StarterTemplate) => {
    if (tpl.isPro && !isUserProActive) {
      setErrorMsg('هذا التصميم متاح حصرياً لمشتركي باقة برو (1,000 د.ج/شهر).');
      return;
    }
    if (
      !consumeGuestDesignSlotOrAlert(
        'تم استهلاك التصميم الوحيد المتاح في وضع المعاينة المؤقتة للعامة. اشترك في نسخة برو لفتح جميع القوالب وإنشاء تصاميم غير محدودة.'
      )
    ) {
      return;
    }
    setActiveProject({
      projectId: sanitizeId(`proj_${Date.now()}`),
      isExisting: false,
      title: tpl.title,
      templateKey: tpl.key,
      plan: structuredClone(tpl.floorPlan),
    });
  };

  const handleOpenWithCatalogItem = (itemDef: CatalogItemDef) => {
    if (
      !consumeGuestDesignSlotOrAlert(
        'تم استهلاك التصميم الوحيد المتاح في الدخول المؤقت. اشترك في نسخة برو لإنشاء مشاريع جديدة بالأثاث والأجهزة.'
      )
    ) {
      return;
    }
    const plan = createBlankFloorPlan();
    plan.furniture.push({
      id: `furn_${Date.now()}`,
      catalogId: itemDef.catalogId,
      type: itemDef.type,
      name: itemDef.name,
      category: itemDef.category,
      x: 0,
      z: 1.15,
      rotation: 0,
      width: itemDef.width,
      depth: itemDef.depth,
      height: itemDef.height,
      primaryColor: itemDef.defaultPrimary,
      accentColor: itemDef.defaultAccent,
      ...(typeof itemDef.defaultPriceDzd === 'number' && itemDef.defaultPriceDzd >= 0
        ? { priceDzd: itemDef.defaultPriceDzd }
        : {}),
    });
    setActiveProject({
      projectId: sanitizeId(`proj_${Date.now()}`),
      isExisting: false,
      title: `تصميم مع ${itemDef.name}`,
      plan,
    });
  };

  const handleOpenProject = (proj: ProjectRecord) => {
    setActiveProject({
      projectId: proj.id,
      isExisting: true,
      title: proj.title,
      templateKey: proj.templateKey,
      plan: structuredClone(proj.floorPlanData),
    });
  };

  const handleSaveActiveProject = async (title: string, plan: FloorPlanData) => {
    if (!activeProject) return;
    if (!freePromoActive && isGuestSession && !activeProject.isExisting && projects.length >= GUEST_MAX_DESIGNS) {
      setGuestLimitReason(
        'يمكن حفظ تصميم واحد فقط في الدخول المؤقت للعامة. اشترك في نسخة برو لحفظ مشاريع غير محدودة.'
      );
      return;
    }
    const metrics = computeFloorPlanMetrics(plan);
    const updatedList = saveLocalProject({
      id: activeProject.projectId,
      ownerId: authSession?.username || 'local',
      title,
      templateKey: activeProject.templateKey,
      floorPlanData: plan,
      roomCount: metrics.roomCount,
      totalAreaSqm: metrics.totalAreaSqm,
    });
    setProjects(updatedList);
    setActiveProject((prev) => (prev ? { ...prev, isExisting: true, title, plan } : null));
  };

  const handleDuplicateProject = async (proj: ProjectRecord) => {
    if (
      !consumeGuestDesignSlotOrAlert(
        'لا يمكن إنشاء نسخة ثانية في وضع الدخول المؤقت للعامة (تصميم واحد فقط). يرجى الاشتراك في نسخة برو.'
      )
    ) {
      return;
    }
    const newId = sanitizeId(`proj_${Date.now()}`);
    const next = saveLocalProject({
      ...proj,
      id: newId,
      title: `${proj.title} (نسخة)`,
    });
    setProjects(next);
  };

  const handleDeleteProject = async (projectId: string) => {
    setProjects(deleteLocalProject(projectId));
  };

  const handleImportProjects = async (
    importedList: { title: string; templateKey?: string; floorPlanData: FloorPlanData }[],
    openFirst = false
  ) => {
    if (importedList.length === 0) return;
    if (
      !freePromoActive &&
      isGuestSession &&
      (hasReachedGuestLimit || importedList.length > GUEST_MAX_DESIGNS)
    ) {
      setGuestLimitReason(
        'وضع الدخول المؤقت يسمح بتصميم واحد فقط. اشترك في نسخة برو لاستيراد وحفظ عدة مشاريع.'
      );
      return;
    }
    if (isGuestSession && !freePromoActive) {
      incrementGuestDesignsUsed();
      setGuestDesignsUsed(loadGuestDesignsUsed());
    }

    let firstProjectRecord: ProjectRecord | null = null;

    for (let i = 0; i < importedList.length; i += 1) {
      const entry = importedList[i];
      const newId = sanitizeId(`proj_${Date.now()}_${i}`);
      const metrics = computeFloorPlanMetrics(entry.floorPlanData);
      const record: ProjectRecord = {
        id: newId,
        ownerId: authSession?.username || 'local',
        title: entry.title,
        templateKey: entry.templateKey,
        floorPlanData: entry.floorPlanData,
        roomCount: metrics.roomCount,
        totalAreaSqm: metrics.totalAreaSqm,
      };
      const updated = saveLocalProject(record);
      setProjects(updated);
      if (i === 0) {
        firstProjectRecord = record;
      }
    }

    if (openFirst && firstProjectRecord) {
      handleOpenProject(firstProjectRecord);
    }
  };

  const handleSaveFacebookUrl = (url: string) => {
    saveFacebookUrl(url);
    setFacebookUrl(loadFacebookUrl());
  };

  const handleSubmitProOrder = async (
    order: Omit<ProSubscriptionOrder, 'id' | 'ownerId' | 'status' | 'createdAtMs'>
  ) => {
    const localOrder: ProSubscriptionOrder = {
      ...order,
      id: sanitizeId(`pro_${Date.now()}`),
      ownerId: authSession?.username || 'visitor',
      status: 'pending',
      createdAtMs: Date.now(),
    };
    setProOrders(saveLocalProOrder(localOrder));
  };

  const handleUpdateProOrderStatus = async (orderId: string, status: 'approved' | 'rejected') => {
    if (!isAdminAuthorized) return;
    setProOrders(updateLocalProOrderStatus(orderId, status));
  };

  const handleCreateSubscriber = async (sub: SubscriberAccount) => {
    if (!isAdminAuthorized) return;
    setRevokedUsername(sub.username, false);
    const filtered = subscribers.filter(
      (s) => s.username.trim().toLowerCase() !== sub.username.trim().toLowerCase()
    );
    setSubscribers(saveSubscribers([sub, ...filtered]));
    await pushSubscriberToServer(sub);
  };

  const handleUpdateSubscriber = async (id: string, patch: Partial<SubscriberAccount>) => {
    if (!isAdminAuthorized) return;
    const next = subscribers.map((s) => (s.id === id ? { ...s, ...patch } : s));
    setSubscribers(saveSubscribers(next));
    const updatedSub = next.find((s) => s.id === id);
    if (updatedSub) {
      setRevokedUsername(updatedSub.username, !updatedSub.active);
      await pushSubscriberToServer(updatedSub);
    }
  };

  const handleDeleteSubscriber = async (id: string, username: string) => {
    if (!isAdminAuthorized) return;
    setRevokedUsername(username, true);
    setSubscribers(saveSubscribers(subscribers.filter((s) => s.id !== id)));
    await deleteSubscriberOnServer(id);
  };

  const handleImportSubscribers = async (imported: SubscriberAccount[]) => {
    if (!isAdminAuthorized) return;
    const map = new Map<string, SubscriberAccount>();
    for (const s of subscribers) map.set(s.username.trim().toLowerCase(), s);
    for (const s of imported) {
      map.set(s.username.trim().toLowerCase(), s);
      setRevokedUsername(s.username, !s.active);
      await pushSubscriberToServer(s);
    }
    setSubscribers(saveSubscribers(Array.from(map.values())));
  };

  if (!authSession) {
    return (
      <AuthGateScreen
        brandName={brandName}
        facebookUrl={facebookUrl}
        isDarkTheme={isDarkTheme}
        guestDesignsUsed={guestDesignsUsed}
        onToggleTheme={() => setIsDarkTheme((d) => !d)}
        onLogin={handleLogin}
        onGuestLogin={handleGuestLogin}
        onSubmitProOrder={handleSubmitProOrder}
      />
    );
  }

  return (
    <>
      {errorMsg && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border border-red-200 dark:border-red-900 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs font-medium text-red-700 dark:text-red-400 shadow-lg">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            إغلاق
          </button>
        </div>
      )}

      {activeProject ? (
        <StudioWorkspace
          brandName={brandName}
          projectId={activeProject.projectId}
          initialTitle={activeProject.title}
          initialPlan={activeProject.plan}
          initialUnderlay={activeProject.underlay}
          isDarkTheme={isDarkTheme}
          isSignedIn={true}
          isGuestSession={isGuestSession}
          isUserProActive={isUserProActive}
          isAiArProActive={hasPaidOrAdminPro}
          onOpenProUpgrade={() => setShowGlobalProModal(true)}
          onToggleTheme={() => setIsDarkTheme((d) => !d)}
          onSaveProject={handleSaveActiveProject}
          onBackToGallery={() => setActiveProject(null)}
        />
      ) : (
        <LandingShowcase
          brandName={brandName}
          sessionUser={authSession}
          isAdminAuthorized={isAdminAuthorized}
          isUserProActive={isUserProActive}
          isAiArProActive={hasPaidOrAdminPro}
          isGuestSession={isGuestSession}
          guestDesignsUsed={guestDesignsUsed}
          projects={projects}
          loadingProjects={false}
          proOrders={proOrders}
          facebookUrl={facebookUrl}
          isDarkTheme={isDarkTheme}
          onToggleTheme={() => setIsDarkTheme((d) => !d)}
          onUpdateBrandName={handleUpdateBrandName}
          onSignOut={handleSignOut}
          onOpenAdminPanel={() => setShowAdminPanel(true)}
          onOpenNewBlank={handleOpenNewBlank}
          onStartGeneratedPlan={handleOpenGeneratedPlan}
          onOpenSketchModal={() => setShowSketchModal(true)}
          onOpenTemplate={handleOpenTemplate}
          onOpenWithCatalogItem={handleOpenWithCatalogItem}
          onOpenProject={handleOpenProject}
          onDuplicateProject={handleDuplicateProject}
          onDeleteProject={handleDeleteProject}
          onImportProjects={handleImportProjects}
          onSaveFacebookUrl={handleSaveFacebookUrl}
          onSubmitProOrder={handleSubmitProOrder}
          onUpdateProOrderStatus={handleUpdateProOrderStatus}
        />
      )}

      {/* Guest 1-Design Limit Reached -> Urgent Pro Subscription Alert Modal */}
      {guestLimitReason && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setGuestLimitReason(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-[#181B20] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-amber-50/70 dark:bg-amber-950/30">
              <div className="inline-flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-300">
                <Crown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>تنبيه: الاشتراك في نسخة برو ضروري للمتابعة</span>
              </div>
              <button
                type="button"
                onClick={() => setGuestLimitReason(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                {guestLimitReason}
              </p>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3.5 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <div>• فتح جميع التصاميم الجزائرية الـ 200 القابلة للتعديل</div>
                <div>• إنشاء وحفظ عدد غير محدود من المشاريع والملفات</div>
                <div>• الاشتراك بـ 1,000 د.ج/شهر عبر بريدي موب أو فليكسي (+10%)</div>
              </div>

              <div className="flex flex-col gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setGuestLimitReason(null);
                    setShowGlobalProModal(true);
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white transition-colors"
                >
                  <Crown className="w-4 h-4" />
                  <span>اشترك في نسخة برو الآن (دليل الدفع والتفعيل)</span>
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>لدي اسم مستخدم ورقم سري — تسجيل الدخول</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ProSubscribeModal
        isOpen={showGlobalProModal}
        brandName={brandName}
        facebookUrl={facebookUrl}
        userEmail={authSession.username}
        isSignedIn={true}
        isUserProActive={isUserProActive}
        onClose={() => setShowGlobalProModal(false)}
        onSubmitOrder={handleSubmitProOrder}
      />

      <SketchToPlanModal
        isOpen={showSketchModal}
        brandName={brandName}
        isUserProActive={hasPaidOrAdminPro}
        onClose={() => setShowSketchModal(false)}
        onOpenProUpgrade={() => {
          setShowSketchModal(false);
          setShowGlobalProModal(true);
        }}
        onApplySketchPlan={({ title, floorPlan, underlay }) => {
          const newId = sanitizeId(`proj_${Date.now()}`);
          setActiveProject({
            projectId: newId,
            isExisting: false,
            title,
            plan: floorPlan,
            underlay: underlay ?? null,
          });
        }}
      />

      {isAdminAuthorized && (
        <AdminPanelModal
          isOpen={showAdminPanel}
          brandName={brandName}
          subscribers={subscribers}
          orders={proOrders}
          facebookUrl={facebookUrl}
          onClose={() => setShowAdminPanel(false)}
          onCreateSubscriber={handleCreateSubscriber}
          onUpdateSubscriber={handleUpdateSubscriber}
          onDeleteSubscriber={handleDeleteSubscriber}
          onUpdateOrderStatus={handleUpdateProOrderStatus}
          onSaveFacebookUrl={handleSaveFacebookUrl}
          onImportSubscribers={handleImportSubscribers}
          onLogout={handleSignOut}
        />
      )}
    </>
  );
}
