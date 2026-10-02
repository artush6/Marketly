import json
import datetime
import logging
import re
from contextvars import ContextVar
from functools import lru_cache
from typing import Optional

from app.core.cache import CacheManager
from app.core.config import settings
from app.core.errors import MisconfigurationError
from app.integrations import supabase_store
from app.services.news_intelligence import enrich_articles
import finnhub

logger = logging.getLogger(__name__)
LAST_DATA_SOURCE: ContextVar[str] = ContextVar("news_data_source", default="unknown")
COMMON_COMPANY_ALIASES = {
    "AAPL": ("Apple",), "MSFT": ("Microsoft",), "NVDA": ("NVIDIA",),
    "GOOGL": ("Alphabet", "Google"), "GOOG": ("Alphabet", "Google"),
    "AMZN": ("Amazon",), "META": ("Meta Platforms", "Meta"),
    "TSLA": ("Tesla",), "AMD": ("Advanced Micro Devices",),
    "NKE": ("Nike",), "JPM": ("JPMorgan", "JPMorgan Chase"),
}


def _plain(value) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]*>", " ", str(value or ""))).strip()


def _company_aliases(symbol: str) -> list[str]:
    """Read only already-cached identity data; news filtering must not trigger a quote fetch."""
    values = [symbol, *COMMON_COMPANY_ALIASES.get(symbol, ())]
    if symbol in COMMON_COMPANY_ALIASES:
        return values
    payload = None
    try:
        cached, _ = CacheManager.get_with_source(CacheManager.make_key("tickers", symbol))
        if cached:
            payload = json.loads(cached)
        if payload is None:
            payload = supabase_store.get_json("tickers", symbol)
    except Exception:
        payload = None
    info = payload.get("info") if isinstance(payload, dict) else None
    if not isinstance(info, dict):
        info = {}
    for key in ("shortName", "longName", "companyName", "name"):
        name = _plain(info.get(key))
        if name and name not in values:
            values.append(name)
        # Corporate suffixes are often absent from news headlines.
        shortened = re.sub(r"\b(incorporated|corporation|corp|inc|limited|ltd|plc|company|co)\b\.?$", "", name, flags=re.I).strip(" ,.")
        if shortened and shortened not in values:
            values.append(shortened)
    return values


def _contains_company(text: str, alias: str) -> bool:
    alias = _plain(alias)
    if len(alias) < 3:
        return False
    escaped = re.escape(alias).replace(r"\ ", r"\s+")
    return bool(re.search(rf"(?<![A-Z0-9]){escaped}(?![A-Z0-9])", text, flags=re.I))


def _article_matches_symbol(article: dict, symbol: str, aliases: list[str] | None = None) -> bool:
    """Require a focal-company mention in the headline or lead sentence.

    Provider symbol association can be triggered by a passing comparison deep in
    an article. Such a mention remains insufficient evidence that the story is
    about the requested company.
    """
    aliases = aliases or _company_aliases(symbol)
    headline = _plain(article.get("headline"))
    summary = _plain(article.get("summary"))
    lead = re.split(r"(?<=[.!?])\s+", summary, maxsplit=1)[0]
    return any(_contains_company(headline, alias) or _contains_company(lead, alias) for alias in aliases)


def _relevant_articles(articles: list[dict], symbol: str) -> list[dict]:
    aliases = _company_aliases(symbol)
    return [article for article in articles if isinstance(article, dict) and _article_matches_symbol(article, symbol, aliases)]


@lru_cache(maxsize=1)
def _get_finnhub_client() -> finnhub.Client:
    """Create and cache the Finnhub SDK client."""

    if not settings.FINNHUB_API_KEY:
        raise MisconfigurationError("FINNHUB_API_KEY is not configured")
    return finnhub.Client(api_key=settings.FINNHUB_API_KEY)


def get_news(symbol: str, days: int = 3, max_items: int = 8, output_file: Optional[str] = None, *, force_refresh: bool = False):
    """
    Fetch recent company news from Finnhub for a given symbol.
    Uses Redis caching to avoid redundant API calls.
    Optionally saves results to a JSON file.
    """

    symbol = symbol.strip().upper()
    cache_key = CacheManager.make_key(
        "news",
        f"{symbol}_{days}d_{max_items or 'all'}",
    )
    # Try to load from cache
    cached, cache_source = (None, None) if force_refresh else CacheManager.get_with_source(cache_key)
    if cached:
        articles = _relevant_articles(enrich_articles(json.loads(cached)), symbol)
        if isinstance(articles, list):
            supabase_store.save_news_articles(symbol, articles)
        LAST_DATA_SOURCE.set(cache_source or "cache")
        return articles

    snapshot_key = f"{symbol}_{days}d_{max_items or 'all'}"
    snapshot = None if force_refresh else supabase_store.get_latest_snapshot("news", snapshot_key)
    if snapshot and isinstance(snapshot.get("payload"), list):
        LAST_DATA_SOURCE.set("supabase")
        articles = _relevant_articles(enrich_articles(snapshot["payload"]), symbol)
        CacheManager.set(cache_key, json.dumps(articles))
        supabase_store.save_news_articles(symbol, articles)
        return articles

    # Otherwise fetch fresh data
    date_start = (datetime.date.today() -
                  datetime.timedelta(days=days)).isoformat()
    date_end = datetime.date.today().isoformat()

    finnhub_client = _get_finnhub_client()
    articles = _relevant_articles(enrich_articles(finnhub_client.company_news(
        symbol, _from=date_start, to=date_end)
    ), symbol)

    if max_items:
        articles = articles[:max_items]

    supabase_store.save_snapshot(
        "news",
        snapshot_key,
        articles,
        provenance={"provider": "finnhub", "symbol": symbol, "days": days},
    )
    supabase_store.save_news_articles(symbol, articles)
    LAST_DATA_SOURCE.set("fresh")

    # Cache the new data
    CacheManager.set(cache_key, json.dumps(articles))

    # Optionally save to file
    if output_file:
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(articles, f, ensure_ascii=False, indent=2)
        logger.info("Saved %s articles for %s → %s", len(articles), symbol, output_file)
        logger.debug("Raw response sample for %s: %s", symbol, articles[:2])

    return articles


def get_last_data_source() -> str:
    return LAST_DATA_SOURCE.get()


def get_news_grouped(symbols, max_items: int = 50, days: int = 30, output_file: Optional[str] = None):
    if isinstance(symbols, str):
        symbols_list = [s.strip().upper() for s in symbols.split(",")]
    else:
        symbols_list = [s.strip().upper() for s in symbols]

    # normalize and make a stable cache key
    symbols_list.sort()
    symbols_str = "-".join(symbols_list)
    cache_key = CacheManager.make_key("news", f"{symbols_str}_{days}d")

    if cached := CacheManager.get(cache_key):
        return {symbol: _relevant_articles(enrich_articles(articles), symbol) for symbol, articles in json.loads(cached).items()}

    date_start = (datetime.date.today() -
                  datetime.timedelta(days=days)).isoformat()
    date_end = datetime.date.today().isoformat()

    if isinstance(symbols, str):
        symbols = [s.strip().upper() for s in symbols.split(",")]

    grouped = {}

    finnhub_client = _get_finnhub_client()
    for symbol in symbols:
        articles = _relevant_articles(enrich_articles(finnhub_client.company_news(
            symbol, _from=date_start, to=date_end)), symbol)
        logger.debug("%s: %s articles", symbol, len(articles))
        logger.debug("%s: type=%s, sample=%s", symbol, type(articles), articles[:1])

        if max_items:
            articles = articles[:max_items]

        grouped[symbol] = articles
        supabase_store.save_news_articles(symbol, articles)

    # Cache the new data
    CacheManager.set(cache_key, json.dumps(grouped))

    # print(grouped)
    return grouped


def get_news_mixed(symbols, max_items: int = 10, days: int = 3, output_file: Optional[str] = None):
    """
    Returns a combined list of articles across ALL symbols.
    Optionally saves results to a JSON file if output_file is provided.
    """

    if isinstance(symbols, str):
        symbols_list = [s.strip().upper() for s in symbols.split(",")]
    else:
        symbols_list = [s.strip().upper() for s in symbols]

    # normalize and make a stable cache key
    symbols_list.sort()
    symbols_str = "-".join(symbols_list)
    cache_key = CacheManager.make_key("news", f"{symbols_str}_{days}d")

    if cached := CacheManager.get(cache_key):
        return enrich_articles(json.loads(cached))

    date_start = (datetime.date.today() -
                  datetime.timedelta(days=days)).isoformat()
    date_end = datetime.date.today().isoformat()

    if isinstance(symbols, str):
        symbols = [s.strip().upper() for s in symbols.split(",")]

    mixed_articles = []

    finnhub_client = _get_finnhub_client()
    for symbol in symbols:
        articles = _relevant_articles(enrich_articles(finnhub_client.company_news(
            symbol, _from=date_start, to=date_end)), symbol)
        if max_items:
            articles = articles[:max_items]
        supabase_store.save_news_articles(symbol, articles)
        mixed_articles.extend(articles)

    mixed_articles.sort(key=lambda x: x.get('datetime', 0), reverse=True)

    CacheManager.set(cache_key, json.dumps(mixed_articles))

    if output_file:
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(mixed_articles, f, ensure_ascii=False, indent=2)
        logger.info("Saved %s articles → %s", len(mixed_articles), output_file)

    return mixed_articles
