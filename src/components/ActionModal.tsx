import React, { useState, useMemo, useCallback } from 'react';
import { X, Shield, Building, TrendingUp, AlertTriangle, Sparkles, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { ActionItem, BorrowerProfile } from '../types';

interface ActionModalProps {
  action: ActionItem | null;
  profile: BorrowerProfile;
  onClose: () => void;
  onConfirm: (actionId: string, actionType: ActionItem['actionType'], amount: number) => void;
}

export const ActionModal: React.FC<ActionModalProps> = React.memo(({
  action,
  profile,
  onClose,
  onConfirm,
}) => {
  if (!action) return null;

  const [customAmount, setCustomAmount] = useState<number>(action.amount);
  const [isProcessing, setIsProcessing] = useState(false);

  const theme = useMemo(() => {
    switch (action.actionType) {
      case 'PROTECT_BUFFER':
        return {
          icon: Shield,
          btnBg: 'bg-[#123524] hover:bg-[#1b4332]',
          btnText: 'Lock & Protect in Buffer',
          badgeBg: 'bg-[#faebd7] text-[#c05e2b]',
        };
      case 'REPAY_FLEXIBLE':
        return {
          icon: Building,
          btnBg: 'bg-[#1b4332] hover:bg-[#255742]',
          btnText: 'Pay ₹' + customAmount.toLocaleString('en-IN') + ' Flexible EMI',
          badgeBg: 'bg-[#e2f0e8] text-[#1b4332]',
        };
      case 'SWEEP_RESERVE':
        return {
          icon: TrendingUp,
          btnBg: 'bg-[#2d6a4f] hover:bg-[#387f5f]',
          btnText: 'Sweep to Overnight Yield Reserve',
          badgeBg: 'bg-[#eaf4ed] text-[#2d6a4f]',
        };
      case 'ACTIVATE_SHIELD':
        return {
          icon: AlertTriangle,
          btnBg: 'bg-[#b45309] hover:bg-[#92400e]',
          btnText: 'Activate 60-Day Shock Grace Pause',
          badgeBg: 'bg-[#fef3c7] text-[#b45309]',
        };
    }
  }, [action.actionType, customAmount]);

  const Icon = theme.icon;

  const handleExecute = useCallback(() => {
    setIsProcessing(true);
    // Fire celebratory confetti for resilience growth
    confetti({
      particleCount: 75,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#123524', '#80a98f', '#d97706', '#ffffff'],
    });

    setTimeout(() => {
      onConfirm(action.id, action.actionType, customAmount);
      setIsProcessing(false);
      onClose();
    }, 600);
  }, [action.id, action.actionType, customAmount, onConfirm, onClose]);

  return (
    <div
      id="action-modal-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs transition-all touch-manipulation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="action-modal-sheet"
        className="w-full max-w-md bg-[#faf8f2] rounded-t-3xl sm:rounded-3xl border-t sm:border border-[#e8e2d5] shadow-2xl p-5 sm:p-6 space-y-4 max-h-[85vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain animate-in slide-in-from-bottom duration-200 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]"
      >
        {/* Mobile Drag Pill Indicator */}
        <div className="w-10 h-1.25 bg-[#d6cbba] rounded-full mx-auto mb-1 sm:hidden shrink-0" />

        {/* Modal Top Bar */}
        <div className="flex items-center justify-between">
          <span className={`px-3 py-1 text-[10px] font-mono font-bold tracking-wider rounded-full uppercase ${theme.badgeBg}`}>
            {action.badgeType} · {action.stepNumber}
          </span>
          <button
            id="action-modal-close-btn"
            onClick={onClose}
            className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full bg-white border border-[#e2dacb] flex items-center justify-center text-[#6e7f74] hover:text-[#123524] active:bg-[#ede8dc] transition-all"
            aria-label="Close action modal"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Title and Icon */}
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#123524] text-white flex items-center justify-center shrink-0 mt-0.5">
            <Icon className="w-5.5 h-5.5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h3 className="font-display text-xl sm:text-2xl font-bold text-[#123524] leading-tight">
              {action.title}
            </h3>
            <p className="text-[13px] text-[#4a5c50] mt-0.5">
              {action.impactText}
            </p>
          </div>
        </div>

        {/* Mathematical "Why BAWS Recommends This" Box */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-[#e8e2d5] space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-[#123524] uppercase">
            <Sparkles className="w-3.5 h-3.5 text-[#1b4332]" />
            <span>Why BAWS Recommends This Now</span>
          </div>
          <p className="text-[13px] text-[#3d4f44] leading-relaxed">
            {action.whyExplanation}
          </p>
        </div>

        {/* Amount adjustment slider (if applicable) */}
        {action.actionType !== 'ACTIVATE_SHIELD' && (
          <div className="bg-[#f2eee4] p-3.5 sm:p-4 rounded-2xl space-y-2 border border-[#e5ded0]">
            <div className="flex justify-between items-center text-[13px]">
              <span className="font-medium text-[#6e7f74]">Target Amount:</span>
              <span className="font-display text-xl sm:text-2xl font-bold text-[#123524]">
                ₹{customAmount.toLocaleString('en-IN')}
              </span>
            </div>
            <input
              type="range"
              min={Math.round(action.amount * 0.5)}
              max={Math.round(action.amount * 2)}
              step={100}
              value={customAmount}
              onChange={(e) => setCustomAmount(Number(e.target.value))}
              className="w-full accent-[#123524] cursor-pointer h-2 bg-[#d8cbba] rounded-lg appearance-none"
            />
            <div className="flex justify-between text-[10px] font-mono text-[#7e8f83]">
              <span>Min: ₹{Math.round(action.amount * 0.5).toLocaleString('en-IN')}</span>
              <span>Max: ₹{Math.round(action.amount * 2).toLocaleString('en-IN')}</span>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-1 sm:pt-2">
          <button
            id="action-modal-confirm-btn"
            onClick={handleExecute}
            disabled={isProcessing}
            className={`w-full min-h-[48px] py-3.5 px-5 rounded-2xl text-white font-semibold text-[15px] shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${theme.btnBg}`}
          >
            {isProcessing ? (
              <span>Updating Financial Shield...</span>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>{theme.btnText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});
