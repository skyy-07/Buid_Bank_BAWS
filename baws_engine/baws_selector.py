"""
BAWS-NN Engine — Bootstrap-Based Adaptive Window Selection

Implements the core BAWS algorithm (Algorithm 1 from the paper):
  Step 2: Candidate horizon & reference window setup
  Step 3: Sequential loss difference evaluation
  Step 4: Moving Block Bootstrap (MBB) threshold calibration
  Step 5: Optimal window selection k̂_t

Mathematical Reference (arXiv:2603.01157v2):
  D(t, k, i) = |f_{t,i}(θ̂_k) - f_{t,i}(θ̂_i)|
  τ(t, i)    = β-quantile of bootstrap loss differences
  T_k        = I(D(t, k, i) > τ(t, i))
  k̂_t        = max{k ∈ K : T_k = 0}

  MBB block length: l_i = c * ceil(i^{1/3})  (Künsch 1989)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Tuple

import numpy as np

from baws_engine.config import BAWSConfig


@dataclass
class BAWSResult:
    """
    Output of the adaptive window selection process.

    Attributes:
        optimal_k: Selected optimal look-back window k̂_t.
        break_detected: Whether any structural break was detected.
        rejection_vector: Binary vector T_k for each candidate window.
        candidate_windows: The candidate window sizes evaluated.
        mbb_block_length: Block length l_i used in MBB.
        loss_differences: Loss differences D(t,k,i) for each candidate.
        threshold: Calibrated threshold τ(t,i).
    """
    optimal_k: int
    break_detected: bool
    rejection_vector: List[int]
    candidate_windows: List[int]
    mbb_block_length: int
    loss_differences: List[float]
    threshold: float


# ─────────────────────────────────────────────────────────────────────
# Scoring Functions (Elicitable Loss Functions)
# ─────────────────────────────────────────────────────────────────────

def pinball_loss(x: np.ndarray, q: float, alpha: float) -> np.ndarray:
    """
    Quantile check function (pinball loss) for VaR estimation.

    S_{V,α}(v, x) = (I(x < v) - α)(v - x)

    This is the strictly consistent scoring function for VaR_α.
    Minimizing the expected pinball loss yields the α-quantile.

    Args:
        x: Observed cash-flow values.
        q: Quantile estimate (candidate VaR).
        alpha: Confidence level (e.g., 0.90).

    Returns:
        Array of elementwise pinball losses.
    """
    diff = q - x
    return np.where(x < q, (1.0 - alpha) * diff, -alpha * diff)


def fissler_ziegel_loss(
    x: np.ndarray,
    v: float,
    e: float,
    alpha: float,
) -> np.ndarray:
    """
    Fissler-Ziegel joint scoring function for (VaR, ES) pair.

    S_{V,E,α}(x, v, e) = (I(x < v) - α)(v - x)
                         + 1/(1-α) * G₂(e) * I(x ≥ v)(v - x)
                         + G₂(e)(e - v) - G̃₂(e)

    where G₂(e) = -1/e, G̃₂(e) = -ln(-e)  (for negative shortfalls)

    This is the unique (up to equivalence) strictly consistent joint
    scoring function for the (VaR_α, ES_α) pair (Fissler & Ziegel 2016).

    Args:
        x: Observed cash-flow values.
        v: VaR estimate.
        e: ES estimate (expected to be ≤ v for lower-tail risk).
        alpha: Confidence level.

    Returns:
        Array of elementwise Fissler-Ziegel losses.
    """
    indicator_below = (x < v).astype(float)
    indicator_above = 1.0 - indicator_below
    diff_vx = v - x

    # Pinball component
    pinball = (indicator_below - alpha) * diff_vx

    # Ensure e is negative for the G₂ functions (lower-tail ES)
    e_safe = min(e, -1e-10)
    g2_e = -1.0 / e_safe
    g2_tilde_e = -np.log(-e_safe)

    # Joint correction terms
    correction = g2_e * indicator_above * diff_vx
    level_term = g2_e * (e - v)

    return pinball + (1.0 / (1.0 - alpha)) * correction + level_term - g2_tilde_e


def compute_empirical_loss(
    series: np.ndarray,
    theta: float,
    alpha: float,
    loss_type: str = "pinball",
    theta_es: Optional[float] = None,
) -> float:
    """
    Compute the empirical average loss f_{t,i}(θ) over a data window.

    f_{t,i}(θ) = (1/i) Σ_{s=t-i+1}^{t} S(X̃_s, θ)

    Args:
        series: Data window [X̃_{t-i+1}, ..., X̃_t].
        theta: Parameter estimate (VaR candidate).
        alpha: Confidence level.
        loss_type: "pinball" for VaR-only, "fissler_ziegel" for joint VaR-ES.
        theta_es: ES estimate (required if loss_type = "fissler_ziegel").

    Returns:
        Mean loss value.
    """
    if loss_type == "pinball":
        losses = pinball_loss(series, theta, alpha)
    elif loss_type == "fissler_ziegel":
        if theta_es is None:
            raise ValueError("theta_es required for Fissler-Ziegel loss")
        losses = fissler_ziegel_loss(series, theta, theta_es, alpha)
    else:
        raise ValueError(f"Unknown loss type: {loss_type}")

    return float(np.mean(losses))


# ─────────────────────────────────────────────────────────────────────
# Candidate Window Construction
# ─────────────────────────────────────────────────────────────────────

def build_candidate_windows(
    t: int,
    k_min: int,
    k_max_cap: int,
    previous_k: Optional[int] = None,
) -> List[int]:
    """
    Construct the candidate window set K_t using growing increments.

    From §2.2 of the paper:
      - Increments of 5 below 50
      - Increments of 10 for 50–100
      - Increments of 20 for 100–300
      - Increments of 50 for 300–1000
      - Increments of 100 beyond 1000

    The previous selection k̂_{t-1} is always included if provided.

    Args:
        t: Current time index (total available observations).
        k_min: Minimum window size.
        k_max_cap: Maximum window size cap.
        previous_k: Previously selected window k̂_{t-1}.

    Returns:
        Sorted list of unique candidate window sizes.
    """
    max_k = min(t - 1, k_max_cap) if t > 1 else k_min
    candidates = set()

    k = k_min
    while k <= max_k:
        candidates.add(k)
        if k < 50:
            k += 5
        elif k < 100:
            k += 10
        elif k < 300:
            k += 20
        elif k < 1000:
            k += 50
        else:
            k += 100

    # Always include the maximum available
    candidates.add(max_k)

    # Include previous selection as reference
    if previous_k is not None and k_min <= previous_k <= max_k:
        candidates.add(previous_k)

    return sorted(candidates)


# ─────────────────────────────────────────────────────────────────────
# Moving Block Bootstrap (MBB) Threshold Calibration
# ─────────────────────────────────────────────────────────────────────

def compute_mbb_block_length(i: int, c: float = 1.0) -> int:
    """
    Compute the optimal MBB block length.

    l_i = c * ceil(i^{1/3})

    The rate l_i ~ O(i^{1/3}) is optimal for balancing block-boundary
    bias against variance in threshold calibration under α-mixing
    weakly dependent processes (Künsch 1989, Hall et al. 1995).

    Args:
        i: Reference window sample size.
        c: Tuning constant (default 1.0).

    Returns:
        Block length l_i (at least 1).
    """
    return max(1, int(np.ceil(c * np.power(i, 1.0 / 3.0))))


def mbb_resample(
    series: np.ndarray,
    block_length: int,
    rng: np.random.Generator,
) -> np.ndarray:
    """
    Generate a single MBB resample by drawing overlapping blocks
    with replacement and concatenating.

    Preserves within-block autocorrelation structure of the original
    weakly dependent time series.

    Args:
        series: Reference window observations [X̃_{t-i+1}, ..., X̃_t].
        block_length: Block size l_i.
        rng: NumPy random generator for reproducibility.

    Returns:
        Resampled series of the same length as input.
    """
    n = len(series)
    if block_length >= n:
        return series.copy()

    num_blocks = int(np.ceil(n / block_length))
    max_start = n - block_length  # Inclusive

    resampled = []
    for _ in range(num_blocks):
        start = rng.integers(0, max_start + 1)
        block = series[start: start + block_length]
        resampled.append(block)

    return np.concatenate(resampled)[:n]


def calibrate_threshold(
    ref_window_data: np.ndarray,
    alpha: float,
    beta: float,
    n_boot: int,
    block_length: int,
    loss_type: str = "pinball",
    seed: int = 42,
) -> float:
    """
    Calibrate the data-dependent threshold τ(t,i) via Moving Block Bootstrap.

    Algorithm (§2.2 of the paper):
      For b = 1, ..., B:
        1. Resample reference window via MBB → {x^(b)}
        2. Compute θ̂^(b) = argmin f^(b)(θ)   (bootstrap estimator)
        3. Compute excess loss: f_{t,i}(θ̂^(b)) - f_{t,i}(θ̂_{t,i})
      4. τ(t,i) = β-quantile of excess losses

    Args:
        ref_window_data: Reference window observations.
        alpha: VaR confidence level.
        beta: Bootstrap threshold confidence level.
        n_boot: Number of bootstrap replications.
        block_length: MBB block length l_i.
        loss_type: Scoring function type.
        seed: Random seed for reproducibility.

    Returns:
        Calibrated threshold τ(t,i).
    """
    rng = np.random.default_rng(seed)
    i = len(ref_window_data)

    # Reference estimator: empirical α-quantile of reference window
    theta_ref = float(np.quantile(ref_window_data, 1.0 - alpha))

    # Compute reference loss
    loss_ref = compute_empirical_loss(ref_window_data, theta_ref, alpha, loss_type)

    excess_losses = np.zeros(n_boot)

    for b in range(n_boot):
        # Step 1: MBB resample
        resampled = mbb_resample(ref_window_data, block_length, rng)

        # Step 2: Bootstrap estimator (quantile of resampled data)
        theta_boot = float(np.quantile(resampled, 1.0 - alpha))

        # Step 3: Excess loss evaluated on ORIGINAL reference window
        loss_boot = compute_empirical_loss(
            ref_window_data, theta_boot, alpha, loss_type
        )
        excess_losses[b] = loss_boot - loss_ref

    # Step 4: β-quantile of excess losses
    threshold = float(np.quantile(excess_losses, beta))

    # Ensure threshold is non-negative (excess loss ≥ 0 by definition of minimizer)
    return max(threshold, 0.0)


# ─────────────────────────────────────────────────────────────────────
# Core BAWS Algorithm
# ─────────────────────────────────────────────────────────────────────

def select_adaptive_window(
    residual_series: np.ndarray,
    config: Optional[BAWSConfig] = None,
    previous_k: Optional[int] = None,
    seed: int = 42,
) -> BAWSResult:
    """
    Execute the full BAWS adaptive window selection algorithm.

    At each time step t, evaluates candidate look-back windows k against
    a short reference window i = k_min. Windows whose loss difference
    exceeds the MBB-calibrated threshold are rejected (T_k = 1).
    The largest admissible window is selected: k̂_t = max{k : T_k = 0}.

    Mathematical guarantee (Theorem 2):
      If a structural break of magnitude δ > √(log(n)/k_min) occurred,
      P(T_k = 1) → 1 as n → ∞.
      This ensures pre-crisis data cannot mask current distress.

    Args:
        residual_series: Deseasonalized residual X̃_t from STL.
              Full available history [X̃_1, ..., X̃_t].
        config: BAWS configuration (uses defaults if None).
        previous_k: Previously selected window k̂_{t-1} for inclusion
              in candidate set.
        seed: Random seed for bootstrap reproducibility.

    Returns:
        BAWSResult with optimal window, break indicators, and diagnostics.
    """
    if config is None:
        config = BAWSConfig()

    t = len(residual_series)
    k_min = config.k_min
    alpha = config.alpha

    # Edge case: too few observations
    if t <= k_min:
        return BAWSResult(
            optimal_k=t,
            break_detected=False,
            rejection_vector=[0],
            candidate_windows=[t],
            mbb_block_length=1,
            loss_differences=[0.0],
            threshold=0.0,
        )

    # Step 1: Build candidate window set
    candidates = build_candidate_windows(
        t=t,
        k_min=k_min,
        k_max_cap=config.k_max_cap,
        previous_k=previous_k,
    )

    # Reference window data (most recent k_min observations)
    ref_data = residual_series[-k_min:]

    # MBB block length
    block_length = compute_mbb_block_length(k_min, config.block_length_constant)

    # Calibrate threshold τ(t, i) using MBB on reference window
    threshold = calibrate_threshold(
        ref_window_data=ref_data,
        alpha=alpha,
        beta=config.beta,
        n_boot=config.n_boot,
        block_length=block_length,
        seed=seed,
    )

    # Reference parameter: empirical quantile over reference window
    theta_ref = float(np.quantile(ref_data, 1.0 - alpha))
    loss_ref = compute_empirical_loss(ref_data, theta_ref, alpha)

    # Step 2–4: Evaluate each candidate window
    rejection_vector = []
    loss_differences = []
    optimal_k = k_min
    break_detected = False

    for k in candidates:
        if k <= k_min:
            # Reference window is always admissible
            rejection_vector.append(0)
            loss_differences.append(0.0)
            optimal_k = k
            continue

        # Candidate parameter: empirical quantile over window k
        candidate_data = residual_series[-k:]
        theta_k = float(np.quantile(candidate_data, 1.0 - alpha))

        # Loss difference D(t, k, i): candidate θ_k evaluated on reference window
        loss_k_on_ref = compute_empirical_loss(ref_data, theta_k, alpha)
        D = abs(loss_k_on_ref - loss_ref)

        loss_differences.append(D)

        # Rejection test: T_k = I(D > τ)
        if D > threshold:
            rejection_vector.append(1)
            break_detected = True
        else:
            rejection_vector.append(0)
            optimal_k = k  # Largest admissible so far

    return BAWSResult(
        optimal_k=optimal_k,
        break_detected=break_detected,
        rejection_vector=rejection_vector,
        candidate_windows=candidates,
        mbb_block_length=block_length,
        loss_differences=loss_differences,
        threshold=threshold,
    )
