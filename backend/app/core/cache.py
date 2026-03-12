import logging
from urllib.parse import urlparse
from typing import Optional

import redis
from redis.exceptions import RedisError

from app.core.config import settings

PREFIX = "marketly"
logger = logging.getLogger(__name__)

TTL_PRESETS = {
    "macro": 86400 * 7,     # 7 days
    "tickers": 86400,       # 1 day
    "news": 3600 * 3,       # 3 hours
    "analyst": 86400 * 2,   # 2 days
    "scores": 3600 * 6,     # 6 hours
}


def _build_client():
    redis_url = (settings.REDIS_URL or "").strip()
    if not redis_url:
        logger.info("REDIS_URL not set; cache disabled")
        return None

    parsed = urlparse(redis_url)
    if parsed.scheme not in {"redis", "rediss", "unix"}:
        logger.warning("REDIS_URL has invalid scheme; cache disabled")
        return None

    try:
        client = redis.from_url(redis_url, decode_responses=True)
        client.ping()
        return client
    except (RedisError, ValueError) as exc:
        logger.warning("Redis unavailable; cache disabled: %s", exc)
        return None


r = _build_client()


class CacheManager:
    @staticmethod
    def make_key(namespace: str, identifier: str) -> str:
        return f"{PREFIX}:{namespace}:{identifier}"

    @staticmethod
    def get(key: str):
        if r is None:
            return None
        try:
            value = r.get(key)
            return value if value else None
        except RedisError as exc:
            logger.warning("Cache read failed for %s: %s", key, exc)
            return None

    @staticmethod
    def set(key: str, value: str, ttl: Optional[int] = None):
        if r is None:
            return
        # Determine namespace from key
        namespace = key.split(":")[1] if ":" in key else None
        ttl = ttl or TTL_PRESETS.get(namespace, 3600)  # default 1 h fallback
        try:
            r.set(key, value, ex=ttl)
        except RedisError as exc:
            logger.warning("Cache write failed for %s: %s", key, exc)

    @staticmethod
    def delete(pattern: str):
        if r is None:
            return
        try:
            for key in r.scan_iter(f"{PREFIX}:{pattern}*"):
                r.delete(key)
        except RedisError as exc:
            logger.warning("Cache delete failed for %s: %s", pattern, exc)
