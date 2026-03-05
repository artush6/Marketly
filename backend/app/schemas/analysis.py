from pydantic import BaseModel, Field
from typing import List, Optional


class ValuationResponse(BaseModel):
    trailingPE: Optional[float] = None
    forwardPE: Optional[float] = None
    priceToBook: Optional[float] = None
    priceToSales: Optional[float] = None
    dividendYield: Optional[float] = None
    marketCap: Optional[float] = None


class ProfitabilityResponse(BaseModel):
    grossMargin: Optional[float] = None
    operatingMargin: Optional[float] = None
    netMargin: Optional[float] = None
    ebitdaMargin: Optional[float] = None
    profitabilityScore: Optional[float] = None
    coverage: float = 0.0


class TickerScoreResponse(BaseModel):
    symbol: str
    score: Optional[int] = None
    summary: Optional[str] = None
    positives: List[str] = Field(default_factory=list)
    negatives: List[str] = Field(default_factory=list)
    company: Optional[str] = None
    profitability: ProfitabilityResponse
    valuation: ValuationResponse
