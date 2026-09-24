from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.routes import discovery

client = TestClient(app)


def test_search_preserves_distinct_listings_and_removes_duplicates(monkeypatch):
    monkeypatch.setattr(discovery, "provider_get", lambda *args: {"result": [
        {"symbol": "AAPL", "description": "Apple Inc", "type": "Common Stock"},
        {"symbol": "AAPL", "description": "Duplicate"},
        {"symbol": "AAPL.L", "description": "London listing"},
        {"symbol": "../bad", "description": "Invalid"},
    ]})
    response = client.get("/discovery/search", params={"q": "Apple"})
    assert response.status_code == 200
    assert [item["symbol"] for item in response.json()["results"]] == ["AAPL", "AAPL.L"]


def test_peers_excludes_subject_duplicates_and_invalid_symbols(monkeypatch):
    monkeypatch.setattr(discovery, "provider_get", lambda *args: ["AAPL", "MSFT", "MSFT", None, "<script>", "DELL"])
    assert client.get("/discovery/peers/aapl").json()["symbols"] == ["MSFT", "DELL"]


def test_search_rejects_blank_query_before_provider_call(monkeypatch):
    def unexpected(*args):
        pytest.fail("Provider should not be called")
    monkeypatch.setattr(discovery, "provider_get", unexpected)
    assert client.get("/discovery/search", params={"q": "   "}).status_code == 422


def test_missing_provider_is_explicit(monkeypatch):
    monkeypatch.setattr(discovery, "settings", SimpleNamespace(FINNHUB_API_KEY=""))
    response = client.get("/discovery/search", params={"q": "Apple"})
    assert response.status_code == 503


def test_provider_error_does_not_become_empty_search(monkeypatch):
    monkeypatch.setattr(discovery, "settings", SimpleNamespace(FINNHUB_API_KEY="test-only"))
    class FailedResponse:
        def raise_for_status(self):
            pass
        def json(self):
            return {"error": "rate limit"}
    monkeypatch.setattr(discovery.requests, "get", lambda *args, **kwargs: FailedResponse())
    assert client.get("/discovery/search", params={"q": "Apple"}).status_code == 502
