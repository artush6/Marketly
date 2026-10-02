from app.integrations.news import _article_matches_symbol, _relevant_articles


def test_company_news_requires_focal_company_in_headline_or_lead_sentence():
    alias = ["NVDA", "NVIDIA"]

    assert _article_matches_symbol(
        {"headline": "Nvidia shares rise after results", "summary": "Investors react."},
        "NVDA", alias,
    )
    assert _article_matches_symbol(
        {"headline": "Chip maker reports results", "summary": "Nvidia reported record revenue. Analysts responded."},
        "NVDA", alias,
    )
    assert not _article_matches_symbol(
        {"headline": "Nike Just Reported Earnings", "summary": "Nike's turnaround needs a turnaround. Joining a list like Nvidia did."},
        "NVDA", alias,
    )


def test_news_filter_removes_passive_ticker_mentions():
    articles = [
        {"headline": "NVIDIA expands data center supply", "summary": "New facilities open."},
        {"headline": "Nike reports earnings", "summary": "Nike's turnaround needs a turnaround. Nvidia was also mentioned."},
    ]
    assert _relevant_articles(articles, "NVDA") == [articles[0]]


def test_company_news_endpoint_pipeline_drops_story_matched_only_by_late_mention():
    from types import SimpleNamespace
    from unittest.mock import patch
    from app.integrations import news

    provider_items = [
        {"headline": "NVIDIA expands data center supply", "summary": "New facilities open."},
        {"headline": "Nike Just Reported Earnings", "summary": "Nike's turnaround needs a turnaround. Joining a list like NVIDIA did."},
    ]
    client = SimpleNamespace(company_news=lambda *args, **kwargs: provider_items)
    with patch.object(news.CacheManager, "get_with_source", return_value=(None, None)), \
         patch.object(news.supabase_store, "get_latest_snapshot", return_value=None), \
         patch.object(news, "_get_finnhub_client", return_value=client), \
         patch.object(news.CacheManager, "set"), \
         patch.object(news.supabase_store, "save_snapshot"), \
         patch.object(news.supabase_store, "save_news_articles"):
        result = news.get_news("NVDA", days=2, max_items=10, force_refresh=True)

    assert [item["headline"] for item in result] == ["NVIDIA expands data center supply"]
