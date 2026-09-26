import { backendServerUrl } from "@/lib/backend-config";

export type BackendFinancialStatement = {
  date?: string;
  calendarYear?: string;
  period?: string;
  reportedCurrency?: string;
  revenue?: number | string | null;
  totalRevenue?: number | string | null;
  netIncome?: number | string | null;
  operatingIncome?: number | string | null;
  incomeFromOperations?: number | string | null;
  eps?: number | string | null;
  epsDiluted?: number | string | null;
  interestExpense?: number | string | null;
  ebitda?: number | string | null;
  totalDebt?: number | string | null;
  netDebt?: number | string | null;
  totalAssets?: number | string | null;
  totalStockholdersEquity?: number | string | null;
  totalShareholderEquity?: number | string | null;
  commonStockSharesOutstanding?: number | string | null;
  [key: string]: unknown;
};

export type BackendFinancialsResponse = {
  symbol: string;
  info?: {
    shortName?: string | null;
    sector?: string | null;
    industry?: string | null;
    country?: string | null;
    currency?: string | null;
    logo?: string | null;
    image?: string | null;
    icon?: string | null;
    website?: string | null;
    marketCap?: number | null;
    beta?: number | null;
    trailingPE?: number | null;
    forwardPE?: number | null;
    priceToBook?: number | null;
    priceToSalesTrailing12Months?: number | null;
    priceToSales?: number | null;
    dividendYield?: number | null;
    pegRatio?: number | null;
    roe?: number | null;
    grossMargin?: number | null;
    debtToEquity?: number | null;
    fullTimeEmployees?: number | null;
    foundedYear?: number | null;
    ipoDate?: string | null;
    chiefExecutive?: string | null;
    headquarters?: string | null;
    officeLocations?: Array<Record<string, string>>;
    companyOfficers?: Array<{ name?: string; title?: string; age?: number; yearBorn?: number }>;
    longBusinessSummary?: string | null;
    phone?: string | null;
    [key: string]: unknown;
  };
  quote?: {
    c?: number | null;
    d?: number | null;
    dp?: number | null;
    h?: number | null;
    l?: number | null;
    o?: number | null;
    pc?: number | null;
    currentPrice?: number | null;
    targetMeanPrice?: number | null;
    recommendationMean?: number | null;
    forwardEps?: number | null;
    dividendRate?: number | null;
    marketCap?: number | null;
    sharesOutstanding?: number | null;
    [key: string]: unknown;
  };
  analyst_data?: unknown;
  dividends?: Record<string, unknown>;
  financials?: {
    income_statement?: BackendFinancialStatement[];
    balance_sheet?: BackendFinancialStatement[];
    cash_flow?: BackendFinancialStatement[];
    as_reported_income_statement?: BackendFinancialStatement[];
    [key: string]: unknown;
  };
  sources?: Record<string, string>;
  dataQuality?: BackendFinancialQuality;
};

export type BackendFinancialQuality = {
  status: "complete" | "partial" | "insufficient" | "stale";
  coverage: number;
  statementCoverage: number;
  missingCriticalFields: string[];
  fetchedAt: string;
  cacheEligible: boolean;
  scoreEligible: boolean;
  reason?: string | null;
};

export type BackendNewsItem = {
  category?: string;
  datetime?: number;
  headline?: string;
  id?: number;
  image?: string;
  related?: string;
  source?: string;
  summary?: string;
  url?: string;
  symbol?: string;
  importanceScore?: number;
  importanceLabel?: "routine" | "notable" | "important" | "critical";
  importanceReasons?: string[];
  relationshipSignal?: {
    relationshipType?: string;
    relatedCompanyName?: string;
    relatedSymbol?: string;
    confidence?: number;
  } | null;
  [key: string]: unknown;
};

export type BackendFollowUpResponse = {
  sources?: {url: string; title: string}[];
  symbol: string;
  answer: string;
};

export type BackendAnalysisMetadata = {
  analysisId?: string | null;
  analysisVersion?: string | null;
  dataTimestamp?: string | null;
  factCoverage?: number;
  factFieldCount?: number;
  factFieldTotal?: number;
  inferredFactCount?: number;
  conflictingFactCount?: number;
  weakFactFields?: string[];
  dataQualityScore?: number | null;
  confidenceLevel?: string | null;
  missingCriticalFields?: string[];
  analysisLimitations?: string[];
  coverageBreakdown?: Record<string, number>;
  provenance?: Record<string, unknown>;
  refreshPolicy?: Record<string, unknown>;
  gptScore?: number | null;
  modelSuggestedScore?: number | null;
  financialQuality?: BackendFinancialQuality;
  dataSource?: string | null;
  dataSources?: Record<string, string>;
  inputPartitions?: Record<string, string[]>;
};

export type BackendBusinessModel = {
  primaryModel?: string | null;
  secondaryModels?: string[];
  confidence?: number;
  evidence?: string[];
  frameworkFocus?: string[];
  revenueVolatility?: number | null;
};

export type BackendInterpretationFactor = {
  label?: string | null;
  detail?: string | null;
};

export type BackendInterpretation = {
  summary?: string | null;
  marginQuality?: BackendInterpretationFactor | null;
  growthDurability?: BackendInterpretationFactor | null;
  balanceSheetRisk?: BackendInterpretationFactor | null;
  valuationDependency?: BackendInterpretationFactor | null;
  criticalUnknowns?: string[];
  strengths?: string[];
  risks?: string[];
};

export type BackendCatalystItem = {
  title: string;
  type: string;
  tone: string;
  importance: string;
  rationale: string;
};

export type BackendEventCatalysts = {
  keyCatalysts?: BackendCatalystItem[];
  lifecycleModel?: {
    pattern?: string | null;
    focus?: string | null;
  } | null;
  retentionRisk?: string | null;
  monetizationDurability?: string | null;
  interpretationLink?: string | null;
};

export type BackendHistoryContext = {
  trendSummary?: string | null;
  analogTemplates?: string[];
  dataGaps?: string[];
  hasUsefulHistory?: boolean;
};

export type BackendScenarioCase = {
  name: string;
  probability: number;
  confidence: string;
  thesis: string;
  mustGoRight?: string[];
  breaksIf?: string[];
  probabilityRationale?: string | null;
  keyEvidence?: string[];
  watchlistTriggers?: string[];
};

export type BackendScenarios = {
  source?: string | null;
  asymmetry?: string | null;
  historicalContextNeeded?: string[];
  signalSummary?: Record<string, unknown>;
  anomalyFlags?: string[];
  cases?: BackendScenarioCase[];
};

export type BackendTrajectoryHorizon = {
  horizon: string;
  outlook: string;
  drivers?: string[];
  risks?: string[];
  focus: string;
};

export type BackendTrajectory = {
  pastDrivers?: string[];
  upcomingDrivers?: string[];
  horizons?: BackendTrajectoryHorizon[];
  growthLens?: string | null;
  valuationLens?: string | null;
  historyLink?: string | null;
};

export type BackendMarketContext = {
  equityRiskSentiment?: string | null;
  liquidityFlag?: string | null;
  indexTrend?: string | null;
  rateDirection?: string | null;
  treasuryYieldDirection?: string | null;
  inflationDirection?: string | null;
  companyNewsSentiment?: string | null;
  betaSensitivity?: string | null;
  riskOnScore?: number | null;
  sector?: string | null;
};

export type BackendScoreBreakdown = {
  score?: number | null;
  rawScore?: number | null;
  confidenceAdjustment?: number | null;
  subscores?: Record<string, number>;
  maxSubscores?: Record<string, number>;
  bonuses?: string[];
  penalties?: string[];
  method?: string | null;
};

export type BackendScoreResponse = {
  analysisId?: string | null;
  analysisVersion?: string | null;
  dataTimestamp?: string | null;
  symbol: string;
  score?: number | null;
  scoreBreakdown?: BackendScoreBreakdown | null;
  summary?: string | null;
  positives?: string[];
  negatives?: string[];
  company?: string | null;
  profitability?: {
    grossMargin?: number | null;
    operatingMargin?: number | null;
    netMargin?: number | null;
    ebitdaMargin?: number | null;
    roe?: number | null;
    profitabilityScore?: number | null;
    coverage?: number;
  };
  growth?: {
    revenueGrowthYoY?: number | null;
    revenueCagr3Y?: number | null;
    epsGrowthYoY?: number | null;
    netIncomeGrowthYoY?: number | null;
    coverage?: number;
  };
  stability?: {
    debtToEquity?: number | null;
    debtRatio?: number | null;
    interestCoverage?: number | null;
    coverage?: number;
  };
  valuation?: {
    trailingPE?: number | null;
    forwardPE?: number | null;
    pegRatio?: number | null;
    priceToBook?: number | null;
    priceToSales?: number | null;
    dividendYield?: number | null;
    marketCap?: number | null;
    coverage?: number;
  };
  analysisMetadata?: BackendAnalysisMetadata | null;
  businessModel?: BackendBusinessModel | null;
  interpretation?: BackendInterpretation | null;
  eventCatalysts?: BackendEventCatalysts | null;
  historyContext?: BackendHistoryContext | null;
  marketContext?: BackendMarketContext | null;
  scenarios?: BackendScenarios | null;
  trajectory?: BackendTrajectory | null;
  analysisSource?: string | null;
  dataSource?: string | null;
};

function getBaseUrl() {
  const baseUrl = typeof window === "undefined"
    ? backendServerUrl()
    : process.env.NEXT_PUBLIC_API_URL || "/api/backend";
  return baseUrl.replace(/\/$/, "");
}

const CLIENT_CACHE_TTL_MS = 60_000;
const CLIENT_REQUEST_TIMEOUT_MS = 120_000;
const clientResponseCache = new Map<
  string,
  { expiresAt: number; value: unknown }
>();
const clientInFlightRequests = new Map<string, Promise<unknown>>();

async function requestJson<T>(path: string, fetchPath = path): Promise<T> {
  const url = `${getBaseUrl()}${path}`;

  if (typeof window !== "undefined") {
    const cached = clientResponseCache.get(url);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }

    const inFlight = clientInFlightRequests.get(url);
    if (inFlight) {
      return inFlight as Promise<T>;
    }
  }

  const request = fetch(`${getBaseUrl()}${fetchPath}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(CLIENT_REQUEST_TIMEOUT_MS),
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const value = (await res.json()) as T;

      if (typeof window !== "undefined") {
        const record = value as Record<string, unknown>;
        const quality = record?.dataQuality as
          BackendFinancialQuality | undefined;
        const degraded =
          quality?.status === "insufficient" ||
          quality?.status === "stale" ||
          ("score" in (record ?? {}) && record.score == null);
        if (!degraded) {
          clientResponseCache.set(url, {
            expiresAt: Date.now() + (path.startsWith("/financials/") ? 300_000 : CLIENT_CACHE_TTL_MS),
            value,
          });
        }
      }

      return value;
    })
    .finally(() => {
      if (typeof window !== "undefined") {
        clientInFlightRequests.delete(url);
      }
    });

  if (typeof window !== "undefined") {
    clientInFlightRequests.set(url, request);
  }

  return request;
}

export async function getFinancials(
  symbol: string,
  refresh = false,
): Promise<BackendFinancialsResponse> {
  const query = refresh ? "?refresh=true" : "";
  return requestJson<BackendFinancialsResponse>(
    `/financials/${encodeURIComponent(symbol)}${query}`,
  );
}

export async function getCompanyNews(
  symbol: string,
): Promise<BackendNewsItem[]> {
  return requestJson<BackendNewsItem[]>(
    `/news/${encodeURIComponent(symbol)}?days=7&max_items=24`,
  );
}

export async function getGroupedNews(symbols: string[]): Promise<Record<string, BackendNewsItem[]>> {
  return requestJson<Record<string, BackendNewsItem[]>>(
    `/news/grouped?symbols=${encodeURIComponent(symbols.join(","))}&days=14&max_items=30`,
  );
}

export type CompanyRelationship = {
  id: string;
  related_company_name: string;
  related_symbol?: string | null;
  relationship_type: "supplier" | "customer" | "partner" | "competitor" | "investor" | "subsidiary" | "other";
  direction: string;
  product_service?: string | null;
  evidence_summary: string;
  source_url: string;
  source_date?: string | null;
  confidence: number;
  last_verified_at: string;
};

export type RelationshipResponse = {
  symbol: string;
  relationships: CompanyRelationship[];
  count: number;
  loadedAt: string;
  coverageNote: string;
};

export function getRelationships(symbol: string) {
  return requestJson<RelationshipResponse>(`/relationships/${encodeURIComponent(symbol)}`);
}

export async function refreshRelationships(symbol: string) {
  const response = await fetch(`${getBaseUrl()}/relationships/${encodeURIComponent(symbol)}/refresh`, {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<RelationshipResponse>;
}

export async function getTickerScore(
  symbol: string,
): Promise<BackendScoreResponse> {
  return requestJson<BackendScoreResponse>(
    `/score/${encodeURIComponent(symbol)}`,
  );
}

export class BackendRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "BackendRequestError";
  }
}

export async function postFollowUp(
  symbol: string,
  question: string,
  analysisContext?: Record<string, unknown>,
  conversation: { role: "user" | "assistant"; content: string }[] = [],
  research = false,
): Promise<BackendFollowUpResponse> {
  const res = await fetch(`${getBaseUrl()}/assistant/follow-up`, {
    signal: AbortSignal.timeout(90000),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      symbol,
      question,
      analysis_context: analysisContext,
      research,
      conversation,
    }),
  });

  if (!res.ok) {
    let detail = `Request failed with status ${res.status}`;
    try {
      const payload = (await res.json()) as { detail?: string };
      if (payload.detail) detail = payload.detail;
    } catch {
      // Preserve the status-based message for non-JSON proxy failures.
    }
    throw new BackendRequestError(detail, res.status);
  }

  return res.json() as Promise<BackendFollowUpResponse>;
}


// Preload visible companies with bounded concurrency; opening one reuses the same
// request/cache. No analysis or LLM request is made by this queue.
const financialPreloadQueue: string[] = [];
const financialPreloadPending = new Set<string>();
let financialPreloadActive = 0;

function drainFinancialPreloads() {
  while (financialPreloadActive < 2 && financialPreloadQueue.length) {
    const symbol = financialPreloadQueue.shift()!;
    financialPreloadActive += 1;
    const path = `/financials/${encodeURIComponent(symbol)}`;
    void requestJson<BackendFinancialsResponse>(path, `${path}?track=false`).catch(() => {
      // A failed speculative load must not block navigation or future retries.
    }).finally(() => {
      financialPreloadActive -= 1;
      financialPreloadPending.delete(symbol);
      drainFinancialPreloads();
    });
  }
}

export function preloadFinancials(symbols: string[], speculative = false) {
  if (typeof window === "undefined") return;
  for (const raw of symbols.slice(0, 50)) {
    const symbol = raw.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9.:-]{0,19}$/.test(symbol) || financialPreloadPending.has(symbol)) continue;
    // Discovery also returns exchange-specific listings unsupported by our US feeds.
    // Explicit watchlists and navigation may still load those on demand.
    if (speculative && !/^[A-Z][A-Z0-9-]{0,9}(?:\.[AB])?$/.test(symbol)) continue;
    if (financialPreloadQueue.length >= 50) break;
    financialPreloadPending.add(symbol);
    financialPreloadQueue.push(symbol);
  }
  drainFinancialPreloads();
}

export type CompanyMetadata = {
  symbol: string;
  name: string;
  logoUrl: string | null;
  exchange?: string | null;
  industry?: string | null;
  country?: string | null;
  currency?: string | null;
  fetchedAt?: string;
  source?: string;
  status: "available" | "missing" | "unavailable";
};

export function getCompanyMetadata(symbols: string[]) {
  return requestJson<{ companies: CompanyMetadata[] }>(
    `/companies/metadata?symbols=${encodeURIComponent(symbols.join(","))}`,
  );
}
