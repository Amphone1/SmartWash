from app.scorer import RiskFactors, score_topup


def clean() -> RiskFactors:
    return RiskFactors(
        amount_expected=20000, ocr_amount=20000, account_match=True
    )


def test_clean_topup_is_low_risk():
    r = score_topup(clean())
    assert r.score == 0
    assert r.band == "low"


def test_account_mismatch_is_high():
    f = clean()
    f.account_match = False
    r = score_topup(f)
    assert r.score >= 40
    assert "account_mismatch" in r.factors


def test_amount_mismatch_scales_with_percentage():
    f = clean()
    f.ocr_amount = 10000  # 50% off
    r = score_topup(f)
    assert r.factors["amount_mismatch"] == 40  # capped at 40
    assert r.band in ("medium", "high")


def test_small_amount_mismatch_small_points():
    f = clean()
    f.ocr_amount = 20200  # 1% off
    r = score_topup(f)
    assert r.factors["amount_mismatch"] == 1


def test_velocity_has_free_allowance_then_accrues():
    f = clean()
    f.velocity_count = 3
    assert "velocity" not in score_topup(f).factors
    f.velocity_count = 5  # 2 over the free allowance → 10 pts
    assert score_topup(f).factors["velocity"] == 10


def test_duplicate_attempts_accrue_and_cap_at_50():
    f = clean()
    f.duplicate_attempts = 3  # 3*25 = 75 → capped at 50
    r = score_topup(f)
    assert r.factors["duplicate_attempts"] == 50
    # 50 alone is "medium"; exact-duplicate rejection is the Fraud service's job.
    assert r.band == "medium"


def test_score_capped_at_100():
    f = RiskFactors(
        amount_expected=20000,
        ocr_amount=0,
        account_match=False,
        velocity_count=20,
        duplicate_attempts=10,
    )
    assert score_topup(f).score == 100
