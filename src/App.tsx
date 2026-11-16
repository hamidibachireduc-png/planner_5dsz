/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
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
import {
  LocalClientSession,
  adminCreateUserAccountInFirestore,
  adminUpdateUserAccountInFirestore,
  createProOrderInFirestore,
  deleteGuestProject,
  deleteProjectFromFirestore,
  isAdminEmail,
  loadAdminPanelSession,
  loadFacebookUrl,
  loadGuestProOrders,
  loadGuestProjects,
  loadLocalBrandName,
  loadLocalClientSession,
  loadLocalUserAccounts,
  loadUserStudioSettings,
  sanitizeId,
  saveAdminPanelSession,
  saveFacebookUrl,
  saveGuestProOrder,
  saveGuestProject,
  saveLocalBrandName,
  saveLocalClientSession,
  saveProjectToFirestore,
  saveUserStudioSettings,
  signInWithGoogle,
  signOutUser,
  subscribeAuth,
  subscribeProOrders,
  subscribeUserAccounts,
  subscribeUserProjects,
  syncUserAccountInFirestore,
  updateLocalProOrderStatus,
  updateLocalUserAccount,
  updateProOrderStatusInFirestore,
  upsertLocalUserAccount,
  verifyAdminPanelCredentials,
} from './firebase';
import {
  FloorPlanData,
  ProSubscriptionOrder,
  ProjectRecord,
  UserAccountRecord,
  UserAccountStatus,
} from './types/planner';

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
  const [clientSession, setClientSession] = useState<LocalClientSession | null>(() =>
    loadLocalClientSession()
  );
  const [adminSession, setAdminSession] = useState<boolean>(() => loadAdminPanelSession());
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  const [brandName, setBrandName] = useState<string>(() => loadLocalBrandName());
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(false);

  const [projects, setProjects] = useState<ProjectRecord[]>(() => loadGuestProjects());
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [proOrders, setProOrders] = useState<ProSubscriptionOrder[]>(() => loadGuestProOrders());
  const [cloudAccounts, setCloudAccounts] = useState<UserAccountRecord[]>([]);
  const [localAccounts, setLocalAccounts] = useState<UserAccountRecord[]>(() =>
    loadLocalUserAccounts()
  );
  const [facebookUrl, setFacebookUrl] = useState<string>(() => loadFacebookUrl());
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isAdmin = Boolean(user?.email && user.emailVerified && isAdminEmail(user.email));
  const isAdminAuthorized = isAdmin || adminSession;
  const isAuthenticated = Boolean(user || clientSession || adminSession);

  // Merge cloud + local accounts cleanly (deduped by id or email)
  const mergedAccounts = useMemo(() => {
    const map = new Map<string, UserAccountRecord>();
    for (const acc of localAccounts) {
      map.set(acc.id, acc);
    }
    for (const acc of cloudAccounts) {
      map.set(acc.id, acc);
    }
    return Array.from(map.values()).sort(
      (a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0)
    );
  }, [cloudAccounts, localAccounts]);

  const currentAccount = useMemo(() => {
    if (user) {
      return mergedAccounts.find((a) => a.id === user.uid || a.ownerId === user.uid) || null;
    }
    if (clientSession) {
      return (
        mergedAccounts.find(
          (a) =>
            a.id === clientSession.id ||
            (clientSession.email &&
              a.email &&
              a.email.toLowerCase() === clientSession.email.toLowerCase())
        ) || null
      );
    }
    return null;
  }, [user, clientSession, mergedAccounts]);

  const isAccountSuspended = Boolean(
    !isAdminAuthorized && currentAccount && currentAccount.accountStatus === 'suspended'
  );

  const isUserProActive = Boolean(
    isAdminAuthorized ||
      currentAccount?.proActive ||
      proOrders.some((o) => o.status === 'approved')
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

  // Subscribe to Firebase Auth
  useEffect(() => {
    const unsub = subscribeAuth((nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Load Firestore projects, user settings, orders, and accounts when authenticated
  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setProjects(loadGuestProjects());
      setCloudAccounts([]);
      setLoadingProjects(false);
      return;
    }

    setLoadingProjects(true);
    void syncUserAccountInFirestore(user).catch(() => {
      // Non-fatal if offline or transient
    });

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

    const unsubAccounts = subscribeUserAccounts(
      user.uid,
      isAdmin,
      (accounts) => {
        setCloudAccounts(accounts);
      },
      () => {
        // Ignore transient account listener errors
      }
    );

    return () => {
      unsubProjects();
      unsubOrders();
      unsubAccounts();
    };
  }, [user, authReady, isAdmin]);

  useEffect(() => {
    if (authReady && !user) {
      setProOrders(loadGuestProOrders());
      setLocalAccounts(loadLocalUserAccounts());
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
      throw new Error('Google sign-in failed');
    }
  };

  const handleClientLogin = (payload: { displayName: string; email: string; phone: string }) => {
    const existing = loadLocalUserAccounts().find(
      (a) =>
        payload.email &&
        a.email &&
        a.email.toLowerCase() === payload.email.toLowerCase()
    );
    const id = existing?.id || sanitizeId(`client_${Date.now()}`);
    const session: LocalClientSession = {
      id,
      displayName: payload.displayName,
      email: payload.email,
      phone: payload.phone,
    };
    saveLocalClientSession(session);
    setClientSession(session);

    const updated = upsertLocalUserAccount({
      id,
      ownerId: id,
      displayName: payload.displayName,
      email: payload.email,
      phone: payload.phone,
      accountStatus: existing?.accountStatus || 'active',
      proActive: existing?.proActive || false,
      proPlan: existing?.proPlan || 'free',
    });
    setLocalAccounts(updated);
  };

  const handleAdminLogin = (username: string, password: string): boolean => {
    const ok = verifyAdminPanelCredentials(username, password);
    if (!ok) return false;
    saveAdminPanelSession(true);
    setAdminSession(true);
    setShowAdminPanel(true);
    return true;
  };

  const handleAdminLogout = () => {
    saveAdminPanelSession(false);
    setAdminSession(false);
    setShowAdminPanel(false);
  };

  const handleSignOut = async () => {
    setActiveSession(null);
    saveLocalClientSession(null);
    setClientSession(null);
    saveAdminPanelSession(false);
    setAdminSession(false);
    setShowAdminPanel(false);
    if (user) {
      await signOutUser();
    }
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
    if (!isAdminAuthorized) return;
    const targetOrder = proOrders.find((o) => o.id === orderId);
    if (isAdmin) {
      await updateProOrderStatusInFirestore(orderId, status);
      if (status === 'approved' && targetOrder?.ownerId && targetOrder.ownerId !== 'guest') {
        const matchingAcc = cloudAccounts.find(
          (a) => a.id === targetOrder.ownerId || a.ownerId === targetOrder.ownerId
        );
        if (matchingAcc) {
          await adminUpdateUserAccountInFirestore(matchingAcc.id, {
            accountStatus: 'active',
            proActive: true,
            proPlan: targetOrder.planType,
          }).catch(() => {
            // Non-fatal if account document is managed separately
          });
        }
      }
    } else {
      setProOrders(updateLocalProOrderStatus(orderId, status));
      if (status === 'approved' && targetOrder?.ownerId) {
        setLocalAccounts(
          updateLocalUserAccount(targetOrder.ownerId, {
            accountStatus: 'active',
            proActive: true,
            proPlan: targetOrder.planType,
          })
        );
      }
    }
  };

  const handleAdminUpdateAccount = async (
    accountId: string,
    patch: {
      accountStatus: UserAccountStatus;
      proActive: boolean;
      proPlan: 'free' | 'monthly' | 'annual';
      notes?: string;
    }
  ) => {
    if (!isAdminAuthorized) return;
    const inCloud = cloudAccounts.some((a) => a.id === accountId);
    if (isAdmin && inCloud) {
      await adminUpdateUserAccountInFirestore(accountId, patch);
    } else {
      setLocalAccounts(updateLocalUserAccount(accountId, patch));
    }
  };

  const handleAdminCreateAccount = async (input: {
    email: string;
    displayName: string;
    phone: string;
    accountStatus: UserAccountStatus;
    proActive: boolean;
    proPlan: 'free' | 'monthly' | 'annual';
    notes?: string;
  }) => {
    if (!isAdminAuthorized) return;
    if (isAdmin) {
      await adminCreateUserAccountInFirestore(input);
    } else {
      const id = sanitizeId(`acc_${Date.now()}`);
      setLocalAccounts(
        upsertLocalUserAccount({
          id,
          ownerId: id,
          email: input.email,
          displayName: input.displayName,
          phone: input.phone,
          accountStatus: input.accountStatus,
          proActive: input.proActive,
          proPlan: input.proPlan,
          notes: input.notes,
        })
      );
    }
  };

  if (!isAuthenticated || isAccountSuspended) {
    return (
      <AuthGateScreen
        brandName={brandName}
        isDarkTheme={isDarkTheme}
        authReady={authReady}
        suspendedAccount={
          isAccountSuspended && currentAccount
            ? {
                displayName: currentAccount.displayName,
                email: currentAccount.email,
              }
            : null
        }
        onToggleTheme={() => setIsDarkTheme((d) => !d)}
        onGoogleSignIn={handleSignIn}
        onClientLogin={handleClientLogin}
        onAdminLogin={handleAdminLogin}
        onSignOut={handleSignOut}
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
          isAdminAuthorized={isAdminAuthorized}
          activeClientName={clientSession?.displayName || (isAdminAuthorized ? 'المدير (حميدي البشير)' : null)}
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

      <AdminPanelModal
        isOpen={showAdminPanel}
        brandName={brandName}
        isAdminAuthorized={isAdminAuthorized}
        isCloudAdminSignedIn={isAdmin}
        accounts={mergedAccounts}
        orders={proOrders}
        facebookUrl={facebookUrl}
        onClose={() => setShowAdminPanel(false)}
        onAdminLogin={handleAdminLogin}
        onAdminLogout={handleAdminLogout}
        onGoogleSyncSignIn={handleSignIn}
        onUpdateAccount={handleAdminUpdateAccount}
        onCreateAccount={handleAdminCreateAccount}
        onUpdateOrderStatus={handleUpdateProOrderStatus}
        onSaveFacebookUrl={handleSaveFacebookUrl}
      />
    </>
  );
}
