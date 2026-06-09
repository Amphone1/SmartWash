"""Rules-based topup risk scorer (Phase 2; ML deferred).

Produces a 0-100 risk score (higher = riskier) from a handful of factors. The
score is advisory — the payment service combines it with fraud + OCR to decide
approve / manual-review / reject. Deterministic and pure so it's unit-testable.

All money inputs are integer kip (rule #1).
"""
from __future__ import annotations

from dataclasses import dataclass, field

# Weights (points added to the risk score).
ACCOUNT_MISMATCH_POINTS = 40
AMOUNT_MISMATCH_MAX_POINTS = 40
VELOCITY_FREE = 3          # topups/window before risk accrues
VELOCITY_POINTS_EACH = 5
VELOCITY_MAX_POINTS = 20
DUPLICATE_POINTS_EACH = 25
DUPLICATE_MAX_POINTS = 50

BAND_HIGH = 70
BAND_MEDIUM = 30


@dataclass
class RiskFactors:
    amount_expected: int          # kip the QR was issued for
    ocr_amount: int               # kip OCR read from the slip
    account_match: bool           # slip paid to the owner account?
    velocity_count: int = 0       # recent topups in the window
    duplicate_attempts: int = 0   # prior slips with the same hash/ref


@dataclass
class RiskResult:
    score: int
    band: str                     # low | medium | high
    factors: dict = field(default_factory=dict)


def score_topup(f: RiskFactors) -> RiskResult:
    score = 0
    factors: dict[str, int] = {}

    if not f.account_match:
        score += ACCOUNT_MISMATCH_POINTS
        factors["account_mismatch"] = ACCOUNT_MISMATCH_POINTS

    if f.amount_expected > 0:
        mismatch = abs(f.ocr_amount - f.amount_expected)
        if mismatch > 0:
            pct = mismatch / f.amount_expected
            pts = min(AMOUNT_MISMATCH_MAX_POINTS, round(pct * 100))
            if pts > 0:
                score += pts
                factors["amount_mismatch"] = pts

    if f.velocity_count > VELOCITY_FREE:
        pts = min(
            VELOCITY_MAX_POINTS,
            (f.velocity_count - VELOCITY_FREE) * VELOCITY_POINTS_EACH,
        )
        score += pts
        factors["velocity"] = pts

    if f.duplicate_attempts > 0:
        pts = min(DUPLICATE_MAX_POINTS, f.duplicate_attempts * DUPLICATE_POINTS_EACH)
        score += pts
        factors["duplicate_attempts"] = pts

    score = min(100, score)
    band = "high" if score >= BAND_HIGH else "medium" if score >= BAND_MEDIUM else "low"
    return RiskResult(score=score, band=band, factors=factors)
