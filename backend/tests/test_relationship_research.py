from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app.services.relationship_research import canonical_url, retrieved_urls, validate_evidence, research_relationships


def evidence(**changes):
    return dict({"related_company_name": "Acme Semiconductor", "related_symbol": "ACME",
                 "relationship_type": "supplier", "source_url": "https://issuer.example/filing",
                 "source_date": "2020-02-03", "confidence": .9, "status": "historical",
                 "evidence_summary": "Acme supplied the focal company with radio components under the disclosed agreement.",
                 "evidence_quote": "Acme supplied radio components.", "product_service": "Radio components"}, **changes)


def test_preserves_historical_evidence_and_correct_direction():
    rows = validate_evidence([evidence()], {"https://issuer.example/filing"}, "AAPL", "Apple Inc.")
    assert len(rows) == 1
    assert rows[0]["source_date"] == "2020-02-03"
    assert rows[0]["direction"] == "incoming"
    assert rows[0]["evidence_summary"].startswith("[HISTORICAL]")


@pytest.mark.parametrize("changes", [
    {"related_company_name": "Apple Inc. (NASDAQ: AAPL)"}, {"related_symbol": "AAPL"},
    {"source_url": "https://invented.example/source"}, {"source_date": "2099-01-01"},
    {"source_date": None}, {"confidence": float("nan")}, {"confidence": .2},
    {"evidence_quote": ""}, {"status": "invented"}, {"relationship_type": "rumor"},
])
def test_rejects_unusable_evidence(changes):
    assert validate_evidence([evidence(**changes)], {"https://issuer.example/filing"}, "AAPL", "Apple Inc.") == []


def test_deduplicates_sources_and_collects_retrieval_provenance():
    response = SimpleNamespace(model_dump=lambda: {"output": [
        {"action": {"sources": [{"url": "https://issuer.example/filing#section"}]}},
        {"content": [{"annotations": [{"type": "url_citation", "url": "https://issuer.example/filing"}]}]},
    ]})
    urls = retrieved_urls(response)
    assert urls == {"https://issuer.example/filing"}
    assert len(validate_evidence([evidence(), evidence()], urls, "AAPL", "Apple")) == 1
    assert canonical_url("https://secret@issuer.example/report") == ""


def test_persistence_failure_is_reported_not_claimed_as_success():
    with patch("app.services.relationship_research.store.is_configured", return_value=True), \
         patch("app.services.relationship_research.settings", SimpleNamespace(OPENAI_API_KEY="test")), \
         patch("app.services.relationship_research.store._select_rows", return_value=[{"name": "Apple"}]), \
         patch("app.services.relationship_research.store.get_company_relationships", return_value=[]), \
         patch("app.services.relationship_research.research_pass", return_value={"rows": [evidence()], "gaps": []}), \
         patch("app.services.relationship_research.store.save_researched_relationships", side_effect=RuntimeError), \
         patch("app.services.relationship_research.store.set_json") as report:
        with pytest.raises(ValueError):
            research_relationships("AAPL")
        assert len(report.call_args.args[2]["failures"]) == 3
        assert report.call_args.args[2]["passes"] == []
