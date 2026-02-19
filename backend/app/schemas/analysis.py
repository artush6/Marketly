from pydantic import BaseModel, Field
from typing import List, Optional


class ValuationResponse(BaseModel):
    trailingPE: Optional[float] = None
    forwardPE: Optional[float] = None
    priceToBook: Optional[float] = None
    priceToSales: Optional[float] = None
    dividendYield: Optional[float] = None
    marketCap: Optional[float] = None


class StockScoreResponse(BaseModel):
    symbol: str
    score: Optional[int] = None
    summary: Optional[str] = None
    positives: List[str] = Field(default_factory=list)
    negatives: List[str] = Field(default_factory=list)
    company: Optional[str] = None
    valuation: ValuationResponse
