from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


FactSource = Literal[
    "finnhub",
    "fmp",
    "rapidapi",
    "yfinance",
    "derived",
    "unknown",
]


class FactCandidate(BaseModel):
    key: str
    value: Any = None
    source: FactSource = "unknown"
    quality_score: float = 0.5
    inferred: bool = False
    notes: Optional[str] = None


class CanonicalFact(BaseModel):
    key: str
    value: Any = None
    source: FactSource = "unknown"
    confidence: float = 0.0
    inferred: bool = False
    alternatives: list[FactCandidate] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class CoverageReport(BaseModel):
    total_fields: int
    filled_fields: int
    inferred_fields: int
    conflict_fields: int
    weak_fields: list[str] = Field(default_factory=list)
    coverage_ratio: float = 0.0


class CompanyFactGraph(BaseModel):
    symbol: str
    company_name: Optional[str] = None
    facts: dict[str, CanonicalFact] = Field(default_factory=dict)
    coverage: CoverageReport
