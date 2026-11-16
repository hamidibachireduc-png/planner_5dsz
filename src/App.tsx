/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { LandingShowcase } from './components/LandingShowcase';
import { StudioWorkspace } from './components/StudioWorkspace';
import {
  CatalogItemDef,
  StarterTemplate,
  computeFloorPlanMetrics,
  createBlankFloorPlan,
} from './data/catalog';
import {
  ADMIN_EMAIL,
  createProOrderInFirestore,
  deleteGuestProject,
  deleteProjectFromFirestore,
  loadFacebookUrl,
  loadGuestProOrders,
  loadGuestProjects,
  loadLocalBrandName,
  loadUserStudioSettings,
  sanitizeId,
  saveFacebookUrl,
  saveGuestProOrder,
  saveGuestProject,
  saveLocalBrandName,
  saveProjectToFirestore,
  saveUserStudioSettings,
  signInWithGoogle,
  signOutUser,
  subscribeAuth,
  subscribeProOrders,
  subscribeUserProjects,
  updateProOrderStatusInFirestore,
} from './firebase';
import { FloorPlanData, ProSubscriptionOrder, ProjectRecord } from './types/planner';

interface ActiveSession {
  projectId: string;
  isExisting: boolean;
  title: string;
  templateKey?: string;
  plan: FloorPlanData;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [brandName, setBrandName] = useState<string>(() => loadLocalBrandName());
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(false);

  const [projects, setProjects] = useState<ProjectRecord[]>(() => loadGuestProjects());
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [proOrders, setProOrders] = useState<ProSubscriptionOrder[]>(() => loadGuestProOrders());
  const [facebookUrl, setFacebookUrl] = useState<string>(() => loadFacebookUrl());
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isAdmin = Boolean(user?.email && user.emailVerified && user.email === ADMIN_EMAIL);
  const isUserProActive = isAdmin || proOrders.some((o) => o.status === 'approved');

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

  // Subscribe to Firebase Auth
  useEffect(() => {
    const unsub = subscribeAuth((nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Load Firestore projects & user settings when authenticated, else guest local projects
  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setProjects(loadGuestProjects());
      setLoadingProjects(false);
      return;
    }

    setLoadingProjects(true);
    void loadUserStudioSettings(user.uid)
      .then((settings) => {
        if (settings?.brandName) {
          setBrandName(settings.brandName);
          saveLocalBrandName(settings.brandName);
        }
      })
      .catch(() => {
        // Keep local brand fallback if settings doc doesn't exist yet
      });

    const unsubProjects = subscribeUserProjects(
      user.uid,
      (cloudProjects) => {
        setProjects(cloudProjects);
        setLoadingProjects(false);
      },
      () => {
        setErrorMsg('تعذر تحميل المشاريع من قاعدة البيانات.');
        setLoadingProjects(false);
      }
    );

    const unsubOrders = subscribeProOrders(
      user.uid,
      isAdmin,
      (orders) => {
        setProOrders(orders);
      },
      () => {
        // Keep local fallback quietly if orders listener encounters transient error
      }
    );

    return () => {
      unsubProjects();
      unsubOrders();
    };
  }, [user, authReady, isAdmin]);

  useEffect(() => {
    if (authReady && !user) {
      setProOrders(loadGuestProOrders());
    }
  }, [authReady, user]);

  const handleUpdateBrandName = async (nextName: string) => {
    const cleaned = nextName.trim() || 'خدمات انشاء حميدي البشير';
    setBrandName(cleaned);
    saveLocalBrandName(cleaned);
    if (user) {
      try {
        await saveUserStudioSettings(user.uid, cleaned, 'm');
      } catch {
        setErrorMsg('تم تحديث الاسم محلياً، تعذر الحفظ في السحابة.');
      }
    }
  };

  const handleSignIn = async () => {
    setErrorMsg(null);
    try {
      await signInWithGoogle();
    } catch {
      setErrorMsg('تم إلغاء تسجيل الدخول أو تعذر الاتصال بخدمة Google.');
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
  };

  const handleOpenNewBlank = () => {
    setActiveSession({
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
    setActiveSession({
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
    setActiveSession({
      projectId: sanitizeId(`proj_${Date.now()}`),
      isExisting: false,
      title: `تصميم مع ${itemDef.name}`,
      plan,
    });
  };

  const handleOpenProject = (proj: ProjectRecord) => {
    setActiveSession({
      projectId: proj.id,
      isExisting: true,
      title: proj.title,
      templateKey: proj.templateKey,
      plan: structuredClone(proj.floorPlanData),
    });
  };

  const handleSaveActiveProject = async (title: string, plan: FloorPlanData) => {
    if (!activeSession) return;
    const metrics = computeFloorPlanMetrics(plan);

    if (user) {
      await saveProjectToFirestore(
        user.uid,
        {
          id: activeSession.projectId,
          title,
          templateKey: activeSession.templateKey,
          floorPlanData: plan,
        },
        activeSession.isExisting
      );
      setActiveSession((prev) => (prev ? { ...prev, isExisting: true, title, plan } : null));
    } else {
      const updatedList = saveGuestProject({
        id: activeSession.projectId,
        ownerId: 'guest',
        title,
        templateKey: activeSession.templateKey,
        floorPlanData: plan,
        roomCount: metrics.roomCount,
        totalAreaSqm: metrics.totalAreaSqm,
      });
      setProjects(updatedList);
      setActiveSession((prev) => (prev ? { ...prev, isExisting: true, title, plan } : null));
    }
  };

  const handleDuplicateProject = async (proj: ProjectRecord) => {
    const newId = sanitizeId(`proj_${Date.now()}`);
    const newTitle = `${proj.title} (نسخة)`;
    if (user) {
      await saveProjectToFirestore(
        user.uid,
        {
          id: newId,
          title: newTitle,
          templateKey: proj.templateKey,
          floorPlanData: proj.floorPlanData,
        },
        false
      );
    } else {
      const next = saveGuestProject({
        ...proj,
        id: newId,
        title: newTitle,
      });
      setProjects(next);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (user) {
      await deleteProjectFromFirestore(projectId);
    } else {
      setProjects(deleteGuestProject(projectId));
    }
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
      if (user) {
        await saveProjectToFirestore(
          user.uid,
          {
            id: newId,
            title: entry.title,
            templateKey: entry.templateKey,
            floorPlanData: entry.floorPlanData,
          },
          false
        );
      } else {
        const record: ProjectRecord = {
          id: newId,
          ownerId: 'guest',
          title: entry.title,
          templateKey: entry.templateKey,
          floorPlanData: entry.floorPlanData,
          roomCount: metrics.roomCount,
          totalAreaSqm: metrics.totalAreaSqm,
        };
        const updated = saveGuestProject(record);
        setProjects(updated);
      }
      if (i === 0) {
        firstProjectRecord = {
          id: newId,
          ownerId: user?.uid || 'guest',
          title: entry.title,
          templateKey: entry.templateKey,
          floorPlanData: entry.floorPlanData,
          roomCount: metrics.roomCount,
          totalAreaSqm: metrics.totalAreaSqm,
        };
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
    if (user) {
      await createProOrderInFirestore(user.uid, order);
    } else {
      const localOrder: ProSubscriptionOrder = {
        ...order,
        id: sanitizeId(`pro_${Date.now()}`),
        ownerId: 'guest',
        status: 'pending',
        createdAtMs: Date.now(),
      };
      setProOrders(saveGuestProOrder(localOrder));
    }
  };

  const handleUpdateProOrderStatus = async (orderId: string, status: 'approved' | 'rejected') => {
    if (!user || !isAdmin) return;
    await updateProOrderStatusInFirestore(orderId, status);
  };

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

      {activeSession ? (
        <StudioWorkspace
          brandName={brandName}
          projectId={activeSession.projectId}
          initialTitle={activeSession.title}
          initialPlan={activeSession.plan}
          isDarkTheme={isDarkTheme}
          isSignedIn={Boolean(user)}
          onToggleTheme={() => setIsDarkTheme((d) => !d)}
          onSaveProject={handleSaveActiveProject}
          onBackToGallery={() => setActiveSession(null)}
        />
      ) : (
        <LandingShowcase
          brandName={brandName}
          user={user}
          authReady={authReady}
          isAdmin={isAdmin}
          isUserProActive={isUserProActive}
          projects={projects}
          loadingProjects={loadingProjects}
          proOrders={proOrders}
          facebookUrl={facebookUrl}
          isDarkTheme={isDarkTheme}
          onToggleTheme={() => setIsDarkTheme((d) => !d)}
          onUpdateBrandName={handleUpdateBrandName}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
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
    </>
  );
}
