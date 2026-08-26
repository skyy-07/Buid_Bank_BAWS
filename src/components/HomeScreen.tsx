import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  TrendingDown,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Info,
  Sparkles,
  Building2,
  RefreshCw,
  FileDown,
  Award,
  PartyPopper,
} from 'lucide-react';
import { BorrowerProfile, ActionItem } from '../types';
import { LiquidBufferChart } from './LiquidBufferChart';
import { generateRiskAndBufferPDF } from '../utils/pdfGenerator';
import { CelebrationOverlay, getMilestoneForScore, RESILIENCE_MILESTONES } from './CelebrationOverlay';

interface HomeScreenProps {
  profile: BorrowerProfile;
  onNavigateToTab: (tab: 'cashflow' | 'actions' | 'more') => void;
  onExecuteAction: (action: ActionItem) => void;
  onOpenExplainFormula: () => void;
  onOpenBankModal?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = React.memo(({
  profile,
  onNavigateToTab,
  onExecuteAction,
  onOpenExplainFormula,
  onOpenBankModal,
}) => {
  const [showFormulaDetails, setShowFormulaDetails] = useState(false);
  const [isQuickSyncing, setIsQuickSyncing] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);

  // Celebratory overlay state
  const [isCelebrationOpen, setIsCelebrationOpen] = useState(false);
  const [celebrationPrevScore, setCelebrationPrevScore] = useState(65.0);
  const [celebrationNewScore, setCelebrationNewScore] = useState(profile.scoringProfile.resilienceScore);
  const [thresholdCrossed, setThresholdCrossed] = useState(70);

  // Score calculation data
  const resilience = profile.scoringProfile.resilienceScore;
  const trustScore100 = profile.scoringProfile.trustScore100;
  const liquidBuffer = profile.currentLiquidBuffer;
  const essentialDays = profile.scoringProfile.formulaBreakdown.essentialDaysCovered || 9;

  // Track previous resilience score to detect user-driven increases across milestones
  const prevResilienceRef = useRef<number>(resilience);
  const isInitialMountRef = useRef<boolean>(true);

  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      prevResilienceRef.current = resilience;
      return;
    }

    const prevScore = prevResilienceRef.current;
    const currentScore = resilience;

    // Check if score has increased
    if (currentScore > prevScore) {
      // Check threshold milestones (85, 80, 75, 70)
      const crossedMilestone = RESILIENCE_MILESTONES.find(
        (m) => prevScore < m.threshold && currentScore >= m.threshold
      );

      // Or significant increase of >= 2.5 points
      if (crossedMilestone || currentScore - prevScore >= 2.5) {
        const threshold = crossedMilestone ? crossedMilestone.threshold : (currentScore >= 70 ? 70 : 65);
        setCelebrationPrevScore(prevScore);
        setCelebrationNewScore(currentScore);
        setThresholdCrossed(threshold);
        setIsCelebrationOpen(true);
      }
    }

    prevResilienceRef.current = currentScore;
  }, [resilience]);

  const handleDownloadPDF = useCallback(() => {
    setIsGeneratingPDF(true);
    try {
      generateRiskAndBufferPDF(profile);
      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 3500);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setIsGeneratingPDF(false);
    }
  }, [profile]);

  const handleManualCelebrationPreview = useCallback(() => {
    setCelebrationPrevScore(Math.max(50, Number((resilience - 6).toFixed(1))));
    setCelebrationNewScore(resilience);
    setThresholdCrossed(resilience >= 85 ? 85 : resilience >= 80 ? 80 : resilience >= 75 ? 75 : 70);
    setIsCelebrationOpen(true);
  }, [resilience]);

  const handleCloseCelebration = useCallback(() => {
    setIsCelebrationOpen(false);
  }, []);

  const activeMilestone = useMemo(() => getMilestoneForScore(resilience), [resilience]);

  // Sweep action item for quick trigger
  const sweepAction = useMemo(() => {
    return profile.actions.find((a) => a.actionType === 'SWEEP_RESERVE') || profile.actions[2];
  }, [profile.actions]);

  const bankAccounts = useMemo(() => {
    return profile.connectedBankAccounts || [
      { id: '1', bankName: 'State Bank of India', mask: '•••• 4821', balanceAvailable: profile.currentLiquidBuffer + 4850, accountType: 'SAVINGS' },
      { id: '2', bankName: 'HDFC Mandi Merchant', mask: '•••• 9104', balanceAvailable: 8400, accountType: 'CURRENT' },
    ];
  }, [profile.connectedBankAccounts, profile.currentLiquidBuffer]);

  // Circular gauge parameters
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (resilience / 100) * circumference;

  // Daily pulse bars simulation for current month (1 Aug - Today)
  const pulseBars = [
    { day: '1', height: 45, isPositive: true },
    { day: '2', height: 28, isPositive: true },
    { day: '3', height: 58, isPositive: true },
    { day: '4', height: 35, isPositive: true },
    { day: '5', height: 70, isPositive: true },
    { day: '6', height: 48, isPositive: true },
    { day: '7', height: 60, isPositive: true },
    { day: '8', height: 42, isPositive: true },
    { day: '9', height: 50, isPositive: true },
    { day: '10', height: 65, isPositive: true },
    { day: '11', height: 72, isPositive: false }, // deficit / pressure days
    { day: '12', height: 55, isPositive: false },
    { day: '13', height: 62, isPositive: false },
    { day: '14', height: 48, isPositive: false },
    { day: '15', height: 58, isPositive: false },
    { day: '16', height: 68, isPositive: false },
  ];

  return (
    <div className="space-y-4 pb-24">
      {/* 1. Pressure Status Alert Banner */}
      {profile.pressureStatusBanner.isUnderPressure && (
        <div className="bg-[#fbf4e8] border border-[#f3ddb8] rounded-2xl p-4 transition-all">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#e89b4f]/20 flex items-center justify-center text-[#b45309] shrink-0 mt-0.5">
              <TrendingDown className="w-4.5 h-4.5 stroke-[2.2]" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-[15px] text-[#78350f] leading-tight">
                {profile.pressureStatusBanner.title}
              </h2>
              <p className="text-[13px] text-[#92400e] mt-1 leading-snug">
                {profile.pressureStatusBanner.description}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Financial Resilience Hero Card (Dark Forest Green) */}
      <div className="bg-[#123524] text-white rounded-3xl p-5 shadow-sm overflow-hidden relative">
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-[#23583d]/30 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />

        <div className="flex items-center justify-between mb-2 relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono tracking-widest uppercase font-semibold text-[#80a98f]">
              Financial Resilience
            </span>
            {resilience >= 70 && (
              <button
                onClick={handleManualCelebrationPreview}
                className="px-2 py-0.5 bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 text-[10px] font-mono font-bold rounded-full border border-amber-300/40 flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-xs animate-pulse"
                title="View Unlocked Milestone Perks"
              >
                <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                <span>{activeMilestone.tierName.split('·')[0].trim()}</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleManualCelebrationPreview}
              className="text-amber-300 hover:text-amber-200 transition-colors p-1"
              title="Test & Celebrate Milestone"
              aria-label="Celebrate Resilience Milestone"
            >
              <PartyPopper className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenExplainFormula}
              className="text-[#80a98f] hover:text-white transition-colors"
              title="Formula information"
            >
              <HelpCircle className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        <p className="text-[14px] sm:text-[15px] text-[#d6e5dc] font-normal leading-snug mb-5 relative z-10">
          {profile.scoringProfile.resilienceVerdict}
        </p>

        {/* Circular Gauge & Liquid Buffer Side-by-Side */}
        <div className="flex items-center justify-between gap-3 sm:gap-4 py-2 relative z-10">
          {/* Circular Score Gauge */}
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center shrink-0">
            {/* Celebratory ambient ring glow when in safe/resilient tier */}
            {resilience >= 70 && (
              <div className="absolute inset-0 rounded-full border border-amber-400/30 animate-ping opacity-25 pointer-events-none" />
            )}

            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 110 110">
              {/* Background circle */}
              <circle
                cx="55"
                cy="55"
                r={radius}
                className="text-white/10"
                strokeWidth="7"
                stroke="currentColor"
                fill="#fcfaf4"
              />
              {/* Animated Progress Arc */}
              <circle
                cx="55"
                cy="55"
                r={radius}
                className={`${resilience >= 80 ? 'text-[#10b981]' : resilience >= 70 ? 'text-[#d97706]' : 'text-[#e09849]'} transition-all duration-1000 ease-out`}
                strokeWidth="7"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-display text-2xl sm:text-3xl font-bold text-[#123524] tracking-tight">
                {Math.round(resilience)}
              </span>
              <span className="text-[10px] sm:text-[11px] font-medium text-[#64746a] -mt-0.5 sm:-mt-1">
                / 100
              </span>
            </div>
          </div>

          {/* Liquid Buffer Stat Block */}
          <div className="flex-1 pl-1 sm:pl-2">
            <span className="text-[10px] sm:text-[11px] font-mono tracking-widest uppercase font-semibold text-[#80a98f] block">
              Liquid Buffer
            </span>
            <div className="font-display text-2xl sm:text-4xl font-bold text-white tracking-tight mt-0.5">
              ₹{liquidBuffer.toLocaleString('en-IN')}
            </div>
            <p className="text-[12px] sm:text-[13px] text-[#9fc4ad] mt-0.5 sm:mt-1 font-normal">
              covers ~{essentialDays} essential days
            </p>
          </div>
        </div>

        {/* Collapsible Formula Breakdown Accordion */}
        <div className="mt-4 pt-3 border-t border-white/10 relative z-10">
          <button
            onClick={() => setShowFormulaDetails(!showFormulaDetails)}
            className="flex items-center justify-between w-full text-left text-[13px] font-medium text-[#d6e5dc] hover:text-white transition-colors"
          >
            <span>How we calculate this</span>
            {showFormulaDetails ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showFormulaDetails && (
            <div className="mt-3 p-3.5 bg-white/5 rounded-2xl text-[12px] text-[#c2dbce] space-y-2 border border-white/5">
              <div className="font-mono text-[11px] text-[#9fc4ad] bg-black/20 p-2 rounded-lg">
                R_score = min(100, ((B_t + E[X_pos]) / ES_0.90) × 100)
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-white/60 block">Verified Buffer (B_t):</span>
                  <span className="font-semibold text-white">₹{liquidBuffer.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-white/60 block">Tail Deficit (ES_0.90):</span>
                  <span className="font-semibold text-white">
                    ₹{profile.statisticalMetrics.expectedShortfall90.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-white/70 pt-1 leading-relaxed">
                Non-parametric bootstrap stress tests your liquidity against extreme 90% deficit scenarios.
              </p>
            </div>
          )}

          {/* Quick PDF Report Trigger */}
          <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-3">
            <div className="text-[11px] text-[#a9ceb8] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#80a98f]" />
              <span>Full Audit Report Ready</span>
            </div>

            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="py-1.5 px-3 bg-white/10 hover:bg-white/20 active:scale-98 text-white rounded-xl text-[11px] font-semibold flex items-center gap-1.5 transition-all border border-white/15 disabled:opacity-50"
            >
              <FileDown className="w-3.5 h-3.5 text-[#98d4ad]" />
              <span>{pdfSuccess ? 'PDF Downloaded!' : isGeneratingPDF ? 'Generating...' : 'Download PDF Audit'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. D3-Based Liquid Buffer 6-Month Trajectory & Micro-Savings Sweep Chart */}
      <LiquidBufferChart
        history={profile.bufferHistory}
        currentBuffer={profile.currentLiquidBuffer}
        currencySymbol={profile.currencySymbol || '₹'}
        onSweepMore={sweepAction ? () => onExecuteAction(sweepAction) : undefined}
      />

      {/* 3b. Real-Time Bank Information Stream Card */}
      <div className="bg-[#fcfaf4] rounded-3xl p-5 border border-[#e8e2d5] shadow-xs space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-mono tracking-widest uppercase font-semibold text-[#6e7f74]">
              Real-Time Bank Stream
            </span>
          </div>
          <span className="px-2 py-0.5 bg-[#eef7f2] text-[#123524] text-[10px] font-mono font-bold rounded-full border border-[#cbe4d4]">
            RBI AA / Open Banking Live
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-bold text-[#123524]">
              Live Banking Inflow Stream
            </h3>
            <p className="text-[12px] text-[#55695c] mt-0.5">
              Syncing daily Mandi settlements and UPI cash directly into BAWS adaptive lookback window.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenBankModal}
              className="py-2 px-3 bg-white hover:bg-[#f4efe4] border border-[#e0d8c8] text-[#123524] text-[12px] font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-xs active:scale-98"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Accounts ({bankAccounts.length})</span>
            </button>

            <button
              onClick={onOpenBankModal}
              className="py-2 px-3.5 bg-[#123524] hover:bg-[#1a4a33] text-white text-[12px] font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-xs active:scale-98"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync Live</span>
            </button>
          </div>
        </div>

        {/* Mini Bank Chips */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {bankAccounts.map((acc, idx) => (
            <div
              key={idx}
              className="bg-white rounded-xl p-2.5 border border-[#ede8dc] flex items-center justify-between text-[11px]"
            >
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                <span className="font-semibold text-[#123524] truncate max-w-[140px]">{acc.bankName}</span>
                <span className="font-mono text-[#8a998f] text-[10px]">{acc.mask}</span>
              </div>
              <span className="font-mono font-bold text-[#123524]">
                ₹{acc.balanceAvailable.toLocaleString('en-IN')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Cash Flow Pulse Card (White background) */}
      <div className="bg-white rounded-3xl p-5 border border-[#e8e2d5] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono tracking-widest uppercase font-semibold text-[#6e7f74]">
            Cash Flow Pulse
          </span>
          <span className="px-2.5 py-0.5 bg-[#fef3c7] text-[#92400e] text-[11px] font-mono font-semibold rounded-full border border-[#fde68a]">
            VAR ↑ 12%
          </span>
        </div>

        <div>
          <h3 className="font-display text-2xl font-bold text-[#123524]">
            This month
          </h3>
        </div>

        {/* Pulse Bar Visualization */}
        <div className="pt-2">
          <div className="h-20 flex items-end gap-1 sm:gap-1.5 justify-between px-1">
            {pulseBars.map((bar, i) => (
              <div
                key={i}
                className="flex-1 flex flex-col items-center group relative cursor-pointer"
              >
                <div
                  style={{ height: `${bar.height}%` }}
                  className={`w-full max-w-[10px] rounded-t-sm transition-all duration-300 group-hover:opacity-80 ${
                    bar.isPositive ? 'bg-[#7ba88a]' : 'bg-[#e09849]'
                  }`}
                />
              </div>
            ))}
          </div>

          <div className="flex justify-between text-[10px] font-mono font-medium text-[#7e8f83] mt-2 px-1 border-t border-[#f0ece4] pt-1.5">
            <span>1 AUG</span>
            <span className="text-[#c05e2b] font-semibold">TODAY</span>
          </div>
        </div>

        {/* Split Metrics: Trust Score & Safe to Spend */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#f0ece4]">
          <div>
            <span className="text-[11px] font-medium text-[#6e7f74] block">
              Trust score
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-display text-2xl font-bold text-[#123524]">
                {trustScore100}
              </span>
              <span className="text-[12px] font-medium text-[#6e7f74]">
                / 100
              </span>
            </div>
          </div>

          <div className="border-l border-[#f0ece4] pl-4">
            <span className="text-[11px] font-medium text-[#6e7f74] block">
              Safe to spend
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-display text-2xl font-bold text-[#123524]">
                ₹{profile.safeToSpendDaily}
              </span>
              <span className="text-[12px] font-medium text-[#6e7f74]">
                today
              </span>
            </div>
          </div>
        </div>

        {/* Adapting Plan Footer Note */}
        <div
          onClick={() => onNavigateToTab('cashflow')}
          className="bg-[#eef6f0] border border-[#d6ebd9] rounded-2xl p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#e6f2e8] transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#123524]/10 text-[#123524] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[#123524] leading-tight">
                Your plan is adapting
              </p>
              <p className="text-[12px] text-[#3b634d] leading-snug mt-0.5">
                We changed your repayment target after a cash-flow shift.
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-[#123524] group-hover:translate-x-0.5 transition-transform shrink-0" />
        </div>
      </div>

      {/* 4. Practical Action Plan Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono tracking-widest uppercase font-semibold text-[#6e7f74] block">
              Your Next Steps
            </span>
            <h3 className="font-display text-2xl font-bold text-[#123524]">
              A practical action plan
            </h3>
          </div>
          <button
            onClick={() => onNavigateToTab('actions')}
            className="text-[13px] font-semibold text-[#123524] hover:underline"
          >
            See all
          </button>
        </div>

        {/* Action Cards List */}
        <div className="space-y-3">
          {profile.actions.map((act) => (
            <div
              key={act.id}
              className="bg-white rounded-3xl p-5 border border-[#e8e2d5] shadow-xs space-y-3 hover:border-[#123524]/30 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 bg-[#faebd7] text-[#9c4221] text-[10px] font-mono font-bold tracking-wider rounded-full uppercase">
                  {act.category}
                </span>
                <span className="text-[11px] font-mono text-[#7e8f83]">
                  {act.stepNumber}
                </span>
              </div>

              <div>
                <h4 className="font-display text-2xl font-bold text-[#123524]">
                  {act.title}
                </h4>
                <p className="text-[13px] text-[#4c5d52] mt-1 leading-relaxed">
                  {act.description}
                </p>
              </div>

              <div className="pt-3 border-t border-[#f0ece4] flex items-center justify-between">
                <span className="text-[13px] font-semibold text-[#123524]">
                  {act.impactText}
                </span>

                {act.status === 'COMPLETED' ? (
                  <div className="flex items-center gap-1.5 text-[#1b4332] text-[12px] font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-[#1b4332]" />
                    <span>Done</span>
                  </div>
                ) : (
                  <button
                    onClick={() => onExecuteAction(act)}
                    className="w-10 h-10 rounded-full bg-[#123524] text-white flex items-center justify-center hover:bg-[#1b4332] active:scale-95 transition-all shadow-xs"
                    aria-label={`Execute ${act.title}`}
                  >
                    <ArrowRight className="w-4.5 h-4.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Celebratory Milestone Overlay Modal */}
      <CelebrationOverlay
        isOpen={isCelebrationOpen}
        onClose={handleCloseCelebration}
        profile={profile}
        previousScore={celebrationPrevScore}
        newScore={celebrationNewScore}
        thresholdCrossed={thresholdCrossed}
      />
    </div>
  );
});
