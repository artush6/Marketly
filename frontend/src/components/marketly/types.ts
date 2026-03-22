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
};

export type NewsItem = {
  id: string;
  title: string;
  timestamp: string;
  source?: string;
  url?: string;
  summary?: string;
  category?: string;
};

export type VerdictData = {
  summary: string;
  score: string;
  label: string;
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
  bullPoints: string[];
  bearPoints: string[];
  verdict: VerdictData;
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
