"""
BAWS-NN Engine — Synthetic Data Generator

Generates multi-regime synthetic cash-flow series for training,
validation, and stress-testing the BAWS-NN engine.

Supports:
  1. Stable regime series (stationary with seasonal overlay)
  2. Single structural break (mean/variance shift at configurable t)
  3. Multi-regime switching (Markov-style)
  4. Stress injection (-70% income shock)
  5. Agricultural seasonal patterns (harvest/sowing cycles)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import numpy as np


@dataclass
class SyntheticConfig:
    """Configuration for synthetic cash-flow generation."""
    n_periods: int = 60                 # Total observation periods
    base_income: float = 1000.0         # Mean gross inflow (stable regime)
    base_expense: float = 700.0         # Mean gross outflow
    income_std: float = 200.0           # Income standard deviation
    expense_std: float = 100.0          # Expense standard deviation
    seasonal_amplitude: float = 150.0   # Seasonal component amplitude
    seasonal_period: int = 12           # Seasonal period (months)
    ar1_coefficient: float = 0.3        # AR(1) autocorrelation coefficient
    liquid_buffer_mean: float = 500.0   # Mean liquid buffer reserves
    liquid_buffer_std: float = 150.0    # Buffer standard deviation
    seed: int = 42


@dataclass
class BreakConfig:
    """Configuration for structural breaks."""
    break_time: int = 20               # Period at which break occurs
    income_shift: float = -0.5         # Fractional change in mean income
    variance_shift: float = 1.5        # Multiplicative change in variance
    expense_shift: float = 0.2         # Fractional change in expenses


@dataclass
class StressConfig:
    """Configuration for stress scenario injection."""
    shock_time: int = 20               # Period at which shock occurs
    shock_magnitude: float = -0.7      # -70% income shock
    shock_duration: int = 3            # Number of periods shock persists
    recovery_rate: float = 0.3         # Recovery per period after shock


@dataclass
class SyntheticSeries:
    """Output of the synthetic data generator."""
    gross_inflows: np.ndarray
    gross_outflows: np.ndarray
    liquid_buffers: np.ndarray
    net_cash_flow: np.ndarray
    event_tags: np.ndarray
    break_points: List[int]
    regime_labels: np.ndarray
    timestamps: np.ndarray


def generate_seasonal_component(
    n: int,
    amplitude: float,
    period: int,
    phase: float = 0.0,
) -> np.ndarray:
    """
    Generate seasonal component Ŝ_t as a sinusoidal cycle.

    For agricultural borrowers, this captures harvest peaks and
    sowing-season expenditure troughs.
    Args:
        n: Number of periods.
        amplitude: Seasonal swing magnitude.
        period: Cycle length (typically 12 months).
        phase: Phase offset in radians.
    Returns:
        Seasonal component array.
    """
    t = np.arange(n)
    return amplitude * np.sin(2 * np.pi * t / period + phase)

def generate_ar1_noise(
    n: int,
    phi: float,
    sigma: float,
    rng: np.random.Generator,
) -> np.ndarray:
    """
    Generate AR(1) autocorrelated noise.

    X_t = φ * X_{t-1} + ε_t,  ε_t ~ N(0, σ²)

    Preserves the serial correlation structure that the MBB is
    designed to handle.

    Args:
        n: Number of periods.
        phi: AR(1) coefficient (|φ| < 1 for stationarity).
        sigma: Innovation standard deviation.
        rng: Random generator.

    Returns:
        AR(1) noise series.
    """
    noise = np.zeros(n)
    innovations = rng.normal(0, sigma, n)
    noise[0] = innovations[0]
    for t in range(1, n):
        noise[t] = phi * noise[t - 1] + innovations[t]
    return noise


def generate_stable_series(
    config: Optional[SyntheticConfig] = None,
) -> SyntheticSeries:
    """
    Generate a stationary cash-flow series with seasonal overlay.

    No structural breaks — used as a control/baseline.

    Args:
        config: Generator configuration.

    Returns:
        SyntheticSeries with stable regime throughout.
    """
    if config is None:
        config = SyntheticConfig()

    rng = np.random.default_rng(config.seed)
    n = config.n_periods

    # Seasonal component
    seasonal = generate_seasonal_component(
        n, config.seasonal_amplitude, config.seasonal_period
    )

    # AR(1) noise for income and expenses
    income_noise = generate_ar1_noise(n, config.ar1_coefficient, config.income_std, rng)
    expense_noise = generate_ar1_noise(n, config.ar1_coefficient * 0.5, config.expense_std, rng)

    # Gross inflows and outflows
    inflows = np.maximum(0, config.base_income + seasonal + income_noise)
    outflows = np.maximum(0, config.base_expense + expense_noise)

    # Liquid buffer (random walk with drift toward mean)
    buffers = np.zeros(n)
    buffers[0] = config.liquid_buffer_mean
    for t in range(1, n):
        reversion = 0.1 * (config.liquid_buffer_mean - buffers[t - 1])
        buffers[t] = max(0, buffers[t - 1] + reversion + rng.normal(0, config.liquid_buffer_std * 0.3))

    net = inflows - outflows
    tags = np.array(["NORMAL"] * n)
    timestamps = np.arange(n)

    return SyntheticSeries(
        gross_inflows=inflows,
        gross_outflows=outflows,
        liquid_buffers=buffers,
        net_cash_flow=net,
        event_tags=tags,
        break_points=[],
        regime_labels=np.zeros(n, dtype=int),
        timestamps=timestamps,
    )


def generate_single_break_series(
    syn_config: Optional[SyntheticConfig] = None,
    break_config: Optional[BreakConfig] = None,
) -> SyntheticSeries:
    """
    Generate a cash-flow series with a single structural break.

    At t = break_time:
      - Income mean shifts by income_shift fraction
      - Income variance multiplied by variance_shift
      - Expenses shift by expense_shift fraction

    Used to validate Theorem 2: BAWS should reject windows crossing
    sufficiently large breaks with P(T_k = 1) → 1.

    Args:
        syn_config: Base generator configuration.
        break_config: Break specification.

    Returns:
        SyntheticSeries with break metadata.
    """
    if syn_config is None:
        syn_config = SyntheticConfig()
    if break_config is None:
        break_config = BreakConfig()

    rng = np.random.default_rng(syn_config.seed)
    n = syn_config.n_periods
    bt = break_config.break_time

    seasonal = generate_seasonal_component(
        n, syn_config.seasonal_amplitude, syn_config.seasonal_period
    )

    # Pre-break regime
    income_pre = generate_ar1_noise(
        bt, syn_config.ar1_coefficient, syn_config.income_std, rng
    )
    expense_pre = generate_ar1_noise(
        bt, syn_config.ar1_coefficient * 0.5, syn_config.expense_std, rng
    )

    # Post-break regime (shifted mean and variance)
    post_n = n - bt
    new_income_mean = syn_config.base_income * (1.0 + break_config.income_shift)
    new_income_std = syn_config.income_std * break_config.variance_shift
    new_expense_mean = syn_config.base_expense * (1.0 + break_config.expense_shift)

    income_post = generate_ar1_noise(
        post_n, syn_config.ar1_coefficient, new_income_std, rng
    )
    expense_post = generate_ar1_noise(
        post_n, syn_config.ar1_coefficient * 0.5, syn_config.expense_std, rng
    )

    # Combine regimes
    inflows = np.zeros(n)
    outflows = np.zeros(n)

    inflows[:bt] = np.maximum(0, syn_config.base_income + seasonal[:bt] + income_pre)
    inflows[bt:] = np.maximum(0, new_income_mean + seasonal[bt:] + income_post)

    outflows[:bt] = np.maximum(0, syn_config.base_expense + expense_pre)
    outflows[bt:] = np.maximum(0, new_expense_mean + expense_post)

    # Liquid buffer
    buffers = np.zeros(n)
    buffers[0] = syn_config.liquid_buffer_mean
    for t in range(1, n):
        mean_target = syn_config.liquid_buffer_mean * (
            0.5 if t >= bt else 1.0
        )
        reversion = 0.1 * (mean_target - buffers[t - 1])
        buffers[t] = max(0, buffers[t - 1] + reversion + rng.normal(0, syn_config.liquid_buffer_std * 0.3))

    net = inflows - outflows
    tags = np.array(["NORMAL"] * n)
    tags[bt] = "REGIME_SHIFT"

    regime_labels = np.zeros(n, dtype=int)
    regime_labels[bt:] = 1

    return SyntheticSeries(
        gross_inflows=inflows,
        gross_outflows=outflows,
        liquid_buffers=buffers,
        net_cash_flow=net,
        event_tags=tags,
        break_points=[bt],
        regime_labels=regime_labels,
        timestamps=np.arange(n),
    )


def generate_stress_scenario(
    syn_config: Optional[SyntheticConfig] = None,
    stress_config: Optional[StressConfig] = None,
) -> SyntheticSeries:
    """
    Generate a cash-flow series with a severe exogenous shock.

    At t = shock_time, inflows drop by shock_magnitude (e.g., -70%).
    The shock persists for shock_duration periods, then gradually
    recovers at recovery_rate per period.

    Used to validate the shock-shield invariant:
      - BAWS should assert T_k = 1 within ≤ 2 cycles
      - k̂_t should contract to ≤ k_min + 2

    Args:
        syn_config: Base generator configuration.
        stress_config: Stress scenario specification.

    Returns:
        SyntheticSeries with stress metadata.
    """
    if syn_config is None:
        syn_config = SyntheticConfig()
    if stress_config is None:
        stress_config = StressConfig()

    # Generate stable base
    base = generate_stable_series(syn_config)
    inflows = base.gross_inflows.copy()
    tags = base.event_tags.copy()

    st = stress_config.shock_time
    n = syn_config.n_periods

    # Apply shock
    for t in range(st, min(st + stress_config.shock_duration, n)):
        inflows[t] *= (1.0 + stress_config.shock_magnitude)
        tags[t] = "REGIME_SHIFT"

    # Gradual recovery
    recovery_start = st + stress_config.shock_duration
    for t in range(recovery_start, n):
        periods_since = t - recovery_start
        recovery_factor = min(1.0, (1.0 + stress_config.shock_magnitude) + stress_config.recovery_rate * (periods_since + 1))
        if recovery_factor < 1.0:
            inflows[t] *= recovery_factor

    net = inflows - base.gross_outflows

    return SyntheticSeries(
        gross_inflows=inflows,
        gross_outflows=base.gross_outflows,
        liquid_buffers=base.liquid_buffers,
        net_cash_flow=net,
        event_tags=tags,
        break_points=[st],
        regime_labels=base.regime_labels,
        timestamps=base.timestamps,
    )


def generate_multi_regime_series(
    n_periods: int = 120,
    n_regimes: int = 4,
    seed: int = 42,
) -> SyntheticSeries:
    """
    Generate a multi-regime switching cash-flow series.

    Simulates realistic career transitions: stable employment →
    job loss → gig work → recovery.

    Args:
        n_periods: Total number of periods.
        n_regimes: Number of distinct regimes.
        seed: Random seed.

    Returns:
        SyntheticSeries with multiple structural breaks.
    """
    rng = np.random.default_rng(seed)

    # Define regime parameters
    regime_durations = np.array([n_periods // n_regimes] * n_regimes)
    regime_durations[-1] = n_periods - regime_durations[:-1].sum()

    regime_income_means = [1000, 400, 600, 900][:n_regimes]
    regime_income_stds = [150, 300, 250, 180][:n_regimes]
    regime_expense_means = [700, 600, 550, 650][:n_regimes]

    inflows = np.zeros(n_periods)
    outflows = np.zeros(n_periods)
    regime_labels = np.zeros(n_periods, dtype=int)
    tags = np.array(["NORMAL"] * n_periods)
    break_points = []

    idx = 0
    for r in range(n_regimes):
        dur = regime_durations[r]
        regime_labels[idx: idx + dur] = r

        if r > 0:
            break_points.append(idx)
            tags[idx] = "REGIME_SHIFT"

        noise_i = generate_ar1_noise(dur, 0.3, regime_income_stds[r], rng)
        noise_e = generate_ar1_noise(dur, 0.15, 80.0, rng)

        seasonal = generate_seasonal_component(dur, 100.0, 12)

        inflows[idx: idx + dur] = np.maximum(
            0, regime_income_means[r] + seasonal + noise_i
        )
        outflows[idx: idx + dur] = np.maximum(
            0, regime_expense_means[r] + noise_e
        )

        idx += dur

    # Liquid buffer
    buffers = np.zeros(n_periods)
    buffers[0] = 500.0
    for t in range(1, n_periods):
        net_t = inflows[t] - outflows[t]
        buffers[t] = max(0, buffers[t - 1] + 0.1 * net_t + rng.normal(0, 30))

    net = inflows - outflows

    return SyntheticSeries(
        gross_inflows=inflows,
        gross_outflows=outflows,
        liquid_buffers=buffers,
        net_cash_flow=net,
        event_tags=tags,
        break_points=break_points,
        regime_labels=regime_labels,
        timestamps=np.arange(n_periods),
    )
