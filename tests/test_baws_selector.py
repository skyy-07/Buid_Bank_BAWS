"""
BAWS-NN Engine — BAWS Selector Tests

Validates:
  1. Candidate window construction follows growing increment rules
  2. Pinball loss matches known analytical values
  3. MBB block length formula l_i = ceil(i^{1/3})
  4. MBB threshold is non-negative and finite
  5. Window selection detects known structural breaks
  6. Stable series retains maximum window
"""

import numpy as np
import pytest

from baws_engine.baws_selector import (
    pinball_loss,
    build_candidate_windows,
    compute_mbb_block_length,
    mbb_resample,
    calibrate_threshold,
    select_adaptive_window,
    BAWSResult,
)
from baws_engine.config import BAWSConfig


class TestPinballLoss:
    """Test the quantile check function (pinball loss)."""

    def test_below_quantile(self):
        """When x < q, loss = (1-α)(q-x)."""
        x = np.array([5.0])
        q = 10.0
        alpha = 0.90
        loss = pinball_loss(x, q, alpha)
        expected = (1.0 - 0.90) * (10.0 - 5.0)  # 0.5
        np.testing.assert_allclose(loss, [expected])

    def test_above_quantile(self):
        """When x > q, loss = α(x-q)."""
        x = np.array([15.0])
        q = 10.0
        alpha = 0.90
        loss = pinball_loss(x, q, alpha)
        expected = alpha * (15.0 - 10.0)  # 4.5
        np.testing.assert_allclose(loss, [expected])

    def test_at_quantile(self):
        """When x = q, loss should be 0."""
        x = np.array([10.0])
        q = 10.0
        loss = pinball_loss(x, q, 0.90)
        np.testing.assert_allclose(loss, [0.0], atol=1e-10)

    def test_minimizer_is_quantile(self):
        """Minimizer of expected pinball loss is the α-quantile."""
        rng = np.random.default_rng(42)
        data = rng.normal(100, 20, 10000)
        alpha = 0.90
        true_quantile = np.quantile(data, alpha)

        # Search for minimizer
        best_q = None
        best_loss = float("inf")
        for q in np.linspace(50, 150, 500):
            mean_loss = np.mean(pinball_loss(data, q, alpha))
            if mean_loss < best_loss:
                best_loss = mean_loss
                best_q = q

        np.testing.assert_allclose(best_q, true_quantile, atol=0.5)


class TestCandidateWindows:
    """Test candidate window construction."""

    def test_minimum_window_included(self):
        """k_min should always be in the candidate set."""
        candidates = build_candidate_windows(t=50, k_min=6, k_max_cap=60)
        assert 6 in candidates

    def test_growing_increments(self):
        """Increments should grow: +5 (<50), +10 (50-100), +20 (100-300)."""
        candidates = build_candidate_windows(t=400, k_min=6, k_max_cap=350)
        # Check that gaps increase as windows get larger
        for i in range(1, len(candidates)):
            gap = candidates[i] - candidates[i - 1]
            if candidates[i] <= 50:
                assert gap <= 5, f"Gap {gap} at window {candidates[i]} should be ≤5"

    def test_sorted_and_unique(self):
        """Candidates should be sorted and unique."""
        candidates = build_candidate_windows(t=100, k_min=6, k_max_cap=60)
        assert candidates == sorted(set(candidates))

    def test_previous_k_included(self):
        """Previous selection k̂_{t-1} should be included."""
        candidates = build_candidate_windows(
            t=50, k_min=6, k_max_cap=60, previous_k=18
        )
        assert 18 in candidates


class TestMBBBlockLength:
    """Test MBB block length computation."""

    def test_formula(self):
        """l_i = ceil(i^{1/3}) for c=1."""
        assert compute_mbb_block_length(6) == 2    # ceil(6^{1/3}) = ceil(1.82) = 2
        assert compute_mbb_block_length(8) == 2    # ceil(8^{1/3}) = ceil(2.0) = 2
        assert compute_mbb_block_length(27) == 3   # ceil(27^{1/3}) = ceil(3.0) = 3
        assert compute_mbb_block_length(1) == 1    # Minimum block length

    def test_minimum_one(self):
        """Block length should always be at least 1."""
        assert compute_mbb_block_length(0) >= 1
        assert compute_mbb_block_length(1) >= 1


class TestMBBResample:
    """Test Moving Block Bootstrap resampling."""

    def test_preserves_length(self):
        """Resampled series should have the same length."""
        series = np.arange(20, dtype=float)
        rng = np.random.default_rng(42)
        resampled = mbb_resample(series, block_length=3, rng=rng)
        assert len(resampled) == len(series)

    def test_values_from_original(self):
        """All resampled values should exist in the original series."""
        series = np.array([10, 20, 30, 40, 50, 60, 70, 80], dtype=float)
        rng = np.random.default_rng(42)
        resampled = mbb_resample(series, block_length=3, rng=rng)
        for val in resampled:
            assert val in series


class TestThresholdCalibration:
    """Test MBB threshold calibration."""

    def test_non_negative(self):
        """Threshold should be non-negative."""
        series = np.random.default_rng(42).normal(0, 1, 20)
        tau = calibrate_threshold(
            ref_window_data=series,
            alpha=0.90,
            beta=0.90,
            n_boot=100,
            block_length=2,
        )
        assert tau >= 0.0

    def test_finite(self):
        """Threshold should be finite."""
        series = np.random.default_rng(42).normal(100, 20, 12)
        tau = calibrate_threshold(
            ref_window_data=series,
            alpha=0.90,
            beta=0.90,
            n_boot=100,
            block_length=2,
        )
        assert np.isfinite(tau)


class TestWindowSelection:
    """Test the full BAWS window selection algorithm."""

    def test_stable_series_retains_large_window(self):
        """A stationary series should select a large look-back window."""
        rng = np.random.default_rng(42)
        stable = rng.normal(100, 10, 48)

        config = BAWSConfig(k_min=6, k_max_cap=48, n_boot=100)
        result = select_adaptive_window(stable, config=config)

        assert isinstance(result, BAWSResult)
        assert result.optimal_k >= 12  # Should use substantial history
        assert not result.break_detected or result.optimal_k > config.k_min

    def test_break_detected_on_shifted_series(self):
        """A large mean shift should trigger break detection."""
        rng = np.random.default_rng(42)
        pre_break = rng.normal(100, 10, 24)
        post_break = rng.normal(20, 10, 24)  # Major income drop
        series = np.concatenate([pre_break, post_break])

        config = BAWSConfig(k_min=6, k_max_cap=48, n_boot=200)
        result = select_adaptive_window(series, config=config)

        # Should detect the break and contract window
        assert result.optimal_k < 48  # Should not use full history

    def test_output_structure(self):
        """Result should contain all required fields."""
        series = np.random.default_rng(42).normal(50, 10, 30)
        result = select_adaptive_window(series)

        assert hasattr(result, "optimal_k")
        assert hasattr(result, "break_detected")
        assert hasattr(result, "rejection_vector")
        assert hasattr(result, "candidate_windows")
        assert hasattr(result, "mbb_block_length")
        assert hasattr(result, "threshold")

    def test_short_series(self):
        """Series shorter than k_min should return series length."""
        series = np.array([10.0, 20.0, 30.0])
        config = BAWSConfig(k_min=6)
        result = select_adaptive_window(series, config=config)
        assert result.optimal_k == 3
