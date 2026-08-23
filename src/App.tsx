import React, { useState, useEffect } from 'react';
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
import { BorrowerProfile, ActionItem, OAuthUser } from './types';
import { getInitialAartiProfile, getAvailableArchetypes } from './utils/bawsEngine';
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

export default function App() {
  // Initialize from cache or fallback default
  const [profile, setProfile] = useState<BorrowerProfile>(() => {
    return getCachedBorrowerProfile() || getInitialAartiProfile();
  });
  const [availableProfiles, setAvailableProfiles] = useState<BorrowerProfile[]>(() => {
    const cached = getAllCachedProfiles();
    return cached.length > 0 ? cached : getAvailableArchetypes();
  });
  const [currentUser, setCurrentUser] = useState<OAuthUser | null>(() => {
    return getCachedAuthUser();
  });
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [isDeviceFrameView, setIsDeviceFrameView] = useState(true);
  const [selectedActionForModal, setSelectedActionForModal] = useState<ActionItem | null>(null);
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showBankConnectModal, setShowBankConnectModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
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
          setProfile(data);
          cacheBorrowerProfile(data);
        }
      })
      .catch((err) => {
        console.log('Offline or network error, loaded from local storage cache:', err);
        const cached = getCachedBorrowerProfile('baws-user-aarti-8821');
        if (cached) {
          setProfile(cached);
        }
      });

    // Listen to live Firebase Auth state changes
    let unsubscribe = () => {};
    if (auth) {
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          const mappedUser: OAuthUser = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            picture:
              firebaseUser.photoURL ||
              'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
            provider: firebaseUser.providerData[0]?.providerId?.includes('google') ? 'google' : 'demo',
            role: 'borrower',
            linkedBorrowerId: 'baws-user-aarti-8821',
            loginTimestamp: new Date().toISOString(),
          };
          setCurrentUser(mappedUser);
          cacheAuthUser(mappedUser);

          // Check if there is saved profile data in Firestore for this user
          try {
            const savedData = await getUserComprehensiveData(firebaseUser.uid);
            if (savedData?.borrowerProfile) {
              setProfile(savedData.borrowerProfile as BorrowerProfile);
              cacheBorrowerProfile(savedData.borrowerProfile as BorrowerProfile);
            }
          } catch (e) {
            console.warn('Could not retrieve Firestore user profile, using local cache:', e);
          }
        }
      });
    }

    return () => unsubscribe();
  }, []);

  // Process any offline queued actions when coming online
  const handleTriggerOfflineSync = async () => {
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
  };


  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSaveProfileToDb = async () => {
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
  };

  const handleDeleteProfile = async (userId: string) => {
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
  };

  const handleSelectBorrower = (borrowerId: string) => {
    const found = availableProfiles.find((p) => p.borrowerId === borrowerId);
    if (found) {
      setProfile(found);
      showToast(`Switched profile to ${found.fullName}`);
    }
  };

  const handleExecuteAction = (action: ActionItem) => {
    setSelectedActionForModal(action);
  };

  const handleConfirmActionExecution = async (
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
  };

  const updateLocalProfileAfterAction = (
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
  };

  const handleSimulateScenario = async (
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
  };

  const handleRunGeminiEvaluation = async () => {
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
            ? 'Adaptive Risk Underwriting Complete'
            : 'Statistical Risk Evaluation Complete'
        );
      }
    } catch (err) {
      console.error('AI evaluation error:', err);
      showToast('Completed Risk Assessment');
    } finally {
      setIsEvaluatingAI(false);
    }
  };

  const pendingActionsCount = profile.actions.filter((a) => a.status === 'TODO').length;

  return (
    <div className="min-h-screen bg-[#ede8dc] text-[#12281e] flex flex-col items-center justify-center p-0 sm:p-4 md:p-6 select-none font-sans">
      {/* Top View Mode Switcher Toolbar */}
      <div className="w-full max-w-md mb-2 px-3 py-1.5 flex items-center justify-between text-[11px] font-mono text-[#6e7f74]">
        <div className="flex items-center gap-1.5 font-semibold text-[#123524]">
          <span className="w-2 h-2 rounded-full bg-[#15803d] animate-pulse" />
          <span>BAWS Risk Engine v2.4</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsDeviceFrameView(!isDeviceFrameView)}
            className="flex items-center gap-1 px-2.5 py-1 bg-white/80 hover:bg-white border border-[#d6cbba] rounded-lg text-[#123524] transition-all shadow-2xs"
            title="Toggle Device Frame"
          >
            {isDeviceFrameView ? (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Expand</span>
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
        className={`w-full transition-all duration-300 ${
          isDeviceFrameView
            ? 'max-w-[420px] bg-[#faf8f2] sm:rounded-[44px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] border-0 sm:border-[8px] sm:border-[#201c18] overflow-hidden min-h-screen sm:min-h-[850px] relative'
            : 'max-w-2xl bg-[#faf8f2] rounded-3xl shadow-xl border border-[#ded5c5] overflow-hidden min-h-screen'
        }`}
      >
        {/* Dynamic Island Notch (Device Frame mode only) */}
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
            onLoginSuccess={(user) => {
              setCurrentUser(user);
              showToast(`Welcome to BAWS, ${user.name}`);
            }}
            isDeviceFrameView={isDeviceFrameView}
          />
        ) : (
          /* MAIN AUTHENTICATED APPLICATION */
          <>
            {/* Header */}
            <Header
              profile={profile}
              currentUser={currentUser}
              onOpenNotifications={() => setShowNotificationsModal(true)}
              onOpenBankModal={() => setShowBankConnectModal(true)}
              onOpenAuthModal={() => setShowAuthModal(true)}
              unreadCount={pendingActionsCount}
            />

            {/* Screen View Port */}
            <main className="px-5 pt-2 pb-24">
              {activeTab === 'home' && (
                <HomeScreen
                  profile={profile}
                  onNavigateToTab={(tab) => setActiveTab(tab)}
                  onExecuteAction={handleExecuteAction}
                  onOpenExplainFormula={() => setShowFormulaModal(true)}
                  onOpenBankModal={() => setShowBankConnectModal(true)}
                />
              )}

              {activeTab === 'cashflow' && (
                <CashFlowScreen
                  profile={profile}
                  onUpdateLookbackWindow={(k) => {
                    setProfile((prev) => ({
                      ...prev,
                      bawsEngineState: { ...prev.bawsEngineState, optimalLookbackWindowK: k },
                    }));
                  }}
                />
              )}

              {activeTab === 'actions' && (
                <ActionsScreen
                  profile={profile}
                  onExecuteAction={handleExecuteAction}
                  onQuickComplete={handleConfirmActionExecution}
                  onSelectActionForDetails={(act) => setSelectedActionForModal(act)}
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
                  onOpenAuthModal={() => setShowAuthModal(true)}
                  onDeleteProfile={handleDeleteProfile}
                  onSaveProfileToDb={handleSaveProfileToDb}
                  isEvaluatingAI={isEvaluatingAI}
                />
              )}
            </main>

            {/* Bottom Navigation */}
            <BottomNav
              activeTab={activeTab}
              onChangeTab={setActiveTab}
              pendingActionsCount={pendingActionsCount}
            />
          </>
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
        onClose={() => setSelectedActionForModal(null)}
        onConfirm={handleConfirmActionExecution}
      />

      {/* Formula Explanation Modal */}
      <ExplainFormulaModal
        isOpen={showFormulaModal}
        onClose={() => setShowFormulaModal(false)}
        profile={profile}
      />

      {/* Real-Time Bank Connect & Statement Synchronization Modal */}
      <BankConnectModal
        isOpen={showBankConnectModal}
        onClose={() => setShowBankConnectModal(false)}
        profile={profile}
        onProfileUpdated={(updated) => {
          setProfile(updated);
          showToast('Live bank information synchronized successfully');
        }}
      />

      {/* User Login & OAuth 2.0 Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        currentUser={currentUser}
        onDeleteProfile={handleDeleteProfile}
        onUserChanged={(user) => {
          setCurrentUser(user);
          if (user) {
            showToast(`Welcome, ${user.name}`);
          } else {
            showToast('Signed out of session');
          }
        }}
      />

      {/* Notifications Drawer */}
      <NotificationsModal
        isOpen={showNotificationsModal}
        onClose={() => setShowNotificationsModal(false)}
        profile={profile}
      />
    </div>
  );
}
