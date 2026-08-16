"""
BAWS-NN Engine — Core Orchestrator

End-to-end pipeline orchestrating all engine components:

  Raw Cash Flows → Preprocessing → BAWS Window Selection →
  Tail-Risk Estimation → Neural Scoring → Risk Output

Also computes adaptive product terms (underwriting decision, credit
facility limit, repayment mode, shock shielding).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

import numpy as np

from baws_engine.config import EngineConfig
from baws_engine.preprocessing import preprocess, PreprocessedSeries
from baws_engine.baws_selector import select_adaptive_window, BAWSResult
from baws_engine.tail_risk import estimate_tail_risk, TailRiskResult
from baws_engine.neural_extractor import compute_scores, ScoringResult
from baws_engine.schemas import (
    BAWSRiskResult,
    BAWSMetadata,
    RiskMetrics,
    AdaptiveProductTerms,
    UnderwritingDecision,
    RepaymentMode,
)


class BAWSEngine:
    """
    Main engine class orchestrating the full BAWS-NN risk assessment pipeline.

    Usage:
        engine = BAWSEngine()
        result = engine.evaluate(
            borrower_id="abc123",
            timestamps=timestamps,
            gross_inflows=inflows,
            gross_outflows=outflows,
            liquid_buffers=buffers,
        )
    """

    def __init__(
        self,
        config: Optional[EngineConfig] = None,
        neural_model: object = None,
    ):
        """
        Initialize the BAWS-NN engine.

        Args:
            config: Full engine configuration. Uses defaults if None.
            neural_model: Optional pre-trained TrustScoreMLP model.
                         Falls back to analytical scoring if not provided.
        """
        self.config = config or EngineConfig()
        self.neural_model = neural_model
        self._previous_k: Optional[int] = None

    def evaluate(
        self,
        borrower_id: str,
        timestamps: np.ndarray,
        gross_inflows: np.ndarray,
        gross_outflows: np.ndarray,
        liquid_buffers: np.ndarray,
        event_tags: Optional[np.ndarray] = None,
        seed: int = 42,
    ) -> BAWSRiskResult:
        """
        Execute the full BAWS-NN risk assessment pipeline.

        Pipeline Steps:
          1. Preprocess → X_t, X̃_t (net cash flow, deseasonalized residual)
          2. BAWS window selection → k̂_t, break detection
          3. Tail-risk estimation → VaR_α, ES_α, auxiliary metrics
          4. Feature assembly → 9-dim h_t
          5. Scoring → T_score, R_score
          6. Product terms → underwriting decision, limits, repayment mode

        Args:
            borrower_id: Unique borrower identifier.
            timestamps: Array of observation timestamps.
            gross_inflows: Gross cash inflow array (≥ 0).
            gross_outflows: Gross cash outflow array (≥ 0).
            liquid_buffers: Liquid buffer reserves array (≥ 0).
            event_tags: Optional event tags per observation.
            seed: Random seed for MBB reproducibility.

        Returns:
            BAWSRiskResult containing all risk metrics and product terms.
        """
        # ── Step 1: Preprocessing ──────────────────────────────────────
        preprocessed: PreprocessedSeries = preprocess(
            timestamps=timestamps,
            gross_inflows=gross_inflows,
            gross_outflows=gross_outflows,
            liquid_buffers=liquid_buffers,
            event_tags=event_tags,
            config=self.config.preprocessing,
        )

        # ── Step 2: BAWS Adaptive Window Selection ─────────────────────
        baws_result: BAWSResult = select_adaptive_window(
            residual_series=preprocessed.residual,
            config=self.config.baws,
            previous_k=self._previous_k,
            seed=seed,
        )

        # Update state for sequential evaluation
        self._previous_k = baws_result.optimal_k

        # ── Step 3: Tail-Risk Estimation ───────────────────────────────
        tail_risk: TailRiskResult = estimate_tail_risk(
            net_cash_flow=preprocessed.net_cash_flow,
            residual_series=preprocessed.residual,
            optimal_k=baws_result.optimal_k,
            config=self.config.baws,
        )

        # ── Step 4 & 5: Feature Assembly & Scoring ─────────────────────
        scoring: ScoringResult = compute_scores(
            current_residual=float(preprocessed.residual[-1]),
            mean_positive=tail_risk.mean_positive,
            std_dev=tail_risk.std_dev,
            cv=tail_risk.cv,
            consistency_ratio=tail_risk.consistency_ratio,
            var_alpha=tail_risk.var_alpha,
            es_alpha=tail_risk.es_alpha,
            shock_frequency=tail_risk.shock_frequency,
            liquid_buffer=preprocessed.liquid_buffer,
            neural_model=self.neural_model,
            scoring_weights=self.config.scoring_weights,
        )

        # ── Step 6: Adaptive Product Terms ─────────────────────────────
        product_terms = self._compute_product_terms(
            trust_score=scoring.trust_score,
            resilience_score=scoring.resilience_score,
            mean_positive=tail_risk.mean_positive,
            es_alpha=tail_risk.es_alpha,
            break_detected=baws_result.break_detected,
        )

        # ── Assemble Output ────────────────────────────────────────────
        return BAWSRiskResult(
            borrower_id=borrower_id,
            timestamp=datetime.now(timezone.utc),
            baws_metadata=BAWSMetadata(
                optimal_lookback_months=baws_result.optimal_k,
                structural_break_detected=baws_result.break_detected,
                rejection_vector=baws_result.rejection_vector,
                mbb_block_length=baws_result.mbb_block_length,
            ),
            risk_metrics=RiskMetrics(
                trust_score=round(scoring.trust_score, 1),
                resilience_score=round(scoring.resilience_score, 1),
                value_at_risk_90=round(tail_risk.var_alpha, 2),
                expected_shortfall_90=round(tail_risk.es_alpha, 2),
                coefficient_of_variation=round(tail_risk.cv, 4),
                consistency_ratio=round(tail_risk.consistency_ratio, 4),
            ),
            adaptive_product_terms=product_terms,
        )

    def _compute_product_terms(
        self,
        trust_score: float,
        resilience_score: float,
        mean_positive: float,
        es_alpha: float,
        break_detected: bool,
    ) -> AdaptiveProductTerms:
        """
        Compute adaptive lending product terms based on risk metrics.

        Underwriting Logic:
          - APPROVED:      T_score ≥ threshold AND R_score ≥ threshold
          - CONDITIONAL:   T_score ≥ threshold but R_score below threshold
          - MANUAL_REVIEW: T_score near threshold (within 50 points)
          - DECLINED:      T_score below threshold

        Credit Facility Limit:
          Based on mean positive cash flow × repayment capacity factor.

        Repayment Mode:
          - CASH_FLOW_ADAPTIVE: For irregular earners (high CV)
          - FIXED_EMI: For stable earners
        """
        policy = self.config.policy
        t_threshold = policy.trust_score_threshold_approved
        r_threshold = policy.resilience_threshold_approved

        # Underwriting decision
        if trust_score >= t_threshold and resilience_score >= r_threshold:
            decision = UnderwritingDecision.APPROVED
        elif trust_score >= t_threshold:
            decision = UnderwritingDecision.CONDITIONAL
        elif trust_score >= t_threshold - 50:
            decision = UnderwritingDecision.MANUAL_REVIEW
        else:
            decision = UnderwritingDecision.DECLINED

        # Credit facility limit: conservative multiple of mean positive income
        if decision in (UnderwritingDecision.APPROVED, UnderwritingDecision.CONDITIONAL):
            # Facility = mean_positive × months_coverage × risk_factor
            risk_factor = min(1.0, trust_score / 850.0)
            facility = mean_positive * 6 * risk_factor * (resilience_score / 100.0)
        else:
            facility = 0.0

        # Repayment scaling factor γ
        gamma = min(policy.gamma_max, policy.gamma_max * (resilience_score / 100.0))

        # Base monthly commitment (conservative: γ × mean positive income)
        base_emi = gamma * mean_positive if mean_positive > 0 else 0.0

        # Shock shield activation
        shock_shield = break_detected

        # Grace period
        grace = policy.grace_period_months if shock_shield else 0

        return AdaptiveProductTerms(
            underwriting_decision=decision,
            credit_facility_limit=round(facility, 2),
            repayment_mode=RepaymentMode.CASH_FLOW_ADAPTIVE,
            base_monthly_commitment=round(base_emi, 2),
            surge_repayment_factor_gamma=round(gamma, 4),
            shock_shield_active=shock_shield,
            grace_period_months_available=grace,
        )

    def reset_state(self) -> None:
        """Reset sequential state (previous k̂) for a new borrower."""
        self._previous_k = None
