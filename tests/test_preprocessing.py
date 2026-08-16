"""
BAWS-NN Engine — Preprocessing Tests

Validates:
  1. Input validation catches invalid data
  2. Missing value imputation works correctly
  3. Winsorization clips outliers while preserving regime shifts
  4. STL decomposition extracts meaningful components
  5. Full pipeline produces valid output shapes
"""

import numpy as np
import pytest

from baws_engine.preprocessing import (
    validate_raw_inputs,
    impute_missing_values,
    winsorize,
    decompose_stl,
    preprocess,
    PreprocessedSeries,
)
from baws_engine.config import PreprocessingConfig


class TestInputValidation:
    """Test the input validation function."""

    def test_valid_inputs(self):
        """Valid inputs should not raise."""
        timestamps = np.arange(10)
        inflows = np.random.uniform(0, 1000, 10)
        outflows = np.random.uniform(0, 500, 10)
        buffers = np.random.uniform(0, 500, 10)
        validate_raw_inputs(timestamps, inflows, outflows, buffers)

    def test_too_few_observations(self):
        """Should raise ValueError for fewer than 3 observations."""
        with pytest.raises(ValueError, match="Minimum 3"):
            validate_raw_inputs(
                np.arange(2),
                np.array([100, 200]),
                np.array([50, 60]),
                np.array([30, 40]),
            )

    def test_negative_inflows(self):
        """Should raise ValueError for negative gross_inflows."""
        with pytest.raises(ValueError, match="gross_inflow"):
            validate_raw_inputs(
                np.arange(5),
                np.array([100, -50, 200, 300, 400]),
                np.zeros(5),
                np.zeros(5),
            )

    def test_mismatched_lengths(self):
        """Should raise ValueError when array lengths differ."""
        with pytest.raises(ValueError, match="same length"):
            validate_raw_inputs(
                np.arange(5),
                np.random.uniform(0, 100, 5),
                np.random.uniform(0, 100, 4),  # Wrong length
                np.random.uniform(0, 100, 5),
            )


class TestImputation:
    """Test missing value imputation."""

    def test_no_missing(self):
        """Series without NaN should be unchanged."""
        series = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        config = PreprocessingConfig()
        imputed, mask = impute_missing_values(series, config)
        np.testing.assert_array_equal(imputed, series)
        assert not np.any(mask)

    def test_short_gap_linear_interpolation(self):
        """Short gaps (≤2 periods) should be linearly interpolated."""
        series = np.array([10.0, np.nan, 30.0, 40.0, 50.0])
        config = PreprocessingConfig(max_gap_interpolation=2)
        imputed, mask = impute_missing_values(series, config)
        assert not np.isnan(imputed[1])
        assert mask[1] == True
        # Interpolated value should be between 10 and 30
        assert 10.0 < imputed[1] < 30.0

    def test_all_imputed_values_finite(self):
        """All imputed values should be finite numbers."""
        series = np.array([100.0, np.nan, np.nan, np.nan, 500.0, 600.0])
        config = PreprocessingConfig(max_gap_interpolation=2)
        imputed, _ = impute_missing_values(series, config)
        assert np.all(np.isfinite(imputed))


class TestWinsorization:
    """Test outlier winsorization."""

    def test_clips_extreme_values(self):
        """Values beyond 1st/99th percentile should be clipped."""
        rng = np.random.default_rng(42)
        series = rng.normal(100, 20, 100)
        # Inject extreme outliers
        series[0] = -500
        series[1] = 5000

        config = PreprocessingConfig()
        result = winsorize(series, None, config)

        assert result[0] > -500  # Lower outlier clipped
        assert result[1] < 5000  # Upper outlier clipped

    def test_preserves_regime_shift(self):
        """Observations tagged REGIME_SHIFT should not be clipped."""
        series = np.array([100, 200, -500, 300, 400], dtype=float)
        tags = np.array(["NORMAL", "NORMAL", "REGIME_SHIFT", "NORMAL", "NORMAL"])

        config = PreprocessingConfig()
        result = winsorize(series, tags, config)

        # Regime shift observation should be preserved
        assert result[2] == -500


class TestSTLDecomposition:
    """Test STL seasonal decomposition."""

    def test_short_series_fallback(self):
        """Series shorter than 2*period+1 should use moving average fallback."""
        series = np.random.uniform(100, 300, 10)
        config = PreprocessingConfig(stl_period=12)

        trend, seasonal, residual = decompose_stl(series, config)

        assert len(trend) == len(series)
        assert len(residual) == len(series)
        # Seasonal should be zero in fallback mode
        np.testing.assert_array_equal(seasonal, np.zeros(10))

    def test_decomposition_reconstructs(self):
        """trend + seasonal + residual should reconstruct the original."""
        n = 48  # 4 years of monthly data
        t = np.arange(n)
        seasonal_true = 50 * np.sin(2 * np.pi * t / 12)
        trend_true = 100 + 2 * t
        noise = np.random.default_rng(42).normal(0, 10, n)
        series = trend_true + seasonal_true + noise

        config = PreprocessingConfig(stl_period=12)
        trend, seasonal, residual = decompose_stl(series, config)

        reconstructed = trend + seasonal + residual
        np.testing.assert_allclose(reconstructed, series, atol=1e-6)

    def test_output_shapes(self):
        """All output arrays should match input length."""
        series = np.random.uniform(50, 500, 36)
        config = PreprocessingConfig(stl_period=12)
        trend, seasonal, residual = decompose_stl(series, config)

        assert trend.shape == series.shape
        assert seasonal.shape == series.shape
        assert residual.shape == series.shape


class TestFullPipeline:
    """Test the complete preprocessing pipeline."""

    def test_produces_valid_output(self):
        """Full pipeline should produce a valid PreprocessedSeries."""
        n = 36
        timestamps = np.arange(n)
        inflows = np.random.default_rng(42).uniform(500, 1500, n)
        outflows = np.random.default_rng(43).uniform(300, 800, n)
        buffers = np.random.default_rng(44).uniform(100, 600, n)

        result = preprocess(timestamps, inflows, outflows, buffers)

        assert isinstance(result, PreprocessedSeries)
        assert len(result.net_cash_flow) == n
        assert len(result.residual) == n
        assert result.liquid_buffer >= 0
        assert np.all(np.isfinite(result.residual))
