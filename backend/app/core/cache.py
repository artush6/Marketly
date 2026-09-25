import logging
import json
from urllib.parse import urlparse
from typing import Optional

import redis
import requests
from redis.exceptions import RedisError

from app.core.config import settings
from app.integrations import supabase_store

PREFIX = "marketly"
logger = logging.getLogger(__name__)

TTL_PRESETS = {
    "macro": 86400 * 7,     # 7 days
    "tickers": 86400,       # 1 day
    "news": 3600 * 3,       # 3 hours
    "analyst": 86400 * 2,   # 2 days
    "scores": 3600 * 6,     # 6 hours
}


class UpstashRestCache:
    """Small redis-py-compatible adapter for the Upstash REST API."""

    def __init__(self, url: str, token: str):
        self.url = url.rstrip("/")
        self.headers = {"Authorization": f"Bearer {token}"}

    def _command(self, *parts):
        try:
            response = requests.post(
                self.url,
                headers=self.headers,
                json=list(parts),
                timeout=2,
            )
            response.raise_for_status()
            payload = response.json()
            if payload.get("error"):
                raise RedisError(str(payload["error"]))
            return payload.get("result")
        except (requests.RequestException, ValueError) as exc:
            raise RedisError(str(exc)) from exc

    def ping(self):
        return self._command("PING") == "PONG"

    def get(self, key):
        return self._command("GET", key)

    def set(self, key, value, ex=None):
        command = ["SET", key, value]
        if ex:
            command.extend(["EX", int(ex)])
        return self._command(*command)

    def delete(self, key):
        return self._command("DEL", key)

    def scan_iter(self, pattern):
        cursor = "0"
        while True:
            result = self._command("SCAN", cursor, "MATCH", pattern, "COUNT", 100)
            if not isinstance(result, list) or len(result) != 2:
                return
            cursor, keys = str(result[0]), result[1]
            yield from keys or []
            if cursor == "0":
                return


def _normalize_redis_url(raw_url: str) -> str:
    redis_url = raw_url.strip().strip("\"'")
    if not redis_url:
        return ""

    if "://" not in redis_url:
        return f"rediss://{redis_url}"

    parsed = urlparse(redis_url)
    if parsed.scheme == "https":
        return redis_url.replace("https://", "rediss://", 1)
    if parsed.scheme == "http":
        return redis_url.replace("http://", "redis://", 1)

    return redis_url


def _build_client():
    redis_url = _normalize_redis_url(settings.REDIS_URL or "")
    if redis_url:
        parsed = urlparse(redis_url)
        if parsed.scheme not in {"redis", "rediss", "unix"}:
            logger.warning("REDIS_URL has invalid scheme; trying Upstash REST")
        else:
            try:
                client = redis.from_url(
                    redis_url,
                    decode_responses=True,
                    socket_connect_timeout=2,
                    socket_timeout=2,
                    health_check_interval=30,
                )
                client.ping()
                return client
            except (RedisError, ValueError) as exc:
                logger.warning("Redis unavailable; trying Upstash REST: %s", exc)

    rest_url = getattr(settings, "UPSTASH_REDIS_REST_URL", None)
    rest_token = getattr(settings, "UPSTASH_REDIS_REST_TOKEN", None)
    if rest_url and rest_token:
        try:
            client = UpstashRestCache(rest_url, rest_token)
            client.ping()
            logger.info("Using Upstash REST fast cache")
            return client
        except RedisError as exc:
            logger.warning("Upstash REST unavailable; using Supabase cache: %s", exc)

    logger.info("No fast cache available; using Supabase cache")
    return None


r = _build_client()


class CacheManager:
    @staticmethod
    def make_key(namespace: str, identifier: str) -> str:
        return f"{PREFIX}:{namespace}:{identifier}"

    @staticmethod
    def get(key: str):
        value, _source = CacheManager.get_with_source(key)
        return value

    @staticmethod
    def get_with_source(key: str):
        namespace, identifier = CacheManager.parse_key(key)
        if r is None:
            value = CacheManager._get_persistent(namespace, identifier)
            return value, "supabase_cache" if value is not None else None
        try:
            value = r.get(key)
            if value:
                return value, "cache"
        except RedisError as exc:
            logger.warning("Cache read failed for %s: %s", key, exc)
        value = CacheManager._get_persistent(namespace, identifier)
        return value, "supabase_cache" if value is not None else None

    @staticmethod
    def set(key: str, value: str, ttl: Optional[int] = None, *, durable: bool = False):
        namespace, identifier = CacheManager.parse_key(key)
        ttl = ttl or TTL_PRESETS.get(namespace, 3600)  # default 1 h fallback
        if r is None:
            CacheManager._set_persistent(namespace, identifier, value, ttl, strict=durable)
            return
        try:
            r.set(key, value, ex=ttl)
        except RedisError as exc:
            logger.warning("Cache write failed for %s: %s", key, exc)
        CacheManager._set_persistent(namespace, identifier, value, ttl, strict=durable)

    @staticmethod
    def delete_key(key: str):
        """Invalidate the exact key in both layers, including Redis-free deployments."""
        namespace, identifier = CacheManager.parse_key(key)
        supabase_store.delete_json(namespace, identifier)
        if r is not None:
            r.delete(key)

    @staticmethod
    def delete(pattern: str):
        if r is None:
            return
        try:
            for key in r.scan_iter(f"{PREFIX}:{pattern}*"):
                r.delete(key)
        except RedisError as exc:
            logger.warning("Cache delete failed for %s: %s", pattern, exc)

    @staticmethod
    def parse_key(key: str) -> tuple[str, str]:
        parts = key.split(":", 2)
        if len(parts) == 3 and parts[0] == PREFIX:
            return parts[1], parts[2]
        if len(parts) >= 2:
            return parts[0], ":".join(parts[1:])
        return "default", key

    @staticmethod
    def _get_persistent(namespace: str, identifier: str):
        payload = supabase_store.get_json(namespace, identifier)
        if payload is None:
            return None
        return json.dumps(payload)

    @staticmethod
    def _set_persistent(namespace: str, identifier: str, value: str, ttl: int, *, strict: bool = False):
        try:
            payload = json.loads(value)
        except ValueError:
            payload = value
        supabase_store.set_json(namespace, identifier, payload, ttl, strict=strict)
