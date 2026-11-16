/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { AdminPanelModal } from './components/AdminPanelModal';
import { AuthGateScreen } from './components/AuthGateScreen';
import { LandingShowcase } from './components/LandingShowcase';
import { StudioWorkspace } from './components/StudioWorkspace';
import {
  CatalogItemDef,
  StarterTemplate,
  computeFloorPlanMetrics,
  createBlankFloorPlan,
} from './data/catalog';
import { FloorPlanData, ProSubscriptionOrder, ProjectRecord } from './types/planner';
import {
  ActiveAuthSession,
  SubscriberAccount,
  authenticateUserOrAdmin,
  deleteLocalProject,
  deleteSubscriberOnServer,
  loadActiveSession,
  loadFacebookUrl,
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
}

export default function App() {
  const [authSession, setAuthSession] = useState<ActiveAuthSession | null>(() =>
    loadActiveSession()
  );
  const [subscribers, setSubscribers] = useState<SubscriberAccount[]>(() => loadSubscribers());
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  const [brandName, setBrandName] = useState<string>(() => loadLocalBrandName());
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(false);

  const [projects, setProjects] = useState<ProjectRecord[]>(() => loadLocalProjects());
  const [proOrders, setProOrders] = useState<ProSubscriptionOrder[]>(() => loadLocalProOrders());
  const [facebookUrl, setFacebookUrl] = useState<string>(() => loadFacebookUrl());
  const [activeProject, setActiveProject] = useState<ActiveProjectSession | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isAdminAuthorized = authSession?.role === 'admin';
  const matchedSubscriber =
    authSession?.role === 'subscriber'
      ? subscribers.find(
          (s) => s.username.trim().toLowerCase() === authSession.username.trim().toLowerCase()
        )
      : undefined;

  const isUserProActive = Boolean(
    isAdminAuthorized ||
      (matchedSubscriber ? matchedSubscriber.proActive && matchedSubscriber.active : authSession?.proActive)
  );

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkTheme) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [isDarkTheme]);

  // Keep page <title> aligned with personalized brand name
  useEffect(() => {
    document.title = `${brandName} | استوديو تصميم المنازل والمخططات 2D و 3D`;
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
      if (res.session.role === 'admin') {
        setShowAdminPanel(true);
      }
      return { ok: true };
    }
    return { ok: false, error: res.error };
  };

  const handleSignOut = () => {
    setActiveProject(null);
    setShowAdminPanel(false);
    saveActiveSession(null);
    setAuthSession(null);
  };

  const handleUpdateBrandName = async (nextName: string) => {
    const cleaned = nextName.trim() || 'خدمات انشاء حميدي البشير';
    setBrandName(cleaned);
    saveLocalBrandName(cleaned);
  };

  const handleOpenNewBlank = () => {
    setActiveProject({
      projectId: sanitizeId(`proj_${Date.now()}`),
      isExisting: false,
      title: 'منزل جديد',
      plan: createBlankFloorPlan(),
    });
  };

  const handleOpenTemplate = (tpl: StarterTemplate) => {
    if (tpl.isPro && !isUserProActive) {
      setErrorMsg('هذا التصميم متاح حصرياً لمشتركي باقة برو (1,000 د.ج/شهر).');
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
        onToggleTheme={() => setIsDarkTheme((d) => !d)}
        onLogin={handleLogin}
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
          isDarkTheme={isDarkTheme}
          isSignedIn={true}
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
