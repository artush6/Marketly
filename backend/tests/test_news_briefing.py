from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.services.news_briefing import parse_world_feed, get_briefing, world_news


def test_world_feed_deduplicates_and_handles_missing_dates():
    xml = b'''<rss xmlns:media="http://search.yahoo.com/mrss/"><channel>
    <item><title>World talks</title><link>https://www.bbc.com/news/one</link><description>&lt;b&gt;Diplomacy&lt;/b&gt;</description><pubDate>Sun, 27 Sep 2026 08:00:00 GMT</pubDate><media:thumbnail url="https://example.com/photo.jpg"/></item>
    <item><title>Duplicate</title><link>https://www.bbc.com/news/one</link></item>
    <item><title>Election</title><link>https://www.bbc.com/news/two</link><pubDate>invalid</pubDate></item>
    <item><title>Unsafe</title><link>javascript:alert(1)</link></item>
    </channel></rss>'''
    articles = parse_world_feed(xml)
    assert len(articles) == 2
    assert articles[0]["summary"] == "Diplomacy"
    assert articles[0]["source"] == "BBC News"
    assert articles[0]["datetime"] > 0
    assert articles[1]["datetime"] is None


def test_provider_failure_does_not_remove_other_section():
    with patch("app.services.news_briefing.market_news", side_effect=RuntimeError()), patch("app.services.news_briefing.world_news", return_value={"articles": [{"headline": "Diplomacy"}], "fetchedAt": "2026-09-27"}):
        data = get_briefing()
    assert data["market"]["status"] == "unavailable"
    assert data["world"]["status"] == "available"


def test_world_feed_cache_avoids_provider_request():
    with patch("app.services.news_briefing.CacheManager.get", return_value='{"articles": [], "fetchedAt": "2026-09-27"}'), patch("app.services.news_briefing.requests.get") as fetch:
        assert world_news()["fetchedAt"] == "2026-09-27"
        fetch.assert_not_called()


def test_briefing_route_is_not_treated_as_a_ticker():
    with patch("app.services.news_briefing.get_briefing", return_value={"market": {"articles": [], "status": "empty"}, "world": {"articles": [], "status": "empty"}}), patch("app.routes.news.get_news") as company:
        response = TestClient(app).get("/news/briefing")
        assert response.status_code == 200
        assert "world" in response.json()
        company.assert_not_called()
