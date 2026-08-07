from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_follow_up_reuses_supplied_analysis_context(monkeypatch):
    def fail_if_called(*args, **kwargs):
        raise AssertionError("provider should not be called")

    monkeypatch.setattr("app.routes.assistant.fetch_ticker_financials", fail_if_called)
    monkeypatch.setattr("app.routes.assistant.build_ticker_score", fail_if_called)
    monkeypatch.setattr("app.routes.assistant.get_news", fail_if_called)
    monkeypatch.setattr(
        "app.routes.assistant.answer_follow_up",
        lambda **kwargs: {"answer": f"Context score: {kwargs['score_payload']['score']}"},
    )

    response = client.post(
        "/assistant/follow-up",
        json={
            "symbol": "aapl",
            "question": "What changed?",
            "analysis_context": {"score": 82, "summary": "Durable business"},
        },
    )

    assert response.status_code == 200
    assert response.json() == {"symbol": "AAPL", "answer": "Context score: 82"}


def test_dependency_health_does_not_expose_credentials():
    response = client.get("/healthz/dependencies")

    assert response.status_code == 200
    payload = response.json()
    assert set(payload["openai"]) == {"configured", "model"}
    assert set(payload["redis"]) == {"configured", "connected"}
