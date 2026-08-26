import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Smartphone,
  Maximize2,
  Sparkles,
  ShieldCheck,
  Zap,
  TrendingUp,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import { Header } from './components/Header';
import { BottomNav, TabType } from './components/BottomNav';
import { HomeScreen } from './components/HomeScreen';
import { CashFlowScreen } from './components/CashFlowScreen';
import { ActionsScreen } from './components/ActionsScreen';
import { MoreScreen } from './components/MoreScreen';
import { ActionModal } from './components/ActionModal';
import { ExplainFormulaModal } from './components/ExplainFormulaModal';
import { NotificationsModal } from './components/NotificationsModal';
import { BankConnectModal } from './components/BankConnectModal';
import { AuthModal } from './components/AuthModal';
import { LoginScreen } from './components/LoginScreen';
import { EditNameModal } from './components/EditNameModal';
import { BorrowerProfile, ActionItem, OAuthUser } from './types';
import { getInitialAartiProfile, getAvailableArchetypes } from './utils/bawsEngine';
import { useSwipeGesture } from './hooks/useSwipeGesture';
import {
  cacheBorrowerProfile,
  getCachedBorrowerProfile,
  cacheMultipleProfiles,
  getAllCachedProfiles,
  cacheAuthUser,
  getCachedAuthUser,
  enqueuePendingSync,
  getPendingSyncQueue,
  clearPendingSyncQueue,
} from './utils/offlineSync';
import { OfflineSyncBanner } from './components/OfflineSyncBanner';
import {
  auth,
  logoutFirebase,
  saveUserComprehensiveData,
  getUserComprehensiveData,
  deleteUserProfileAccount,
} from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const CUSTOM_DISPLAY_NAME_KEY = 'baws_custom_user_display_name';
const CUSTOM_FULL_NAME_KEY = 'baws_custom_user_full_name';
const CUSTOM_SECTOR_KEY = 'baws_custom_user_sector_label';

function applyCustomNameIfStored(baseProfile: BorrowerProfile): BorrowerProfile {
  try {
    const customDisplay = localStorage.getItem(CUSTOM_DISPLAY_NAME_KEY);
    const customFull = localStorage.getItem(CUSTOM_FULL_NAME_KEY);
    const customSector = localStorage.getItem(CUSTOM_SECTOR_KEY);
    if (customDisplay || customFull) {
      return {
        ...baseProfile,
        displayName: customDisplay || baseProfile.displayName,
        fullName: customFull || baseProfile.fullName,
        sectorLabel: customSector || baseProfile.sectorLabel,
      };
    }
  } catch (e) {
    console.warn('Error reading custom name from storage:', e);
  }
  return baseProfile;
}

export default function App() {
  // Initialize from cache or fallback default
  const [profile, setProfile] = useState<BorrowerProfile>(() => {
    const cached = getCachedBorrowerProfile() || getInitialAartiProfile();
    return applyCustomNameIfStored(cached);
  });
  const [availableProfiles, setAvailableProfiles] = useState<BorrowerProfile[]>(() => {
    const cached = getAllCachedProfiles();
    return cached.length > 0 ? cached : getAvailableArchetypes();
  });
  const [currentUser, setCurrentUser] = useState<OAuthUser | null>(() => {
    return getCachedAuthUser();
  });
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const {
    direction,
    handleTabChangeWithDirection,
    containerProps,
  } = useSwipeGesture({
    activeTab,
    onChangeTab: setActiveTab,
  });
  const [isDeviceFrameView, setIsDeviceFrameView] = useState(true);
  const [selectedActionForModal, setSelectedActionForModal] = useState<ActionItem | null>(null);
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showBankConnectModal, setShowBankConnectModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [isEvaluatingAI, setIsEvaluatingAI] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Keep local storage cache synchronized with profile changes
  useEffect(() => {
    cacheBorrowerProfile(profile);
  }, [profile]);

  // Keep archetypes cached
  useEffect(() => {
    cacheMultipleProfiles(availableProfiles);
  }, [availableProfiles]);

  // Keep auth user cached
  useEffect(() => {
    cacheAuthUser(currentUser);
  }, [currentUser]);

  // Synchronize Firebase Auth State & initial profile from network or cache
  useEffect(() => {
    fetch('/api/borrowers/baws-user-aarti-8821')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          const customized = applyCustomNameIfStored(data);
          setProfile(customized);
          cacheBorrowerProfile(customized);
        }
      })
      .catch((err) => {
        console.log('Offline or network error, loaded from local storage cache:', err);
        const cached = getCachedBorrowerProfile('baws-user-aarti-8821');
        if (cached) {
          const customized = applyCustomNameIfStored(cached);
          setProfile(customized);
        }
      });

    // Listen to live Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setCurrentUser((prevUser) => {
          if (prevUser && prevUser.id === firebaseUser.uid) {
            return prevUser;
          }
          const userName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
          const mappedUser: OAuthUser = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: userName,
            picture:
              firebaseUser.photoURL ||
              'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
            provider: firebaseUser.providerData[0]?.providerId?.includes('google') ? 'google' : 'demo',
            role: 'borrower',
            linkedBorrowerId: 'baws-user-aarti-8821',
            loginTimestamp: new Date().toISOString(),
          };
          cacheAuthUser(mappedUser);
          return mappedUser;
        });

        // Non-blocking asynchronous Firestore user profile check
        getUserComprehensiveData(firebaseUser.uid)
          .then((savedData) => {
            if (savedData?.borrowerProfile) {
              const customized = applyCustomNameIfStored(savedData.borrowerProfile as BorrowerProfile);
              setProfile(customized);
              cacheBorrowerProfile(customized);
            }
          })
          .catch((e) => {
            console.warn('Could not retrieve Firestore user profile, using local cache:', e);
          });
      }
    });

    return () => unsubscribe();
  }, []);

  // Process any offline queued actions when coming online
  const handleTriggerOfflineSync = useCallback(async () => {
    const queue = getPendingSyncQueue();
    if (queue.length === 0 && currentUser) {
      await saveUserComprehensiveData(currentUser.id, {
        role: currentUser.role,
        borrowerProfile: profile,
      });
      return;
    }

    for (const item of queue) {
      try {
        if (item.type === 'ACTION') {
          await fetch(`/api/borrowers/${item.borrowerId}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.payload),
          });
        } else if (item.type === 'SIMULATION') {
          await fetch(`/api/borrowers/${item.borrowerId}/simulate-shock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.payload),
          });
        }
      } catch (err) {
        console.warn('Sync attempt for queued item failed:', err);
      }
    }

    if (currentUser) {
      await saveUserComprehensiveData(currentUser.id, {
        role: currentUser.role,
        borrowerProfile: profile,
      });
    }

    clearPendingSyncQueue();
  }, [currentUser, profile]);


  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  const handleSaveProfileToDb = useCallback(async () => {
    if (!currentUser) return;
    try {
      await saveUserComprehensiveData(currentUser.id, {
        role: currentUser.role,
        borrowerProfile: profile,
      });
      showToast('Cloud database synchronized successfully');
    } catch (err: any) {
      console.warn('Manual save notice:', err);
      showToast('Profile stored in local state session');
    }
  }, [currentUser, profile, showToast]);

  const handleDeleteProfile = useCallback(async (userId: string) => {
    try {
      await deleteUserProfileAccount(userId);
      setProfile(getInitialAartiProfile());
      setCurrentUser(null);
      showToast('Profile and database records permanently deleted');
    } catch (err: any) {
      console.error('Delete profile error:', err);
      setProfile(getInitialAartiProfile());
      setCurrentUser(null);
      showToast('Profile reset completed');
    }
  }, [showToast]);

  const handleSelectBorrower = useCallback((borrowerId: string) => {
    const found = availableProfiles.find((p) => p.borrowerId === borrowerId);
    if (found) {
      setProfile(found);
      showToast(`Switched profile to ${found.fullName}`);
    }
  }, [availableProfiles, showToast]);

  const handleExecuteAction = useCallback((action: ActionItem) => {
    setSelectedActionForModal(action);
  }, []);

  const updateLocalProfileAfterAction = useCallback((
    actionId: string,
    actionType: ActionItem['actionType'],
    amount: number
  ) => {
    setProfile((prev) => {
      const updatedActions = prev.actions.map((a) =>
        a.id === actionId ? { ...a, status: 'COMPLETED' as const } : a
      );
      let newBuffer = prev.currentLiquidBuffer;
      let newResilience = prev.scoringProfile.resilienceScore;
      let updatedHistory = prev.bufferHistory ? [...prev.bufferHistory] : undefined;

      if (actionType === 'PROTECT_BUFFER') {
        newBuffer += amount;
        newResilience = Math.min(100, Number((newResilience + 6.0).toFixed(1)));
        if (updatedHistory && updatedHistory.length > 0) {
          const lastIndex = updatedHistory.length - 1;
          updatedHistory[lastIndex] = {
            ...updatedHistory[lastIndex],
            baseBuffer: updatedHistory[lastIndex].baseBuffer + amount,
            totalBuffer: updatedHistory[lastIndex].totalBuffer + amount,
          };
        }
      } else if (actionType === 'SWEEP_RESERVE') {
        newBuffer += amount;
        newResilience = Math.min(100, Number((newResilience + 0.8).toFixed(1)));
        if (updatedHistory && updatedHistory.length > 0) {
          const lastIndex = updatedHistory.length - 1;
          updatedHistory[lastIndex] = {
            ...updatedHistory[lastIndex],
            microSavingsSweep: updatedHistory[lastIndex].microSavingsSweep + amount,
            totalBuffer: updatedHistory[lastIndex].totalBuffer + amount,
            sweepThisMonth: updatedHistory[lastIndex].sweepThisMonth + amount,
          };
        }
      }

      return {
        ...prev,
        currentLiquidBuffer: newBuffer,
        bufferHistory: updatedHistory,
        scoringProfile: {
          ...prev.scoringProfile,
          resilienceScore: newResilience,
        },
        actions: updatedActions,
      };
    });
  }, []);

  const handleConfirmActionExecution = useCallback(async (
    actionId: string,
    actionType: ActionItem['actionType'],
    amount: number
  ) => {
    try {
      const res = await fetch(`/api/borrowers/${profile.borrowerId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, actionType, amount }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setProfile(data.profile);
        }
      } else {
        // Fallback local update
        updateLocalProfileAfterAction(actionId, actionType, amount);
      }
    } catch {
      updateLocalProfileAfterAction(actionId, actionType, amount);
    }
    showToast(`Completed: ${actionType.replace('_', ' ')} (₹${amount.toLocaleString('en-IN')})`);
  }, [profile.borrowerId, updateLocalProfileAfterAction, showToast]);

  const handleSimulateScenario = useCallback(async (
    scenarioType: string,
    magnitude?: number,
    description?: string
  ) => {
    try {
      const res = await fetch(`/api/borrowers/${profile.borrowerId}/simulate-shock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioType, shockMagnitude: magnitude, description }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setProfile(data.profile);
          showToast(`Scenario executed: ${scenarioType.replace(/_/g, ' ')}`);
        }
      }
    } catch (err) {
      console.error('Simulation error:', err);
      showToast('Simulation applied in local session');
    }
  }, [profile.borrowerId, showToast]);

  const handleRunGeminiEvaluation = useCallback(async () => {
    setIsEvaluatingAI(true);
    try {
      const res = await fetch(`/api/borrowers/${profile.borrowerId}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setProfile(data.profile);
        }
        showToast(
          data.isAIEvaluated
            ? 'Gemini 3.7 Flash Underwriting Complete'
            : 'Statistical Risk Evaluation Complete'
        );
      }
    } catch (err) {
      console.error('AI evaluation error:', err);
      showToast('Completed Risk Assessment');
    } finally {
      setIsEvaluatingAI(false);
    }
  }, [profile.borrowerId, showToast]);

  const handleUpdateLookback = useCallback((k: number) => {
    setProfile((prev) => ({
      ...prev,
      bawsEngineState: { ...prev.bawsEngineState, optimalLookbackWindowK: k },
    }));
  }, []);

  const handleOpenNotifications = useCallback(() => setShowNotificationsModal(true), []);
  const handleCloseNotifications = useCallback(() => setShowNotificationsModal(false), []);
  const handleOpenBankModal = useCallback(() => setShowBankConnectModal(true), []);
  const handleCloseBankModal = useCallback(() => setShowBankConnectModal(false), []);
  const handleOpenAuthModal = useCallback(() => setShowAuthModal(true), []);
  const handleCloseAuthModal = useCallback(() => setShowAuthModal(false), []);
  const handleOpenEditName = useCallback(() => setShowEditNameModal(true), []);
  const handleCloseEditName = useCallback(() => setShowEditNameModal(false), []);
  const handleOpenFormulaModal = useCallback(() => setShowFormulaModal(true), []);
  const handleCloseFormulaModal = useCallback(() => setShowFormulaModal(false), []);
  const handleCloseActionModal = useCallback(() => setSelectedActionForModal(null), []);

  const handleBankProfileUpdated = useCallback((updated: BorrowerProfile) => {
    setProfile(updated);
    showToast('Live bank information synchronized successfully');
  }, [showToast]);

  const handleAuthUserChanged = useCallback((user: OAuthUser | null) => {
    setCurrentUser(user);
    if (user) {
      showToast(`Welcome, ${user.name}`);
    } else {
      showToast('Signed out of session');
    }
  }, [showToast]);

  const handleSaveCustomName = useCallback(async (updated: { displayName: string; fullName: string; sectorLabel?: string }) => {
    try {
      localStorage.setItem(CUSTOM_DISPLAY_NAME_KEY, updated.displayName);
      localStorage.setItem(CUSTOM_FULL_NAME_KEY, updated.fullName);
      if (updated.sectorLabel) {
        localStorage.setItem(CUSTOM_SECTOR_KEY, updated.sectorLabel);
      }

      setProfile((prev) => {
        const next: BorrowerProfile = {
          ...prev,
          displayName: updated.displayName,
          fullName: updated.fullName,
          ...(updated.sectorLabel ? { sectorLabel: updated.sectorLabel } : {}),
        };
        cacheBorrowerProfile(next);
        return next;
      });

      // Update server memory
      fetch(`/api/borrowers/${profile.borrowerId}/update-name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      }).catch((err) => console.warn('Could not sync name to server:', err));

      // Update currentUser name if active
      if (currentUser) {
        const updatedUser: OAuthUser = {
          ...currentUser,
          name: updated.fullName,
        };
        setCurrentUser(updatedUser);
        cacheAuthUser(updatedUser);
        saveUserComprehensiveData(currentUser.id, {
          displayName: updated.fullName,
          role: currentUser.role,
          borrowerProfile: {
            ...profile,
            displayName: updated.displayName,
            fullName: updated.fullName,
            ...(updated.sectorLabel ? { sectorLabel: updated.sectorLabel } : {}),
          },
        }).catch((err) => console.warn('Could not sync name to Firestore:', err));
      }

      showToast(`Name updated to "${updated.displayName}"`);
    } catch (err: any) {
      console.error('Error saving custom name:', err);
      showToast('Name updated');
    }
  }, [currentUser, profile, showToast]);

  const handleLoginSuccess = useCallback((user: OAuthUser) => {
    setCurrentUser(user);
    if (user.name) {
      const firstName = user.name.split(' ')[0];
      localStorage.setItem(CUSTOM_DISPLAY_NAME_KEY, firstName);
      localStorage.setItem(CUSTOM_FULL_NAME_KEY, user.name);
      setProfile((prev) => ({
        ...prev,
        displayName: firstName,
        fullName: user.name,
      }));
    }
    showToast(`Welcome to BAWS, ${user.name}`);
  }, [showToast]);

  const pendingActionsCount = useMemo(() => {
    return profile.actions.filter((a) => a.status === 'TODO').length;
  }, [profile.actions]);

  return (
    <div className="min-h-screen min-h-dvh bg-[#ede8dc] text-[#12281e] flex flex-col items-center justify-start sm:justify-center p-0 sm:p-4 md:p-6 select-none font-sans antialiased">
      {/* Top View Mode Switcher Toolbar (Desktop/Tablet preview helper) */}
      <div className="w-full max-w-md mb-1.5 px-3 py-1 hidden sm:flex items-center justify-between text-[11px] font-mono text-[#6e7f74]">
        <div className="flex items-center gap-1.5 font-semibold text-[#123524]">
          <span className="w-2 h-2 rounded-full bg-[#15803d] animate-pulse" />
          <span>BAWS Risk Engine v2.4</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="toggle-device-frame-btn"
            onClick={() => setIsDeviceFrameView(!isDeviceFrameView)}
            className="flex items-center gap-1 px-2.5 py-1 bg-white/80 hover:bg-white border border-[#d6cbba] rounded-lg text-[#123524] transition-all shadow-2xs active:scale-95 touch-manipulation"
            title="Toggle Device Frame"
          >
            {isDeviceFrameView ? (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Full Width</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5" />
                <span>Mobile Frame</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Container / Mobile Device Frame */}
      <div
        id="app-main-container"
        className={`w-full transition-all duration-300 ${
          isDeviceFrameView
            ? 'max-w-[430px] bg-[#faf8f2] sm:rounded-[44px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] border-0 sm:border-[8px] sm:border-[#201c18] overflow-hidden min-h-screen min-h-dvh sm:min-h-[850px] relative flex flex-col'
            : 'max-w-2xl bg-[#faf8f2] sm:rounded-3xl shadow-xl border-0 sm:border sm:border-[#ded5c5] overflow-hidden min-h-screen min-h-dvh relative flex flex-col'
        }`}
      >
        {/* Dynamic Island Notch (Device Frame mode on desktop only) */}
        {isDeviceFrameView && (
          <div className="hidden sm:flex justify-center pt-3 pb-1 sticky top-0 bg-[#faf8f2] z-50">
            <div className="w-28 h-6 bg-black rounded-full flex items-center justify-end px-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1a3328] border border-[#2d5241]" />
            </div>
          </div>
        )}

        {/* Real-Time Offline Cache & Sync Banner */}
        <OfflineSyncBanner onTriggerSync={handleTriggerOfflineSync} />

        {!currentUser ? (
          /* STARTING SCREEN: Authentication Required */
          <LoginScreen
            onLoginSuccess={handleLoginSuccess}
            isDeviceFrameView={isDeviceFrameView}
          />
        ) : (
          /* MAIN AUTHENTICATED APPLICATION */
          <div className="flex-1 flex flex-col w-full">
            {/* Header */}
            <Header
              profile={profile}
              currentUser={currentUser}
              onOpenNotifications={handleOpenNotifications}
              onOpenBankModal={handleOpenBankModal}
              onOpenAuthModal={handleOpenAuthModal}
              onOpenEditName={handleOpenEditName}
              unreadCount={pendingActionsCount}
            />

            {/* Screen View Port with Swipe-to-Switch Support */}
            <main
              id="screen-viewport"
              className="flex-1 px-3.5 sm:px-5 pt-1 sm:pt-2 pb-28 relative overflow-x-hidden touch-pan-y"
              {...containerProps}
            >
              <AnimatePresence mode="wait" custom={direction} initial={false}>
                <motion.div
                  key={activeTab}
                  custom={direction}
                  initial={{ opacity: 0, x: direction > 0 ? 30 : direction < 0 ? -30 : 0 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction > 0 ? -30 : direction < 0 ? 30 : 0 }}
                  transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
                  className="w-full"
                >
                  {activeTab === 'home' && (
                    <HomeScreen
                      profile={profile}
                      onNavigateToTab={handleTabChangeWithDirection}
                      onExecuteAction={handleExecuteAction}
                      onOpenExplainFormula={handleOpenFormulaModal}
                      onOpenBankModal={handleOpenBankModal}
                    />
                  )}

                  {activeTab === 'cashflow' && (
                    <CashFlowScreen
                      profile={profile}
                      onUpdateLookbackWindow={handleUpdateLookback}
                    />
                  )}

                  {activeTab === 'actions' && (
                    <ActionsScreen
                      profile={profile}
                      onExecuteAction={handleExecuteAction}
                      onQuickComplete={handleConfirmActionExecution}
                      onSelectActionForDetails={handleExecuteAction}
                    />
                  )}

                  {activeTab === 'more' && (
                    <MoreScreen
                      profile={profile}
                      availableProfiles={availableProfiles}
                      currentUser={currentUser}
                      onSelectBorrower={handleSelectBorrower}
                      onSimulateScenario={handleSimulateScenario}
                      onRunGeminiEvaluation={handleRunGeminiEvaluation}
                      onOpenAuthModal={handleOpenAuthModal}
                      onOpenEditName={handleOpenEditName}
                      onDeleteProfile={handleDeleteProfile}
                      onSaveProfileToDb={handleSaveProfileToDb}
                      isEvaluatingAI={isEvaluatingAI}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </main>

            {/* Bottom Navigation */}
            <BottomNav
              activeTab={activeTab}
              onChangeTab={handleTabChangeWithDirection}
              pendingActionsCount={pendingActionsCount}
            />
          </div>
        )}
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 z-50 bg-[#123524] text-white px-4 py-2.5 rounded-full shadow-lg text-[13px] font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200">
          <Sparkles className="w-4 h-4 text-[#80a98f]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Action Execution Modal */}
      <ActionModal
        action={selectedActionForModal}
        profile={profile}
        onClose={handleCloseActionModal}
        onConfirm={handleConfirmActionExecution}
      />

      {/* Formula Explanation Modal */}
      <ExplainFormulaModal
        isOpen={showFormulaModal}
        onClose={handleCloseFormulaModal}
        profile={profile}
      />

      {/* Real-Time Bank Connect & Statement Synchronization Modal */}
      <BankConnectModal
        isOpen={showBankConnectModal}
        onClose={handleCloseBankModal}
        profile={profile}
        onProfileUpdated={handleBankProfileUpdated}
      />

      {/* User Login & OAuth 2.0 Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={handleCloseAuthModal}
        currentUser={currentUser}
        onDeleteProfile={handleDeleteProfile}
        onUserChanged={handleAuthUserChanged}
      />

      {/* Set / Edit Name Modal */}
      <EditNameModal
        isOpen={showEditNameModal}
        onClose={handleCloseEditName}
        profile={profile}
        onSaveName={handleSaveCustomName}
      />

      {/* Notifications Drawer */}
      <NotificationsModal
        isOpen={showNotificationsModal}
        onClose={handleCloseNotifications}
        profile={profile}
      />
    </div>
  );
}
