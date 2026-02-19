import os
import json
import datetime
import logging
from app.core.cache import CacheManager
import finnhub
from dotenv import load_dotenv, find_dotenv


# --- Load API keys ---
load_dotenv(find_dotenv())
FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY")  # match .env key name exactly
finnhub_client = finnhub.Client(
    api_key=FINNHUB_API_KEY)
logger = logging.getLogger(__name__)


def get_news(symbol: str, days: int = 3, max_items: int = 8, output_file: str | None = None):
    """"
    Fetch recent company news from Finnhub for a given symbol.
    Uses Redis caching to avoid redundant API calls.
    Optionally saves results to a JSON file.
    """

    cache_key = CacheManager.make_key("news", f"{symbol}_{days}d")

    # Try to load from cache
    if cached := CacheManager.get(cache_key):
        return json.loads(cached)

    # Otherwise fetch fresh data
    date_start = (datetime.date.today() -
                  datetime.timedelta(days=days)).isoformat()
    date_end = datetime.date.today().isoformat()

    articles = finnhub_client.company_news(
        symbol, _from=date_start, to=date_end)

    if max_items:
        articles = articles[:max_items]

    # Cache the new data
    CacheManager.set(cache_key, json.dumps(articles))

    # Optionally save to file
    if output_file:
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(articles, f, ensure_ascii=False, indent=2)
        logger.info("Saved %s articles for %s → %s", len(articles), symbol, output_file)
        logger.debug("Raw response sample for %s: %s", symbol, articles[:2])

    return articles


def get_news_grouped(symbols, max_items: int = 50, days: int = 30, output_file: str | None = None):
    if isinstance(symbols, str):
        symbols_list = [s.strip().upper() for s in symbols.split(",")]
    else:
        symbols_list = [s.strip().upper() for s in symbols]

    # normalize and make a stable cache key
    symbols_list.sort()
    symbols_str = "-".join(symbols_list)
    cache_key = CacheManager.make_key("news", f"{symbols_str}_{days}d")

    if cached := CacheManager.get(cache_key):
        return json.loads(cached)

    date_start = (datetime.date.today() -
                  datetime.timedelta(days=days)).isoformat()
    date_end = datetime.date.today().isoformat()

    if isinstance(symbols, str):
        symbols = [s.strip().upper() for s in symbols.split(",")]

    grouped = {}

    for symbol in symbols:
        articles = finnhub_client.company_news(
            symbol, _from=date_start, to=date_end)
        logger.debug("%s: %s articles", symbol, len(articles))
        logger.debug("%s: type=%s, sample=%s", symbol, type(articles), articles[:1])

        if max_items:
            articles = articles[:max_items]

        grouped[symbol] = articles

    # Cache the new data
    CacheManager.set(cache_key, json.dumps(grouped))

    # print(grouped)
    return grouped


def get_news_mixed(symbols, max_items: int = 10, days: int = 3, output_file: str | None = None):
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
        return json.loads(cached)

    date_start = (datetime.date.today() -
                  datetime.timedelta(days=days)).isoformat()
    date_end = datetime.date.today().isoformat()

    if isinstance(symbols, str):
        symbols = [s.strip().upper() for s in symbols.split(",")]

    mixed_articles = []

    for symbol in symbols:
        articles = finnhub_client.company_news(
            symbol, _from=date_start, to=date_end)
        if max_items:
            articles = articles[:max_items]
        mixed_articles.extend(articles)

    mixed_articles.sort(key=lambda x: x['datetime'])

    CacheManager.set(cache_key, json.dumps(mixed_articles))

    if output_file:
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(mixed_articles, f, ensure_ascii=False, indent=2)
        logger.info("Saved %s articles → %s", len(mixed_articles), output_file)

    return mixed_articles
