export const MARKET_TICKERS = [
  { symbol: "S&P 500", change: "+0.42%" },
  { symbol: "NASDAQ", change: "+0.67%" },
  { symbol: "BTC", change: "-1.21%" },
  { symbol: "US10Y", change: "+0.08%" },
];

export const ANALYSIS_LOADING_STEPS = [
  {
    label: "Parsing query",
    detail: "Normalizing company name, ticker candidates, and analysis scope.",
  },
  {
    label: "Collecting market data",
    detail: "Pulling price action, profitability, and growth context into the canvas.",
  },
  {
    label: "Reading signals",
    detail: "Scanning recent headlines, margin quality, and operating leverage.",
  },
  {
    label: "Building the case",
    detail: "Weighing strength, risk, and scenario pressure points.",
  },
  {
    label: "Writing verdict",
    detail: "Compressing the evidence into a final institutional summary.",
  },
] as const;

export const QUERY_ALIASES: Record<string, string> = {
  apple: "AAPL",
  aapl: "AAPL",
  microsoft: "MSFT",
  msft: "MSFT",
  nvidia: "NVDA",
  nvda: "NVDA",
};

export function resolveFallbackTicker(query: string) {
  const normalized = query.trim().toLowerCase();
  return QUERY_ALIASES[normalized] ?? "AAPL";
}
