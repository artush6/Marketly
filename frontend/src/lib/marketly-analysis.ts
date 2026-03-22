import {
  getCompanyNews,
  getFinancials,
  getTickerScore,
  type BackendFinancialStatement,
  type BackendFinancialsResponse,
  type BackendNewsItem,
  type BackendScoreResponse,
} from "@/lib/api";
import { QUERY_ALIASES, resolveFallbackTicker } from "@/components/marketly/mock-data";
import type {
  AnalysisBlock,
  FinancialMiniChartData,
  InsightData,
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

  return news.slice(0, 8).map((item, index) => ({
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
    };
  }

  return {
    summary: score.summary?.trim() || "Analysis is missing.",
    strengths: score.positives?.length ? score.positives : [],
    risks: score.negatives?.length ? score.negatives : [],
    sourceLabel: "Scoring algo + OpenAI backend analysis",
  };
}

function buildVerdict(score: BackendScoreResponse | null): VerdictData {
  if (!score) {
    return {
      summary: "Score is missing because the backend analysis could not be generated.",
      score: "--",
      label: "Data missing",
    };
  }

  return {
    summary: score.summary?.trim() || "Score is missing.",
    score: scoreToDisplay(score.score),
    label: buildScoreLabel(score.score),
  };
}

function buildScenarioPoints(score: BackendScoreResponse | null, type: "positives" | "negatives") {
  const points = type === "positives" ? score?.positives : score?.negatives;
  return points?.length ? points : [];
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
  const revenue = buildEmptyRevenueSection(target.symbol);

  return {
    id,
    query,
    stock: buildStockHeader(target, null, revenue.series),
    metrics: buildMissingMetricCards(target.symbol),
    revenue,
    insights: buildInsights(null),
    news: [],
    bullPoints: [],
    bearPoints: [],
    verdict: buildVerdict(null),
    resolution: target,
    dataStatus: {
      financials: "missing",
      news: "missing",
      analysis: "missing",
    },
  };
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
  const revenue = buildRevenueSection(resolved.symbol, financials);

  return {
    id,
    query,
    stock: buildStockHeader(resolved, financials, revenue.series),
    metrics: buildMetricCards(resolved.symbol, financials, score),
    revenue,
    insights: buildInsights(score),
    news: buildNews(news),
    bullPoints: buildScenarioPoints(score, "positives"),
    bearPoints: buildScenarioPoints(score, "negatives"),
    verdict: buildVerdict(score),
    resolution: resolved,
    dataStatus: {
      financials: financials ? "backend" : "missing",
      news: news && news.length > 0 ? "backend" : "missing",
      analysis: score ? "backend" : "missing",
    },
  };
}
