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


def test_small_cap_list_reads_persisted_candidates_without_provider_calls(monkeypatch):
    monkeypatch.setattr(discovery, "load_persisted_small_caps", lambda **kwargs: [{"symbol": "TEST"}])
    monkeypatch.setattr(discovery.supabase_store, "is_configured", lambda: True)
    response = client.get("/discovery/small-caps", params={"limit": 10, "min_score": 40})
    assert response.status_code == 200
    assert response.json()["candidates"] == [{"symbol": "TEST"}]
    assert response.json()["persistenceAvailable"] is True


def test_small_cap_presets_expose_market_cap_bands():
    response = client.get("/discovery/small-caps/profiles")
    assert response.status_code == 200
    profiles = {row["name"]: row for row in response.json()["profiles"]}
    assert set(profiles) == {"nano", "micro", "small", "lower_mid"}
    assert profiles["lower_mid"]["max_market_cap"] == 10_000_000_000


def test_small_cap_scan_requires_provider_configuration(monkeypatch):
    monkeypatch.setattr(discovery, "settings", SimpleNamespace(FMP_API_KEY=""))
    response = client.post("/discovery/small-caps/scan", json={})
    assert response.status_code == 503


def test_small_cap_scan_validates_profile_before_running(monkeypatch):
    monkeypatch.setattr(discovery, "settings", SimpleNamespace(FMP_API_KEY="test-only"))
    response = client.post("/discovery/small-caps/scan", json={"min_market_cap": 20, "max_market_cap": 10})
    assert response.status_code == 422


def test_small_cap_scan_queues_bounded_profile(monkeypatch):
    monkeypatch.setattr(discovery, "settings", SimpleNamespace(FMP_API_KEY="test-only"))
    queued = []
    monkeypatch.setattr(discovery, "enqueue_small_cap_scan", lambda profile: queued.append(profile) or True)
    response = client.post("/discovery/small-caps/scan", json={"countries": ["us", "ca"], "deep_limit": 2})
    assert response.status_code == 202
    assert response.json()["queued"] is True
    assert response.json()["profile"]["countries"] == ["US", "CA"]
    assert queued[0].deep_limit == 2


def test_small_cap_scan_requires_durable_queue(monkeypatch):
    monkeypatch.setattr(discovery, "settings", SimpleNamespace(FMP_API_KEY="test-only"))
    monkeypatch.setattr(discovery.supabase_store, "is_configured", lambda: True)
    monkeypatch.setattr(discovery, "enqueue_small_cap_scan", lambda profile: False)
    response = client.post("/discovery/small-caps/scan", json={})
    assert response.status_code == 409
