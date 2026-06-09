"""OCR FastAPI service.

Endpoints (per CLAUDE.md per-service shape):
  GET  /health/live   GET /health/ready   GET /metrics
  POST /ocr/parse     { imageObjectKey } -> parsed slip fields
"""
from __future__ import annotations

import time

from fastapi import FastAPI, Request, Response
from prometheus_client import CONTENT_TYPE_LATEST, Histogram, generate_latest
from pydantic import BaseModel, Field

from app.parser import parse_slip
from app.telemetry import init_telemetry

app = FastAPI(title="SmartWash OCR", version="0.1.0")
init_telemetry(app, service_name="ocr")

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


class ParseRequest(BaseModel):
    imageObjectKey: str = Field(min_length=1)


class ParseResponse(BaseModel):
    amount: int
    ref: str
    account: str
    confidence: float
    raw: dict


@app.get("/health/live")
def live() -> dict:
    return {"status": "up"}


@app.get("/health/ready")
def ready() -> dict:
    # Mock parser has no external dependency.
    return {"status": "up"}


@app.get("/metrics")
def metrics() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.post("/ocr/parse", response_model=ParseResponse)
def ocr_parse(body: ParseRequest) -> ParseResponse:
    result = parse_slip(body.imageObjectKey)
    return ParseResponse(
        amount=result.amount,
        ref=result.ref,
        account=result.account,
        confidence=result.confidence,
        raw=result.raw,
    )
