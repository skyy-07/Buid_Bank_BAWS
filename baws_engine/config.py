"""
BAWS-NN Engine — Configuration & Hyperparameters

Central configuration for all tunable parameters across the engine.
All mathematical constants are documented with their statistical justification.
"""

from dataclasses import dataclass, field
from typing import List


@dataclass(frozen=True)
class BAWSConfig:
    """
    Configuration for the Bias-Adaptive Window Selection engine.

    Attributes:
        k_min: Minimum reference window size (months). Acts as the shortest
               admissible look-back horizon. Typically 3–6 months to ensure
               sufficient observations for bootstrap calibration.
        k_max_cap: Hard upper bound on candidate windows (months).
        beta: Bootstrap threshold confidence level. The τ(t,i) threshold is
              set as the β-quantile of bootstrap loss differences.
              Paper default: 0.90 (§2.2).
        n_boot: Number of Moving Block Bootstrap replications.
              500 balances computational cost with threshold stability.
        block_length_constant: Multiplicative constant c in block length
              formula l_i = c * ceil(i^{1/3}). Controls autocorrelation
              preservation vs. block-boundary bias. Default c=1.
        alpha: Tail-risk confidence level for VaR/ES estimation.
              α=0.90 means we estimate the 10th percentile worst-case.
    """
    k_min: int = 6
    k_max_cap: int = 60
    beta: float = 0.90
    n_boot: int = 500
    block_length_constant: float = 1.0
    alpha: float = 0.90


@dataclass(frozen=True)
class PreprocessingConfig:
    """
    Configuration for the signal conditioning pipeline.

    Attributes:
        stl_period: Seasonal period for STL decomposition.
              12 for monthly data, 26 for bi-weekly.
        stl_seasonal: STL seasonal smoother window length (must be odd, ≥7).
        winsorize_lower: Lower percentile for outlier winsorization.
        winsorize_upper: Upper percentile for outlier winsorization.
        max_gap_interpolation: Maximum gap length (periods) for linear
              interpolation. Gaps longer than this use Kalman smoothing.
        kalman_observation_noise: Observation noise variance for Kalman
              state-space imputation model.
    """
    stl_period: int = 12
    stl_seasonal: int = 13
    winsorize_lower: float = 0.01
    winsorize_upper: float = 0.99
    max_gap_interpolation: int = 2
    kalman_observation_noise: float = 1.0


@dataclass(frozen=True)
class NeuralConfig:
    """
    Configuration for the MLP feature extractor and score heads.

    Attributes:
        input_dim: Dimensionality of the feature vector h_t.
              9 features: [X̃_t, μ⁺, σ, σ/μ⁺, C_ratio, VaR, ES, S_freq, B_t/|ES|]
        hidden_dims: Sizes of hidden layers.
        dropout_rate: Dropout probability between hidden layers.
        learning_rate: Initial learning rate for AdamW optimizer.
        weight_decay: L2 regularization coefficient.
        epochs: Maximum training epochs.
        trust_score_min: Lower bound of the trust score range.
        trust_score_max: Upper bound of the trust score range.
    """
    input_dim: int = 9
    hidden_dims: List[int] = field(default_factory=lambda: [64, 32])
    dropout_rate: float = 0.3
    learning_rate: float = 1e-3
    weight_decay: float = 1e-4
    epochs: int = 200
    trust_score_min: float = 300.0
    trust_score_max: float = 850.0


@dataclass(frozen=True)
class ScoringWeights:
    """
    Weights for the composite Financial Trust Score formula.

    T_score = 300 + 550 * (w1*(1 - min(1, σ/μ⁺)) + w2*C_ratio + w3*(1 - S_freq))

    Must satisfy: w1 + w2 + w3 = 1.0
    """
    w1: float = 0.4  # Income volatility weight
    w2: float = 0.4  # Cash-flow consistency weight
    w3: float = 0.2  # Shock frequency weight

    def __post_init__(self):
        total = self.w1 + self.w2 + self.w3
        if abs(total - 1.0) > 1e-6:
            raise ValueError(
                f"Scoring weights must sum to 1.0, got {total:.6f}"
            )


@dataclass(frozen=True)
class PolicyConfig:
    """
    Configuration for adaptive product terms and underwriting policy.

    Attributes:
        gamma_max: Maximum repayment scaling factor. Caps debt service
              at γ_max fraction of positive net cash flow.
        grace_period_months: Maximum grace period available during shocks.
        resilience_threshold_approved: Minimum R_score for approval.
        trust_score_threshold_approved: Minimum T_score for approval.
    """
    gamma_max: float = 0.25
    grace_period_months: int = 3
    resilience_threshold_approved: float = 40.0
    trust_score_threshold_approved: float = 450.0


@dataclass(frozen=True)
class EngineConfig:
    """Top-level configuration aggregating all sub-configs."""
    baws: BAWSConfig = field(default_factory=BAWSConfig)
    preprocessing: PreprocessingConfig = field(default_factory=PreprocessingConfig)
    neural: NeuralConfig = field(default_factory=NeuralConfig)
    scoring_weights: ScoringWeights = field(default_factory=ScoringWeights)
    policy: PolicyConfig = field(default_factory=PolicyConfig)
