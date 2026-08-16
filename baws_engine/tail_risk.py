"""
BAWS-NN Engine — Tail-Risk Estimation

Implements Step 5 of the BAWS-NN pipeline:
  Joint estimation of VaR_α and ES_α via Fissler-Ziegel loss minimization,
  plus computation of all auxiliary risk metrics.

Mathematical Reference:
  VaR_α = argmin_v E[S_{V,α}(v, X)]            (quantile check function)

  (VaR_α, ES_α) = argmin_{v,e} E[S_{V,E,α}(v, e, X)]   (Fissler-Ziegel)

  L_FZ(v, e) = (1/k̂_t) Σ [ (I{X̃_s < v} - α)(v - X̃_s)
               + 1/(1-α) G₂(e) I{X̃_s ≥ v}(v - X̃_s) + G₂(e)(e-v) - G̃₂(e) ]

  where G₂(e) = -1/e, G̃₂(e) = -ln(-e)

Auxiliary Metrics (computed over adaptive window k̂_t):
  μ⁺   = mean of positive cash flows
  σ    = standard deviation
  σ/μ⁺ = coefficient of variation (income volatility ratio)
  C_ratio = fraction of non-negative periods
  S_freq  = frequency of tail breaches below VaR
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np
from scipy.optimize import minimize

from baws_engine.config import BAWSConfig


@dataclass
class TailRiskResult:
    """
    Output of the tail-risk estimation module.

    Attributes:
        var_alpha: Value-at-Risk at confidence level α.
        es_alpha: Expected Shortfall at confidence level α.
        mean_positive: μ⁺ — mean of positive cash flows.
        std_dev: σ — cash-flow standard deviation.
        cv: σ/μ⁺ — coefficient of variation.
        consistency_ratio: C_ratio — fraction of non-negative periods.
        shock_frequency: S_freq — empirical rate of tail events.
        fz_loss: Optimized Fissler-Ziegel loss value.
    """
    var_alpha: float
    es_alpha: float
    mean_positive: float
    std_dev: float
    cv: float
    consistency_ratio: float
    shock_frequency: float
    fz_loss: float


def estimate_var_quantile(
    series: np.ndarray,
    alpha: float,
) -> float:
    """
    Estimate VaR_α as the empirical α-quantile.

    VaR_α(X) = F_X^{-1}(α) = inf{x : F_X(x) ≥ α}

    For lower-tail risk (cash-flow deficits), we use the (1-α) quantile
    of the series, which gives the α-level worst-case threshold.

    Args:
        series: Cash-flow observations over the selected window.
        alpha: Confidence level (e.g., 0.90).

    Returns:
        Estimated VaR_α value.
    """
    return float(np.quantile(series, 1.0 - alpha))


def estimate_es_empirical(
    series: np.ndarray,
    var_alpha: float,
) -> float:
    """
    Estimate ES_α as the conditional mean of observations below VaR.

    ES_α(X) = E[X_t | X_t ≤ VaR_α(X)]

    This is the average severity of losses in the tail.

    Args:
        series: Cash-flow observations.
        var_alpha: Estimated VaR threshold.

    Returns:
        Estimated ES_α. Falls back to VaR if no observations in the tail.
    """
    tail_obs = series[series <= var_alpha]
    if len(tail_obs) == 0:
        return var_alpha
    return float(np.mean(tail_obs))


def fissler_ziegel_objective(
    params: np.ndarray,
    series: np.ndarray,
    alpha: float,
) -> float:
    """
    Joint Fissler-Ziegel loss function for (VaR, ES) optimization.

    This is the objective minimized to jointly estimate VaR and ES
    in a strictly consistent manner.

    L_FZ(v, e) = (1/n) Σ_s [
        (I{x_s < v} - α)(v - x_s)
        + 1/(1-α) * G₂(e) * I{x_s ≥ v} * (v - x_s)
        + G₂(e) * (e - v)
        - G̃₂(e)
    ]

    Args:
        params: [v, e] — VaR and ES estimates.
        series: Cash-flow observations.
        alpha: Confidence level.

    Returns:
        Mean Fissler-Ziegel loss value (scalar).
    """
    v, e = params

    # Constraint: ES ≤ VaR for lower-tail (ES is deeper into the tail)
    # Enforce e < v and e < 0 for well-defined G₂
    e = min(e, v - 1e-8)
    if e >= 0:
        e = -1e-8

    indicator_below = (series < v).astype(float)
    indicator_above = 1.0 - indicator_below
    diff_vx = v - series

    # G₂(e) = -1/e,  G̃₂(e) = -ln(-e)
    g2 = -1.0 / e
    g2_tilde = -np.log(-e)

    # Pinball term
    pinball = (indicator_below - alpha) * diff_vx

    # Correction term (Fissler-Ziegel)
    correction = (1.0 / (1.0 - alpha)) * g2 * indicator_above * diff_vx

    # Level adjustment
    level = g2 * (e - v) - g2_tilde

    total_loss = pinball + correction + level
    return float(np.mean(total_loss))


def estimate_var_es_joint(
    series: np.ndarray,
    alpha: float,
) -> tuple[float, float, float]:
    """
    Jointly estimate (VaR_α, ES_α) by minimizing the Fissler-Ziegel loss.

    Uses L-BFGS-B with empirical quantile/conditional-mean initialization.

    Args:
        series: Cash-flow observations over the adaptive window k̂_t.
        alpha: Confidence level.

    Returns:
        Tuple of (VaR, ES, optimized_loss).
    """
    # Initialize with empirical estimates
    var_init = estimate_var_quantile(series, alpha)
    es_init = estimate_es_empirical(series, var_init)

    # Ensure valid initialization
    if es_init >= var_init:
        es_init = var_init - abs(var_init) * 0.1 - 1e-6
    if es_init >= 0:
        es_init = min(-1e-6, var_init - 1e-6)

    x0 = np.array([var_init, es_init])

    # Bounds: ES < VaR, ES < 0
    data_min = float(np.min(series))
    data_max = float(np.max(series))
    margin = max(abs(data_max - data_min), 1.0) * 2.0

    bounds = [
        (data_min - margin, data_max + margin),  # VaR bounds
        (data_min - margin, -1e-10),              # ES bounds (must be negative)
    ]

    try:
        result = minimize(
            fissler_ziegel_objective,
            x0,
            args=(series, alpha),
            method="L-BFGS-B",
            bounds=bounds,
            options={"maxiter": 1000, "ftol": 1e-10},
        )
        var_opt, es_opt = result.x
        loss_opt = result.fun

        # Enforce constraint: ES ≤ VaR
        if es_opt > var_opt:
            es_opt = var_opt - 1e-6

        return float(var_opt), float(es_opt), float(loss_opt)

    except Exception:
        # Fallback to empirical estimates
        return var_init, es_init, fissler_ziegel_objective(x0, series, alpha)


# ─────────────────────────────────────────────────────────────────────
# Auxiliary Risk Metrics
# ─────────────────────────────────────────────────────────────────────

def compute_mean_positive(series: np.ndarray) -> float:
    """
    Mean Positive Cash Flow: μ⁺_{k̂_t}

    μ⁺ = Σ X_s·I(X_s > 0) / Σ I(X_s > 0)

    Measures central tendency of earning capacity during productive
    periods, excluding zero/negative months.
    """
    positive = series[series > 0]
    if len(positive) == 0:
        return 0.0
    return float(np.mean(positive))


def compute_std_dev(series: np.ndarray) -> float:
    """
    Cash-Flow Standard Deviation: σ_{k̂_t}

    Unbiased sample standard deviation (ddof=1).
    """
    if len(series) < 2:
        return 0.0
    return float(np.std(series, ddof=1))


def compute_cv(std_dev: float, mean_positive: float) -> float:
    """
    Income Volatility Ratio (Coefficient of Variation): σ/μ⁺

    Dimensionless, scale-invariant measure of relative dispersion.
    """
    if mean_positive <= 0:
        return float("inf")
    return std_dev / mean_positive


def compute_consistency_ratio(series: np.ndarray) -> float:
    """
    Cash-Flow Consistency Ratio: C_ratio

    C_ratio = (1/k̂_t) Σ I(X_s ≥ 0)

    MLE of Bernoulli success probability for non-deficiency.
    C_ratio ≈ 1.0 → variable but mostly positive
    C_ratio < 0.5 → structural operational deficits
    """
    return float(np.mean(series >= 0))


def compute_shock_frequency(
    residual_series: np.ndarray,
    var_alpha: float,
) -> float:
    """
    Non-Seasonal Shock Frequency: S_freq

    S_freq = (1/k̂_t) Σ I(X̃_s < VaR_{0.90}(X̃))

    In a stationary environment, S_freq ≈ 1 - α = 0.10.
    S_freq >> 0.10 signals elevated exogenous shock arrival rate.
    """
    return float(np.mean(residual_series < var_alpha))


# ─────────────────────────────────────────────────────────────────────
# Full Tail-Risk Estimation Pipeline
# ─────────────────────────────────────────────────────────────────────

def estimate_tail_risk(
    net_cash_flow: np.ndarray,
    residual_series: np.ndarray,
    optimal_k: int,
    config: Optional[BAWSConfig] = None,
) -> TailRiskResult:
    """
    Execute the complete tail-risk estimation pipeline over the
    BAWS-selected adaptive window k̂_t.

    Pipeline:
      1. Extract window: most recent k̂_t observations
      2. Joint VaR/ES estimation via Fissler-Ziegel
      3. Compute auxiliary metrics: μ⁺, σ, CV, C_ratio, S_freq

    Args:
        net_cash_flow: Full net cash-flow series X_t.
        residual_series: Deseasonalized residual X̃_t.
        optimal_k: Selected adaptive window k̂_t from BAWS.
        config: BAWS configuration.

    Returns:
        TailRiskResult with all risk metrics.
    """
    if config is None:
        config = BAWSConfig()

    alpha = config.alpha

    # Extract windowed data
    window_cf = net_cash_flow[-optimal_k:]
    window_resid = residual_series[-optimal_k:]

    # Step 1: Joint VaR-ES estimation via Fissler-Ziegel
    var_alpha, es_alpha, fz_loss = estimate_var_es_joint(window_resid, alpha)

    # Step 2: Auxiliary metrics (computed on net cash flow for interpretability)
    mean_pos = compute_mean_positive(window_cf)
    std = compute_std_dev(window_cf)
    cv = compute_cv(std, mean_pos)
    c_ratio = compute_consistency_ratio(window_cf)

    # Shock frequency on deseasonalized residual
    s_freq = compute_shock_frequency(window_resid, var_alpha)

    return TailRiskResult(
        var_alpha=var_alpha,
        es_alpha=es_alpha,
        mean_positive=mean_pos,
        std_dev=std,
        cv=cv,
        consistency_ratio=c_ratio,
        shock_frequency=s_freq,
        fz_loss=fz_loss,
    )
