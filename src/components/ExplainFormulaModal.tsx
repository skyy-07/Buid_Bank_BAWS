import React from 'react';
import { X, HelpCircle, Sigma, Shield, Check, Info } from 'lucide-react';
import { BorrowerProfile } from '../types';

interface ExplainFormulaModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: BorrowerProfile;
}

export const ExplainFormulaModal: React.FC<ExplainFormulaModalProps> = React.memo(({
  isOpen,
  onClose,
  profile,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="explain-formula-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs touch-manipulation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="explain-formula-sheet"
        className="w-full max-w-lg bg-[#faf8f2] rounded-t-3xl sm:rounded-3xl border-t sm:border border-[#e8e2d5] shadow-2xl p-5 sm:p-6 space-y-4 max-h-[85vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain animate-in slide-in-from-bottom duration-200 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]"
      >
        {/* Mobile Drag Handle */}
        <div className="w-10 h-1.25 bg-[#d6cbba] rounded-full mx-auto mb-1 sm:hidden shrink-0" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#123524]">
            <Sigma className="w-5 h-5 text-[#1b4332]" />
            <h3 className="font-display text-xl sm:text-2xl font-bold">
              How BAWS Scores Work
            </h3>
          </div>
          <button
            id="formula-modal-close-btn"
            onClick={onClose}
            className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full bg-white border border-[#e2dacb] flex items-center justify-center text-[#6e7f74] hover:text-[#123524] active:bg-[#ede8dc] transition-all"
            aria-label="Close formula modal"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Resilience Score Section */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-[#e8e2d5] space-y-2">
          <span className="text-[11px] font-mono uppercase font-bold text-[#123524] block">
            1. Financial Resilience Score (R_score)
          </span>
          <div className="font-mono text-[11px] sm:text-[12px] bg-[#123524] text-[#d6e5dc] p-3 rounded-xl overflow-x-auto">
            R_score = min(100.0, ((B_t + E[X_next^+]) / |ES_0.90|) × 100)
          </div>
          <p className="text-[13px] text-[#4a5c50] leading-relaxed">
            Measures your ability to withstand an extreme 90% worst-case income collapse (Expected Shortfall ES_0.90) using verified liquid reserves (B_t) and next-period seasonal harvest expectations.
          </p>
        </div>

        {/* Trust Score Section */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-[#e8e2d5] space-y-2">
          <span className="text-[11px] font-mono uppercase font-bold text-[#123524] block">
            2. Financial Trust Score (T_score ∈ [300, 850])
          </span>
          <div className="font-mono text-[11px] sm:text-[12px] bg-[#faf8f2] text-[#123524] p-3 rounded-xl border border-[#e5ded0] overflow-x-auto">
            T_score = 300 + 550 × [ 0.40(1 - min(1, σ/μ^+)) + 0.40(C_ratio) + 0.20(1 - S_freq) ]
          </div>
          <p className="text-[13px] text-[#4a5c50] leading-relaxed">
            Evaluates your cash-flow consistency (C_ratio) and penalizes only unexpected downside disruptions (S_freq), ensuring routine seasonal sowing outlays are never misdiagnosed as default risks.
          </p>
        </div>

        {/* Zero Default Policy */}
        <div className="bg-[#eef6f0] rounded-2xl p-3.5 sm:p-4 border border-[#d6ebd9] space-y-1.5">
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#1b4332]">
            <Shield className="w-4 h-4" />
            <span>Perpetually Positive Standing (Zero-Default Policy)</span>
          </div>
          <p className="text-[12px] text-[#2d6a4f] leading-relaxed">
            Repayments scale dynamically with positive cash flow surges (R_t = min(EMI_base, γ × max(0, X_t))) and automatically pause during verified exogenous shocks.
          </p>
        </div>

        <button
          id="formula-modal-got-it-btn"
          onClick={onClose}
          className="w-full min-h-[48px] py-3 bg-[#123524] text-white font-semibold rounded-2xl hover:bg-[#1b4332] active:bg-[#0c2419] transition-all"
        >
          Got it
        </button>
      </div>
    </div>
  );
});
