"""Private alert preferences, persisted notification context and Web Push delivery."""
from __future__ import annotations

from datetime import datetime, timezone
import json
import logging
from typing import Any

from app.core.config import settings
from app.integrations import supabase_store

logger = logging.getLogger(__name__)
DEFAULT_PREFERENCES = {
    "price_drop_thresholds": [3, 5, 10],
    "important_news_enabled": True,
    "discovery_enabled": True,
    "discovery_min_score": 70,
}


def _one(table: str, user_id: str) -> dict[str, Any] | None:
    rows = supabase_store._select_rows(table, {
        "user_id": f"eq.{user_id}", "select": "*", "limit": "1",
    })
    return rows[0] if rows else None


def preferences(user_id: str) -> dict[str, Any]:
    current = _one("user_alert_preferences", user_id)
    if current is None and supabase_store.is_configured():
        supabase_store._upsert_rows("user_alert_preferences", [{"user_id": user_id, **DEFAULT_PREFERENCES}], on_conflict="user_id", strict=True)
        current = _one("user_alert_preferences", user_id)
    return {**DEFAULT_PREFERENCES, **(current or {})}


def save_preferences(user_id: str, values: dict[str, Any]) -> dict[str, Any]:
    if not supabase_store.is_configured():
        raise RuntimeError("Durable alerts are not configured.")
    payload = {
        "user_id": user_id,
        "price_drop_thresholds": values["price_drop_thresholds"],
        "important_news_enabled": values["important_news_enabled"],
        "discovery_enabled": values["discovery_enabled"],
        "discovery_min_score": values["discovery_min_score"],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    supabase_store._upsert_rows("user_alert_preferences", [payload], on_conflict="user_id", strict=True)
    return preferences(user_id)


def upsert_subscription(user_id: str, subscription: dict[str, Any], user_agent: str | None) -> None:
    if not supabase_store.is_configured():
        raise RuntimeError("Durable alerts are not configured.")
    # Endpoints are globally unique in the schema. Never let an upsert silently
    # transfer a device registered to a different signed-in account.
    existing = supabase_store._select_rows("web_push_subscriptions", {
        "endpoint": f"eq.{subscription['endpoint']}", "select": "user_id", "limit": "1",
    })
    if existing and existing[0].get("user_id") != user_id:
        raise ValueError("This device is already registered to another account.")
    keys = subscription.get("keys") if isinstance(subscription.get("keys"), dict) else {}
    row = {
        "user_id": user_id,
        "endpoint": subscription["endpoint"],
        "p256dh": keys["p256dh"],
        "auth_secret": keys["auth"],
        "user_agent": (user_agent or "")[:300],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    supabase_store._upsert_rows("web_push_subscriptions", [row], on_conflict="endpoint", strict=True)


def delete_subscription(user_id: str, endpoint: str) -> None:
    response = supabase_store.requests.delete(
        supabase_store._rest_url("web_push_subscriptions"),
        headers=supabase_store._headers(prefer="return=minimal"),
        params={"user_id": f"eq.{user_id}", "endpoint": f"eq.{endpoint}"},
        timeout=10,
    )
    response.raise_for_status()


def list_notifications(user_id: str, limit: int = 50) -> list[dict[str, Any]]:
    return supabase_store._select_rows("user_alert_notifications", {
        "user_id": f"eq.{user_id}",
        "select": "id,category,symbol,severity,title,body,target_url,explanation,created_at,sent_at,read_at",
        "order": "created_at.desc", "limit": str(max(1, min(100, limit))),
    })


def mark_read(user_id: str, notification_id: str) -> None:
    response = supabase_store.requests.patch(
        supabase_store._rest_url("user_alert_notifications"),
        headers=supabase_store._headers(prefer="return=minimal"),
        params={"id": f"eq.{notification_id}", "user_id": f"eq.{user_id}"},
        json={"read_at": datetime.now(timezone.utc).isoformat()},
        timeout=10,
    )
    response.raise_for_status()


def subscriptions(user_id: str) -> list[dict[str, Any]]:
    return supabase_store._select_rows("web_push_subscriptions", {
        "user_id": f"eq.{user_id}", "select": "id,endpoint,p256dh,auth_secret", "limit": "10",
    })


def _remove_endpoint(endpoint: str) -> None:
    try:
        supabase_store.requests.delete(
            supabase_store._rest_url("web_push_subscriptions"),
            headers=supabase_store._headers(prefer="return=minimal"),
            params={"endpoint": f"eq.{endpoint}"}, timeout=10,
        ).raise_for_status()
    except Exception:
        logger.info("Expired web-push endpoint cleanup failed")


def _push(user_id: str, notification: dict[str, Any]) -> bool:
    if not settings.VAPID_PUBLIC_KEY or not settings.VAPID_PRIVATE_KEY:
        return False
    from pywebpush import WebPushException, webpush

    delivered = False
    for row in subscriptions(user_id):
        info = {
            "endpoint": row["endpoint"],
            "keys": {"p256dh": row["p256dh"], "auth": row["auth_secret"]},
        }
        payload = json.dumps({
            "id": notification["id"],
            "title": notification["title"],
            "body": notification["body"],
            "url": notification["target_url"],
            "tag": notification["dedupe_key"],
        })
        try:
            webpush(
                subscription_info=info,
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.VAPID_SUBJECT},
                ttl=3600,
                timeout=8,
            )
            delivered = True
        except WebPushException as exc:
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            if status_code in (404, 410):
                _remove_endpoint(row["endpoint"])
            logger.info("Web-push send failed with status %s", status_code or "unknown")
        except Exception as exc:
            logger.info("Web-push send failed: %s", type(exc).__name__)
    return delivered


def create_notification(
    user_id: str,
    *,
    dedupe_key: str,
    category: str,
    symbol: str | None,
    severity: str,
    title: str,
    body: str,
    target_url: str = "/alerts",
    explanation: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    row = {
        "user_id": user_id, "dedupe_key": dedupe_key, "category": category,
        "symbol": symbol, "severity": severity, "title": title[:120],
        "body": body[:320], "target_url": target_url[:500],
        "explanation": explanation or {},
    }
    response = supabase_store.requests.post(
        supabase_store._rest_url("user_alert_notifications"),
        headers=supabase_store._headers(prefer="resolution=ignore-duplicates,return=representation"),
        params={"on_conflict": "dedupe_key"}, json=[row], timeout=10,
    )
    response.raise_for_status()
    created_rows = response.json() if response.content else []
    if created_rows:
        notification = created_rows[0]
    else:
        # A prior insert whose push failed stays visible in the inbox and gets
        # another delivery attempt on the next scheduled observation.
        existing = supabase_store._select_rows("user_alert_notifications", {
            "user_id": f"eq.{user_id}", "dedupe_key": f"eq.{dedupe_key}",
            "select": "id,user_id,dedupe_key,title,body,target_url,sent_at", "limit": "1",
        })
        if not existing or existing[0].get("sent_at"):
            return None
        notification = existing[0]
    if _push(user_id, notification):
        sent_at = datetime.now(timezone.utc).isoformat()
        try:
            supabase_store.requests.patch(
                supabase_store._rest_url("user_alert_notifications"),
                headers=supabase_store._headers(prefer="return=minimal"),
                params={"id": f"eq.{notification['id']}"},
                json={"sent_at": sent_at}, timeout=10,
            ).raise_for_status()
            notification["sent_at"] = sent_at
        except Exception:
            logger.info("Could not record alert push delivery")
    return notification


def followed_symbols_by_user() -> dict[str, set[str]]:
    """Read account-owned watchlists through the service role for background checks."""
    rows = supabase_store._select_rows("user_research_state", {
        "key": "eq.marketly.research.v1", "select": "user_id,value", "limit": "1000",
    })
    result: dict[str, set[str]] = {}
    for row in rows:
        try:
            state = json.loads(row.get("value") or "{}")
        except (TypeError, json.JSONDecodeError):
            continue
        symbols = state.get("watchlist", []) if isinstance(state, dict) else []
        if isinstance(symbols, list):
            result[row["user_id"]] = {str(symbol).strip().upper() for symbol in symbols if isinstance(symbol, str)}
    return result


def recipients(symbol: str, category: str) -> list[tuple[str, dict[str, Any]]]:
    prefs = supabase_store._select_rows("user_alert_preferences", {
        "select": "user_id,price_drop_thresholds,important_news_enabled,discovery_enabled,discovery_min_score",
        "limit": "1000",
    })
    follows = followed_symbols_by_user()
    enabled_field = {"price_move": None, "important_news": "important_news_enabled"}.get(category)
    return [
        (row["user_id"], row)
        for row in prefs
        if (enabled_field is None or row.get(enabled_field, True))
        and symbol.upper() in follows.get(row["user_id"], set())
    ]


def discovery_recipients(score: float) -> list[tuple[str, dict[str, Any]]]:
    prefs = supabase_store._select_rows("user_alert_preferences", {
        "select": "user_id,discovery_enabled,discovery_min_score", "limit": "1000",
    })
    return [
        (row["user_id"], row) for row in prefs
        if row.get("discovery_enabled", True)
        and score >= int(row.get("discovery_min_score", 70))
    ]


def notify_price_drop(symbol: str, quote: dict[str, Any], explanation: dict[str, Any]) -> list[dict[str, Any]]:
    change = quote.get("changePercent")
    if not isinstance(change, (int, float)) or change > -3:
        return []
    session = datetime.now(timezone.utc).astimezone(__import__("zoneinfo").ZoneInfo("America/New_York")).date().isoformat()
    delivered = []
    for user_id, pref in recipients(symbol, "price_move"):
        thresholds = sorted({int(value) for value in pref.get("price_drop_thresholds", [3, 5, 10]) if int(value) in (3, 5, 10)})
        crossed = [value for value in thresholds if change <= -value]
        if not crossed:
            continue
        threshold = max(crossed)
        pct = abs(change)
        headline = next((item.get("headline") for item in explanation.get("recentArticles", []) if item.get("headline")), None)
        body = f"{symbol} is down {pct:.1f}% today. " + (f"Recent coverage: {headline}" if headline else "No verified catalyst is available yet; tap for the prepared context.")
        notification = create_notification(
            user_id, dedupe_key=f"price-drop:{user_id}:{symbol}:{session}:{threshold}",
            category="price_move", symbol=symbol,
            severity="critical" if threshold >= 10 else "important" if threshold >= 5 else "notice",
            title=f"{symbol} down {pct:.1f}% today", body=body,
            target_url=f"/alerts?symbol={symbol}", explanation=explanation,
        )
        if notification:
            delivered.append(notification)
    return delivered


def notify_important_news(symbol: str, articles: list[dict[str, Any]]) -> int:
    sent = 0
    for article in articles:
        score = article.get("importanceScore")
        if not isinstance(score, (int, float)) or score < 4:
            continue
        url = article.get("url") if isinstance(article.get("url"), str) else ""
        headline = str(article.get("headline") or "Important company news")[:180]
        dedupe = f"important-news:{symbol}:{url or headline}"
        for user_id, _ in recipients(symbol, "important_news"):
            created = create_notification(
                user_id, dedupe_key=dedupe + ":" + user_id,
                category="important_news", symbol=symbol,
                severity="critical" if score >= 5 else "important",
                title=f"{symbol}: {headline[:85]}",
                body=str(article.get("summary") or headline)[:280],
                target_url=f"/alerts?symbol={symbol}",
                explanation={"headline": headline, "source": article.get("source"),
                             "url": url, "importanceReasons": article.get("importanceReasons", [])},
            )
            sent += int(created is not None)
    return sent


def notify_discovery_candidates(scan: dict[str, Any]) -> int:
    sent = 0
    method = (scan.get("method") or {}).get("ranking") or "small-cap-scan"
    for candidate in scan.get("candidates", []):
        score = candidate.get("potentialScore")
        if not isinstance(score, (int, float)):
            continue
        symbol = str(candidate.get("symbol") or "").upper()
        if not symbol:
            continue
        for user_id, _ in discovery_recipients(score):
            created = create_notification(
                user_id, dedupe_key=f"discovery:{user_id}:{symbol}:{method}",
                category="discovery", symbol=symbol,
                severity="important" if score >= 80 else "notice",
                title=f"New small-cap research candidate: {symbol}",
                body=f"Potential score {score:.0f}/100 with {(candidate.get('futurePotential') or {}).get('confidence', 'low')} confidence. Open the evidence and risk flags before deciding whether it fits.",
                target_url=f"/alerts?symbol={symbol}",
                explanation={
                    "potentialScore": score,
                    "estimatedOutperformanceProbability": candidate.get("futurePotential", {}).get("estimated12mOutperformanceProbability"),
                    "probabilityCalibrated": False,
                    "evidenceCoverage": candidate.get("evidenceCoverage"),
                    "positives": candidate.get("positives", []),
                    "riskFlags": candidate.get("riskFlags", []),
                    "company": {key: candidate.get(key) for key in ("name", "sector", "industry", "marketCap", "marketCapClass")},
                    "notice": "Heuristic research signal only; not calibrated against historical outcomes or a point-in-time universe.",
                },
            )
            sent += int(created is not None)
    return sent
