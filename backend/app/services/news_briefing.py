"""Broad news discovery independent of tracked symbols."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from time import time
import json
import re
import xml.etree.ElementTree as ET

import requests

from app.core.cache import CacheManager
from app.services.news_intelligence import enrich_articles

WORLD_FEED = "https://feeds.bbci.co.uk/news/world/rss.xml"


def parse_world_feed(content):
    root = ET.fromstring(content)
    articles = []
    seen = set()
    for item in root.findall("./channel/item"):
        url = (item.findtext("link") or "").strip()
        title = (item.findtext("title") or "").strip()
        if not title or not url.startswith("https://") or url in seen:
            continue
        seen.add(url)
        try:
            timestamp = int(parsedate_to_datetime(item.findtext("pubDate") or "").timestamp())
        except (ValueError, TypeError, OverflowError):
            timestamp = None
        image = item.find("{http://search.yahoo.com/mrss/}thumbnail")
        articles.append({"headline": title, "url": url, "source": "BBC News",
                         "datetime": timestamp, "summary": re.sub(r"<[^>]+>", "", item.findtext("description") or ""),
                         "image": image.get("url") if image is not None else None,
                         "category": "World affairs"})
    return sorted(articles, key=lambda a: a["datetime"] or 0, reverse=True)[:24]


def world_news():
    key = CacheManager.make_key("market_news", "world_briefing")
    cached = CacheManager.get(key)
    if cached:
        return json.loads(cached)
    response = requests.get(WORLD_FEED, timeout=8, headers={"User-Agent": "Marketly/1.0 news reader"})
    response.raise_for_status()
    articles = parse_world_feed(response.content)
    if not articles:
        raise ValueError("World feed returned no articles")
    result = {"articles": articles, "fetchedAt": datetime.now(timezone.utc).isoformat()}
    CacheManager.set(key, json.dumps(result), ttl=900)
    return result


def market_news():
    # Reuse the general-news pipeline and its scheduled refresh; no ticker fan-out.
    from app.routes.market import cached_news
    articles = cached_news(int(time() // 120))
    unique = {}
    for article in enrich_articles(articles):
        key = article.get("url") or article.get("headline")
        if key:
            unique.setdefault(key, article)
    return {"articles": sorted(unique.values(), key=lambda a: (a.get("importanceScore") or 1, a.get("datetime") or 0), reverse=True)[:24], "fetchedAt": None}


def get_briefing():
    result = {}
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = {"market": pool.submit(market_news), "world": pool.submit(world_news)}
        for section, future in futures.items():
            try:
                payload = future.result()
                result[section] = {**payload, "status": "available" if payload["articles"] else "empty"}
            except Exception:
                result[section] = {"articles": [], "fetchedAt": None, "status": "unavailable"}
    return result
