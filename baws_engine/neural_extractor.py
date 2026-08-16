"""
BAWS-NN Engine — Neural Feature Extractor & Score Calibration

Implements Step 6 of the BAWS-NN pipeline:
  1. MLP feature extractor with GELU activations
  2. Trust Score output head (sigmoid → [300, 850])
  3. Resilience Score computation (deterministic formula)

Architecture:
  h_t = [X̃_t, μ⁺, σ, σ/μ⁺, C_ratio, VaR, ES, S_freq, B_t/|ES|]ᵀ  (9-dim)
     ↓
  Linear(9, 64) → GELU → Dropout(0.3) → Linear(64, 32) → GELU
     ↓
  z_t (32-dim latent representation)
     ↓
  Trust Score Head: Linear(32, 1) → Sigmoid → scale to [300, 850]
  Resilience Score: deterministic coverage ratio formula

Mathematical Reference:
  T_score = 300 + 550 × σ(wᵀ·z_t + b)  ∈ [300, 850]
  R_score = min(1.0, (B_t + E[X_{t+1}|X_{t+1}>0]) / |ES_α|) × 100%
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple

import numpy as np

try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from torch.utils.data import DataLoader, TensorDataset

    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

from baws_engine.config import NeuralConfig, ScoringWeights


@dataclass
class ScoringResult:
    """
    Output of the neural scoring module.

    Attributes:
        trust_score: T_score ∈ [300, 850] — composite creditworthiness.
        resilience_score: R_score ∈ [0, 100] — liquidity coverage %.
        feature_vector: Raw 9-dim input feature vector h_t.
        latent_vector: 32-dim latent representation z_t (if neural model used).
        scoring_method: "neural" or "analytical" depending on availability.
    """
    trust_score: float
    resilience_score: float
    feature_vector: np.ndarray
    latent_vector: Optional[np.ndarray]
    scoring_method: str


def build_feature_vector(
    current_residual: float,
    mean_positive: float,
    std_dev: float,
    cv: float,
    consistency_ratio: float,
    var_alpha: float,
    es_alpha: float,
    shock_frequency: float,
    liquid_buffer: float,
) -> np.ndarray:
    """
    Assemble the 9-dimensional feature vector h_t.

    h_t = [X̃_t, μ⁺, σ, σ/μ⁺, C_ratio, VaR, ES, S_freq, B_t/|ES|]ᵀ

    All features are designed to be scale-aware and capture different
    aspects of cash-flow health:
      - X̃_t:        Current deseasonalized state
      - μ⁺:         Earning capacity
      - σ:          Absolute risk
      - σ/μ⁺:       Relative risk (dimensionless)
      - C_ratio:    Operational consistency
      - VaR, ES:    Tail-risk severity
      - S_freq:     Shock arrival rate
      - B_t/|ES|:   Liquidity coverage against tail risk
    """
    # Buffer coverage ratio (how many tail events can be absorbed)
    es_abs = abs(es_alpha) if abs(es_alpha) > 1e-10 else 1e-10
    buffer_coverage = liquid_buffer / es_abs

    return np.array([
        current_residual,
        mean_positive,
        std_dev,
        min(cv, 10.0),          # Cap extreme CV values
        consistency_ratio,
        var_alpha,
        es_alpha,
        shock_frequency,
        min(buffer_coverage, 10.0),  # Cap extreme coverage
    ], dtype=np.float32)


def compute_trust_score_analytical(
    cv: float,
    consistency_ratio: float,
    shock_frequency: float,
    weights: Optional[ScoringWeights] = None,
) -> float:
    """
    Compute Trust Score using the analytical (non-neural) formula.

    T_score = 300 + 550 × (w₁·(1 - min(1, σ/μ⁺)) + w₂·C_ratio + w₃·(1 - S_freq))

    This serves as:
      1. Fallback when PyTorch is unavailable
      2. Interpretable baseline for comparison with neural output
      3. Initialization target for neural network training

    Args:
        cv: Coefficient of variation σ/μ⁺.
        consistency_ratio: C_ratio.
        shock_frequency: S_freq.
        weights: Scoring weights (default: w1=0.4, w2=0.4, w3=0.2).

    Returns:
        Trust score in [300, 850].
    """
    if weights is None:
        weights = ScoringWeights()

    volatility_component = 1.0 - min(1.0, cv)
    consistency_component = consistency_ratio
    shock_component = 1.0 - shock_frequency

    composite = (
        weights.w1 * volatility_component
        + weights.w2 * consistency_component
        + weights.w3 * shock_component
    )

    # Clamp to [0, 1] before scaling
    composite = max(0.0, min(1.0, composite))

    return 300.0 + 550.0 * composite


def compute_resilience_score(
    liquid_buffer: float,
    mean_positive: float,
    es_alpha: float,
) -> float:
    """
    Compute Financial Resilience Score (deterministic formula).

    R_score = min(1.0, (B_t + E[X_{t+1}|X_{t+1}>0]) / |ES_α|) × 100%

    Measures whether available liquid capital plus expected short-term
    inflows can absorb a (1-α) worst-case downside shock.

    R_score ≥ 100% → can absorb tail shock without defaulting.

    Args:
        liquid_buffer: B_t — verified liquid savings.
        mean_positive: E[X_{t+1}|X_{t+1}>0] — expected positive inflow.
        es_alpha: ES_α — expected shortfall (typically negative).

    Returns:
        Resilience score in [0, 100].
    """
    es_abs = abs(es_alpha) if abs(es_alpha) > 1e-10 else 1e-10
    coverage = (liquid_buffer + max(0, mean_positive)) / es_abs
    return min(1.0, coverage) * 100.0


# ─────────────────────────────────────────────────────────────────────
# PyTorch Neural Model (optional, used when torch is available)
# ─────────────────────────────────────────────────────────────────────

if TORCH_AVAILABLE:

    class TrustScoreMLP(nn.Module):
        """
        Lightweight MLP for Trust Score prediction.

        Architecture:
          Input (9) → Linear(64) → GELU → Dropout → Linear(32) → GELU → Linear(1) → Sigmoid

        Output is scaled to [300, 850] via:
          T_score = 300 + 550 × sigmoid(output)
        """

        def __init__(self, config: Optional[NeuralConfig] = None):
            super().__init__()
            if config is None:
                config = NeuralConfig()

            self.config = config
            dims = [config.input_dim] + config.hidden_dims

            layers = []
            for i in range(len(dims) - 1):
                layers.append(nn.Linear(dims[i], dims[i + 1]))
                layers.append(nn.GELU())
                if i < len(dims) - 2:
                    layers.append(nn.Dropout(config.dropout_rate))

            self.feature_extractor = nn.Sequential(*layers)
            self.score_head = nn.Linear(dims[-1], 1)
            self.sigmoid = nn.Sigmoid()

        def forward(
            self, x: torch.Tensor
        ) -> Tuple[torch.Tensor, torch.Tensor]:
            """
            Forward pass returning both trust score and latent features.

            Args:
                x: Input tensor of shape (batch, 9).

            Returns:
                Tuple of (trust_scores [batch, 1], latent [batch, 32]).
            """
            z = self.feature_extractor(x)
            raw_score = self.score_head(z)
            scaled_score = (
                self.config.trust_score_min
                + (self.config.trust_score_max - self.config.trust_score_min)
                * self.sigmoid(raw_score)
            )
            return scaled_score, z

        def predict(self, feature_vector: np.ndarray) -> Tuple[float, np.ndarray]:
            """
            Single-sample inference.

            Args:
                feature_vector: 9-dim feature vector h_t.

            Returns:
                Tuple of (trust_score, latent_vector).
            """
            self.eval()
            with torch.no_grad():
                x = torch.tensor(
                    feature_vector, dtype=torch.float32
                ).unsqueeze(0)
                score, latent = self.forward(x)
                return float(score.item()), latent.squeeze(0).numpy()

    def train_trust_score_model(
        features: np.ndarray,
        targets: np.ndarray,
        config: Optional[NeuralConfig] = None,
        validation_split: float = 0.2,
    ) -> TrustScoreMLP:
        """
        Train the Trust Score MLP on labeled data.

        Args:
            features: Training features of shape (N, 9).
            targets: Target trust scores of shape (N,) in [300, 850].
            config: Neural configuration.
            validation_split: Fraction of data for validation.

        Returns:
            Trained TrustScoreMLP model.
        """
        if config is None:
            config = NeuralConfig()

        model = TrustScoreMLP(config)
        optimizer = optim.AdamW(
            model.parameters(),
            lr=config.learning_rate,
            weight_decay=config.weight_decay,
        )
        scheduler = optim.lr_scheduler.CosineAnnealingLR(
            optimizer, T_max=config.epochs
        )
        criterion = nn.MSELoss()

        # Split data
        n = len(features)
        n_val = int(n * validation_split)
        indices = np.random.permutation(n)
        train_idx, val_idx = indices[n_val:], indices[:n_val]

        X_train = torch.tensor(features[train_idx], dtype=torch.float32)
        y_train = torch.tensor(
            targets[train_idx], dtype=torch.float32
        ).unsqueeze(1)
        X_val = torch.tensor(features[val_idx], dtype=torch.float32)
        y_val = torch.tensor(
            targets[val_idx], dtype=torch.float32
        ).unsqueeze(1)

        train_dataset = TensorDataset(X_train, y_train)
        train_loader = DataLoader(
            train_dataset, batch_size=min(64, len(train_idx)), shuffle=True
        )

        best_val_loss = float("inf")
        best_state = None

        for epoch in range(config.epochs):
            model.train()
            for batch_x, batch_y in train_loader:
                optimizer.zero_grad()
                pred, _ = model(batch_x)
                loss = criterion(pred, batch_y)
                loss.backward()
                optimizer.step()

            scheduler.step()

            # Validation
            model.eval()
            with torch.no_grad():
                val_pred, _ = model(X_val)
                val_loss = criterion(val_pred, y_val).item()

            if val_loss < best_val_loss:
                best_val_loss = val_loss
                best_state = {
                    k: v.clone() for k, v in model.state_dict().items()
                }

        # Restore best model
        if best_state is not None:
            model.load_state_dict(best_state)

        return model


# ─────────────────────────────────────────────────────────────────────
# Unified Scoring Interface
# ─────────────────────────────────────────────────────────────────────

def compute_scores(
    current_residual: float,
    mean_positive: float,
    std_dev: float,
    cv: float,
    consistency_ratio: float,
    var_alpha: float,
    es_alpha: float,
    shock_frequency: float,
    liquid_buffer: float,
    neural_model: object = None,
    scoring_weights: Optional[ScoringWeights] = None,
) -> ScoringResult:
    """
    Compute both Trust Score and Resilience Score.

    Uses the neural model if available and provided, otherwise falls
    back to the analytical (interpretable) formula.

    Args:
        current_residual: Most recent deseasonalized cash-flow X̃_t.
        mean_positive: μ⁺ — mean positive cash flow.
        std_dev: σ — cash-flow standard deviation.
        cv: σ/μ⁺ — coefficient of variation.
        consistency_ratio: C_ratio.
        var_alpha: VaR_α estimate.
        es_alpha: ES_α estimate.
        shock_frequency: S_freq.
        liquid_buffer: B_t — liquid reserves.
        neural_model: Optional trained TrustScoreMLP model.
        scoring_weights: Weights for analytical formula.

    Returns:
        ScoringResult with both scores and diagnostics.
    """
    # Build feature vector
    h_t = build_feature_vector(
        current_residual, mean_positive, std_dev, cv,
        consistency_ratio, var_alpha, es_alpha,
        shock_frequency, liquid_buffer,
    )

    # Resilience score (always deterministic)
    r_score = compute_resilience_score(liquid_buffer, mean_positive, es_alpha)

    # Trust score (neural if available, else analytical)
    latent = None
    method = "analytical"

    if TORCH_AVAILABLE and neural_model is not None and isinstance(neural_model, TrustScoreMLP):
        try:
            t_score, latent = neural_model.predict(h_t)
            method = "neural"
        except Exception:
            t_score = compute_trust_score_analytical(
                cv, consistency_ratio, shock_frequency, scoring_weights
            )
    else:
        t_score = compute_trust_score_analytical(
            cv, consistency_ratio, shock_frequency, scoring_weights
        )

    return ScoringResult(
        trust_score=t_score,
        resilience_score=r_score,
        feature_vector=h_t,
        latent_vector=latent,
        scoring_method=method,
    )
