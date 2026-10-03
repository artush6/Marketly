"""Account-scoped push setup and alert inbox."""
from __future__ import annotations

import re
import logging
from urllib.parse import urlparse
from uuid import UUID
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.auth import Identity, current_user
from app.core.config import settings
from app.integrations import supabase_store
from app.services import alert_delivery

router = APIRouter(prefix="/notifications", tags=["notifications"])
logger = logging.getLogger(__name__)


def _user(user: Identity | None) -> Identity:
    if user is None:
        raise HTTPException(401, "Sign in to use background alerts.")
    return user


def _followed_symbols(user_id: str) -> list[str]:
    rows = supabase_store._select_rows("user_research_state", {
        "user_id": f"eq.{user_id}", "key": "eq.marketly.research.v1",
        "select": "value", "limit": "1",
    })
    if not rows:
        return []
    import json
    try:
        state = json.loads(rows[0].get("value") or "{}")
    except (TypeError, json.JSONDecodeError):
        return []
    symbols = state.get("watchlist", []) if isinstance(state, dict) else []
    return list(dict.fromkeys(symbol.upper() for symbol in symbols if isinstance(symbol, str)))[:50]


class PreferencesUpdate(BaseModel):
    price_drop_thresholds: list[int] = Field(min_length=1, max_length=3)
    important_news_enabled: bool = True
    discovery_enabled: bool = True
    discovery_min_score: int = Field(default=70, ge=50, le=100)

    @field_validator("price_drop_thresholds")
    @classmethod
    def valid_thresholds(cls, values: list[int]) -> list[int]:
        if len(set(values)) != len(values) or any(value not in (3, 5, 10) for value in values):
            raise ValueError("Choose unique 3%, 5%, or 10% thresholds.")
        return sorted(values)


class SymbolAlertRuleInput(BaseModel):
    symbol: str = Field(min_length=1, max_length=20)
    trigger_type: Literal["price", "percent_change"]
    direction: Literal["above", "below"]
    threshold: float = Field(gt=0, le=1_000_000_000)

    @field_validator("symbol")
    @classmethod
    def valid_symbol(cls, value: str) -> str:
        value = value.strip().upper()
        if not re.fullmatch(r"[A-Z0-9][A-Z0-9.:-]{0,19}", value):
            raise ValueError("Enter a valid ticker symbol.")
        return value

    @model_validator(mode="after")
    def valid_threshold(self):
        if self.trigger_type == "percent_change" and self.threshold > 100:
            raise ValueError("Daily percentage thresholds must be 100% or less.")
        return self


class SubscriptionInput(BaseModel):
    endpoint: str = Field(min_length=30, max_length=3000)
    keys: dict[str, str]

    @field_validator("endpoint")
    @classmethod
    def secure_endpoint(cls, value: str) -> str:
        parsed = urlparse(value)
        host = (parsed.hostname or "").lower().rstrip(".")
        public_push_hosts = (
            "fcm.googleapis.com", "push.apple.com", "push.services.mozilla.com",
            "notify.windows.com",
        )
        if (parsed.scheme != "https" or not host or parsed.username or parsed.password
                or parsed.port not in (None, 443)
                or not any(host == suffix or host.endswith("." + suffix) for suffix in public_push_hosts)):
            raise ValueError("Push endpoint must use a supported public browser push service over HTTPS.")
        return value

    @field_validator("keys")
    @classmethod
    def valid_keys(cls, value: dict[str, str]) -> dict[str, str]:
        if not all(isinstance(value.get(key), str) and 8 <= len(value[key]) <= 256 for key in ("p256dh", "auth")):
            raise ValueError("Invalid push subscription keys.")
        return value


class SubscriptionDelete(BaseModel):
    endpoint: str = Field(min_length=30, max_length=3000)


@router.get("")
def alert_inbox(user: Identity | None = Depends(current_user)):
    identity = _user(user)
    if not supabase_store.is_configured():
        raise HTTPException(503, "Background alerts need Supabase persistence to be configured.")
    try:
        rules = alert_delivery.symbol_rules(identity.user_id)
        followed = _followed_symbols(identity.user_id)
        return {
            "notifications": alert_delivery.list_notifications(identity.user_id),
            "preferences": alert_delivery.preferences(identity.user_id),
            "followedSymbols": followed,
            "ruleSymbols": sorted({rule["symbol"] for rule in rules}),
            "deviceCount": len(alert_delivery.subscriptions(identity.user_id)),
            "pushConfigured": bool(settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY),
        }
    except Exception as exc:
        raise HTTPException(503, "Alerts could not be loaded right now.") from exc


@router.get("/summary")
def alert_summary(user: Identity | None = Depends(current_user)):
    identity = _user(user)
    if not supabase_store.is_configured():
        raise HTTPException(503, "Alert counts are unavailable.")
    try:
        return {"unreadCritical": alert_delivery.unread_critical_count(identity.user_id)}
    except Exception as exc:
        raise HTTPException(503, "Alert counts are unavailable.") from exc


@router.get("/config")
def notification_config():
    return {"configured": bool(settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY),
            "publicKey": settings.VAPID_PUBLIC_KEY if settings.VAPID_PRIVATE_KEY else None}


@router.put("/preferences")
def update_preferences(values: PreferencesUpdate, user: Identity | None = Depends(current_user)):
    identity = _user(user)
    try:
        result = alert_delivery.save_preferences(identity.user_id, values.model_dump())
        from app.services.market_refresh import register_symbols
        register_symbols(_followed_symbols(identity.user_id))
        return {"preferences": result}
    except Exception as exc:
        raise HTTPException(503, "Alert preferences could not be saved.") from exc


@router.get("/rules")
def list_symbol_rules(user: Identity | None = Depends(current_user)):
    identity = _user(user)
    if not supabase_store.is_configured():
        raise HTTPException(503, "Durable alerts need Supabase persistence to be configured.")
    try:
        return {"rules": alert_delivery.symbol_rules(identity.user_id)}
    except Exception as exc:
        raise HTTPException(503, "Ticker alert rules could not be loaded.") from exc


@router.post("/rules", status_code=201)
def create_symbol_rule(values: SymbolAlertRuleInput, user: Identity | None = Depends(current_user)):
    identity = _user(user)
    try:
        rule = alert_delivery.save_symbol_rule(identity.user_id, values.model_dump())
        from app.services.market_refresh import register_symbols
        try:
            register_symbols([values.symbol])
        except Exception:
            # The periodic worker also syncs enabled rule symbols, so a queue
            # hiccup must not make an already-persisted rule look unsaved.
            logger.warning("Ticker rule saved but immediate refresh registration failed", exc_info=True)
        return {"rule": rule}
    except Exception as exc:
        raise HTTPException(503, "Ticker alert rule could not be saved.") from exc


@router.delete("/rules/{rule_id}")
def remove_symbol_rule(rule_id: str, user: Identity | None = Depends(current_user)):
    identity = _user(user)
    try:
        parsed_id = UUID(rule_id)
    except ValueError as exc:
        raise HTTPException(422, "Invalid alert rule ID.") from exc
    try:
        alert_delivery.delete_symbol_rule(identity.user_id, str(parsed_id))
        return {"deleted": True}
    except Exception as exc:
        raise HTTPException(503, "Ticker alert rule could not be deleted.") from exc


@router.post("/subscriptions", status_code=201)
def add_subscription(values: SubscriptionInput, request: Request, user: Identity | None = Depends(current_user)):
    identity = _user(user)
    if not settings.VAPID_PUBLIC_KEY or not settings.VAPID_PRIVATE_KEY:
        raise HTTPException(503, "Web push is not configured on the server.")
    try:
        alert_delivery.upsert_subscription(identity.user_id, values.model_dump(), request.headers.get("user-agent"))
        from app.services.market_refresh import register_symbols
        register_symbols(_followed_symbols(identity.user_id))
        return {"saved": True, "deviceCount": len(alert_delivery.subscriptions(identity.user_id))}
    except Exception as exc:
        raise HTTPException(503, "This device could not be registered for alerts.") from exc


@router.delete("/subscriptions")
def remove_subscription(values: SubscriptionDelete, user: Identity | None = Depends(current_user)):
    identity = _user(user)
    try:
        alert_delivery.delete_subscription(identity.user_id, values.endpoint)
        return {"deleted": True}
    except Exception as exc:
        raise HTTPException(503, "This device could not be removed.") from exc


@router.post("/test")
def test_notification(user: Identity | None = Depends(current_user)):
    identity = _user(user)
    if not alert_delivery.subscriptions(identity.user_id):
        raise HTTPException(409, "Enable notifications on this device first.")
    try:
        import secrets
        sent = alert_delivery.create_notification(
            identity.user_id, dedupe_key=f"test:{identity.user_id}:{secrets.token_urlsafe(12)}",
            category="important_news", symbol=None, severity="notice",
            title="Marketly alerts are connected", body="Your device can receive Marketly market alerts.",
            target_url="/alerts", explanation={"test": True},
        )
        return {"queued": sent is not None, "sent": bool(sent and sent.get("sent_at"))}
    except Exception as exc:
        raise HTTPException(503, "The test notification could not be sent.") from exc


@router.patch("/{notification_id}/read")
def read_notification(notification_id: str, user: Identity | None = Depends(current_user)):
    identity = _user(user)
    try:
        UUID(notification_id)
    except ValueError as exc:
        raise HTTPException(422, "Invalid notification ID.") from exc
    try:
        alert_delivery.mark_read(identity.user_id, notification_id)
        return {"read": True}
    except Exception as exc:
        raise HTTPException(503, "Notification could not be marked read.") from exc
