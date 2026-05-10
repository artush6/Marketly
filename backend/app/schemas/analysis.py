from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ValuationResponse(BaseModel):
    trailingPE: Optional[float] = None
    forwardPE: Optional[float] = None
    pegRatio: Optional[float] = None
    priceToBook: Optional[float] = None
    priceToSales: Optional[float] = None
    dividendYield: Optional[float] = None
    marketCap: Optional[float] = None
    coverage: float = 0.0


class ProfitabilityResponse(BaseModel):
    grossMargin: Optional[float] = None
    operatingMargin: Optional[float] = None
    netMargin: Optional[float] = None
    ebitdaMargin: Optional[float] = None
    roe: Optional[float] = None
    profitabilityScore: Optional[float] = None
    coverage: float = 0.0


class GrowthResponse(BaseModel):
    revenueGrowthYoY: Optional[float] = None
    revenueCagr3Y: Optional[float] = None
    epsGrowthYoY: Optional[float] = None
    netIncomeGrowthYoY: Optional[float] = None
    coverage: float = 0.0


class StabilityResponse(BaseModel):
    debtToEquity: Optional[float] = None
    debtRatio: Optional[float] = None
    interestCoverage: Optional[float] = None
    coverage: float = 0.0


class AnalysisMetadataResponse(BaseModel):
    analysisId: Optional[str] = None
    analysisVersion: Optional[str] = None
    dataTimestamp: Optional[str] = None
    factCoverage: float = 0.0
    factFieldCount: int = 0
    factFieldTotal: int = 0
    inferredFactCount: int = 0
    conflictingFactCount: int = 0
    weakFactFields: List[str] = Field(default_factory=list)
    dataQualityScore: Optional[float] = None
    confidenceLevel: Optional[str] = None
    missingCriticalFields: List[str] = Field(default_factory=list)
    analysisLimitations: List[str] = Field(default_factory=list)
    coverageBreakdown: Dict[str, float] = Field(default_factory=dict)
    provenance: Dict[str, Any] = Field(default_factory=dict)
    refreshPolicy: Dict[str, Any] = Field(default_factory=dict)
    inputPartitions: Dict[str, List[str]] = Field(default_factory=dict)


class BusinessModelResponse(BaseModel):
    primaryModel: Optional[str] = None
    secondaryModels: List[str] = Field(default_factory=list)
    confidence: float = 0.0
    evidence: List[str] = Field(default_factory=list)
    frameworkFocus: List[str] = Field(default_factory=list)
    revenueVolatility: Optional[float] = None


class InterpretationFactorResponse(BaseModel):
    label: Optional[str] = None
    detail: Optional[str] = None


class InterpretationResponse(BaseModel):
    summary: Optional[str] = None
    marginQuality: Optional[InterpretationFactorResponse] = None
    growthDurability: Optional[InterpretationFactorResponse] = None
    balanceSheetRisk: Optional[InterpretationFactorResponse] = None
    valuationDependency: Optional[InterpretationFactorResponse] = None
    criticalUnknowns: List[str] = Field(default_factory=list)
    strengths: List[str] = Field(default_factory=list)
    risks: List[str] = Field(default_factory=list)


class CatalystItemResponse(BaseModel):
    title: str
    type: str
    tone: str
    importance: str
    rationale: str


class LifecycleModelResponse(BaseModel):
    pattern: Optional[str] = None
    focus: Optional[str] = None


class EventCatalystResponse(BaseModel):
    keyCatalysts: List[CatalystItemResponse] = Field(default_factory=list)
    lifecycleModel: Optional[LifecycleModelResponse] = None
    retentionRisk: Optional[str] = None
    monetizationDurability: Optional[str] = None
    interpretationLink: Optional[str] = None


class HistoryContextResponse(BaseModel):
    trendSummary: Optional[str] = None
    analogTemplates: List[str] = Field(default_factory=list)
    dataGaps: List[str] = Field(default_factory=list)
    hasUsefulHistory: bool = False


class ScenarioCaseResponse(BaseModel):
    name: str
    probability: float
    confidence: str
    thesis: str
    mustGoRight: List[str] = Field(default_factory=list)
    breaksIf: List[str] = Field(default_factory=list)
    probabilityRationale: Optional[str] = None
    keyEvidence: List[str] = Field(default_factory=list)
    watchlistTriggers: List[str] = Field(default_factory=list)


class ScenarioResponse(BaseModel):
    source: Optional[str] = None
    asymmetry: Optional[str] = None
    historicalContextNeeded: List[str] = Field(default_factory=list)
    signalSummary: Dict[str, Any] = Field(default_factory=dict)
    anomalyFlags: List[str] = Field(default_factory=list)
    cases: List[ScenarioCaseResponse] = Field(default_factory=list)


class MarketContextResponse(BaseModel):
    equityRiskSentiment: Optional[str] = None
    liquidityFlag: Optional[str] = None
    indexTrend: Optional[str] = None
    rateDirection: Optional[str] = None
    treasuryYieldDirection: Optional[str] = None
    inflationDirection: Optional[str] = None
    companyNewsSentiment: Optional[str] = None
    betaSensitivity: Optional[str] = None
    riskOnScore: int = 0
    sector: Optional[str] = None


class HorizonOutlookResponse(BaseModel):
    horizon: str
    outlook: str
    drivers: List[str] = Field(default_factory=list)
    risks: List[str] = Field(default_factory=list)
    focus: str


class TrajectoryResponse(BaseModel):
    pastDrivers: List[str] = Field(default_factory=list)
    upcomingDrivers: List[str] = Field(default_factory=list)
    horizons: List[HorizonOutlookResponse] = Field(default_factory=list)
    growthLens: Optional[str] = None
    valuationLens: Optional[str] = None
    historyLink: Optional[str] = None


class TickerScoreResponse(BaseModel):
    analysisId: Optional[str] = None
    analysisVersion: Optional[str] = None
    dataTimestamp: Optional[str] = None
    symbol: str
    score: Optional[int] = None
    summary: Optional[str] = None
    positives: List[str] = Field(default_factory=list)
    negatives: List[str] = Field(default_factory=list)
    company: Optional[str] = None
    profitability: ProfitabilityResponse
    growth: GrowthResponse
    stability: StabilityResponse
    valuation: ValuationResponse
    analysisMetadata: Optional[AnalysisMetadataResponse] = None
    businessModel: Optional[BusinessModelResponse] = None
    interpretation: Optional[InterpretationResponse] = None
    eventCatalysts: Optional[EventCatalystResponse] = None
    historyContext: Optional[HistoryContextResponse] = None
    marketContext: Optional[MarketContextResponse] = None
    scenarios: Optional[ScenarioResponse] = None
    trajectory: Optional[TrajectoryResponse] = None
    analysisSource: Optional[str] = None
