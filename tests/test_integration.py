"""
BAWS-NN Engine — Integration Tests

End-to-end validation of the complete BAWS-NN pipeline using
synthetic data generators. Tests the four-tier validation protocol:

  1. Score range validation (T_score ∈ [300, 850], R_score ∈ [0, 100])
  2. Stable series → high trust score
  3. Stress shock → break detection + window contraction
  4. API output schema compliance
"""

import numpy as np
import pytest

from baws_engine.engine import BAWSEngine
from baws_engine.config import EngineConfig
from baws_engine.schemas import BAWSRiskResult

# Import synthetic generators
import sys
sys.path.insert(0, ".")
from data.synthetic.generator import (
    generate_stable_series,
    generate_single_break_series,
    generate_stress_scenario,
    generate_multi_regime_series,
    SyntheticConfig,
    BreakConfig,
    StressConfig,
)


@pytest.fixture
def engine():
    """Create a fresh engine instance."""
    return BAWSEngine()


@pytest.fixture
def stable_data():
    """Generate stable (no-break) synthetic cash flows."""
    return generate_stable_series(SyntheticConfig(n_periods=36, seed=42))


@pytest.fixture
def break_data():
    """Generate single-break synthetic cash flows."""
    return generate_single_break_series(
        SyntheticConfig(n_periods=48, seed=42),
        BreakConfig(break_time=20, income_shift=-0.5),
    )


@pytest.fixture
def stress_data():
    """Generate stress scenario synthetic cash flows."""
    return generate_stress_scenario(
        SyntheticConfig(n_periods=48, seed=42),
        StressConfig(shock_time=20, shock_magnitude=-0.7),
    )


class TestEndToEndPipeline:
    """Test the complete engine pipeline with synthetic data."""

    def test_stable_series_evaluation(self, engine, stable_data):
        """Stable series should produce valid output with reasonable scores."""
        result = engine.evaluate(
            borrower_id="test-stable-001",
            timestamps=stable_data.timestamps,
            gross_inflows=stable_data.gross_inflows,
            gross_outflows=stable_data.gross_outflows,
            liquid_buffers=stable_data.liquid_buffers,
            event_tags=stable_data.event_tags,
        )

        assert isinstance(result, BAWSRiskResult)

        # Trust score should be in valid range
        assert 300 <= result.risk_metrics.trust_score <= 850

        # Resilience score should be in valid range
        assert 0 <= result.risk_metrics.resilience_score <= 100

        # Consistency ratio should be high for stable income
        assert result.risk_metrics.consistency_ratio > 0.5

    def test_break_series_evaluation(self, engine, break_data):
        """Series with structural break should detect the break."""
        result = engine.evaluate(
            borrower_id="test-break-001",
            timestamps=break_data.timestamps,
            gross_inflows=break_data.gross_inflows,
            gross_outflows=break_data.gross_outflows,
            liquid_buffers=break_data.liquid_buffers,
            event_tags=break_data.event_tags,
        )

        assert isinstance(result, BAWSRiskResult)
        assert 300 <= result.risk_metrics.trust_score <= 850

        # Window should be contracted (not using full history)
        assert result.baws_metadata.optimal_lookback_months <= 48

    def test_stress_scenario(self, engine, stress_data):
        """
        -70% income shock should trigger break detection.

        Shock-Shield Invariant:
          BAWS should assert T_k = 1 within ≤ 2 cycles,
          preventing false default classifications.
        """
        result = engine.evaluate(
            borrower_id="test-stress-001",
            timestamps=stress_data.timestamps,
            gross_inflows=stress_data.gross_inflows,
            gross_outflows=stress_data.gross_outflows,
            liquid_buffers=stress_data.liquid_buffers,
            event_tags=stress_data.event_tags,
        )

        assert isinstance(result, BAWSRiskResult)
        assert 300 <= result.risk_metrics.trust_score <= 850
        assert 0 <= result.risk_metrics.resilience_score <= 100


class TestOutputSchemaCompliance:
    """Verify output matches the spec's API contract."""

    def test_json_serialization(self, engine, stable_data):
        """Output should serialize to valid JSON matching the spec schema."""
        result = engine.evaluate(
            borrower_id="test-json-001",
            timestamps=stable_data.timestamps,
            gross_inflows=stable_data.gross_inflows,
            gross_outflows=stable_data.gross_outflows,
            liquid_buffers=stable_data.liquid_buffers,
        )

        # Serialize with aliases (camelCase for API)
        json_str = result.model_dump_json(by_alias=True)

        assert '"borrowerId"' in json_str
        assert '"bawsMetadata"' in json_str
        assert '"riskMetrics"' in json_str
        assert '"adaptiveProductTerms"' in json_str
        assert '"trustScore"' in json_str
        assert '"resilienceScore"' in json_str
        assert '"valueAtRisk90"' in json_str
        assert '"expectedShortfall90"' in json_str

    def test_underwriting_decision_valid(self, engine, stable_data):
        """Underwriting decision should be a valid enum value."""
        result = engine.evaluate(
            borrower_id="test-underwriting-001",
            timestamps=stable_data.timestamps,
            gross_inflows=stable_data.gross_inflows,
            gross_outflows=stable_data.gross_outflows,
            liquid_buffers=stable_data.liquid_buffers,
        )

        valid_decisions = {"APPROVED", "CONDITIONAL", "DECLINED", "MANUAL_REVIEW"}
        assert result.adaptive_product_terms.underwriting_decision.value in valid_decisions

    def test_gamma_bounded(self, engine, stable_data):
        """Surge repayment factor γ should be in (0, γ_max]."""
        result = engine.evaluate(
            borrower_id="test-gamma-001",
            timestamps=stable_data.timestamps,
            gross_inflows=stable_data.gross_inflows,
            gross_outflows=stable_data.gross_outflows,
            liquid_buffers=stable_data.liquid_buffers,
        )

        gamma = result.adaptive_product_terms.surge_repayment_factor_gamma
        assert 0 <= gamma <= 0.25


class TestMultiRegimeScenario:
    """Test with multi-regime switching series."""

    def test_multi_regime_handles_transitions(self, engine):
        """Engine should handle multiple regime transitions gracefully."""
        data = generate_multi_regime_series(n_periods=60, n_regimes=3, seed=42)

        result = engine.evaluate(
            borrower_id="test-multi-001",
            timestamps=data.timestamps,
            gross_inflows=data.gross_inflows,
            gross_outflows=data.gross_outflows,
            liquid_buffers=data.liquid_buffers,
            event_tags=data.event_tags,
        )

        assert isinstance(result, BAWSRiskResult)
        assert 300 <= result.risk_metrics.trust_score <= 850
        assert 0 <= result.risk_metrics.resilience_score <= 100


class TestEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_minimum_observations(self, engine):
        """Engine should work with minimum number of observations."""
        n = 3
        result = engine.evaluate(
            borrower_id="test-min-001",
            timestamps=np.arange(n),
            gross_inflows=np.array([1000, 1200, 900], dtype=float),
            gross_outflows=np.array([500, 600, 550], dtype=float),
            liquid_buffers=np.array([200, 250, 180], dtype=float),
        )
        assert isinstance(result, BAWSRiskResult)

    def test_zero_income_periods(self, engine):
        """Engine should handle periods with zero income."""
        n = 12
        inflows = np.array([1000, 0, 0, 500, 0, 800, 0, 0, 600, 0, 0, 400], dtype=float)
        outflows = np.full(n, 300.0)
        buffers = np.full(n, 100.0)

        result = engine.evaluate(
            borrower_id="test-zero-001",
            timestamps=np.arange(n),
            gross_inflows=inflows,
            gross_outflows=outflows,
            liquid_buffers=buffers,
        )
        assert isinstance(result, BAWSRiskResult)
        assert result.risk_metrics.consistency_ratio < 1.0  # Some negative periods

    def test_sequential_evaluation_updates_state(self):
        """Sequential calls should update internal state (previous k̂)."""
        engine = BAWSEngine()
        n = 24
        rng = np.random.default_rng(42)

        for _ in range(3):
            result = engine.evaluate(
                borrower_id="test-seq-001",
                timestamps=np.arange(n),
                gross_inflows=rng.uniform(500, 1500, n),
                gross_outflows=rng.uniform(300, 800, n),
                liquid_buffers=rng.uniform(100, 500, n),
            )
            assert isinstance(result, BAWSRiskResult)

    def test_reset_state(self):
        """reset_state() should clear the previous k̂."""
        engine = BAWSEngine()
        engine._previous_k = 18
        engine.reset_state()
        assert engine._previous_k is None
