export type StockHeaderData = {
  company: string;
  ticker: string;
  exchange: string;
  price: string;
  change: string;
  changePercent: string;
  chartPoints: number[];
};

export type RevenuePoint = {
  label: string;
  value: number;
};

export type MetricCardData = {
  label: string;
  value: string;
  context: string;
  href?: string;
};

export type InsightData = {
  summary: string;
  strengths: string[];
  risks: string[];
  sourceLabel: string;
  evidence?: string[];
  criticalUnknowns?: string[];
};

export type NewsItem = {
  id: string;
  title: string;
  timestamp: string;
  source?: string;
  url?: string;
  summary?: string;
  category?: string;
  imageUrl?: string;
};

export type VerdictData = {
  summary: string;
  score: string;
  label: string;
  businessModel?: string;
  confidence?: string;
  asymmetry?: string;
  source?: string;
};

export type LensItem = {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
  detail?: string;
};

export type CatalystData = {
  title: string;
  type: string;
  tone: "positive" | "negative" | "neutral";
  importance: string;
  rationale: string;
};

export type HorizonData = {
  horizon: string;
  outlook: string;
  drivers: string[];
  risks: string[];
  focus: string;
};

export type AnalysisLensData = {
  businessModel: string;
  businessConfidence: string;
  factCoverage: string;
  asymmetry: string;
  analysisSource: string;
  lenses: LensItem[];
  catalysts: CatalystData[];
  lifecyclePattern?: string;
  lifecycleFocus?: string;
  historicalContext: string[];
  pastDrivers: string[];
  upcomingDrivers: string[];
  horizons: HorizonData[];
};

export type FinancialMiniChartData = {
  title: string;
  value: string;
  delta: string;
  deltaTone: "positive" | "negative" | "neutral";
  series: RevenuePoint[];
  format: "billions" | "percent";
  context: string;
};

export type RevenueTrendData = {
  symbol: string;
  series: RevenuePoint[];
  description: string;
  sourceLabel: string;
  sourceSummary: string;
  miniCharts: FinancialMiniChartData[];
  href: string;
};

export type AnalysisBlock = {
  id: string;
  query: string;
  stock: StockHeaderData;
  metrics: MetricCardData[];
  revenue: RevenueTrendData;
  insights: InsightData;
  news: NewsItem[];
  lens: AnalysisLensData;
  bullPoints: string[];
  bearPoints: string[];
  scenarioCases: Array<{
    name: string;
    probability: number;
    confidence: string;
    thesis: string;
    probabilityRationale?: string;
    keyEvidence: string[];
    watchlistTriggers: string[];
  }>;
  verdict: VerdictData;
  marketContext: {
    items: LensItem[];
    riskOnScore: string;
    sector?: string;
  };
  scoreBreakdown: {
    method: string;
    subscores: LensItem[];
    bonuses: string[];
    penalties: string[];
  };
  metadata: {
    dataTimestamp?: string;
    dataSource?: string;
    dataSources: Record<string, string>;
    confidenceLevel?: string;
    dataQualityScore?: string;
    missingCriticalFields: string[];
    analysisLimitations: string[];
  };
  resolution: {
    symbol: string;
    matchedBy: string;
  };
  dataStatus: {
    financials: "backend" | "missing";
    news: "backend" | "missing";
    analysis: "backend" | "missing";
  };
};

export type FollowUpAnswer = {
  id: string;
  symbol: string;
  question: string;
  answer: string;
  status: "loading" | "ready" | "error";
};
