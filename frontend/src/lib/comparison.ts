import type { BackendFinancialsResponse, ComparisonMetric } from "./api";
import { format } from "./research";
export const metricLabels: Record<string, string> = { marketCap: "Market cap", forwardPE: "Forward P/E", trailingPE: "Trailing P/E", evEbitda: "EV/EBITDA", evSales: "EV/Sales", priceSales: "Price/Sales (TTM)", priceBook: "Price/Book", fcfYield: "FCF yield (FY)", revenueGrowth: "Revenue growth", revenueCagr: "Revenue CAGR (3Y)", epsGrowth: "EPS growth", ebitdaGrowth: "EBITDA growth", fcfGrowth: "FCF growth", grossMargin: "Gross margin", ebitdaMargin: "EBITDA margin", operatingMargin: "Operating margin", netMargin: "Net margin", fcfMargin: "FCF margin", revenue: "Revenue", ebitda: "EBITDA", operatingIncome: "Operating income", netIncome: "Net income", freeCashFlow: "Free cash flow", cash: "Cash", debt: "Debt", netDebt: "Net debt", totalAssets: "Assets", equity: "Equity", eps: "EPS", operatingCashFlow: "Operating cash flow", capex: "Capital expenditure", grossProfit: "Gross profit", netDebtEbitda: "Net debt / EBITDA" };
export const categories: Record<string, string[]> = {
  Overview: ["marketCap", "revenueGrowth", "netMargin", "forwardPE", "evEbitda"],
  Valuation: ["forwardPE", "trailingPE", "evEbitda", "evSales", "priceSales", "priceBook", "fcfYield"],
  Growth: ["revenueGrowth", "revenueCagr", "epsGrowth", "ebitdaGrowth", "fcfGrowth"],
  Profitability: ["grossMargin", "ebitdaMargin", "operatingMargin", "netMargin", "fcfMargin"],
  Financials: ["revenue", "ebitda", "operatingIncome", "netIncome", "freeCashFlow", "cash", "debt", "netDebt"],
};
export function parseSymbols(raw: string) { return [...new Set(raw.toUpperCase().split(",").map((s) => s.trim()).filter((s) => /^[A-Z0-9][A-Z0-9.:-]{0,19}$/.test(s)))].slice(0, 6); }
export function comparisonUrl(symbols: string[]) { return `/compare?symbols=${encodeURIComponent(parseSymbols(symbols.join(",")).join(","))}`; }
export function median(values: Array<number | null | undefined>) { const sorted = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v)).sort((a,b) => a-b); const n=sorted.length; return { count: n, value: n ? (sorted[Math.floor((n-1)/2)] + sorted[Math.floor(n/2)])/2 : null }; }
export function compatible(a?: ComparisonMetric, b?: ComparisonMetric) {
  if (!a || !b || a.basis !== b.basis || a.unit !== b.unit) return false;
  if ((a.unit === "money" || a.unit === "number") && (!a.currency || a.currency !== b.currency)) return false;
  return (a.period?.slice(0,4) ?? null) === (b.period?.slice(0,4) ?? null);
}
export function benchmark(base: BackendFinancialsResponse | undefined, peers: BackendFinancialsResponse[], key: string) {
  const anchor = base?.comparisonMetrics?.[key];
  return median(peers.map((p) => compatible(anchor, p.comparisonMetrics?.[key]) ? p.comparisonMetrics?.[key]?.value : null));
}
export function metricText(point?: ComparisonMetric) { return point?.value == null ? "—" : format(point.value, point.unit, point.currency || "USD") + (point.unit === "money" && point.currency ? ` ${point.currency}` : ""); }
export function difference(point: ComparisonMetric | undefined, medianValue: number | null) {
  if (point?.value == null || medianValue == null) return "—";
  const d = point.value - medianValue;
  if (point.unit === "percent") return `${d > 0 ? "+" : ""}${d.toFixed(1)} pp`;
  if (point.unit === "multiple" && medianValue > 0) return `${d > 0 ? "+" : ""}${(d/medianValue*100).toFixed(1)}%`;
  return `${d > 0 ? "+" : ""}${format(d, point.unit, point.currency || "USD")}`;
}
export const companyColors = ["#7fc9bb", "#c9b784", "#8eabd0", "#b6a0c9", "#c79991", "#a8b98d"];
