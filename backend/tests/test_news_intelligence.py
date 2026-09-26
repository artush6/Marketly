from app.services.news_intelligence import enrich_article, importance, relationship_signal


def test_partnership_is_important_and_extracts_counterparty():
    article = {
        "headline": "Acme partners with Northstar Cloud to launch analytics",
        "summary": "The partnership will serve enterprise customers.",
    }

    enriched = enrich_article(article)

    assert enriched["importanceScore"] == 4
    assert enriched["importanceLabel"] == "important"
    assert enriched["relationshipSignal"]["relationshipType"] == "partner"
    assert enriched["relationshipSignal"]["relatedCompanyName"] == "Northstar Cloud"


def test_critical_event_outranks_routine_story():
    critical = importance({"headline": "Issuer announces acquisition of a rival"})
    routine = importance({"headline": "Issuer presents at an industry conference"})

    assert critical[0] == 5
    assert critical[1] == "critical"
    assert routine[0] == 1
    assert routine[1] == "routine"


def test_non_relationship_story_has_no_signal():
    assert relationship_signal({"headline": "Shares rise after analyst note"}) is None


def test_relationship_counterparty_drops_exchange_suffix():
    signal = relationship_signal({
        "headline": "Qualcomm partners with Apple Inc. (NASDAQ: AAPL) on connectivity",
    })

    assert signal is not None
    assert signal["relatedCompanyName"] == "Apple Inc"
