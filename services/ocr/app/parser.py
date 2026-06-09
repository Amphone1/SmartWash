"""Deterministic mock slip parser (Phase 2).

Real PaddleOCR is deferred. This parser is fully deterministic so the Topup chain
and its tests are stable:

  * If the object key carries hint query params (?amount=20000&ref=R1&account=A1),
    those are used verbatim — this lets dev / E2E drive exact values.
  * Otherwise fields are derived from a SHA-256 of the object key, yielding stable
    pseudo-values within plausible ranges.

Money is always an integer number of kip (rule #1) — never a float.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from urllib.parse import parse_qs, urlparse


@dataclass
class OcrResult:
    amount: int  # kip
    ref: str
    account: str
    confidence: float  # 0.0 - 1.0
    raw: dict = field(default_factory=dict)


def _hints(object_key: str) -> dict[str, str]:
    query = urlparse(object_key).query
    if not query:
        return {}
    return {k: v[0] for k, v in parse_qs(query).items() if v}


def parse_slip(object_key: str) -> OcrResult:
    hints = _hints(object_key)
    digest = hashlib.sha256(object_key.encode("utf-8")).hexdigest()

    amount = (
        int(hints["amount"])
        if "amount" in hints
        else (int(digest[0:6], 16) % 900_000) + 1_000
    )
    ref = hints.get("ref") or ("REF" + digest[6:14].upper())
    account = hints.get("account") or ("ACC" + digest[14:20])
    confidence = (
        float(hints["confidence"])
        if "confidence" in hints
        else round(0.80 + (int(digest[20:22], 16) / 255) * 0.19, 2)
    )

    if amount < 0:
        raise ValueError("parsed amount must be non-negative kip")

    return OcrResult(
        amount=amount,
        ref=ref,
        account=account,
        confidence=confidence,
        raw={"engine": "mock", "objectKey": object_key, "digest": digest[:12]},
    )
