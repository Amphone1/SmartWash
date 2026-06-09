from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_live():
    assert client.get("/health/live").json() == {"status": "up"}


def test_health_ready():
    assert client.get("/health/ready").json() == {"status": "up"}


def test_metrics_exposed():
    res = client.get("/metrics")
    assert res.status_code == 200
    assert "http_request_duration_seconds" in res.text


def test_ocr_parse_with_hints():
    res = client.post(
        "/ocr/parse",
        json={"imageObjectKey": "uploads/s.jpg?amount=50000&ref=R&account=A"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["amount"] == 50000
    assert body["ref"] == "R"


def test_ocr_parse_requires_key():
    res = client.post("/ocr/parse", json={"imageObjectKey": ""})
    assert res.status_code == 422
