import {
  type BackendTrajectoryHorizon,
  getCompanyNews,
  getFinancials,
  getTickerScore,
  type BackendCatalystItem,
  type BackendFinancialStatement,
  type BackendFinancialsResponse,
  type BackendNewsItem,
  type BackendScoreResponse,
} from "@/lib/api";
import { QUERY_ALIASES, resolveFallbackTicker } from "@/components/marketly/mock-data";
import type {
  AnalysisBlock,
  AnalysisLensData,
  CatalystData,
  FinancialMiniChartData,
  InsightData,
  LensItem,
  MetricCardData,
  NewsItem,
  RevenuePoint,
  RevenueTrendData,
  VerdictData,
} from "@/components/marketly/types";

export type ResolvedQuery = {
  symbol: string;
  matchedBy: string;
};

export type ProgressiveAnalysisPreview = {
  company?: string;
  price?: string;
  changePercent?: string;
  marketCap?: string;
  revenue?: string;
  netIncome?: string;
  newsCount?: number;
  score?: string;
  verdict?: string;
  completedStages: Array<"financials" | "news" | "score">;
};

export type ProgressiveAnalysisUpdate = {
  stage: "financials" | "news" | "score";
  preview: ProgressiveAnalysisPreview;
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeMarketCap(value: number | null | undefined) {
  if (value == null) {
    return null;
  }

  return value < 10_000_000 ? value * 1_000_000 : value;
}

function formatCurrencyCompact(value: number | null | undefined) {
  if (value == null) {
    return "Data missing";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: value >= 1_000_000_000 ? 1 : 2,
  }).format(value);
}

function formatBillions(value: number | null | undefined) {
  if (value == null) {
    return "Data missing";
  }

  return `$${(value / 1_000_000_000).toFixed(1)}B`;
}

function formatPrice(value: number | null | undefined) {
  if (value == null) {
    return "Data missing";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatSignedNumber(value: number | null | undefined, digits = 2) {
  if (value == null) {
    return "Data missing";
  }

  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${value.toFixed(digits)}`;
}

function formatSignedPercent(value: number | null | undefined, digits = 2) {
  if (value == null) {
    return "Data missing";
  }

  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${value.toFixed(digits)}%`;
}

function formatPercentRatio(value: number | null | undefined, digits = 1) {
  if (value == null) {
    return "Data missing";
  }

  return `${(value * 100).toFixed(digits)}%`;
}

function formatPercentWhole(value: number | null | undefined, digits = 0) {
  if (value == null) {
    return "Data missing";
  }

  return `${(value * 100).toFixed(digits)}%`;
}

function titleCase(value: string | null | undefined) {
  if (!value) {
    return "Data missing";
  }

  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function sentenceOrTitle(value: string | null | undefined) {
  if (!value) {
    return "Data missing";
  }

  const normalized = value.replace(/_/g, " ").trim();
  if (normalized.length > 42 || /[.!?,]/.test(normalized)) {
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  return titleCase(normalized);
}

function cleanExternalImageUrl(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed || !/^https?:\/\//i.test(trimmed)) {
    return undefined;
  }

  return trimmed;
}

function formatChartDelta(current: number, previous: number, format: "billions" | "percent") {
  const delta = current - previous;
  const tone = delta > 0 ? "positive" : delta < 0 ? "negative" : "neutral";

  if (format === "percent") {
    return {
      delta: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} pts`,
      deltaTone: tone as FinancialMiniChartData["deltaTone"],
    };
  }

  return {
    delta: `${delta >= 0 ? "+" : ""}$${(delta / 1_000_000_000).toFixed(1)}B`,
    deltaTone: tone as FinancialMiniChartData["deltaTone"],
  };
}

function statementValue(row: BackendFinancialStatement | undefined, ...keys: string[]) {
  if (!row) {
    return null;
  }

  for (const key of keys) {
    const value = toNumber(row[key]);
    if (value != null) {
      return value;
    }
  }

  return null;
}

function buildStatementLabel(row: BackendFinancialStatement, index: number) {
  const rawDate = typeof row.date === "string" ? row.date : undefined;
  const period = typeof row.period === "string" ? row.period : undefined;
  const year =
    (typeof row.calendarYear === "string" && row.calendarYear) ||
    (rawDate ? rawDate.slice(0, 4) : "");

  if (period && year) {
    return `${period} '${year.slice(-2)}`;
  }

  if (year) {
    return year;
  }

  if (rawDate) {
    return rawDate.slice(0, 10);
  }

  return `P${index + 1}`;
}

function extractIncomeStatements(financials?: BackendFinancialsResponse["financials"]) {
  return Array.isArray(financials?.income_statement) ? [...financials.income_statement].reverse() : [];
}

function extractSeries(
  statements: BackendFinancialStatement[],
  pickValue: (row: BackendFinancialStatement) => number | null,
): RevenuePoint[] {
  return statements
    .map((row, index) => {
      const value = pickValue(row);
      if (value == null) {
        return null;
      }

      return {
        label: buildStatementLabel(row, index),
        value,
      };
    })
    .filter((point): point is RevenuePoint => point !== null)
    .slice(-4);
}

function buildFinancialMiniCharts(
  revenueSeries: RevenuePoint[],
  netIncomeSeries: RevenuePoint[],
  operatingMarginSeries: RevenuePoint[],
  netMarginSeries: RevenuePoint[],
): FinancialMiniChartData[] {
  const chartConfigs = [
    {
      title: "Reported Revenue",
      series: revenueSeries,
      format: "billions" as const,
      context: "Latest four reported income-statement periods.",
    },
    {
      title: "Net Income",
      series: netIncomeSeries,
      format: "billions" as const,
      context: "Bottom-line progression across reported periods.",
    },
    {
      title: "Operating Margin",
      series: operatingMarginSeries,
      format: "percent" as const,
      context: "Operating leverage built from revenue and operating income.",
    },
    {
      title: "Net Margin",
      series: netMarginSeries,
      format: "percent" as const,
      context: "Net income as a share of revenue across reported periods.",
    },
  ];

  return chartConfigs
    .filter((chart) => chart.series.length >= 2)
    .map((chart) => {
      const latest = chart.series[chart.series.length - 1]?.value ?? 0;
      const previous = chart.series[chart.series.length - 2]?.value ?? latest;
      const { delta, deltaTone } = formatChartDelta(latest, previous, chart.format);

      return {
        title: chart.title,
        value: chart.format === "percent" ? `${latest.toFixed(1)}%` : formatBillions(latest),
        delta,
        deltaTone,
        series: chart.series.map((point) => ({
          ...point,
          value: chart.format === "percent" ? point.value : point.value / 1_000_000_000,
        })),
        format: chart.format,
        context: chart.context,
      };
    });
}

function buildEmptyRevenueSection(symbol: string): RevenueTrendData {
  return {
    symbol,
    series: [],
    description: "Financial statement data is missing for this company right now.",
    sourceLabel: "Data missing",
    sourceSummary: "We could not load income statements from the backend.",
    miniCharts: [],
    href: `/financials/${symbol}`,
  };
}

function buildRevenueSection(
  symbol: string,
  financials: BackendFinancialsResponse | null,
): RevenueTrendData {
  if (!financials) {
    return buildEmptyRevenueSection(symbol);
  }

  const statements = extractIncomeStatements(financials.financials);
  const revenueSeries = extractSeries(statements, (row) => statementValue(row, "revenue", "totalRevenue"));
  const netIncomeSeries = extractSeries(statements, (row) => statementValue(row, "netIncome"));
  const operatingMarginSeries = extractSeries(statements, (row) => {
    const revenue = statementValue(row, "revenue", "totalRevenue");
    const operatingIncome = statementValue(row, "operatingIncome", "incomeFromOperations");
    return revenue && operatingIncome != null ? (operatingIncome / revenue) * 100 : null;
  });
  const netMarginSeries = extractSeries(statements, (row) => {
    const revenue = statementValue(row, "revenue", "totalRevenue");
    const netIncome = statementValue(row, "netIncome");
    return revenue && netIncome != null ? (netIncome / revenue) * 100 : null;
  });

  if (revenueSeries.length < 2) {
    return buildEmptyRevenueSection(symbol);
  }

  return {
    symbol,
    series: revenueSeries.map((point) => ({
      ...point,
      value: point.value / 1_000_000_000,
    })),
    description: "Latest reported revenue trend built from backend income statements.",
    sourceLabel: "Backend income_statement",
    sourceSummary: "Revenue, net income, and margin charts are derived from `/financials/{symbol}`.",
    miniCharts: buildFinancialMiniCharts(
      revenueSeries,
      netIncomeSeries,
      operatingMarginSeries,
      netMarginSeries,
    ),
    href: `/financials/${symbol}`,
  };
}

function buildMissingMetricCards(symbol: string): MetricCardData[] {
  return [
    {
      label: "Revenue",
      value: "Data missing",
      context: "Backend income statement data is unavailable.",
      href: `/financials/${symbol}`,
    },
    {
      label: "Net Income",
      value: "Data missing",
      context: "Backend income statement data is unavailable.",
      href: `/financials/${symbol}`,
    },
    {
      label: "Operating Margin",
      value: "Data missing",
      context: "Backend scoring output is unavailable.",
      href: `/financials/${symbol}`,
    },
    {
      label: "Revenue Growth",
      value: "Data missing",
      context: "Growth metrics are unavailable from the backend.",
      href: `/financials/${symbol}`,
    },
  ];
}

function buildMetricCards(
  symbol: string,
  financials: BackendFinancialsResponse | null,
  score: BackendScoreResponse | null,
): MetricCardData[] {
  if (!financials && !score) {
    return buildMissingMetricCards(symbol);
  }

  const statements = extractIncomeStatements(financials?.financials);
  const latest = statements[statements.length - 1];
  const revenue = statementValue(latest, "revenue", "totalRevenue");
  const netIncome = statementValue(latest, "netIncome");
  const marketCap = financials?.info?.marketCap ?? score?.valuation?.marketCap ?? financials?.quote?.marketCap ?? null;
  const revenueGrowth = score?.growth?.revenueGrowthYoY ?? null;
  const operatingMargin = score?.profitability?.operatingMargin ?? null;

  return [
    {
      label: "Revenue",
      value: revenue != null ? formatBillions(revenue) : "Data missing",
      context:
        revenue != null
          ? "Latest reported revenue from the backend income statement."
          : "Backend income statement data is unavailable.",
      href: `/financials/${symbol}`,
    },
    {
      label: "Net Income",
      value: netIncome != null ? formatBillions(netIncome) : "Data missing",
      context:
        netIncome != null
          ? "Latest reported net income from the backend income statement."
          : "Backend income statement data is unavailable.",
      href: `/financials/${symbol}`,
    },
    {
      label: "Operating Margin",
      value: operatingMargin != null ? formatPercentRatio(operatingMargin) : "Data missing",
      context:
        operatingMargin != null
          ? "Derived by the backend scoring pipeline."
          : "Backend scoring output is unavailable.",
      href: `/financials/${symbol}`,
    },
    {
      label: revenueGrowth != null ? "Revenue Growth" : "Market Cap",
      value:
        revenueGrowth != null
            ? formatPercentRatio(revenueGrowth)
          : marketCap != null
            ? formatCurrencyCompact(normalizeMarketCap(marketCap))
            : "Data missing",
      context:
        revenueGrowth != null
          ? "YoY growth supplied by `/score/{symbol}`."
          : marketCap != null
            ? "Market capitalization merged from provider quote and profile data."
            : "Backend valuation data is unavailable.",
      href: `/financials/${symbol}`,
    },
  ];
}

function buildNews(news: BackendNewsItem[] | null): NewsItem[] {
  if (!news || news.length === 0) {
    return [];
  }

  return news.slice(0, 16).map((item, index) => ({
    id: String(item.id ?? `${item.datetime ?? "latest"}-${index}`),
    title: item.headline?.trim() || "Untitled article",
    timestamp:
      typeof item.datetime === "number"
        ? new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }).format(item.datetime * 1000)
        : "Latest",
    source: item.source,
    url: item.url,
    summary: item.summary?.trim() || undefined,
    category: item.category,
    imageUrl: cleanExternalImageUrl(item.image),
  }));
}

function buildScoreLabel(score: number | null | undefined) {
  if (score == null) {
    return "Data missing";
  }

  if (score >= 75) {
    return "Bullish";
  }

  if (score >= 55) {
    return "Balanced";
  }

  return "Cautious";
}

function scoreToDisplay(score: number | null | undefined) {
  if (score == null) {
    return "--";
  }

  return score > 10 ? (score / 10).toFixed(1) : score.toFixed(1);
}

function buildStockHeader(
  resolved: ResolvedQuery,
  financials: BackendFinancialsResponse | null,
  revenueSeries: RevenuePoint[],
) {
  const currentPrice = financials?.quote?.currentPrice ?? financials?.quote?.c ?? null;
  const rawChange =
    financials?.quote?.d ??
    ((financials?.quote?.c ?? null) != null && (financials?.quote?.pc ?? null) != null
      ? (financials?.quote?.c as number) - (financials?.quote?.pc as number)
      : null);
  const rawChangePercent =
    financials?.quote?.dp ??
    ((financials?.quote?.c ?? null) != null && (financials?.quote?.pc ?? null) != null
      ? (((financials?.quote?.c as number) - (financials?.quote?.pc as number)) /
          (financials?.quote?.pc as number)) *
        100
      : null);

  return {
    company: financials?.info?.shortName || resolved.symbol,
    ticker: resolved.symbol,
    exchange: "NASDAQ",
    logoUrl: cleanExternalImageUrl(
      financials?.info?.logo ?? financials?.info?.image ?? financials?.info?.icon,
    ),
    price: currentPrice != null ? formatPrice(currentPrice) : "Data missing",
    change: rawChange != null ? formatSignedNumber(rawChange) : "Data missing",
    changePercent: rawChangePercent != null ? formatSignedPercent(rawChangePercent) : "Data missing",
    chartPoints: revenueSeries.length >= 2 ? revenueSeries.map((point) => point.value) : [],
  };
}

function buildInsights(score: BackendScoreResponse | null): InsightData {
  if (!score) {
    return {
      summary: "Analysis is missing. The backend scoring and GPT interpretation did not return a result.",
      strengths: [],
      risks: [],
      sourceLabel: "Data missing",
      evidence: [],
      criticalUnknowns: [],
    };
  }

  return {
    summary: score.interpretation?.summary?.trim() || score.summary?.trim() || "Analysis is missing.",
    strengths:
      score.interpretation?.strengths?.length
        ? score.interpretation.strengths
        : score.positives?.length
          ? score.positives
          : [],
    risks:
      score.interpretation?.risks?.length
        ? score.interpretation.risks
        : score.negatives?.length
          ? score.negatives
          : [],
    sourceLabel:
      score.analysisSource === "fallback"
        ? "Structured fallback analysis"
        : "Scoring algo + OpenAI backend analysis",
    evidence: score.businessModel?.evidence?.length ? score.businessModel.evidence : [],
    criticalUnknowns: score.interpretation?.criticalUnknowns?.length ? score.interpretation.criticalUnknowns : [],
  };
}

function buildVerdict(score: BackendScoreResponse | null): VerdictData {
  if (!score) {
    return {
      summary: "Score is missing because the backend analysis could not be generated.",
      score: "--",
      label: "Data missing",
      businessModel: undefined,
      confidence: undefined,
      asymmetry: undefined,
      source: undefined,
    };
  }

  return {
    summary: score.summary?.trim() || "Score is missing.",
    score: scoreToDisplay(score.score),
    label: buildScoreLabel(score.score),
    businessModel: titleCase(score.businessModel?.primaryModel),
    confidence:
      typeof score.businessModel?.confidence === "number"
        ? formatPercentWhole(score.businessModel.confidence)
        : undefined,
    asymmetry: sentenceOrTitle(score.scenarios?.asymmetry),
    source: score.analysisSource === "fallback" ? "Fallback" : "OpenAI",
  };
}

function buildScenarioPoints(score: BackendScoreResponse | null, type: "positives" | "negatives") {
  const scenarioKey = type === "positives" ? "bull" : "bear";
  const scenario = score?.scenarios?.cases?.find((item) => item.name === scenarioKey);
  if (scenario) {
    const lines = [scenario.thesis];
    if (scenario.mustGoRight?.length) {
      lines.push(...scenario.mustGoRight);
    }
    if (scenario.breaksIf?.length) {
      lines.push(...scenario.breaksIf.map((item) => `Breaks if: ${item}`));
    }
    return lines;
  }

  const points = type === "positives" ? score?.positives : score?.negatives;
  return points?.length ? points : [];
}

function buildScenarioCases(score: BackendScoreResponse | null): AnalysisBlock["scenarioCases"] {
  return (
    score?.scenarios?.cases?.map((item) => ({
      name: item.name,
      probability: item.probability,
      confidence: item.confidence,
      thesis: item.thesis,
      probabilityRationale: item.probabilityRationale ?? undefined,
      keyEvidence: item.keyEvidence ?? [],
      watchlistTriggers: item.watchlistTriggers ?? [],
    })) ?? []
  );
}

function toneFromLabel(label: string | null | undefined): LensItem["tone"] {
  if (!label) {
    return "neutral";
  }
  const normalized = label.toLowerCase();
  if (normalized === "strong" || normalized === "low") {
    return "positive";
  }
  if (normalized === "weak" || normalized === "high") {
    return "negative";
  }
  return "neutral";
}

function buildCatalysts(score: BackendScoreResponse | null): CatalystData[] {
  return (
    score?.eventCatalysts?.keyCatalysts?.slice(0, 4).map((item: BackendCatalystItem) => ({
      title: item.title,
      type: item.type,
      tone: item.tone === "positive" || item.tone === "negative" ? item.tone : "neutral",
      importance: item.importance,
      rationale: item.rationale,
    })) ?? []
  );
}

function buildAnalysisLens(score: BackendScoreResponse | null): AnalysisLensData {
  const lenses: LensItem[] = [
    {
      label: "Margin Quality",
      value: titleCase(score?.interpretation?.marginQuality?.label),
      tone: toneFromLabel(score?.interpretation?.marginQuality?.label),
      detail: score?.interpretation?.marginQuality?.detail ?? undefined,
    },
    {
      label: "Growth Durability",
      value: titleCase(score?.interpretation?.growthDurability?.label),
      tone: toneFromLabel(score?.interpretation?.growthDurability?.label),
      detail: score?.interpretation?.growthDurability?.detail ?? undefined,
    },
    {
      label: "Balance Sheet Risk",
      value: titleCase(score?.interpretation?.balanceSheetRisk?.label),
      tone: toneFromLabel(score?.interpretation?.balanceSheetRisk?.label),
      detail: score?.interpretation?.balanceSheetRisk?.detail ?? undefined,
    },
    {
      label: "Valuation Dependency",
      value: titleCase(score?.interpretation?.valuationDependency?.label),
      tone: toneFromLabel(score?.interpretation?.valuationDependency?.label),
      detail: score?.interpretation?.valuationDependency?.detail ?? undefined,
    },
  ];

  return {
    businessModel: titleCase(score?.businessModel?.primaryModel),
    businessConfidence:
      typeof score?.businessModel?.confidence === "number"
        ? formatPercentWhole(score.businessModel.confidence)
        : "Data missing",
    factCoverage:
      typeof score?.analysisMetadata?.factCoverage === "number"
        ? formatPercentWhole(score.analysisMetadata.factCoverage)
        : "Data missing",
    asymmetry: sentenceOrTitle(score?.scenarios?.asymmetry),
    analysisSource: score?.analysisSource === "fallback" ? "Fallback analysis" : "OpenAI synthesis",
    lenses,
    catalysts: buildCatalysts(score),
    lifecyclePattern: score?.eventCatalysts?.lifecycleModel?.pattern ?? undefined,
    lifecycleFocus: score?.eventCatalysts?.lifecycleModel?.focus ?? undefined,
    historicalContext: score?.scenarios?.historicalContextNeeded?.length
      ? score.scenarios.historicalContextNeeded
      : score?.historyContext?.analogTemplates?.length
        ? score.historyContext.analogTemplates
        : [],
    pastDrivers: score?.trajectory?.pastDrivers?.length ? score.trajectory.pastDrivers : [],
    upcomingDrivers: score?.trajectory?.upcomingDrivers?.length ? score.trajectory.upcomingDrivers : [],
    horizons:
      score?.trajectory?.horizons?.map((item: BackendTrajectoryHorizon) => ({
        horizon: item.horizon,
        outlook: item.outlook,
        drivers: item.drivers?.length ? item.drivers : [],
        risks: item.risks?.length ? item.risks : [],
        focus: item.focus,
      })) ?? [],
  };
}

function buildMarketContext(score: BackendScoreResponse | null): AnalysisBlock["marketContext"] {
  const context = score?.marketContext;
  const items: LensItem[] = [
    {
      label: "Equity Risk",
      value: titleCase(context?.equityRiskSentiment),
      tone: toneFromLabel(context?.equityRiskSentiment),
    },
    {
      label: "Liquidity",
      value: titleCase(context?.liquidityFlag),
      tone: toneFromLabel(context?.liquidityFlag),
    },
    {
      label: "Index Trend",
      value: titleCase(context?.indexTrend),
      tone: toneFromLabel(context?.indexTrend),
    },
    {
      label: "Rates",
      value: titleCase(context?.rateDirection ?? context?.treasuryYieldDirection),
      tone: context?.rateDirection === "rising" ? "negative" : "neutral",
    },
    {
      label: "Inflation",
      value: titleCase(context?.inflationDirection),
      tone: context?.inflationDirection === "rising" ? "negative" : "neutral",
    },
    {
      label: "Company News",
      value: titleCase(context?.companyNewsSentiment),
      tone: toneFromLabel(context?.companyNewsSentiment),
    },
    {
      label: "Beta Sensitivity",
      value: titleCase(context?.betaSensitivity),
      tone: context?.betaSensitivity === "high" ? "negative" : "neutral",
    },
  ];

  return {
    items,
    riskOnScore:
      typeof context?.riskOnScore === "number" ? `${context.riskOnScore}/100` : "Data missing",
    sector: context?.sector ?? undefined,
  };
}

function buildScoreBreakdown(score: BackendScoreResponse | null): AnalysisBlock["scoreBreakdown"] {
  const breakdown = score?.scoreBreakdown;
  const subscores = Object.entries(breakdown?.subscores ?? {}).map(([key, value]) => {
    const max = breakdown?.maxSubscores?.[key];
    return {
      label: titleCase(key),
      value: typeof max === "number" ? `${value}/${max}` : String(value),
      tone: value >= (max ?? 20) * 0.65 ? "positive" : value <= (max ?? 20) * 0.35 ? "negative" : "neutral",
    } satisfies LensItem;
  });

  return {
    method: breakdown?.method ?? "Data missing",
    subscores,
    bonuses: breakdown?.bonuses ?? [],
    penalties: breakdown?.penalties ?? [],
  };
}

function buildMetadata(score: BackendScoreResponse | null): AnalysisBlock["metadata"] {
  const metadata = score?.analysisMetadata;
  return {
    dataTimestamp: score?.dataTimestamp ?? metadata?.dataTimestamp ?? undefined,
    dataSource: score?.dataSource ?? metadata?.dataSource ?? undefined,
    dataSources: metadata?.dataSources ?? {},
    confidenceLevel: metadata?.confidenceLevel ?? undefined,
    dataQualityScore:
      typeof metadata?.dataQualityScore === "number"
        ? formatPercentWhole(metadata.dataQualityScore)
        : undefined,
    missingCriticalFields: metadata?.missingCriticalFields ?? [],
    analysisLimitations: metadata?.analysisLimitations ?? [],
  };
}

function buildProgressPreview(
  resolved: ResolvedQuery,
  financials: BackendFinancialsResponse | null,
  news: BackendNewsItem[] | null,
  score: BackendScoreResponse | null,
  completedStages: ProgressiveAnalysisPreview["completedStages"],
): ProgressiveAnalysisPreview {
  const statements = extractIncomeStatements(financials?.financials);
  const latest = statements[statements.length - 1];
  const revenue = statementValue(latest, "revenue", "totalRevenue");
  const netIncome = statementValue(latest, "netIncome");
  const currentPrice = financials?.quote?.currentPrice ?? financials?.quote?.c ?? null;
  const rawChangePercent = financials?.quote?.dp ?? null;
  const marketCap = normalizeMarketCap(
    financials?.info?.marketCap ?? score?.valuation?.marketCap ?? financials?.quote?.marketCap ?? null,
  );

  return {
    company: financials?.info?.shortName ?? score?.company ?? resolved.symbol,
    price: formatPrice(currentPrice),
    changePercent: rawChangePercent != null ? formatSignedPercent(rawChangePercent) : undefined,
    marketCap: formatCurrencyCompact(marketCap),
    revenue: formatBillions(revenue),
    netIncome: formatBillions(netIncome),
    newsCount: news?.length,
    score: score?.score != null ? `${score.score}/100` : undefined,
    verdict: score ? buildScoreLabel(score.score) : undefined,
    completedStages,
  };
}

function buildAnalysisBlockFromParts(
  query: string,
  id: string,
  resolved: ResolvedQuery,
  financials: BackendFinancialsResponse | null,
  news: BackendNewsItem[] | null,
  score: BackendScoreResponse | null,
): AnalysisBlock {
  const revenue = buildRevenueSection(resolved.symbol, financials);

  return {
    id,
    query,
    stock: buildStockHeader(resolved, financials, revenue.series),
    metrics: buildMetricCards(resolved.symbol, financials, score),
    revenue,
    insights: buildInsights(score),
    news: buildNews(news),
    lens: buildAnalysisLens(score),
    bullPoints: buildScenarioPoints(score, "positives"),
    bearPoints: buildScenarioPoints(score, "negatives"),
    scenarioCases: buildScenarioCases(score),
    verdict: buildVerdict(score),
    marketContext: buildMarketContext(score),
    scoreBreakdown: buildScoreBreakdown(score),
    metadata: buildMetadata(score),
    resolution: resolved,
    dataStatus: {
      financials: financials ? "backend" : "missing",
      news: news && news.length > 0 ? "backend" : "missing",
      analysis: score ? "backend" : "missing",
    },
  };
}

export function resolveQuerySymbol(query: string): ResolvedQuery {
  const normalized = query.trim().toLowerCase();
  const sortedAliases = Object.keys(QUERY_ALIASES).sort((a, b) => b.length - a.length);
  const matchedAlias = sortedAliases.find((alias) => normalized.includes(alias));

  if (matchedAlias) {
    return {
      symbol: QUERY_ALIASES[matchedAlias],
      matchedBy: `company-alias:${matchedAlias}`,
    };
  }

  const exactTicker = query.trim().match(/^[A-Za-z]{1,5}$/);
  if (exactTicker?.[0]) {
    return {
      symbol: exactTicker[0].toUpperCase(),
      matchedBy: "exact-ticker",
    };
  }

  const inlineTicker = query.match(/\(([A-Z]{1,5})\)/);
  if (inlineTicker?.[1]) {
    return {
      symbol: inlineTicker[1].toUpperCase(),
      matchedBy: "inline-ticker",
    };
  }

  const fallbackSymbol = resolveFallbackTicker(query);
  return {
    symbol: fallbackSymbol,
    matchedBy: "fallback-library",
  };
}

export function shouldRunFullAnalysis(query: string, currentSymbol?: string | null) {
  if (!currentSymbol) {
    return true;
  }

  const resolved = resolveQuerySymbol(query);
  const normalized = query.trim().toLowerCase();
  const exactTicker = query.trim().match(/^[A-Za-z]{1,5}$/);
  const inlineTicker = query.match(/\(([A-Z]{1,5})\)/);
  const includesKnownAlias = Object.keys(QUERY_ALIASES).some((alias) => normalized.includes(alias));

  if (exactTicker || inlineTicker || includesKnownAlias) {
    return resolved.symbol !== currentSymbol;
  }

  return false;
}

export function buildMissingAnalysisBlock(
  query: string,
  id: string,
  resolved?: ResolvedQuery,
): AnalysisBlock {
  const target = resolved ?? resolveQuerySymbol(query);
  return buildAnalysisBlockFromParts(query, id, target, null, null, null);
}

export async function buildAnalysisBlockFromBackend(
  query: string,
  id: string,
): Promise<AnalysisBlock> {
  const resolved = resolveQuerySymbol(query);

  const [financialsResult, newsResult, scoreResult] = await Promise.allSettled([
    getFinancials(resolved.symbol),
    getCompanyNews(resolved.symbol),
    getTickerScore(resolved.symbol),
  ]);

  const financials = financialsResult.status === "fulfilled" ? financialsResult.value : null;
  const news = newsResult.status === "fulfilled" ? newsResult.value : null;
  const score = scoreResult.status === "fulfilled" ? scoreResult.value : null;

  return buildAnalysisBlockFromParts(query, id, resolved, financials, news, score);
}

export async function buildAnalysisBlockFromBackendProgressive(
  query: string,
  id: string,
  onProgress: (update: ProgressiveAnalysisUpdate) => void,
): Promise<AnalysisBlock> {
  const resolved = resolveQuerySymbol(query);
  let financials: BackendFinancialsResponse | null = null;
  let news: BackendNewsItem[] | null = null;
  let score: BackendScoreResponse | null = null;
  const completedStages: ProgressiveAnalysisPreview["completedStages"] = [];

  try {
    financials = await getFinancials(resolved.symbol);
  } catch {
    financials = null;
  } finally {
    completedStages.push("financials");
    onProgress({
      stage: "financials",
      preview: buildProgressPreview(resolved, financials, news, score, [...completedStages]),
    });
  }

  try {
    news = await getCompanyNews(resolved.symbol);
  } catch {
    news = null;
  } finally {
    completedStages.push("news");
    onProgress({
      stage: "news",
      preview: buildProgressPreview(resolved, financials, news, score, [...completedStages]),
    });
  }

  try {
    score = await getTickerScore(resolved.symbol);
  } catch {
    score = null;
  } finally {
    completedStages.push("score");
    onProgress({
      stage: "score",
      preview: buildProgressPreview(resolved, financials, news, score, [...completedStages]),
    });
  }

  return buildAnalysisBlockFromParts(query, id, resolved, financials, news, score);
}
