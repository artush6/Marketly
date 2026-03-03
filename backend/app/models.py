from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class CompanyInfo(BaseModel):
    shortName: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    currency: Optional[str] = None
    marketCap: Optional[float] = None
    beta: Optional[float] = None
    trailingPE: Optional[float] = None
    forwardPE: Optional[float] = None
    priceToBook: Optional[float] = None
    priceToSalesTrailing12Months: Optional[float] = None
    dividendYield: Optional[float] = None
    pegRatio: Optional[float] = None
    roe: Optional[float] = None
    grossMargin: Optional[float] = None

    class Config:
        extra = "allow"


class FinancialsBlock(BaseModel):
    income_statement: Optional[List[Dict[str, Any]]] = None

    class Config:
        extra = "allow"


class StockFinancials(BaseModel):
    symbol: Optional[str] = None
    info: CompanyInfo = Field(default_factory=CompanyInfo)
    quote: Dict[str, Any] = Field(default_factory=dict)
    analyst_data: Optional[Any] = None
    financials: FinancialsBlock = Field(default_factory=FinancialsBlock)
    dividends: Dict[str, Any] = Field(default_factory=dict)
    sources: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        extra = "allow"

    @classmethod
    def from_raw(cls, raw: Dict[str, Any]) -> "StockFinancials":
        data = dict(raw or {})
        data.setdefault("info", {})
        data.setdefault("financials", {})
        return cls.parse_obj(data)

    def to_api_dict(self) -> Dict[str, Any]:
        # Preserve API shape as raw dict
        return self.model_dump() if hasattr(self, "model_dump") else self.dict()
