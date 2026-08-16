"""
BAWS-NN Engine — FastAPI Development Server

Lightweight REST API wrapping the Python BAWS-NN engine.
Used for development, testing, and validation.

Endpoints:
  POST /api/v1/evaluate     — Full risk evaluation
  GET  /api/v1/health       — Health check
  GET  /docs                — OpenAPI documentation (auto-generated)
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Add project root to sys.path for module resolution
root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from datetime import datetime, timezone
from typing import List, Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from baws_engine.engine import BAWSEngine
from baws_engine.schemas import BAWSRiskResult


# ─────────────────────────────────────────────────────────────────────
# App Configuration
# ─────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="BAWS-NN Risk Engine",
    description=(
        "Bootstrap-Based Adaptive Window Selection & Neural Network "
        "risk engine for credit-invisible, low-income borrowers."
    ),
    version="0.1.0",
)

engine = BAWSEngine()


# ─────────────────────────────────────────────────────────────────────
# Request/Response Models
# ─────────────────────────────────────────────────────────────────────

class EvaluateRequest(BaseModel):
    """API request body for risk evaluation."""
    borrower_id: str = Field(
        ..., alias="borrowerId", min_length=1
    )
    gross_inflows: List[float] = Field(
        ..., alias="grossInflows", min_length=3
    )
    gross_outflows: List[float] = Field(
        ..., alias="grossOutflows", min_length=3
    )
    liquid_buffers: List[float] = Field(
        ..., alias="liquidBuffers", min_length=3
    )
    event_tags: Optional[List[str]] = Field(
        None, alias="eventTags"
    )

    model_config = {"populate_by_name": True}


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "healthy"
    timestamp: str
    engine: str = "baws-nn"
    version: str = "0.1.0"


# ─────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────

@app.get("/", summary="Root API Index")
async def root_index():
    """Root URL returning API details and docs link."""
    return {
        "engine": "BAWS-NN Risk Engine",
        "status": "online",
        "version": "0.1.0",
        "documentation": "/docs",
        "endpoints": {
            "evaluate": "POST /api/v1/evaluate",
            "health": "GET /api/v1/health",
            "swaggerDocs": "GET /docs",
            "redoc": "GET /redoc"
        }
    }

@app.post(
    "/api/v1/evaluate",
    response_model=BAWSRiskResult,
    summary="Evaluate borrower risk",
    description="Run the full BAWS-NN pipeline on a borrower's cash-flow history.",
)
async def evaluate_risk(request: EvaluateRequest):
    """Execute the BAWS-NN risk assessment pipeline."""
    try:
        n = len(request.gross_inflows)

        # Validate array lengths match
        if len(request.gross_outflows) != n or len(request.liquid_buffers) != n:
            raise HTTPException(
                status_code=400,
                detail="grossInflows, grossOutflows, and liquidBuffers must have equal length",
            )

        timestamps = np.arange(n)
        event_tags = (
            np.array(request.event_tags)
            if request.event_tags
            else None
        )

        result = engine.evaluate(
            borrower_id=request.borrower_id,
            timestamps=timestamps,
            gross_inflows=np.array(request.gross_inflows, dtype=np.float64),
            gross_outflows=np.array(request.gross_outflows, dtype=np.float64),
            liquid_buffers=np.array(request.liquid_buffers, dtype=np.float64),
            event_tags=event_tags,
        )

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Engine error: {str(e)}")


@app.get(
    "/api/v1/health",
    response_model=HealthResponse,
    summary="Health check",
)
async def health_check():
    """Health check endpoint for monitoring."""
    return HealthResponse(
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


# ─────────────────────────────────────────────────────────────────────
# Entry Point
# ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "api.server:app",
        host="0.0.0.0",
        port=port,
    )
