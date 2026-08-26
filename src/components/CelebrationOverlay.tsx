import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Trophy,
  ShieldCheck,
  ArrowUpRight,
  Download,
  X,
  CheckCircle2,
  TrendingUp,
  Award,
  Zap,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { BorrowerProfile } from '../types';
import { generateRiskAndBufferPDF } from '../utils/pdfGenerator';

export interface MilestoneInfo {
  threshold: number;
  tierName: string;
  badgeTitle: string;
  tagline: string;
  perks: string[];
  color: string;
  accentBg: string;
}

export const RESILIENCE_MILESTONES: MilestoneInfo[] = [
  {
    threshold: 85,
    tierName: 'Tier 4 · Sovereign Fortress',
    badgeTitle: 'Elite Peak Resilience',
    tagline: 'Outstanding tail-risk coverage with autonomous buffer protection.',
    perks: [
      'Top 5% resilience ranking across agricultural & retail cohorts',
      'Eligible for 1.25% instant NBFC interest rate rebate',
      'Zero collateral stress requirement for next season credit lines',
    ],
    color: '#047857',
    accentBg: '#d1fae5',
  },
  {
    threshold: 80,
    tierName: 'Tier 3 · Resilient Shield',
    badgeTitle: 'Deficit Immunity Milestone',
    tagline: 'Comprehensive cushion exceeding 90-day structural income shortfall.',
    perks: [
      'Full absorption of 90% expected shortfall (ES_0.90)',
      'Pre-approved for emergency shock freeze without credit penalty',
      'Eligible for 0.75% NBFC dynamic rate discount',
    ],
    color: '#0f766e',
    accentBg: '#ccfbf1',
  },
  {
    threshold: 75,
    tierName: 'Tier 2 · Robust Cushion',
    badgeTitle: 'Robust Liquidity Cushion',
    tagline: 'Substantial multi-week buffer guarding essential family & business expenses.',
    perks: [
      'Over 14+ essential days of guaranteed household runway',
      'Moving-block bootstrap stress test passed with green grade',
      'Automated micro-savings yield enhancement activated',
    ],
    color: '#d97706',
    accentBg: '#fef3c7',
  },
  {
    threshold: 70,
    tierName: 'Tier 1 · Stable Foundation',
    badgeTitle: 'Buffer Stabilization Milestone',
    tagline: 'Successfully crossed the critical 70% resilience safety boundary.',
    perks: [
      'Defended against high-volatility cash flow swings',
      'Trust score acceleration unlocked on verifiable risk passport',
      'Daily safe-to-spend spending ceiling expanded',
    ],
    color: '#15803d',
    accentBg: '#dcfce7',
  },
];

export function getMilestoneForScore(score: number): MilestoneInfo {
  for (const m of RESILIENCE_MILESTONES) {
    if (score >= m.threshold) {
      return m;
    }
  }
  return RESILIENCE_MILESTONES[RESILIENCE_MILESTONES.length - 1];
}

interface CelebrationOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  profile: BorrowerProfile;
  previousScore?: number;
  newScore: number;
  thresholdCrossed?: number;
}

export const CelebrationOverlay: React.FC<CelebrationOverlayProps> = React.memo(({
  isOpen,
  onClose,
  profile,
  previousScore = 65,
  newScore,
  thresholdCrossed = 70,
}) => {
  const [displayScore, setDisplayScore] = useState(previousScore);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const milestone = useMemo(() => getMilestoneForScore(newScore), [newScore]);

  // Multi-burst celebratory confetti launcher
  const fireCelebratoryConfetti = useCallback(() => {
    // Burst 1: Center burst
    confetti({
      particleCount: 70,
      spread: 80,
      origin: { y: 0.5, x: 0.5 },
      colors: ['#123524', '#d97706', '#10b981', '#f59e0b', '#34d399', '#ffffff'],
      ticks: 200,
    });

    // Burst 2: Left cannon
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 60,
        origin: { x: 0.1, y: 0.7 },
        colors: ['#123524', '#10b981', '#fbbf24', '#ffffff'],
      });
    }, 200);

    // Burst 3: Right cannon
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 60,
        origin: { x: 0.9, y: 0.7 },
        colors: ['#d97706', '#059669', '#fde047', '#123524'],
      });
    }, 400);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fireCelebratoryConfetti();

      // Animate score ticker from previousScore to newScore
      const start = previousScore;
      const end = newScore;
      const duration = 1200;
      const startTime = performance.now();
      let animFrameId: number;

      const updateTicker = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // easeOutExpo
        const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const currentVal = Number((start + (end - start) * ease).toFixed(1));
        setDisplayScore(currentVal);

        if (progress < 1) {
          animFrameId = requestAnimationFrame(updateTicker);
        } else {
          setDisplayScore(end);
        }
      };

      animFrameId = requestAnimationFrame(updateTicker);
      return () => {
        if (animFrameId) cancelAnimationFrame(animFrameId);
      };
    }
  }, [isOpen, newScore, previousScore, fireCelebratoryConfetti]);

  const handleDownloadPDF = useCallback(() => {
    setIsDownloading(true);
    try {
      generateRiskAndBufferPDF(profile);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3500);
    } catch (e) {
      console.error('PDF error:', e);
    } finally {
      setIsDownloading(false);
    }
  }, [profile]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        id="celebration-overlay-backdrop"
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto touch-manipulation"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 22, stiffness: 280 }}
          className="relative w-full max-w-lg bg-[#faf8f2] rounded-t-3xl sm:rounded-3xl border-t sm:border border-[#e8e2d5] shadow-2xl overflow-hidden my-0 sm:my-auto max-h-[92vh] overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]"
        >
          {/* Mobile Drag Pill */}
          <div className="w-10 h-1.25 bg-white/40 rounded-full mx-auto mt-2 sm:hidden relative z-30" />

          {/* Top Decorative Banner */}
          <div className="bg-gradient-to-r from-[#123524] via-[#1b4332] to-[#123524] text-white p-5 sm:p-6 relative overflow-hidden">
            {/* Background ambient lighting */}
            <div className="absolute -top-10 -right-10 w-44 h-44 bg-[#d97706]/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-[#10b981]/25 rounded-full blur-3xl pointer-events-none" />

            {/* Close Button */}
            <button
              id="celebration-close-btn"
              onClick={onClose}
              className="absolute top-4 right-4 w-9 h-9 min-w-[36px] min-h-[36px] rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 active:scale-95 text-white/80 hover:text-white flex items-center justify-center transition-all z-20"
              aria-label="Close celebration modal"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            {/* Top Badge */}
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <span className="px-3 py-1 bg-amber-400/20 border border-amber-300/30 text-amber-300 text-[10px] font-mono font-bold tracking-wider rounded-full uppercase flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>Resilience Threshold (≥{thresholdCrossed}%)</span>
              </span>
            </div>

            {/* Headline */}
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
              {milestone.badgeTitle}! 🎉
            </h2>
            <p className="text-[13px] text-[#c2dbce] mt-1 leading-relaxed max-w-md">
              {milestone.tagline}
            </p>

            {/* Big Animated Score Transformation Card */}
            <div className="mt-4 sm:mt-5 p-3.5 sm:p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 flex items-center justify-between gap-3 sm:gap-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#80a98f] block">
                  Resilience Score Upgraded
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-sm font-mono line-through text-white/50">
                    {previousScore.toFixed(1)}%
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-display text-3xl sm:text-4xl font-black text-amber-300 tracking-tight">
                    {displayScore.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Verified Badge */}
              <div className="text-right">
                <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 text-[11px] font-mono font-bold rounded-lg border border-emerald-400/30 inline-flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{milestone.tierName.split('·')[0].trim()}</span>
                </span>
                <div className="text-[11px] text-[#9fc4ad] mt-1">
                  +{((newScore - previousScore) > 0 ? (newScore - previousScore) : 6).toFixed(1)}% Gain
                </div>
              </div>
            </div>
          </div>

          {/* Body Section */}
          <div className="p-6 space-y-4">
            {/* Impact Metric Chips */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-white rounded-2xl border border-[#e8e2d5] text-center">
                <span className="text-[10px] font-mono uppercase text-[#6e7f74] block">Liquid Buffer</span>
                <span className="font-display text-base font-bold text-[#123524] mt-0.5 block">
                  ₹{profile.currentLiquidBuffer.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="p-3 bg-white rounded-2xl border border-[#e8e2d5] text-center">
                <span className="text-[10px] font-mono uppercase text-[#6e7f74] block">Runway</span>
                <span className="font-display text-base font-bold text-emerald-700 mt-0.5 block">
                  {profile.scoringProfile.formulaBreakdown.essentialDaysCovered || 14} Days
                </span>
              </div>
              <div className="p-3 bg-white rounded-2xl border border-[#e8e2d5] text-center">
                <span className="text-[10px] font-mono uppercase text-[#6e7f74] block">Trust Rating</span>
                <span className="font-display text-base font-bold text-[#123524] mt-0.5 block">
                  {profile.scoringProfile.trustScore100}/100
                </span>
              </div>
            </div>

            {/* Unlocked Benefits & Safeguards List */}
            <div className="p-4 bg-white rounded-2xl border border-[#e5ded0] space-y-2.5">
              <div className="flex items-center gap-2 text-[#123524] font-semibold text-xs">
                <Award className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Unlocked Borrower Advantages:</span>
              </div>

              <div className="space-y-2 pt-1">
                {milestone.perks.map((perk, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-[12px] text-[#4a5c50]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="leading-snug">{perk}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className="w-full sm:flex-1 py-3 px-4 bg-[#f4efe4] hover:bg-[#eae3d2] active:scale-98 text-[#123524] font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all border border-[#dcd4c3] disabled:opacity-50"
              >
                <Download className="w-4 h-4 text-[#123524]" />
                <span>{downloadSuccess ? 'Audit PDF Ready!' : isDownloading ? 'Building PDF...' : 'Download Risk Audit'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full sm:flex-1 py-3 px-4 bg-[#123524] hover:bg-[#1a4a33] active:scale-98 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>Keep Growing Buffer</span>
              </button>
            </div>

            {/* Extra Replay Confetti Link */}
            <div className="text-center pt-1">
              <button
                onClick={fireCelebratoryConfetti}
                className="text-[11px] font-mono text-[#6e7f74] hover:text-[#123524] transition-colors inline-flex items-center gap-1"
              >
                <span>🎉 Replay Confetti Blast</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
});
