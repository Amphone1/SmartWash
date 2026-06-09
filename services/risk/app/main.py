"""Risk FastAPI service.

  GET  /health/live   GET /health/ready   GET /metrics
  POST /risk/score    { amountExpected, ocrAmount, accountMatch, ... } -> score
"""
from __future__ import annotations

import time

from fastapi import FastAPI, Request, Response
from prometheus_client import CONTENT_TYPE_LATEST, Histogram, generate_latest
from pydantic import BaseModel, Field

from app.scorer import RiskFactors, score_topup
from app.telemetry import init_telemetry

app = FastAPI(title="SmartWash Risk", version="0.1.0")
init_telemetry(app, service_name="risk")

_HTTP = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    labelnames=("method", "path", "status"),
)


@app.middleware("http")
async def _metrics(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    _HTTP.labels(request.method, request.url.path, response.status_code).observe(
        time.perf_counter() - start
    )
    return response


class ScoreRequest(BaseModel):
    amountExpected: int = Field(ge=0)
    ocrAmount: int = Field(ge=0)
    accountMatch: bool
    velocityCount: int = Field(default=0, ge=0)
    duplicateAttempts: int = Field(default=0, ge=0)


class ScoreResponse(BaseModel):
    score: int
    band: str
    factors: dict


@app.get("/health/live")
def live() -> dict:
    return {"status": "up"}


@app.get("/health/ready")
def ready() -> dict:
    return {"status": "up"}


@app.get("/metrics")
def metrics() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.post("/risk/score", response_model=ScoreResponse)
def risk_score(body: ScoreRequest) -> ScoreResponse:
    result = score_topup(
        RiskFactors(
            amount_expected=body.amountExpected,
            ocr_amount=body.ocrAmount,
            account_match=body.accountMatch,
            velocity_count=body.velocityCount,
            duplicate_attempts=body.duplicateAttempts,
        )
    )
    return ScoreResponse(score=result.score, band=result.band, factors=result.factors)
