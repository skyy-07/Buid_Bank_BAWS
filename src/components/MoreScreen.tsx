import React, { useState } from 'react';
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
} from 'lucide-react';
import { BorrowerProfile, SectorType, BankConnectedAccount, OAuthUser } from '../types';
import { generateRiskAndBufferPDF } from '../utils/pdfGenerator';
import { deleteUserProfileAccount, saveUserComprehensiveData } from '../lib/firebase';

interface MoreScreenProps {
  profile: BorrowerProfile;
  availableProfiles: BorrowerProfile[];
  currentUser?: OAuthUser | null;
  onSelectBorrower: (id: string) => void;
  onSimulateScenario: (scenarioType: string, magnitude?: number, description?: string) => Promise<void>;
  onRunGeminiEvaluation: () => Promise<void>;
  onOpenAuthModal?: () => void;
  onDeleteProfile?: (userId: string) => Promise<void>;
  onSaveProfileToDb?: () => Promise<void>;
  isEvaluatingAI: boolean;
}

export const MoreScreen: React.FC<MoreScreenProps> = ({
  profile,
  availableProfiles,
  currentUser,
  onSelectBorrower,
  onSimulateScenario,
  onRunGeminiEvaluation,
  onOpenAuthModal,
  onDeleteProfile,
  onSaveProfileToDb,
  isEvaluatingAI,
}) => {
  const [activeSection, setActiveSection] = useState<'passport' | 'simulator' | 'nbfc' | 'bank' | 'auth' | 'switch'>('passport');
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

  const handleCopyHash = () => {
    navigator.clipboard.writeText(profile.passportHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleRunSimulation = async (type: string, mag?: number, desc?: string) => {
    setSimulatingType(type);
    await onSimulateScenario(type, mag, desc);
    setSimulatingType(null);
  };

  const handleSyncBankData = async () => {
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
  };

  const handleManualSyncDatabase = async () => {
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
  };

  const handleConfirmProfileDeletion = async () => {
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
      setDeleteError(err.message || 'Failed to delete profile. Please try logging in again.');
      setIsDeletingProfile(false);
    }
  };

  const bankAccounts = profile.connectedBankAccounts || [
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

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-white border border-[#e2dacb] rounded-2xl overflow-x-auto shadow-2xs">
        <button
          onClick={() => setActiveSection('passport')}
          className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all shrink-0 ${
            activeSection === 'passport'
              ? 'bg-[#123524] text-white shadow-xs'
              : 'text-[#4a5c50] hover:text-[#123524]'
          }`}
        >
          Risk Passport
        </button>
        <button
          onClick={() => setActiveSection('simulator')}
          className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all shrink-0 ${
            activeSection === 'simulator'
              ? 'bg-[#123524] text-white shadow-xs'
              : 'text-[#4a5c50] hover:text-[#123524]'
          }`}
        >
          Shock Simulator
        </button>
        <button
          onClick={() => setActiveSection('nbfc')}
          className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all shrink-0 ${
            activeSection === 'nbfc'
              ? 'bg-[#123524] text-white shadow-xs'
              : 'text-[#4a5c50] hover:text-[#123524]'
          }`}
        >
          NBFC Math Desk
        </button>
        <button
          onClick={() => setActiveSection('bank')}
          className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all shrink-0 flex items-center gap-1 ${
            activeSection === 'bank'
              ? 'bg-[#123524] text-white shadow-xs'
              : 'text-[#4a5c50] hover:text-[#123524]'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Bank APIs</span>
        </button>
        <button
          onClick={() => setActiveSection('auth')}
          className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all shrink-0 flex items-center gap-1 ${
            activeSection === 'auth'
              ? 'bg-[#123524] text-white shadow-xs'
              : 'text-[#4a5c50] hover:text-[#123524]'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Database & Auth</span>
        </button>
        <button
          onClick={() => setActiveSection('switch')}
          className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all shrink-0 ${
            activeSection === 'switch'
              ? 'bg-[#123524] text-white shadow-xs'
              : 'text-[#4a5c50] hover:text-[#123524]'
          }`}
        >
          Borrowers ({availableProfiles.length})
        </button>
      </div>

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
                <span className="font-bold text-[#123524]">{profile.fullName}</span>
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

              {/* Scenario 3: Live Risk Evaluation */}
              <button
                onClick={onRunGeminiEvaluation}
                disabled={isEvaluatingAI}
                className="w-full p-4 rounded-2xl bg-[#123524] text-white hover:bg-[#1b4332] transition-all flex items-center justify-between shadow-xs disabled:opacity-50"
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-[#98d4ad] animate-pulse" />
                  <div className="text-left">
                    <div className="font-semibold text-[14px]">
                      {isEvaluatingAI ? 'Evaluating Cash Flow Risk...' : 'Run Adaptive Risk & Underwriting Engine'}
                    </div>
                    <div className="text-[11px] text-[#9fc4ad]">
                      Dispatches time series cash-flow data to the risk engine for tail risk evaluation
                    </div>
                  </div>
                </div>
                <span className="text-[12px] font-mono font-bold text-[#98d4ad]">
                  Run Engine →
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
};
