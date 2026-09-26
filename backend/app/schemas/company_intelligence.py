from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class IntelligenceMetric(BaseModel):
    value: Optional[float] = None
    unit: Optional[str] = None
    availability: str = "unavailable"
    source: Optional[str] = None
    period: Optional[str] = None
    asOf: Optional[str] = None


class IntelligenceCompany(BaseModel):
    name: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    currency: Optional[str] = None
    marketCap: Optional[float] = None


class CompanyIntelligenceResponse(BaseModel):
    symbol: str
    company: IntelligenceCompany = Field(default_factory=IntelligenceCompany)
    availability: str = "unavailable"
    freshness: Dict[str, Any] = Field(default_factory=dict)
    provenance: Dict[str, Any] = Field(default_factory=dict)
    businessQuality: Dict[str, IntelligenceMetric] = Field(default_factory=dict)
    capitalAllocation: Dict[str, IntelligenceMetric] = Field(default_factory=dict)
    valuation: Dict[str, IntelligenceMetric] = Field(default_factory=dict)
    shareDilution: Dict[str, IntelligenceMetric] = Field(default_factory=dict)
    dividends: Dict[str, IntelligenceMetric] = Field(default_factory=dict)
