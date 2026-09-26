"""Persisted company relationship intelligence discovered from dated evidence."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.core.errors import MisconfigurationError
from app.core.symbols import normalize_symbol_input
from app.integrations import supabase_store
from app.integrations.news import get_news

router = APIRouter(prefix="/relationships", tags=["relationships"])


def relationship_payload(symbol: str) -> dict:
    relationships = supabase_store.get_company_relationships(symbol)
    return {
        "symbol": symbol,
        "relationships": relationships,
        "count": len(relationships),
        "loadedAt": datetime.now(timezone.utc).isoformat(),
        "coverageNote": "Only relationships backed by a dated source are shown; public disclosure is not exhaustive.",
    }


@router.get("/{symbol}")
def relationships(symbol: str):
    return relationship_payload(normalize_symbol_input(symbol))


@router.post("/{symbol}/refresh")
def refresh_relationships(symbol: str):
    symbol = normalize_symbol_input(symbol)
    try:
        # News ingestion enriches, ranks, and upserts relationship signals idempotently.
        get_news(symbol, days=30, max_items=50, force_refresh=True)
        return relationship_payload(symbol)
    except MisconfigurationError as exc:
        raise HTTPException(503, str(exc))
    except Exception as exc:
        raise HTTPException(502, "Relationship evidence refresh is temporarily unavailable.") from exc
