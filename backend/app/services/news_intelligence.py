"""Deterministic, auditable news triage and relationship-signal extraction."""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any


CRITICAL_TERMS = (
    "acquisition", "acquires", "acquired", "merger", "bankruptcy", "chapter 11",
    "fraud", "restatement", "sec investigation", "fda approval", "fda rejects",
)
IMPORTANT_TERMS = (
    "partnership", "partners with", "collaboration", "strategic alliance", "joint venture",
    "contract", "agreement", "customer", "supplier", "guidance", "earnings", "chief executive",
    "ceo", "layoffs", "regulatory approval", "antitrust", "lawsuit",
)
NOTABLE_TERMS = (
    "launches", "unveils", "expands", "investment", "invests", "appoints", "resigns",
    "patent", "buyback", "dividend", "price target",
)

RELATIONSHIP_PATTERNS: tuple[tuple[str, str], ...] = (
    ("partner", r"\b(?:partners? with|partnership with|collaboration with|alliance with|joint venture with)\s+([^,;:]+)"),
    ("customer", r"\b(?:customer agreement with|selected by|contract with|deal with)\s+([^,;:]+)"),
    ("supplier", r"\b(?:supplier to|supplies|supply agreement with)\s+([^,;:]+)"),
    ("other", r"\b(?:agreement with|teams? up with)\s+([^,;:]+)"),
)


def _clean_company_name(value: str) -> str | None:
    value = re.split(r"\b(?:to|for|on|as|after|before|amid|in)\b", value, maxsplit=1, flags=re.I)[0]
    value = re.split(r"\s*[\(\[]", value, maxsplit=1)[0]
    value = re.sub(r"\s+", " ", value).strip(" .–—-()[]")
    if len(value) < 2 or len(value) > 80:
        return None
    if value.lower() in {"a new", "the company", "customers", "suppliers", "partners"}:
        return None
    return value


def relationship_signal(article: dict[str, Any]) -> dict[str, Any] | None:
    text = " ".join(str(article.get(key) or "") for key in ("headline", "summary"))
    for relationship_type, pattern in RELATIONSHIP_PATTERNS:
        match = re.search(pattern, text, flags=re.I)
        if not match:
            continue
        company_name = _clean_company_name(match.group(1))
        if company_name:
            return {
                "relationshipType": relationship_type,
                "relatedCompanyName": company_name,
                "confidence": 0.76 if relationship_type != "other" else 0.64,
            }
    return None


def importance(article: dict[str, Any]) -> tuple[int, str, list[str]]:
    text = " ".join(str(article.get(key) or "") for key in ("headline", "summary")).lower()
    reasons: list[str] = []
    score = 1
    if any(term in text for term in NOTABLE_TERMS):
        score = 2
        reasons.append("company development")
    if any(term in text for term in IMPORTANT_TERMS):
        score = 4
        reasons.append("strategy, financials, leadership, or legal impact")
    if any(term in text for term in CRITICAL_TERMS):
        score = 5
        reasons.append("potentially thesis-changing event")
    label = "critical" if score == 5 else "important" if score >= 4 else "notable" if score >= 2 else "routine"
    return score, label, reasons


def enrich_article(article: dict[str, Any]) -> dict[str, Any]:
    enriched = dict(article)
    score, label, reasons = importance(enriched)
    signal = relationship_signal(enriched)
    enriched["importanceScore"] = score
    enriched["importanceLabel"] = label
    enriched["importanceReasons"] = reasons
    enriched["relationshipSignal"] = signal
    enriched["skimmedAt"] = datetime.now(timezone.utc).isoformat()
    return enriched


def enrich_articles(articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [enrich_article(article) for article in articles if isinstance(article, dict)]
