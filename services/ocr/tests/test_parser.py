from app.parser import parse_slip


def test_uses_hint_params_verbatim():
    r = parse_slip("uploads/slip-1.jpg?amount=20000&ref=R1&account=ACC9")
    assert r.amount == 20000
    assert r.ref == "R1"
    assert r.account == "ACC9"


def test_amount_is_integer_kip():
    r = parse_slip("uploads/slip-2.jpg")
    assert isinstance(r.amount, int)
    assert r.amount >= 1000


def test_deterministic_for_same_key():
    a = parse_slip("uploads/same.jpg")
    b = parse_slip("uploads/same.jpg")
    assert (a.amount, a.ref, a.account, a.confidence) == (
        b.amount,
        b.ref,
        b.account,
        b.confidence,
    )


def test_confidence_in_range():
    r = parse_slip("uploads/slip-3.jpg")
    assert 0.0 <= r.confidence <= 1.0


def test_explicit_confidence_hint():
    r = parse_slip("uploads/x.jpg?confidence=0.99")
    assert r.confidence == 0.99
