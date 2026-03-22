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
  [key: string]: unknown;
};

export type BackendFollowUpResponse = {
  symbol: string;
  answer: string;
};

export type BackendScoreResponse = {
  symbol: string;
  score?: number | null;
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
};

function getBaseUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "/api/backend";
  return baseUrl.replace(/\/$/, "");
}

async function requestJson<T>(path: string): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export async function getFinancials(symbol: string): Promise<BackendFinancialsResponse> {
  return requestJson<BackendFinancialsResponse>(`/financials/${encodeURIComponent(symbol)}`);
}

export async function getCompanyNews(symbol: string): Promise<BackendNewsItem[]> {
  return requestJson<BackendNewsItem[]>(`/news/${encodeURIComponent(symbol)}`);
}

export async function getTickerScore(symbol: string): Promise<BackendScoreResponse> {
  return requestJson<BackendScoreResponse>(`/score/${encodeURIComponent(symbol)}`);
}

export async function postFollowUp(symbol: string, question: string): Promise<BackendFollowUpResponse> {
  const res = await fetch(`${getBaseUrl()}/assistant/follow-up`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      symbol,
      question,
    }),
  });

  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }

  return res.json() as Promise<BackendFollowUpResponse>;
}
