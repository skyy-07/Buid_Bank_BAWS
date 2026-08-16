"""
BAWS-NN Engine — Input/Output Schemas

Pydantic models defining the API contract for data ingestion and risk output.
All fields are documented against the technical specification.
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


# ─────────────────────────────────────────────────────────────────────
# Input Schemas
# ─────────────────────────────────────────────────────────────────────

class EventTag(str, enum.Enum):
    """External shock metadata tag."""
    NORMAL = "NORMAL"
    REGIME_SHIFT = "REGIME_SHIFT"


class CashFlowObservation(BaseModel):
    """
    A single cash-flow observation at a discrete time step.

    Maps directly to the raw ingestion schema from the spec:
    borrower_id, timestamp_t, gross_inflow, gross_outflow,
    liquid_buffer, event_tag.
    """
    borrower_id: str = Field(
        ...,
        description="Unique entity identifier (UUID or alphanumeric string)",
        min_length=1,
    )
    timestamp: datetime = Field(
        ...,
        alias="timestamp_t",
        description="Period timestamp in ISO 8601 format",
    )
    gross_inflow: float = Field(
        ...,
        ge=0.0,
        description="Total realized cash receipts in native currency",
    )
    gross_outflow: float = Field(
        ...,
        ge=0.0,
        description="Total operational/living costs in native currency",
    )
    liquid_buffer: float = Field(
        ...,
        ge=0.0,
        description="Verified savings / overnight balance in native currency",
    )
    event_tag: EventTag = Field(
        default=EventTag.NORMAL,
        description="External shock metadata tag (optional)",
    )

    model_config = {"populate_by_name": True}


class BorrowerCashFlowSeries(BaseModel):
    """
    Complete cash-flow history for a single borrower, ready for engine ingestion.
    Observations must be chronologically ordered.
    """
    borrower_id: str = Field(..., min_length=1)
    observations: List[CashFlowObservation] = Field(
        ...,
        min_length=3,
        description="Chronologically ordered cash-flow observations",
    )

    @field_validator("observations")
    @classmethod
    def validate_chronological_order(
        cls, v: List[CashFlowObservation]
    ) -> List[CashFlowObservation]:
        """Ensure timestamps are monotonically increasing."""
        for i in range(1, len(v)):
            if v[i].timestamp <= v[i - 1].timestamp:
                raise ValueError(
                    f"Timestamps must be monotonically increasing. "
                    f"Observation {i} ({v[i].timestamp}) <= "
                    f"observation {i-1} ({v[i-1].timestamp})"
                )
        return v

    @field_validator("observations")
    @classmethod
    def validate_consistent_borrower_id(
        cls, v: List[CashFlowObservation], info
    ) -> List[CashFlowObservation]:
        """Ensure all observations belong to the same borrower."""
        bid = info.data.get("borrower_id")
        if bid is not None:
            for i, obs in enumerate(v):
                if obs.borrower_id != bid:
                    raise ValueError(
                        f"Observation {i} borrower_id '{obs.borrower_id}' "
                        f"does not match series borrower_id '{bid}'"
                    )
        return v


# ─────────────────────────────────────────────────────────────────────
# Output Schemas
# ─────────────────────────────────────────────────────────────────────

class BAWSMetadata(BaseModel):
    """Metadata from the adaptive window selection process."""
    optimal_lookback_months: int = Field(
        ...,
        alias="optimalLookbackMonths",
        description="Selected adaptive look-back horizon k̂_t in months",
    )
    structural_break_detected: bool = Field(
        ...,
        alias="structuralBreakDetected",
        description="Whether a structural break was detected in the series",
    )
    rejection_vector: List[int] = Field(
        ...,
        alias="rejectionVector",
        description="Binary vector T_k for each candidate window",
    )
    mbb_block_length: int = Field(
        ...,
        alias="mbbBlockLength",
        description="Block length l_i used in the Moving Block Bootstrap",
    )

    model_config = {"populate_by_name": True}


class RiskMetrics(BaseModel):
    """Core risk assessment metrics from the BAWS-NN engine."""
    trust_score: float = Field(
        ...,
        alias="trustScore",
        ge=300.0,
        le=850.0,
        description="Composite Financial Trust Score T_score ∈ [300, 850]",
    )
    resilience_score: float = Field(
        ...,
        alias="resilienceScore",
        ge=0.0,
        le=100.0,
        description="Financial Resilience Score R_score ∈ [0, 100%]",
    )
    value_at_risk_90: float = Field(
        ...,
        alias="valueAtRisk90",
        description="VaR at 90% confidence level",
    )
    expected_shortfall_90: float = Field(
        ...,
        alias="expectedShortfall90",
        description="Expected Shortfall at 90% confidence level",
    )
    coefficient_of_variation: float = Field(
        ...,
        alias="coefficientOfVariation",
        ge=0.0,
        description="σ/μ⁺ income volatility ratio",
    )
    consistency_ratio: float = Field(
        ...,
        alias="consistencyRatio",
        ge=0.0,
        le=1.0,
        description="C_ratio: fraction of non-negative cash-flow periods",
    )

    model_config = {"populate_by_name": True}


class UnderwritingDecision(str, enum.Enum):
    """Automated underwriting decision."""
    APPROVED = "APPROVED"
    CONDITIONAL = "CONDITIONAL"
    DECLINED = "DECLINED"
    MANUAL_REVIEW = "MANUAL_REVIEW"


class RepaymentMode(str, enum.Enum):
    """Repayment mode classification."""
    CASH_FLOW_ADAPTIVE = "CASH_FLOW_ADAPTIVE"
    FIXED_EMI = "FIXED_EMI"
    BULLET = "BULLET"


class AdaptiveProductTerms(BaseModel):
    """Dynamically computed lending product terms."""
    underwriting_decision: UnderwritingDecision = Field(
        ...,
        alias="underwritingDecision",
    )
    credit_facility_limit: float = Field(
        ...,
        alias="creditFacilityLimit",
        ge=0.0,
    )
    repayment_mode: RepaymentMode = Field(
        ...,
        alias="repaymentMode",
    )
    base_monthly_commitment: float = Field(
        ...,
        alias="baseMonthlyCommitment",
        ge=0.0,
    )
    surge_repayment_factor_gamma: float = Field(
        ...,
        alias="surgeRepaymentFactorGamma",
        ge=0.0,
        le=0.25,
    )
    shock_shield_active: bool = Field(
        ...,
        alias="shockShieldActive",
    )
    grace_period_months_available: int = Field(
        ...,
        alias="gracePeriodMonthsAvailable",
        ge=0,
    )

    model_config = {"populate_by_name": True}


class BAWSRiskResult(BaseModel):
    """
    Complete engine output matching the API contract from the spec.
    Serializes to camelCase JSON for frontend/API consumption.
    """
    borrower_id: str = Field(..., alias="borrowerId")
    timestamp: datetime
    baws_metadata: BAWSMetadata = Field(..., alias="bawsMetadata")
    risk_metrics: RiskMetrics = Field(..., alias="riskMetrics")
    adaptive_product_terms: AdaptiveProductTerms = Field(
        ...,
        alias="adaptiveProductTerms",
    )

    model_config = {"populate_by_name": True}
