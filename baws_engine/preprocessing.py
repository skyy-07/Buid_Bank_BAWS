"""
BAWS-NN Engine — Preprocessing & Signal Conditioning Pipeline

Implements the three-stage preprocessing pipeline:
  1. Interval resampling & missing data imputation (Kalman / linear interpolation)
  2. Outlier winsorization (1st/99th percentiles, preserving regime shifts)
  3. STL seasonal decomposition → deseasonalized residual X̃_t

Mathematical Reference:
  X_t = gross_inflow_t - gross_outflow_t        (net cash flow)
  X_t = T̂_t + Ŝ_t + X̃_t                       (additive STL decomposition)

  where T̂_t = trend, Ŝ_t = seasonal (period=12), X̃_t = stationary residual
"""

from __future__ import annotations

import warnings
from dataclasses import dataclass
from typing import Optional, Tuple

import numpy as np
import pandas as pd
from scipy import interpolate
from statsmodels.tsa.seasonal import STL

from baws_engine.config import PreprocessingConfig


@dataclass
class PreprocessedSeries:
    """
    Output of the preprocessing pipeline.

    Attributes:
        net_cash_flow: Raw net cash flow X_t = inflow - outflow.
        trend: Trend component T̂_t from STL decomposition.
        seasonal: Seasonal component Ŝ_t from STL decomposition.
        residual: Deseasonalized stationary residual X̃_t passed to BAWS.
        liquid_buffer: Most recent verified liquid buffer B_t.
        timestamps: Corresponding datetime index.
        event_tags: Event tags per observation.
        imputed_mask: Boolean mask indicating which observations were imputed.
    """
    net_cash_flow: np.ndarray
    trend: np.ndarray
    seasonal: np.ndarray
    residual: np.ndarray
    liquid_buffer: float
    timestamps: np.ndarray
    event_tags: np.ndarray
    imputed_mask: np.ndarray


def validate_raw_inputs(
    timestamps: np.ndarray,
    gross_inflows: np.ndarray,
    gross_outflows: np.ndarray,
    liquid_buffers: np.ndarray,
) -> None:
    """
    Validate raw input arrays against the schema constraints.

    Raises:
        ValueError: If any validation constraint is violated.
    """
    n = len(timestamps)
    if n < 3:
        raise ValueError(
            f"Minimum 3 observations required for STL decomposition, got {n}"
        )

    if not (len(gross_inflows) == len(gross_outflows) == len(liquid_buffers) == n):
        raise ValueError("All input arrays must have the same length")

    if np.any(gross_inflows < 0):
        raise ValueError("gross_inflow values must be >= 0")

    if np.any(gross_outflows < 0):
        raise ValueError("gross_outflow values must be >= 0")

    if np.any(liquid_buffers[~np.isnan(liquid_buffers)] < 0):
        raise ValueError("liquid_buffer values must be >= 0")


def impute_missing_values(
    series: np.ndarray,
    config: PreprocessingConfig,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Impute missing values using linear interpolation for short gaps
    and Kalman-style smoothing for longer gaps.

    For gaps < max_gap_interpolation periods: linear interpolation.
    For gaps >= max_gap_interpolation periods: state-space Kalman smoother
    approximated via cubic spline (scipy) for numerical stability.

    Args:
        series: Input array with np.nan for missing values.
        config: Preprocessing configuration.

    Returns:
        Tuple of (imputed_series, imputed_mask) where imputed_mask[i]=True
        if observation i was imputed.
    """
    imputed = series.copy()
    mask = np.isnan(series)
    imputed_mask = mask.copy()

    if not np.any(mask):
        return imputed, imputed_mask

    # Identify contiguous gaps
    valid_indices = np.where(~mask)[0]

    if len(valid_indices) < 2:
        # If fewer than 2 valid points, fill with the available value or zero
        fill_val = series[valid_indices[0]] if len(valid_indices) == 1 else 0.0
        imputed[mask] = fill_val
        return imputed, imputed_mask

    # Classify gaps by length
    gap_starts = []
    gap_lengths = []
    i = 0
    while i < len(series):
        if mask[i]:
            start = i
            while i < len(series) and mask[i]:
                i += 1
            gap_starts.append(start)
            gap_lengths.append(i - start)
        else:
            i += 1

    # Linear interpolation for short gaps
    for gs, gl in zip(gap_starts, gap_lengths):
        if gl <= config.max_gap_interpolation:
            # Find nearest valid neighbors
            left_idx = gs - 1 if gs > 0 and not mask[gs - 1] else None
            right_idx = gs + gl if gs + gl < len(series) and not mask[gs + gl] else None

            if left_idx is not None and right_idx is not None:
                left_val = series[left_idx]
                right_val = series[right_idx]
                for j in range(gl):
                    t = (j + 1) / (gl + 1)
                    imputed[gs + j] = left_val + t * (right_val - left_val)
            elif left_idx is not None:
                imputed[gs: gs + gl] = series[left_idx]
            elif right_idx is not None:
                imputed[gs: gs + gl] = series[right_idx]

    # Cubic spline for longer gaps (Kalman-equivalent smooth interpolation)
    still_missing = np.isnan(imputed)
    if np.any(still_missing):
        valid_after_linear = np.where(~np.isnan(imputed))[0]
        if len(valid_after_linear) >= 4:
            spline = interpolate.CubicSpline(
                valid_after_linear,
                imputed[valid_after_linear],
                extrapolate=True,
            )
            missing_indices = np.where(still_missing)[0]
            imputed[missing_indices] = spline(missing_indices)
        else:
            # Fallback: forward-fill then backward-fill
            s = pd.Series(imputed)
            imputed = s.ffill().bfill().values

    return imputed, imputed_mask


def winsorize(
    series: np.ndarray,
    event_tags: Optional[np.ndarray],
    config: PreprocessingConfig,
) -> np.ndarray:
    """
    Cap non-structural outliers at the 1st and 99th percentiles.

    Observations tagged as REGIME_SHIFT are preserved (not clipped),
    since they represent genuine structural changes rather than outliers.

    Args:
        series: Net cash-flow array.
        event_tags: Optional array of EventTag values.
        config: Preprocessing configuration.

    Returns:
        Winsorized series.
    """
    result = series.copy()

    # Compute percentile bounds on non-regime-shift observations
    if event_tags is not None:
        normal_mask = np.array([
            tag != "REGIME_SHIFT" for tag in event_tags
        ])
    else:
        normal_mask = np.ones(len(series), dtype=bool)

    normal_values = result[normal_mask]
    if len(normal_values) < 2:
        return result

    lower = np.percentile(normal_values, config.winsorize_lower * 100)
    upper = np.percentile(normal_values, config.winsorize_upper * 100)

    # Clip only normal observations
    clipped = np.clip(result, lower, upper)
    result[normal_mask] = clipped[normal_mask]

    return result


def decompose_stl(
    series: np.ndarray,
    config: PreprocessingConfig,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Apply Seasonal-Trend Decomposition using Loess (STL) to extract:
      - T̂_t (trend component)
      - Ŝ_t (seasonal component, period = stl_period)
      - X̃_t (deseasonalized stationary residual)

    For short series (< 2 full seasonal cycles), falls back to simple
    moving-average trend removal without seasonal extraction.

    Args:
        series: Net cash-flow array X_t (after imputation & winsorization).
        config: Preprocessing configuration.

    Returns:
        Tuple of (trend, seasonal, residual) arrays.
    """
    n = len(series)
    min_stl_length = 2 * config.stl_period + 1

    if n < min_stl_length:
        # Fallback: moving average trend, no seasonal component
        warnings.warn(
            f"Series length {n} < {min_stl_length} required for STL with "
            f"period={config.stl_period}. Falling back to moving-average "
            f"trend extraction without seasonal decomposition.",
            UserWarning,
            stacklevel=2,
        )
        # Simple centered moving average for trend
        window = min(n, config.stl_period)
        if window % 2 == 0:
            window = max(window - 1, 3)
        trend = pd.Series(series).rolling(
            window=window, center=True, min_periods=1
        ).mean().values
        seasonal = np.zeros(n)
        residual = series - trend
        return trend, seasonal, residual

    # Full STL decomposition
    stl = STL(
        series,
        period=config.stl_period,
        seasonal=config.stl_seasonal,
        robust=True,  # Robust to outliers via iteratively reweighted LS
    )
    result = stl.fit()

    return result.trend, result.seasonal, result.resid


def preprocess(
    timestamps: np.ndarray,
    gross_inflows: np.ndarray,
    gross_outflows: np.ndarray,
    liquid_buffers: np.ndarray,
    event_tags: Optional[np.ndarray] = None,
    config: Optional[PreprocessingConfig] = None,
) -> PreprocessedSeries:
    """
    Execute the full preprocessing pipeline:

      Raw Transaction Stream
              │
              ▼
      [1. Interval Resampling & Imputation]  → Kalman / linear interpolation
              │
              ▼
      [2. Outlier Winsorization]             → 1st/99th percentile capping
              │
              ▼
      [3. STL Seasonal Decomposition]        → Separate T̂_t, Ŝ_t, X̃_t

    Args:
        timestamps: Array of datetime timestamps.
        gross_inflows: Array of gross cash inflows (≥ 0).
        gross_outflows: Array of gross cash outflows (≥ 0).
        liquid_buffers: Array of verified liquid buffer reserves (≥ 0).
        event_tags: Optional array of event tags per observation.
        config: Preprocessing configuration (uses defaults if None).

    Returns:
        PreprocessedSeries containing all pipeline outputs.
    """
    if config is None:
        config = PreprocessingConfig()

    # Validate raw inputs
    validate_raw_inputs(timestamps, gross_inflows, gross_outflows, liquid_buffers)

    # Step 1: Impute missing values in inflows and outflows
    inflows_imputed, inflow_mask = impute_missing_values(gross_inflows, config)
    outflows_imputed, outflow_mask = impute_missing_values(gross_outflows, config)
    buffers_imputed, _ = impute_missing_values(liquid_buffers, config)

    imputed_mask = inflow_mask | outflow_mask

    # Compute net cash flow: X_t = gross_inflow_t - gross_outflow_t
    net_cash_flow = inflows_imputed - outflows_imputed

    # Step 2: Winsorize outliers (preserve REGIME_SHIFT tagged observations)
    net_cash_flow_w = winsorize(net_cash_flow, event_tags, config)

    # Step 3: STL decomposition → X_t = T̂_t + Ŝ_t + X̃_t
    trend, seasonal, residual = decompose_stl(net_cash_flow_w, config)

    # Most recent liquid buffer
    latest_buffer = float(buffers_imputed[-1])

    return PreprocessedSeries(
        net_cash_flow=net_cash_flow_w,
        trend=trend,
        seasonal=seasonal,
        residual=residual,
        liquid_buffer=latest_buffer,
        timestamps=timestamps,
        event_tags=event_tags if event_tags is not None else np.array(
            ["NORMAL"] * len(timestamps)
        ),
        imputed_mask=imputed_mask,
    )
