from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    assert client.get("/health/live").json() == {"status": "up"}
    assert client.get("/health/ready").json() == {"status": "up"}


def test_metrics_exposed():
    res = client.get("/metrics")
    assert res.status_code == 200
    assert "http_request_duration_seconds" in res.text


def test_score_clean_topup():
    res = client.post(
        "/risk/score",
        json={"amountExpected": 20000, "ocrAmount": 20000, "accountMatch": True},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["score"] == 0
    assert body["band"] == "low"


def test_score_rejects_negative():
    res = client.post(
        "/risk/score",
        json={"amountExpected": -1, "ocrAmount": 20000, "accountMatch": True},
    )
    assert res.status_code == 422
