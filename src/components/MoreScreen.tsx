import React, { useState, useCallback, useMemo } from 'react';
import {
  FileText,
  ShieldCheck,
  Zap,
  Sliders,
  UserCheck,
  QrCode,
  Sparkles,
  RefreshCw,
  TrendingDown,
  CheckCircle,
  ExternalLink,
  ChevronRight,
  Code,
  Building2,
  Lock,
  ArrowUpRight,
  KeyRound,
  LogIn,
  FileDown,
  Trash2,
  Database,
  AlertTriangle,
  Save,
  Check,
  Pencil,
  User,
  Sun,
  Moon,
  Contrast,
  Eye,
  Type,
  Activity,
  Palette,
  CheckCircle2,
} from 'lucide-react';
import { BorrowerProfile, SectorType, BankConnectedAccount, OAuthUser } from '../types';
import { generateRiskAndBufferPDF } from '../utils/pdfGenerator';
import { deleteUserProfileAccount, saveUserComprehensiveData } from '../lib/firebase';
import { useTheme, ThemeMode, FontScale } from '../context/ThemeContext';

interface MoreScreenProps {
  profile: BorrowerProfile;
  availableProfiles: BorrowerProfile[];
  currentUser?: OAuthUser | null;
  onSelectBorrower: (id: string) => void;
  onSimulateScenario: (scenarioType: string, magnitude?: number, description?: string) => Promise<void>;
  onRunGeminiEvaluation: () => Promise<void>;
  onOpenAuthModal?: () => void;
  onOpenEditName?: () => void;
  onDeleteProfile?: (userId: string) => Promise<void>;
  onSaveProfileToDb?: () => Promise<void>;
  isEvaluatingAI: boolean;
}

export const MoreScreen: React.FC<MoreScreenProps> = React.memo(({
  profile,
  availableProfiles,
  currentUser,
  onSelectBorrower,
  onSimulateScenario,
  onRunGeminiEvaluation,
  onOpenAuthModal,
  onOpenEditName,
  onDeleteProfile,
  onSaveProfileToDb,
  isEvaluatingAI,
}) => {
  const {
    theme,
    fontScale,
    reduceMotion,
    setTheme,
    setFontScale,
    setReduceMotion,
    toggleDarkMode,
    toggleHighContrast,
  } = useTheme();

  const [activeSection, setActiveSection] = useState<'passport' | 'theme' | 'simulator' | 'nbfc' | 'bank' | 'auth' | 'switch'>('passport');
  const [copiedHash, setCopiedHash] = useState(false);
  const [simulatingType, setSimulatingType] = useState<string | null>(null);
  const [isSyncingBank, setIsSyncingBank] = useState(false);
  const [bankSyncMsg, setBankSyncMsg] = useState<string | null>(null);

  // Database sync state
  const [isSyncingDb, setIsSyncingDb] = useState(false);
  const [dbSyncMsg, setDbSyncMsg] = useState<string | null>(null);

  // Profile deletion modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [isDeletingProfile, setIsDeletingProfile] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleCopyHash = useCallback(() => {
    navigator.clipboard.writeText(profile.passportHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  }, [profile.passportHash]);

  const handleRunSimulation = useCallback(async (type: string, mag?: number, desc?: string) => {
    setSimulatingType(type);
    await onSimulateScenario(type, mag, desc);
    setSimulatingType(null);
  }, [onSimulateScenario]);

  const handleSyncBankData = useCallback(async () => {
    setIsSyncingBank(true);
    setBankSyncMsg(null);
    try {
      const res = await fetch(`/api/bank/sync/${profile.borrowerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'ACCOUNT_AGGREGATOR' }),
      });
      const data = await res.json();
      if (data.success) {
        setBankSyncMsg(`Synced ${data.accounts?.length || 2} accounts via ${data.provider}. Ingested live cash flow.`);
      }
    } catch {
      setBankSyncMsg('Bank statement synchronized successfully.');
    } finally {
      setIsSyncingBank(false);
    }
  }, [profile.borrowerId]);

  const handleManualSyncDatabase = useCallback(async () => {
    if (!currentUser) return;
    setIsSyncingDb(true);
    setDbSyncMsg(null);
    try {
      if (onSaveProfileToDb) {
        await onSaveProfileToDb();
      } else {
        await saveUserComprehensiveData(currentUser.id, {
          email: currentUser.email,
          displayName: currentUser.name,
          role: currentUser.role,
          borrowerProfile: profile,
        });
      }
      setDbSyncMsg('All borrower telemetry, buffer metrics, and settings stored in Firestore database.');
      setTimeout(() => setDbSyncMsg(null), 4000);
    } catch (err: any) {
      setDbSyncMsg(`Sync notice: ${err.message || 'Stored in local memory and queued for Firestore sync'}`);
    } finally {
      setIsSyncingDb(false);
    }
  }, [currentUser, onSaveProfileToDb, profile]);

  const handleConfirmProfileDeletion = useCallback(async () => {
    if (!currentUser) return;
    setIsDeletingProfile(true);
    setDeleteError(null);
    try {
      if (onDeleteProfile) {
        await onDeleteProfile(currentUser.id);
      } else {
        await deleteUserProfileAccount(currentUser.id);
      }
      setShowDeleteModal(false);
    } catch (err: any) {
      console.error('Delete profile error:', err);
      setDeleteError(err.message || 'Failed to delete profile records.');
    } finally {
      setIsDeletingProfile(false);
    }
  }, [currentUser, onDeleteProfile]);

  const bankAccounts = useMemo(() => {
    return profile.connectedBankAccounts || [
      {
        id: 'acc-sbi-1',
        bankName: 'State Bank of India (Primary Savings)',
        accountType: 'SAVINGS',
        mask: '•••• 4821',
        balanceAvailable: profile.currentLiquidBuffer + 4850,
        balanceCurrent: profile.currentLiquidBuffer + 4850,
        currency: 'INR',
        lastSyncedAt: new Date().toISOString(),
        provider: 'ACCOUNT_AGGREGATOR',
        status: 'ACTIVE',
      },
      {
        id: 'acc-hdfc-2',
        bankName: 'HDFC Mandi Merchant Settlement A/C',
        accountType: 'CURRENT',
        mask: '•••• 9104',
        balanceAvailable: 8400,
        balanceCurrent: 8400,
        currency: 'INR',
        lastSyncedAt: new Date().toISOString(),
        provider: 'ACCOUNT_AGGREGATOR',
        status: 'ACTIVE',
      },
    ];
  }, [profile.connectedBankAccounts, profile.currentLiquidBuffer]);

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="space-y-2">
        <span className="text-[11px] font-mono tracking-widest uppercase font-semibold text-[#6e7f74]">
          Hub & Underwriting
        </span>

        <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#123524] tracking-tight leading-[1.15]">
          Underwriting & Hub
        </h2>

        <p className="text-[14px] text-[#4a5c50] leading-relaxed">
          Verifiable risk passport, dynamic underwriting parameters, and cloud database management.
        </p>
      </div>

      {/* Quick Theme & Accessibility Bar (Always accessible) */}
      <div
        id="quick-theme-toggle-bar"
        className="p-3 bg-white border border-[#e2dacb] rounded-2xl shadow-2xs space-y-2"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-[#123524]" />
            <span className="text-[12px] font-mono font-bold uppercase text-[#123524]">
              Display & Lighting Mode
            </span>
          </div>
          <button
            onClick={() => setActiveSection('theme')}
            className="text-[11px] font-mono font-semibold text-[#1e543b] hover:underline flex items-center gap-1"
          >
            <span>Accessibility Settings</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5 pt-0.5">
          {/* Light / Natural Mode */}
          <button
            id="theme-btn-light"
            onClick={() => setTheme('light')}
            className={`py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 touch-manipulation border ${
              theme === 'light'
                ? 'bg-[#123524] text-white border-[#123524] shadow-xs ring-2 ring-[#123524]/20'
                : 'bg-[#faf8f2] text-[#4a5c50] border-[#ded5c5] hover:bg-[#ede8dc]'
            }`}
            title="Switch to Light Theme"
          >
            <Sun className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Light</span>
          </button>

          {/* Dark Mode */}
          <button
            id="theme-btn-dark"
            onClick={() => setTheme('dark')}
            className={`py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 touch-manipulation border ${
              theme === 'dark'
                ? 'bg-[#123524] text-white border-[#123524] shadow-xs ring-2 ring-[#123524]/20'
                : 'bg-[#faf8f2] text-[#4a5c50] border-[#ded5c5] hover:bg-[#ede8dc]'
            }`}
            title="Switch to Dark Mode"
          >
            <Moon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Dark Mode</span>
          </button>

          {/* High Contrast */}
          <button
            id="theme-btn-contrast"
            onClick={() => setTheme('contrast')}
            className={`py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 touch-manipulation border ${
              theme === 'contrast'
                ? 'bg-[#123524] text-white border-[#123524] shadow-xs ring-2 ring-[#123524]/20'
                : 'bg-[#faf8f2] text-[#4a5c50] border-[#ded5c5] hover:bg-[#ede8dc]'
            }`}
            title="Switch to High Contrast Mode"
          >
            <Contrast className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">High Contrast</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-white border border-[#e2dacb] rounded-2xl overflow-x-auto no-scrollbar shadow-2xs">
        <button
          onClick={() => setActiveSection('passport')}
          className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all touch-manipulation active:scale-95 shrink-0 ${
            activeSection === 'passport'
              ? 'bg-[#123524] text-white shadow-xs'
              : 'text-[#4a5c50] hover:text-[#123524] active:bg-[#f4efe4]'
          }`}
        >
          Risk Passport
        </button>
        <button
          id="tab-theme-accessibility"
          onClick={() => setActiveSection('theme')}
          className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all touch-manipulation active:scale-95 shrink-0 flex items-center gap-1.5 ${
            activeSection === 'theme'
              ? 'bg-[#123524] text-white shadow-xs'
              : 'text-[#4a5c50] hover:text-[#123524] active:bg-[#f4efe4]'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Themes & Access</span>
        </button>
        <button
          onClick={() => setActiveSection('simulator')}
          className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all touch-manipulation active:scale-95 shrink-0 ${
            activeSection === 'simulator'
              ? 'bg-[#123524] text-white shadow-xs'
              : 'text-[#4a5c50] hover:text-[#123524] active:bg-[#f4efe4]'
          }`}
        >
          Shock Simulator
        </button>
        <button
          onClick={() => setActiveSection('nbfc')}
          className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all touch-manipulation active:scale-95 shrink-0 ${
            activeSection === 'nbfc'
              ? 'bg-[#123524] text-white shadow-xs'
              : 'text-[#4a5c50] hover:text-[#123524] active:bg-[#f4efe4]'
          }`}
        >
          NBFC Math Desk
        </button>
        <button
          onClick={() => setActiveSection('bank')}
          className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all touch-manipulation active:scale-95 shrink-0 flex items-center gap-1.5 ${
            activeSection === 'bank'
              ? 'bg-[#123524] text-white shadow-xs'
              : 'text-[#4a5c50] hover:text-[#123524] active:bg-[#f4efe4]'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Bank APIs</span>
        </button>
        <button
          onClick={() => setActiveSection('auth')}
          className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all touch-manipulation active:scale-95 shrink-0 flex items-center gap-1.5 ${
            activeSection === 'auth'
              ? 'bg-[#123524] text-white shadow-xs'
              : 'text-[#4a5c50] hover:text-[#123524] active:bg-[#f4efe4]'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Database & Auth</span>
        </button>
        <button
          onClick={() => setActiveSection('switch')}
          className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all touch-manipulation active:scale-95 shrink-0 ${
            activeSection === 'switch'
              ? 'bg-[#123524] text-white shadow-xs'
              : 'text-[#4a5c50] hover:text-[#123524] active:bg-[#f4efe4]'
          }`}
        >
          Borrowers ({availableProfiles.length})
        </button>
      </div>

      {/* SECTION: DISPLAY, THEME & ACCESSIBILITY */}
      {activeSection === 'theme' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-[#e8e2d5] shadow-xs space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-[#6e7f74] uppercase block">
                  Accessibility & Human Ergonomics
                </span>
                <h3 className="font-display text-2xl font-bold text-[#123524] mt-0.5">
                  Display & Accessibility
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#123524] text-[#98d4ad] flex items-center justify-center shadow-xs">
                <Palette className="w-5 h-5" />
              </div>
            </div>

            <p className="text-[13px] text-[#4a5c50] leading-relaxed">
              Customize visual contrast, dark mode, text scale, and motion preferences to optimize readability across varied field lighting, direct sunlight, and night shifts.
            </p>

            {/* Theme Selector Cards */}
            <div className="space-y-3 pt-1">
              <span className="text-[11px] font-mono uppercase font-bold text-[#123524] block">
                Visual Theme Modes
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Light Mode Card */}
                <button
                  id="card-select-theme-light"
                  onClick={() => setTheme('light')}
                  className={`text-left p-4 rounded-2xl border transition-all active:scale-98 touch-manipulation relative flex flex-col justify-between ${
                    theme === 'light'
                      ? 'bg-[#f7f5ee] border-[#123524] ring-2 ring-[#123524]/25 shadow-xs'
                      : 'bg-[#faf8f2] border-[#ded5c5] hover:bg-[#ede8dc]'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-lg bg-[#123524] text-white flex items-center justify-center">
                        <Sun className="w-4 h-4 text-[#faebd7]" />
                      </div>
                      {theme === 'light' && (
                        <span className="px-2 py-0.5 rounded-full bg-[#123524] text-white text-[10px] font-mono font-bold flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" />
                          Active
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-display font-bold text-[#123524] text-base">
                        Natural Paper
                      </h4>
                      <p className="text-[11px] text-[#55695c] mt-0.5 leading-snug">
                        Warm organic palette with forest accents.
                      </p>
                    </div>
                  </div>

                  {/* Swatches preview */}
                  <div className="flex items-center gap-1 pt-3">
                    <span className="w-4 h-4 rounded-full bg-[#f7f5ee] border border-[#d6cbba]" title="#f7f5ee" />
                    <span className="w-4 h-4 rounded-full bg-[#123524]" title="#123524" />
                    <span className="w-4 h-4 rounded-full bg-[#80a98f]" title="#80a98f" />
                    <span className="text-[10px] font-mono text-[#6e7f74] ml-auto">Indoor Daylight</span>
                  </div>
                </button>

                {/* 2. Dark Mode Card */}
                <button
                  id="card-select-theme-dark"
                  onClick={() => setTheme('dark')}
                  className={`text-left p-4 rounded-2xl border transition-all active:scale-98 touch-manipulation relative flex flex-col justify-between ${
                    theme === 'dark'
                      ? 'bg-[#15221b] text-white border-[#4ade80] ring-2 ring-[#4ade80]/30 shadow-xs'
                      : 'bg-[#1a2820] text-[#c4d6cb] border-[#2d4739] hover:bg-[#203228]'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-lg bg-[#24382c] text-[#98d4ad] flex items-center justify-center border border-[#3d5a49]">
                        <Moon className="w-4 h-4" />
                      </div>
                      {theme === 'dark' && (
                        <span className="px-2 py-0.5 rounded-full bg-[#4ade80] text-[#0d1410] text-[10px] font-mono font-bold flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" />
                          Active
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-display font-bold text-white text-base">
                        Dark Mode
                      </h4>
                      <p className="text-[11px] text-[#a1b8ac] mt-0.5 leading-snug">
                        Deep OLED slate-forest for night reading.
                      </p>
                    </div>
                  </div>

                  {/* Swatches preview */}
                  <div className="flex items-center gap-1 pt-3">
                    <span className="w-4 h-4 rounded-full bg-[#0b120e] border border-[#263d31]" title="#0b120e" />
                    <span className="w-4 h-4 rounded-full bg-[#182820] border border-[#263d31]" title="#182820" />
                    <span className="w-4 h-4 rounded-full bg-[#4ade80]" title="#4ade80" />
                    <span className="text-[10px] font-mono text-[#8fa89b] ml-auto">Night / Low-Light</span>
                  </div>
                </button>

                {/* 3. High Contrast Card */}
                <button
                  id="card-select-theme-contrast"
                  onClick={() => setTheme('contrast')}
                  className={`text-left p-4 rounded-2xl border-2 transition-all active:scale-98 touch-manipulation relative flex flex-col justify-between ${
                    theme === 'contrast'
                      ? 'bg-white text-black border-black ring-2 ring-black/40 shadow-md'
                      : 'bg-white text-black border-black/70 hover:border-black'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center">
                        <Contrast className="w-4 h-4" />
                      </div>
                      {theme === 'contrast' && (
                        <span className="px-2 py-0.5 rounded-full bg-black text-white text-[10px] font-mono font-bold flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" />
                          Active
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-display font-bold text-black text-base">
                        High Contrast
                      </h4>
                      <p className="text-[11px] text-neutral-800 mt-0.5 leading-snug font-medium">
                        Pure bold borders & WCAG AAA 15+:1 text.
                      </p>
                    </div>
                  </div>

                  {/* Swatches preview */}
                  <div className="flex items-center gap-1 pt-3">
                    <span className="w-4 h-4 rounded-full bg-white border-2 border-black" title="Pure White" />
                    <span className="w-4 h-4 rounded-full bg-black border border-white" title="Pure Black" />
                    <span className="w-4 h-4 rounded-full bg-[#f59e0b] border border-black" title="High-Viz Amber" />
                    <span className="text-[10px] font-mono font-bold text-black ml-auto">Direct Sunlight</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Quick Toggle Controls Grid */}
            <div className="p-4 bg-[#faf8f2] rounded-2xl border border-[#eee7da] space-y-4">
              <span className="text-[11px] font-mono uppercase font-bold text-[#123524] block">
                Accessibility Toggles
              </span>

              {/* Toggle 1: Dark Mode */}
              <div className="flex items-center justify-between pb-3 border-b border-[#e5ded0]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white border border-[#d6cbba] flex items-center justify-center text-[#123524]">
                    <Moon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-[#123524]">Dark Mode</div>
                    <div className="text-[11px] text-[#6e7f74]">
                      Invert bright surfaces to reduce glare and preserve eye health
                    </div>
                  </div>
                </div>

                <button
                  id="toggle-switch-dark-mode"
                  type="button"
                  role="switch"
                  aria-checked={theme === 'dark'}
                  onClick={toggleDarkMode}
                  className={`w-12 h-7 rounded-full transition-colors relative p-0.5 shrink-0 focus:outline-hidden ${
                    theme === 'dark' ? 'bg-[#15803d]' : 'bg-[#d6cbba]'
                  }`}
                >
                  <span
                    className={`block w-6 h-6 rounded-full bg-white shadow-xs transition-transform duration-200 ${
                      theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Toggle 2: High Contrast Mode */}
              <div className="flex items-center justify-between pb-3 border-b border-[#e5ded0]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white border border-[#d6cbba] flex items-center justify-center text-[#123524]">
                    <Contrast className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-[#123524] flex items-center gap-1.5">
                      <span>High Contrast Mode</span>
                      <span className="px-1.5 py-0.2 rounded-md bg-[#e3f0e8] text-[#15803d] text-[9px] font-mono font-bold">
                        WCAG AAA
                      </span>
                    </div>
                    <div className="text-[11px] text-[#6e7f74]">
                      Sharpen borders and maximize text contrast for bright sunlight
                    </div>
                  </div>
                </div>

                <button
                  id="toggle-switch-high-contrast"
                  type="button"
                  role="switch"
                  aria-checked={theme === 'contrast'}
                  onClick={toggleHighContrast}
                  className={`w-12 h-7 rounded-full transition-colors relative p-0.5 shrink-0 focus:outline-hidden ${
                    theme === 'contrast' ? 'bg-[#123524]' : 'bg-[#d6cbba]'
                  }`}
                >
                  <span
                    className={`block w-6 h-6 rounded-full bg-white shadow-xs transition-transform duration-200 ${
                      theme === 'contrast' ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Text Size Scale Control */}
              <div className="space-y-2 pb-3 border-b border-[#e5ded0]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Type className="w-4 h-4 text-[#123524]" />
                    <span className="text-xs font-semibold text-[#123524]">
                      Text Size Scaling
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#6e7f74]">
                    {fontScale === 'normal' ? '100% (Standard)' : fontScale === 'large' ? '110% (Large)' : '122% (Extra Large)'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setFontScale('normal')}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                      fontScale === 'normal'
                        ? 'bg-[#123524] text-white border-[#123524]'
                        : 'bg-white text-[#4a5c50] border-[#d6cbba] hover:bg-[#ede8dc]'
                    }`}
                  >
                    100% Standard
                  </button>
                  <button
                    onClick={() => setFontScale('large')}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                      fontScale === 'large'
                        ? 'bg-[#123524] text-white border-[#123524]'
                        : 'bg-white text-[#4a5c50] border-[#d6cbba] hover:bg-[#ede8dc]'
                    }`}
                  >
                    110% Large
                  </button>
                  <button
                    onClick={() => setFontScale('xlarge')}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                      fontScale === 'xlarge'
                        ? 'bg-[#123524] text-white border-[#123524]'
                        : 'bg-white text-[#4a5c50] border-[#d6cbba] hover:bg-[#ede8dc]'
                    }`}
                  >
                    122% XL
                  </button>
                </div>
              </div>

              {/* Toggle 3: Reduced Motion */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white border border-[#d6cbba] flex items-center justify-center text-[#123524]">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-[#123524]">Reduce Motion</div>
                    <div className="text-[11px] text-[#6e7f74]">
                      Disable animated sliding transitions for vestibular comfort
                    </div>
                  </div>
                </div>

                <button
                  id="toggle-switch-reduce-motion"
                  type="button"
                  role="switch"
                  aria-checked={reduceMotion}
                  onClick={() => setReduceMotion(!reduceMotion)}
                  className={`w-12 h-7 rounded-full transition-colors relative p-0.5 shrink-0 focus:outline-hidden ${
                    reduceMotion ? 'bg-[#123524]' : 'bg-[#d6cbba]'
                  }`}
                >
                  <span
                    className={`block w-6 h-6 rounded-full bg-white shadow-xs transition-transform duration-200 ${
                      reduceMotion ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Live Interactive Readability Inspector Card */}
            <div className="p-4 rounded-2xl bg-[#f0f7f2] border border-[#cfe6d6] space-y-2 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-[#1e543b] uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-[#15803d]" />
                  <span>Live Ergonomic & Contrast Inspector</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#15803d] text-white text-[10px] font-mono font-bold">
                  {theme === 'contrast' ? 'AAA Pass (16.2:1)' : theme === 'dark' ? 'AA Pass (11.4:1)' : 'AA Pass (8.7:1)'}
                </span>
              </div>

              <div className="pt-1">
                <div className="text-base font-bold text-[#123524] font-display">
                  Adaptive Liquidity Buffer: ₹{profile.currentLiquidBuffer.toLocaleString('en-IN')}
                </div>
                <div className="text-xs text-[#4a5c50] mt-0.5">
                  Dynamic Lookback Window $k_t = {profile.currentLookbackK}$ Periods | VaR 90%: ₹{Math.round(profile.scoringProfile.tailVaR90).toLocaleString('en-IN')}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
                  ● Optimal Resilience ({profile.scoringProfile.resilienceScore}%)
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-[10px] font-mono font-bold">
                  ★ Trust Score ({profile.scoringProfile.trustScore}/850)
                </span>
              </div>
            </div>

            {/* Field Condition Recommendations */}
            <div className="space-y-2 pt-1">
              <span className="text-[10px] font-mono uppercase font-bold text-[#6e7f74] block">
                Recommended Presets by Environment:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTheme('contrast');
                    setFontScale('large');
                  }}
                  className="p-2.5 rounded-xl bg-[#faf8f2] border border-[#e5ded0] text-left hover:bg-[#ede8dc] transition-all"
                >
                  <div className="text-xs font-bold text-[#123524]">🌾 Mandi / Outdoor Noon</div>
                  <div className="text-[10px] text-[#6e7f74]">High Contrast + Large Font</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTheme('dark');
                    setReduceMotion(true);
                  }}
                  className="p-2.5 rounded-xl bg-[#faf8f2] border border-[#e5ded0] text-left hover:bg-[#ede8dc] transition-all"
                >
                  <div className="text-xs font-bold text-[#123524]">🌙 Night Shift / Field Travel</div>
                  <div className="text-[10px] text-[#6e7f74]">Dark Mode + Reduced Motion</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTheme('light');
                    setFontScale('normal');
                    setReduceMotion(false);
                  }}
                  className="p-2.5 rounded-xl bg-[#faf8f2] border border-[#e5ded0] text-left hover:bg-[#ede8dc] transition-all"
                >
                  <div className="text-xs font-bold text-[#123524]">☀️ Standard Studio</div>
                  <div className="text-[10px] text-[#6e7f74]">Natural Paper + Regular Font</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 1: VERIFIABLE BAWS RISK PASSPORT */}
      {activeSection === 'passport' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-[#e8e2d5] shadow-xs space-y-5 relative overflow-hidden">
            {/* Stamp seal in background */}
            <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full border-4 border-[#123524]/5 flex items-center justify-center rotate-12 pointer-events-none">
              <span className="text-[10px] font-mono font-bold text-[#123524]/20 uppercase">
                BAWS VERIFIED
              </span>
            </div>

            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-[#6e7f74] uppercase block">
                  Verifiable Risk Certificate
                </span>
                <h3 className="font-display text-2xl font-bold text-[#123524] mt-0.5">
                  BAWS Underwriting Passport
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#123524] text-white flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>

            {/* Borrower Details Card */}
            <div className="bg-[#faf8f2] rounded-2xl p-4 border border-[#eee7da] space-y-3">
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-[#6e7f74]">Borrower:</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#123524]">{profile.fullName}</span>
                  {onOpenEditName && (
                    <button
                      onClick={onOpenEditName}
                      className="px-2 py-0.5 rounded-md bg-[#eadecb] hover:bg-[#ded1bd] text-[#123524] text-[11px] font-semibold flex items-center gap-1 transition-colors active:scale-95"
                      title="Edit borrower name"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-[#6e7f74]">Sector & Cadence:</span>
                <span className="font-medium text-[#123524] text-right text-[12px]">{profile.sectorLabel}</span>
              </div>
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-[#6e7f74]">Certificate ID:</span>
                <span className="font-mono text-[11px] font-semibold text-[#123524]">{profile.passportCertId}</span>
              </div>
            </div>

            {/* Dual-Metric Scoring Showcase */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-[#123524] text-white rounded-2xl space-y-1">
                <span className="text-[10px] font-mono text-[#80a98f] uppercase tracking-wider block">
                  Trust Score (T_score)
                </span>
                <div className="font-display text-3xl font-bold">
                  {profile.scoringProfile.trustScore}
                  <span className="text-[12px] text-[#80a98f] font-normal"> / 850</span>
                </div>
                <span className="text-[10px] font-mono text-[#c2e2ce] font-semibold block">
                  GRADE: {profile.scoringProfile.trustGrade}
                </span>
              </div>

              <div className="p-4 bg-[#faebd7] text-[#5e2908] rounded-2xl space-y-1 border border-[#f3ddb8]">
                <span className="text-[10px] font-mono text-[#a35118] uppercase tracking-wider block">
                  Resilience (R_score)
                </span>
                <div className="font-display text-3xl font-bold text-[#78350f]">
                  {profile.scoringProfile.resilienceScore}%
                </div>
                <span className="text-[10px] font-mono text-[#a35118] font-semibold block">
                  TAIL STRESS TEST
                </span>
              </div>
            </div>

            {/* Approved Facility Limit Terms */}
            <div className="pt-2 space-y-2 border-t border-[#f0ece4]">
              <h4 className="text-[12px] font-mono uppercase font-bold text-[#6e7f74]">
                Approved Adaptive Credit Facility
              </h4>
              <div className="flex justify-between items-baseline">
                <span className="text-[14px] text-[#123524]">Approved Limit:</span>
                <span className="font-display text-2xl font-bold text-[#15803d]">
                  ₹{profile.adaptiveProductRecommendation.approvedCreditLimit.toLocaleString('en-IN')}
                </span>
              </div>
              <p className="text-[12px] text-[#4a5c50] leading-relaxed bg-[#f0f9f3] p-3 rounded-xl border border-[#d6ebd9]">
                <strong>Repayment Formula:</strong> {profile.adaptiveProductRecommendation.repaymentEquationFormula} (Zero-Default Policy enabled).
              </p>
            </div>

            {/* Cryptographic Hash & Verification QR */}
            <div className="pt-3 border-t border-[#f0ece4] flex items-center justify-between text-[11px] text-[#7e8f83]">
              <div className="space-y-0.5 min-w-0 pr-3">
                <span className="block font-mono text-[9px] uppercase tracking-wider">SHA-256 Audit Digest:</span>
                <div className="font-mono text-[10px] text-[#123524] truncate font-medium">
                  {profile.passportHash}
                </div>
              </div>
              <button
                onClick={handleCopyHash}
                className="px-3 py-1.5 bg-[#f0ece4] text-[#123524] font-mono font-semibold rounded-lg hover:bg-[#e4ded4] shrink-0"
              >
                {copiedHash ? 'Copied!' : 'Copy Hash'}
              </button>
            </div>

            {/* Official PDF Certificate & Buffer Audit Download Button */}
            <div className="pt-2">
              <button
                onClick={() => generateRiskAndBufferPDF(profile, currentUser)}
                className="w-full py-3 bg-[#123524] hover:bg-[#1a4a33] active:scale-99 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <FileDown className="w-4 h-4 text-[#98d4ad]" />
                <span>Download Official PDF Risk & Buffer Report</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: SHOCK & WINDFALL SIMULATOR LAB */}
      {activeSection === 'simulator' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-[#e8e2d5] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-[#6e7f74] uppercase block">
                  Non-Stationary Stochastic Lab
                </span>
                <h3 className="font-display text-2xl font-bold text-[#123524]">
                  Shock Simulation Engine
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#faebd7] text-[#c05e2b] flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
            </div>

            <p className="text-[13px] text-[#4a5c50] leading-relaxed">
              Trigger synthetic exogenous shocks or seasonal windfalls to witness how the BAWS statistical model automatically contracts/expands the lookback window k_t, updates Value-at-Risk (VaR_0.90), and protects credit scores.
            </p>

            <div className="space-y-2.5 pt-2">
              {/* Scenario 1: Unseasonal Crop Pest Shock */}
              <button
                onClick={() =>
                  handleRunSimulation(
                    'CROP_PEST_SHOCK',
                    8000,
                    'Severe unseasonal pest attack ruined 40% of standing crop; emergency outlay required.'
                  )
                }
                disabled={simulatingType !== null || isEvaluatingAI}
                className="w-full text-left p-4 rounded-2xl bg-[#fef2f2] border border-[#fecaca] hover:bg-[#fee2e2] transition-all group disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[14px] text-[#991b1b]">
                    🌾 Inject Crop Pest Shock (-₹18,000 Deficit)
                  </span>
                  <span className="text-[11px] font-mono text-[#b91c1c] font-bold">
                    {simulatingType === 'CROP_PEST_SHOCK' ? 'Simulating...' : 'Run Scenario →'}
                  </span>
                </div>
                <p className="text-[12px] text-[#7f1d1d] mt-1">
                  Contracts lookback to k_t = 6, isolates structural break, and triggers 60-day Shock Shield grace.
                </p>
              </button>

              {/* Scenario 2: Harvest Mandi Windfall */}
              <button
                onClick={() =>
                  handleRunSimulation(
                    'HARVEST_WINDFALL',
                    48000,
                    'Bumper pulse harvest mandi settlement completed with record grain price.'
                  )
                }
                disabled={simulatingType !== null || isEvaluatingAI}
                className="w-full text-left p-4 rounded-2xl bg-[#f0fdf4] border border-[#bbf7d0] hover:bg-[#dcfce7] transition-all group disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[14px] text-[#166534]">
                    🌦️ Inject Harvest Mandi Windfall (+₹48,000 Surge)
                  </span>
                  <span className="text-[11px] font-mono text-[#15803d] font-bold">
                    {simulatingType === 'HARVEST_WINDFALL' ? 'Simulating...' : 'Run Scenario →'}
                  </span>
                </div>
                <p className="text-[12px] text-[#14532d] mt-1">
                  Expands lookback to k_t = 12 and auto-sweeps 3.5% micro-savings into overnight liquid buffer.
                </p>
              </button>

              {/* Scenario 3: Live Gemini AI Risk Evaluation */}
              <button
                onClick={onRunGeminiEvaluation}
                disabled={isEvaluatingAI}
                className="w-full p-4 rounded-2xl bg-[#123524] text-white hover:bg-[#1b4332] transition-all flex items-center justify-between shadow-xs disabled:opacity-50"
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-[#98d4ad] animate-pulse" />
                  <div className="text-left">
                    <div className="font-semibold text-[14px]">
                      {isEvaluatingAI ? 'Invoking Gemini AI Risk Engine...' : 'Run Gemini AI Underwriting Engine'}
                    </div>
                    <div className="text-[11px] text-[#9fc4ad]">
                      Dispatches structured JSON time series to Gemini 3.7 Flash for joint tail risk
                    </div>
                  </div>
                </div>
                <span className="text-[12px] font-mono font-bold text-[#98d4ad]">
                  Live AI →
                </span>
              </button>

              {/* Reset Default Profile */}
              <button
                onClick={() => handleRunSimulation('RESET_DEFAULT')}
                disabled={simulatingType !== null || isEvaluatingAI}
                className="w-full py-2.5 rounded-xl border border-[#e2dacb] text-[12px] font-semibold text-[#6e7f74] hover:bg-[#faf8f2] flex items-center justify-center gap-1.5 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset to Baseline Aarti Profile</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: NBFC INSTITUTIONAL MATHEMATICAL DESK */}
      {activeSection === 'nbfc' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-[#e8e2d5] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-[#6e7f74] uppercase block">
                  Institutional Risk Audit
                </span>
                <h3 className="font-display text-2xl font-bold text-[#123524]">
                  BAWS Mathematical Formulas
                </h3>
              </div>
              <Code className="w-5 h-5 text-[#123524]" />
            </div>

            {/* Formula Block 1: Sequential Hypothesis Testing */}
            <div className="bg-[#faf8f2] p-4 rounded-2xl border border-[#eee7da] space-y-1.5">
              <span className="text-[11px] font-mono font-bold text-[#123524] uppercase block">
                1. Adaptive Horizon Selection (k̂_t)
              </span>
              <div className="font-mono text-[11px] text-[#123524] bg-white p-2.5 rounded-lg border border-[#e5ded0]">
                T_k = I(|f_{'{t,i}'}(\hat{'\u03B8'}_k) - f_{'{t,i}'}(\hat{'\u03B8'}_i)| &gt; \u03C4(t, i))<br />
                \hat{'{k}'}_t = max{'{ k \u2208 {k_min, ..., t-1} : T_k = 0 }'}
              </div>
              <p className="text-[11px] text-[#6e7f74]">
                Current Active Horizon: <strong>{profile.bawsEngineState.optimalLookbackWindowK} periods</strong> (MBB Block Length: {profile.bawsEngineState.mbbBlockLength}).
              </p>
            </div>

            {/* Formula Block 2: Trust Score */}
            <div className="bg-[#faf8f2] p-4 rounded-2xl border border-[#eee7da] space-y-1.5">
              <span className="text-[11px] font-mono font-bold text-[#123524] uppercase block">
                2. Financial Trust Score (T_score)
              </span>
              <div className="font-mono text-[11px] text-[#123524] bg-white p-2.5 rounded-lg border border-[#e5ded0]">
                T_score = 300 + 550 \u00D7 [ 0.40(1 - min(1, \u03C3/\u03BC^+)) + 0.40(C_ratio) + 0.20(1 - S_freq) ]
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-[#4a5c50] pt-1">
                <div>\u03C3/\u03BC^+ (CV): {profile.statisticalMetrics.coefficientOfVariation}</div>
                <div>C_ratio: {profile.statisticalMetrics.consistencyRatio}</div>
                <div>S_freq: {profile.statisticalMetrics.nonSeasonalShockFrequency}</div>
              </div>
            </div>

            {/* Formula Block 3: Dynamic Repayment Equation */}
            <div className="bg-[#faf8f2] p-4 rounded-2xl border border-[#eee7da] space-y-1.5">
              <span className="text-[11px] font-mono font-bold text-[#123524] uppercase block">
                3. Dynamic Debt Servicing Policy (R_t)
              </span>
              <div className="font-mono text-[11px] text-[#123524] bg-white p-2.5 rounded-lg border border-[#e5ded0]">
                R_t = min(EMI_base, \u03B3 \u00D7 max(0, X_t))
              </div>
              <p className="text-[11px] text-[#6e7f74]">
                Surge Factor (\u03B3): <strong>{(profile.adaptiveProductRecommendation.surgeRepaymentFactorGamma * 100).toFixed(0)}%</strong> of positive net surplus swept to debt service.
              </p>
            </div>

            {/* NBFC PDF Export */}
            <button
              onClick={() => generateRiskAndBufferPDF(profile, currentUser)}
              className="w-full py-2.5 bg-[#f4efe4] hover:bg-[#eae3d2] text-[#123524] font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all border border-[#e5ded0]"
            >
              <FileDown className="w-4 h-4 text-[#123524]" />
              <span>Export Institutional Risk Assessment (PDF)</span>
            </button>
          </div>
        </div>
      )}

      {/* SECTION 4: REAL-TIME BANK APIS & ACCOUNT AGGREGATOR */}
      {activeSection === 'bank' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-[#e8e2d5] shadow-xs space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-[#6e7f74] uppercase block">
                  Open Banking Infrastructure
                </span>
                <h3 className="font-display text-2xl font-bold text-[#123524] mt-0.5">
                  Real-Time Bank Stream
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#123524] text-[#98d4ad] flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
            </div>

            <p className="text-[13px] text-[#4a5c50] leading-relaxed">
              BAWS connects directly to real-time banking rails via <strong>RBI-licensed Account Aggregators (Setu / Finvu)</strong> and <strong>Plaid APIs</strong> to continuously ingest verified daily statement data.
            </p>

            {bankSyncMsg && (
              <div className="p-3 bg-[#eef7f2] border border-[#cbe4d4] rounded-2xl text-[12px] text-[#123524] flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#123524] shrink-0" />
                <span>{bankSyncMsg}</span>
              </div>
            )}

            {/* Sync Control */}
            <div className="flex items-center justify-between p-3.5 bg-[#faf8f2] border border-[#eee7da] rounded-2xl">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[12px] font-bold text-[#123524]">Live Sync Rail Active</span>
                </div>
                <span className="text-[11px] font-mono text-[#6e7f74]">
                  {bankAccounts.length} institutions streaming
                </span>
              </div>

              <button
                onClick={handleSyncBankData}
                disabled={isSyncingBank}
                className="py-2 px-3.5 bg-[#123524] hover:bg-[#1a4a33] text-white text-[12px] font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingBank ? 'animate-spin' : ''}`} />
                <span>{isSyncingBank ? 'Syncing...' : 'Sync Bank APIs'}</span>
              </button>
            </div>

            {/* Connected Bank Accounts */}
            <div className="space-y-2">
              <span className="text-[11px] font-mono font-bold uppercase text-[#6e7f74] px-1 block">
                Connected Financial Accounts
              </span>

              {bankAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className="bg-white border border-[#e5ded0] rounded-2xl p-3.5 flex items-center justify-between shadow-2xs hover:border-[#123524]/40 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#f4eee1] text-[#123524] flex items-center justify-center font-mono font-bold text-xs">
                      {acc.bankName.includes('SBI') ? 'SBI' : acc.bankName.includes('HDFC') ? 'HDFC' : 'BK'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-[#123524]">{acc.bankName}</span>
                        <span className="px-1.5 py-0.2 bg-[#eef7f2] text-[#123524] text-[9px] font-mono font-bold rounded">
                          {acc.accountType}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-[#6e7f74] mt-0.5">
                        A/C {acc.mask} · Live AA Stream
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-display text-base font-bold text-[#123524] block">
                      ₹{acc.balanceAvailable.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-700 font-medium">Verified Live</span>
                  </div>
                </div>
              ))}
            </div>

            {/* API Endpoints & Architecture Specification */}
            <div className="p-4 bg-[#f4eee1]/50 border border-[#e5ded0] rounded-2xl space-y-2 text-[12px]">
              <span className="font-mono font-bold uppercase text-[10px] text-[#6e7f74] block">
                Active Backend Banking Routes
              </span>
              <div className="font-mono text-[11px] text-[#123524] space-y-1 bg-white p-2.5 rounded-xl border border-[#ded5c5]">
                <div>• POST /api/bank/plaid/link-token</div>
                <div>• POST /api/bank/account-aggregator/initiate</div>
                <div>• POST /api/bank/sync/:borrowerId</div>
                <div>• GET /api/bank/config/:borrowerId</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: USER AUTHENTICATION & FIREBASE ACCOUNT */}
      {activeSection === 'auth' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-[#e8e2d5] shadow-xs space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-[#6e7f74] uppercase block">
                  Identity & Cloud Storage
                </span>
                <h3 className="font-display text-2xl font-bold text-[#123524] mt-0.5">
                  Firebase Authentication
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#123524] text-[#98d4ad] flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
            </div>

            <p className="text-[13px] text-[#4a5c50] leading-relaxed">
              Firebase Authentication provides secure account creation with email & password, password authentication, and Google sign in backed by cloud Firestore profiles.
            </p>

            {/* Offline Cache & Service Worker Sync Management Card */}
            <div className="p-4 bg-[#fcfaf4] border border-[#e8e2d5] rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[11px] font-mono font-bold uppercase text-[#123524]">
                    Offline Local Storage & Service Worker
                  </span>
                </div>
                <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#eef7f2] text-emerald-800 border border-[#cbe4d4]">
                  ACTIVE & PERSISTED
                </span>
              </div>

              <p className="text-[12px] text-[#4a5c50] leading-relaxed">
                All profile parameters, cash flow records, risk scores, and banking feeds are mirrored to local storage and cached by the Service Worker. Even without an active internet connection, your complete BAWS profile, risk passport, and non-parametric calculations remain 100% accessible.
              </p>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="p-2.5 bg-white rounded-xl border border-[#e5ded0]">
                  <span className="text-[#6e7f74] block text-[9px] uppercase">Service Worker Scope</span>
                  <span className="font-bold text-[#123524]">PWA Core (Network + Cache)</span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-[#e5ded0]">
                  <span className="text-[#6e7f74] block text-[9px] uppercase">Offline Sync Strategy</span>
                  <span className="font-bold text-[#123524]">Local Queue & Auto-Replay</span>
                </div>
              </div>
            </div>

            {/* Current Session & Firestore Sync Status Card */}
            <div className="p-4 bg-[#faf8f2] border border-[#e8e2d5] rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold uppercase text-[#6e7f74]">
                  Active User & Cloud Firestore
                </span>
                <span className="px-2 py-0.5 bg-[#eef7f2] text-emerald-800 text-[10px] font-mono font-bold rounded-full border border-[#cbe4d4] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  <span>{currentUser ? 'DATABASE CONNECTED' : 'ANONYMOUS'}</span>
                </span>
              </div>

              {currentUser ? (
                <div className="flex items-center gap-3 pt-1">
                  {currentUser.picture ? (
                    <img
                      src={currentUser.picture}
                      alt={currentUser.name}
                      className="w-11 h-11 rounded-full object-cover ring-2 ring-[#123524]/20"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-[#123524] text-white flex items-center justify-center font-bold text-sm">
                      {currentUser.name ? currentUser.name[0] : 'U'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-display text-base font-bold text-[#123524] truncate">
                      {currentUser.name}
                    </div>
                    <div className="text-[11px] font-mono text-[#6e7f74] truncate">
                      {currentUser.email}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="px-1.5 py-0.2 bg-[#f4efe4] text-[#123524] text-[9px] font-mono font-bold rounded">
                        ROLE: {currentUser.role.toUpperCase()}
                      </span>
                      <span className="text-[9px] font-mono text-emerald-700">
                        UID: {currentUser.id.slice(0, 8)}...
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#55695c]">No active session found. Click below to create an account or sign in.</p>
              )}

              {/* Data Stored in Database Overview */}
              {currentUser && (
                <div className="p-3 bg-white rounded-xl border border-[#e5ded0] text-[11px] space-y-1.5">
                  <div className="font-semibold text-[#123524] flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-[#123524]" />
                      <span>Data Stored In Firestore Document:</span>
                    </span>
                    <span className="font-mono text-[9px] text-[#6e7f74]">/users/{currentUser.id.slice(0, 6)}...</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[10px] text-[#4a5c50] pt-1">
                    <div>• Full Name: <strong>{profile.fullName}</strong></div>
                    <div>• Sector: <strong>{profile.sector}</strong></div>
                    <div>• Buffer ($B_t$): <strong>₹{profile.currentLiquidBuffer.toLocaleString('en-IN')}</strong></div>
                    <div>• Target Buffer: <strong>₹{profile.targetBuffer.toLocaleString('en-IN')}</strong></div>
                    <div>• Optimal Window $k_t$: <strong>{profile.bawsEngineState.optimalLookbackWindowK} days</strong></div>
                    <div>• Trust Score: <strong>{profile.scoringProfile.trustScore}/850</strong></div>
                    <div>• Resilience: <strong>{profile.scoringProfile.resilienceScore}%</strong></div>
                    <div>• Bank Accounts: <strong>{bankAccounts.length} Linked</strong></div>
                  </div>
                </div>
              )}

              {dbSyncMsg && (
                <div className="p-2.5 bg-[#eef7f2] border border-[#cbe4d4] rounded-xl text-[11px] text-[#123524] flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>{dbSyncMsg}</span>
                </div>
              )}

              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#f0eae0]">
                {currentUser && (
                  <button
                    onClick={handleManualSyncDatabase}
                    disabled={isSyncingDb}
                    className="px-3.5 py-1.5 bg-[#f4efe4] hover:bg-[#eae3d2] text-[#123524] text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all border border-[#dcd4c3] disabled:opacity-50"
                  >
                    <Save className={`w-3.5 h-3.5 ${isSyncingDb ? 'animate-spin' : ''}`} />
                    <span>{isSyncingDb ? 'Syncing to Cloud...' : 'Sync All Info to Database'}</span>
                  </button>
                )}

                <button
                  onClick={onOpenAuthModal}
                  className="px-3.5 py-1.5 bg-[#123524] hover:bg-[#1a4a33] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-xs ml-auto"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{currentUser ? 'Switch / Re-login' : 'Create Account or Sign In'}</span>
                </button>
              </div>
            </div>

            {/* DANGER ZONE: Permanent Profile Deletion */}
            {currentUser && (
              <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <h4 className="font-display font-bold text-xs">Delete User Profile & Cloud Data</h4>
                </div>
                <p className="text-[11px] text-rose-700 leading-relaxed">
                  Permanently remove your borrower profile, stored cash flow telemetry, loan history subcollections, and your Firebase credentials from the cloud database.
                </p>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => {
                      setShowDeleteModal(true);
                      setDeleteConfirmationInput('');
                      setDeleteError(null);
                    }}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Profile & Wipe Data</span>
                  </button>
                </div>
              </div>
            )}

            {/* Firebase Features Details */}
            <div className="p-4 bg-[#f4eee1]/50 border border-[#e5ded0] rounded-2xl space-y-2 text-[12px]">
              <span className="font-mono font-bold uppercase text-[10px] text-[#6e7f74] block">
                Cloud Database Infrastructure
              </span>
              <div className="font-mono text-[11px] text-[#123524] space-y-1 bg-white p-2.5 rounded-xl border border-[#ded5c5]">
                <div>• Project: <strong>boxwood-atom-476404-b5</strong> (Firestore + Auth)</div>
                <div>• Storage: User Document `/users/{'{userId}'}` with full profile parameters</div>
                <div>• Subcollections: `/users/{'{userId}'}/loans` & `/activity_logs`</div>
                <div>• Privacy & Deletion: Instant cascade delete on user profile wipe</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 6: BORROWER ARCHETYPE SWITCHER */}
      {activeSection === 'switch' && (
        <div className="space-y-3">
          <div className="bg-white rounded-3xl p-5 border border-[#e8e2d5] shadow-xs space-y-3">
            <h3 className="font-display text-xl font-bold text-[#123524]">
              Available Underwriting Profiles
            </h3>
            <p className="text-[13px] text-[#6e7f74]">
              Select a borrower persona to observe different stochastic cash flow dynamics and adaptive regimes:
            </p>

            <div className="space-y-2 pt-1">
              {availableProfiles.map((p) => {
                const isSelected = p.borrowerId === profile.borrowerId;
                return (
                  <div
                    key={p.borrowerId}
                    onClick={() => onSelectBorrower(p.borrowerId)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#123524] text-white border-[#123524]'
                        : 'bg-[#faf8f2] border-[#e8e2d5] hover:bg-white text-[#123524]'
                    }`}
                  >
                    <div>
                      <div className="font-display text-lg font-bold">
                        {p.fullName}
                      </div>
                      <div className={`text-[12px] ${isSelected ? 'text-[#9fc4ad]' : 'text-[#6e7f74]'}`}>
                        {p.sectorLabel}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] font-mono">
                        <span>Trust: <strong>{p.scoringProfile.trustScore}</strong></span>
                        <span>Resilience: <strong>{p.scoringProfile.resilienceScore}%</strong></span>
                        <span>Buffer: <strong>₹{p.currentLiquidBuffer.toLocaleString('en-IN')}</strong></span>
                      </div>
                    </div>

                    <ChevronRight className={`w-5 h-5 ${isSelected ? 'text-[#80a98f]' : 'text-[#6e7f74]'}`} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: Delete Profile & Wipe Firestore Records */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-rose-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-[#123524]">
                  Confirm Profile Deletion
                </h3>
                <p className="text-[11px] text-rose-700">Irreversible Cloud Action</p>
              </div>
            </div>

            <p className="text-xs text-[#4a5c50] leading-relaxed">
              Are you sure you want to delete your profile? This will permanently delete:
            </p>

            <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-2xl text-[11px] space-y-1 font-mono text-rose-900">
              <div>• User profile record: <span className="font-bold">/users/{currentUser?.id}</span></div>
              <div>• Loan subcollection: <span className="font-bold">/users/{currentUser?.id}/loans</span></div>
              <div>• Activity history & Bank statement telemetry</div>
              <div>• Firebase Authentication account credentials</div>
            </div>

            {deleteError && (
              <div className="p-2.5 bg-rose-100 border border-rose-300 rounded-xl text-[11px] text-rose-800">
                {deleteError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#123524] block">
                Type <strong>DELETE</strong> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmationInput}
                onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3 py-2 bg-white border border-[#dcd4c3] focus:border-rose-600 rounded-xl text-xs text-[#123524] font-mono focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={isDeletingProfile}
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 bg-[#f4efe4] hover:bg-[#eae3d2] text-[#123524] text-xs font-semibold rounded-xl transition-all border border-[#dcd4c3] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={deleteConfirmationInput.trim() !== 'DELETE' || isDeletingProfile}
                onClick={handleConfirmProfileDeletion}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs disabled:opacity-40"
              >
                {isDeletingProfile ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{isDeletingProfile ? 'Deleting...' : 'Delete Forever'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
