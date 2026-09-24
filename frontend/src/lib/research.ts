import type {
  BackendFinancialsResponse,
  BackendNewsItem,
  BackendScoreResponse,
} from "./api";

export type Company = { symbol: string; name: string; type?: string };
export type SavedResearch = {
  id: string;
  symbol: string;
  name: string;
  savedAt: string;
  financials: BackendFinancialsResponse;
  analysis?: BackendScoreResponse;
  news: BackendNewsItem[];
};
export type PriceAlert = {
  id: string;
  symbol: string;
  direction: "above" | "below";
  price: number;
};
export const STARTER_COMPANIES: Company[] = [
  { symbol: "AAPL", name: "Apple" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "GOOGL", name: "Alphabet" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "META", name: "Meta Platforms" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "AMD", name: "Advanced Micro Devices" },
  { symbol: "TTWO", name: "Take-Two Interactive" },
  { symbol: "JPM", name: "JPMorgan Chase" },
];
export function safeUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return;
  }
}
export function number(value: unknown): number | null {
  if (value == null || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}
export function format(
  value: unknown,
  style: "money" | "number" | "percent" | "multiple" = "number",
  currency = "USD",
) {
  const n = number(value);
  if (n == null) return "—";
  if (style === "percent") return `${n.toFixed(1)}%`;
  if (style === "multiple") return `${n.toFixed(1)}×`;
  const options: Intl.NumberFormatOptions = { maximumFractionDigits: 2 };
  if (style === "money") {
    options.style = "currency";
    options.currency = /^[A-Z]{3}$/.test(currency) ? currency : "USD";
  }
  if (Math.abs(n) >= 1e6) {
    options.notation = "compact";
    options.maximumFractionDigits = 2;
  }
  return new Intl.NumberFormat("en-US", options).format(n);
}
export function metrics(data?: BackendFinancialsResponse) {
  const info = data?.info;
  const income = data?.financials?.income_statement?.[0];
  const revenue = number(income?.revenue ?? income?.totalRevenue);
  const netIncome = number(income?.netIncome);
  return {
    price: number(data?.quote?.c ?? data?.quote?.currentPrice),
    change: number(data?.quote?.dp),
    marketCap: number(info?.marketCap ?? data?.quote?.marketCap),
    pe: number(info?.trailingPE),
    revenue,
    margin: revenue && netIncome != null ? (netIncome / revenue) * 100 : null,
    period: income?.date ?? income?.calendarYear ?? "Period unavailable",
    currency: info?.currency ?? "USD",
  };
}
export async function discovery<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  const base = (process.env.NEXT_PUBLIC_API_URL || "/api/backend").replace(
    /\/$/,
    "",
  );
  const timeout = AbortSignal.timeout(12000);
  const res = await fetch(`${base}/discovery/${path}`, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!res.ok) throw new Error("Discovery unavailable");
  return res.json();
}
export function peerMean(values: Array<number | null>) {
  const available = values.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  return {
    value: available.length
      ? available.reduce((sum, value) => sum + value, 0) / available.length
      : null,
    count: available.length,
  };
}
