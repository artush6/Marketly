import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Building2, Database, Radar } from "lucide-react";
import { MarketlyNavbar } from "@/components/marketly";
import {
  getFinancials,
  type BackendFinancialStatement,
  type BackendFinancialsResponse,
} from "@/lib/api";

type FinancialsPageProps = {
  params: Promise<{
    symbol: string;
  }>;
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

function formatCurrency(value: number | null | undefined) {
  if (value == null) {
    return "Data missing";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function normalizeMarketCap(value: number | null | undefined) {
  if (value == null) {
    return null;
  }

  return value < 10_000_000 ? value * 1_000_000 : value;
}

function formatPercent(value: number | null | undefined) {
  if (value == null) {
    return "Data missing";
  }

  return `${value.toFixed(2)}%`;
}

function statementLabel(row: BackendFinancialStatement, index: number) {
  const date = typeof row.date === "string" ? row.date : "";
  const year = typeof row.calendarYear === "string" ? row.calendarYear : date.slice(0, 4);
  const period = typeof row.period === "string" ? row.period : "";

  if (period && year) {
    return `${period} '${year.slice(-2)}`;
  }

  return year || `P${index + 1}`;
}

function extractSeries(
  rows: BackendFinancialStatement[] | undefined,
  keys: string[],
) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return [...rows]
    .reverse()
    .map((row, index) => {
      const value =
        keys.map((key) => toNumber(row[key])).find((entry) => entry != null) ?? null;

      if (value == null) {
        return null;
      }

      return {
        label: statementLabel(row, index),
        value,
      };
    })
    .filter((item): item is { label: string; value: number } => item !== null)
    .slice(-6);
}

function BigChart({
  title,
  points,
}: {
  title: string;
  points: { label: string; value: number }[];
}) {
  const max = Math.max(...points.map((point) => point.value), 1);

  return (
    <section className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(12,19,29,0.96),rgba(8,12,18,0.96))] p-5">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-[11px] uppercase tracking-[0.24em] text-[#9FB3C8]">{title}</h2>
        <span className="text-[11px] uppercase tracking-[0.22em] text-[#6F8197]">
          Backend data
        </span>
      </div>

      {points.length > 0 ? (
        <div className="grid min-h-[320px] grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {points.map((point) => (
            <div key={point.label} className="flex flex-col justify-end gap-3">
              <div className="flex min-h-[240px] items-end rounded-[24px] border border-white/8 bg-[#121821] p-3">
                <div
                  className="w-full rounded-[18px] bg-[linear-gradient(180deg,rgba(61,217,179,0.95),rgba(17,109,93,0.72))]"
                  style={{ height: `${Math.max((point.value / max) * 100, 10)}%` }}
                />
              </div>
              <div>
                <p className="text-sm tabular-nums text-[#F3F7FB]">{formatCurrency(point.value)}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#6F8197]">
                  {point.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex min-h-[320px] items-center justify-center rounded-[24px] border border-dashed border-white/8 bg-[#121821] text-sm text-[#6F8197]">
          Data is missing.
        </div>
      )}
    </section>
  );
}

function StatementTable({
  title,
  rows,
}: {
  title: string;
  rows: BackendFinancialStatement[] | undefined;
}) {
  return (
    <section className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(12,19,29,0.96),rgba(8,12,18,0.96))] p-5">
      <h2 className="text-[11px] uppercase tracking-[0.24em] text-[#9FB3C8]">{title}</h2>
      {Array.isArray(rows) && rows.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.2em] text-[#6F8197]">
                <th className="border-b border-white/8 px-0 py-3 pr-6">Period</th>
                <th className="border-b border-white/8 px-0 py-3 pr-6">Revenue</th>
                <th className="border-b border-white/8 px-0 py-3 pr-6">Net Income</th>
                <th className="border-b border-white/8 px-0 py-3 pr-6">Operating Income</th>
                <th className="border-b border-white/8 px-0 py-3">EPS</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 6).map((row, index) => (
                <tr key={`${title}-${statementLabel(row, index)}`} className="text-sm text-[#DDE7F0]">
                  <td className="border-b border-white/6 py-3 pr-6">{statementLabel(row, index)}</td>
                  <td className="border-b border-white/6 py-3 pr-6">
                    {formatCurrency(toNumber(row.revenue) ?? toNumber(row.totalRevenue))}
                  </td>
                  <td className="border-b border-white/6 py-3 pr-6">
                    {formatCurrency(toNumber(row.netIncome))}
                  </td>
                  <td className="border-b border-white/6 py-3 pr-6">
                    {formatCurrency(
                      toNumber(row.operatingIncome) ?? toNumber(row.incomeFromOperations),
                    )}
                  </td>
                  <td className="border-b border-white/6 py-3">{toNumber(row.eps) ?? "Data missing"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-sm text-[#6F8197]">Data is missing.</p>
      )}
    </section>
  );
}

function DataAvailability({
  data,
}: {
  data: BackendFinancialsResponse | null;
}) {
  const hasStatements = Object.keys(data?.financials ?? {}).length > 0;
  const sources = Object.entries(data?.sources ?? {});
  const collections = [
    {
      label: "Income statement",
      count: data?.financials?.income_statement?.length ?? 0,
    },
    {
      label: "Balance sheet",
      count: data?.financials?.balance_sheet?.length ?? 0,
    },
    {
      label: "Cash flow",
      count: data?.financials?.cash_flow?.length ?? 0,
    },
  ];

  return (
    <section className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(12,19,29,0.96),rgba(8,12,18,0.96))] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[11px] uppercase tracking-[0.24em] text-[#9FB3C8]">Data Availability</h2>
          <p className="mt-3 max-w-[760px] text-sm leading-6 text-[#8EA0B8]">
            {hasStatements
              ? "Backend providers returned statement history, quote data, and profile context for this company."
              : "The backend returned market/profile data, but no statement history. This usually means an upstream statements provider failed or returned nothing."}
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.22em] ${
            hasStatements
              ? "border-[#3DD9B3]/20 bg-[#3DD9B3]/10 text-[#9CEBD8]"
              : "border-[#F3C969]/20 bg-[#F3C969]/10 text-[#F3C969]"
          }`}
        >
          {hasStatements ? "Statements loaded" : "Statements missing"}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {collections.map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#6F8197]">{item.label}</p>
            <p className="mt-2 text-2xl font-medium tracking-[-0.04em] text-[#F3F7FB]">{item.count}</p>
            <p className="mt-2 text-sm text-[#8EA0B8]">Rows available from the backend feed.</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {sources.length > 0 ? (
          sources.map(([key, value]) => (
            <span
              key={key}
              className="rounded-full border border-white/8 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#DDE7F0]"
            >
              {key}: {value}
            </span>
          ))
        ) : (
          <span className="text-sm text-[#6F8197]">No backend sources reported.</span>
        )}
      </div>
    </section>
  );
}

function AnalystSummary({
  data,
}: {
  data: BackendFinancialsResponse | null;
}) {
  const latest = Array.isArray(data?.analyst_data) ? data.analyst_data[0] : null;

  return (
    <section className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(12,19,29,0.96),rgba(8,12,18,0.96))] p-5">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-[11px] uppercase tracking-[0.24em] text-[#9FB3C8]">Analyst Snapshot</h2>
        <span className="text-[11px] uppercase tracking-[0.22em] text-[#6F8197]">Backend data</span>
      </div>

      {latest ? (
        <div className="grid gap-4 md:grid-cols-5">
          {[
            { label: "Strong Buy", value: latest.strongBuy },
            { label: "Buy", value: latest.buy },
            { label: "Hold", value: latest.hold },
            { label: "Sell", value: latest.sell },
            { label: "Strong Sell", value: latest.strongSell },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/8 bg-[#121821] p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#6F8197]">{item.label}</p>
              <p className="mt-3 text-3xl font-medium text-[#F3F7FB]">{String(item.value ?? 0)}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[#6F8197]">Analyst recommendation data is missing.</p>
      )}
    </section>
  );
}

async function loadFinancials(symbol: string): Promise<BackendFinancialsResponse | null> {
  try {
    return await getFinancials(symbol);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: FinancialsPageProps): Promise<Metadata> {
  const { symbol } = await params;
  const ticker = symbol.toUpperCase();

  return {
    title: `${ticker} Financials`,
    description: `Statement history, quote context, and backend provider coverage for ${ticker}.`,
  };
}

export default async function FinancialsPage({ params }: FinancialsPageProps) {
  const { symbol } = await params;
  const ticker = symbol.toUpperCase();

  if (!/^[A-Z]{1,5}$/.test(ticker)) {
    notFound();
  }

  const data = await loadFinancials(ticker);
  const incomeRows = data?.financials?.income_statement;
  const revenueSeries = extractSeries(incomeRows, ["revenue", "totalRevenue"]);
  const netIncomeSeries = extractSeries(incomeRows, ["netIncome"]);
  const companyName = data?.info?.shortName || ticker;
  const normalizedMarketCap = normalizeMarketCap(
    data?.info?.marketCap ?? data?.quote?.marketCap,
  );

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(61,217,179,0.08),transparent_38%),linear-gradient(180deg,rgba(10,16,24,0.12),rgba(5,9,14,0.18))]" />
      <div className="terminal-grid pointer-events-none absolute inset-0 opacity-40" />

      <MarketlyNavbar currentSymbol={ticker} />

      <main className="relative mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 pb-16 pt-[92px] sm:px-6 lg:px-10">
        <section className="mx-auto w-full max-w-[1180px] space-y-6">
          <div className="overflow-hidden rounded-[34px] border border-white/8 bg-[linear-gradient(145deg,rgba(13,22,33,0.98),rgba(8,12,18,0.96))]">
            <div className="flex flex-wrap items-start justify-between gap-5 border-b border-white/8 px-6 py-6 sm:px-8">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#3DD9B3]/18 bg-[#3DD9B3]/10 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-[#9CEBD8]">
                  <Database className="h-3.5 w-3.5" />
                  Financial deep dive
                </div>
                <h1 className="mt-4 text-4xl font-medium tracking-[-0.05em] text-[#F3F7FB] sm:text-5xl">
                  {companyName}
                </h1>
                <p className="mt-3 max-w-[760px] text-sm leading-7 text-[#8EA0B8]">
                  Full backend view for {ticker}, with reported history, quote context, analyst distribution, and statement coverage.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-[#E7EEF5] transition-colors hover:bg-white/[0.04]"
                >
                  <ArrowLeft className="h-4 w-4 text-[#6F8197]" />
                  Back to analysis
                </Link>
                <Link
                  href={`/?q=${encodeURIComponent(`Analyze ${ticker}`)}`}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-[#E7EEF5] transition-colors hover:bg-white/[0.04]"
                >
                  <Radar className="h-4 w-4 text-[#3DD9B3]" />
                  Open in workspace
                  <ArrowUpRight className="h-4 w-4 text-[#6F8197]" />
                </Link>
              </div>
            </div>

            <div className="grid gap-4 px-6 py-6 sm:px-8 md:grid-cols-3">
              {[
                {
                  label: "Market Cap",
                  value: formatCurrency(normalizedMarketCap),
                },
                {
                  label: "Current Price",
                  value: formatCurrency(data?.quote?.currentPrice ?? data?.quote?.c),
                },
                {
                  label: "Trailing PE",
                  value:
                    data?.info?.trailingPE != null
                      ? data.info.trailingPE.toFixed(2)
                      : "Data missing",
                },
              ].map((item) => (
                <div key={item.label} className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-[#9FB3C8]">{item.label}</p>
                  <p className="mt-3 text-3xl font-medium tracking-[-0.03em] text-[#F3F7FB]">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {data ? (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                {[
                  {
                    label: "Gross Margin",
                    value: formatPercent(data.info?.grossMargin),
                  },
                  {
                    label: "ROE",
                    value: formatPercent(data.info?.roe),
                  },
                  {
                    label: "Price To Book",
                    value:
                      data.info?.priceToBook != null
                        ? data.info.priceToBook.toFixed(2)
                        : "Data missing",
                  },
                  {
                    label: "Country / Currency",
                    value:
                      data.info?.country && data.info?.currency
                        ? `${data.info.country} / ${data.info.currency}`
                        : "Data missing",
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-[24px] border border-white/8 bg-[#0B1118] p-5">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-[#9FB3C8]">{item.label}</p>
                    <p className="mt-3 text-xl font-medium tracking-[-0.02em] text-[#F3F7FB]">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-6">
                <DataAvailability data={data} />
                <AnalystSummary data={data} />
                <div className="grid gap-6 xl:grid-cols-2">
                  <BigChart title="Reported Revenue" points={revenueSeries} />
                  <BigChart title="Net Income" points={netIncomeSeries} />
                </div>
                <StatementTable title="Income Statement" rows={incomeRows} />
              </div>
            </>
          ) : (
            <section className="rounded-[30px] border border-dashed border-white/10 bg-[#0B1118] p-8 text-center">
              <div className="mx-auto max-w-[680px]">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#F3C969]/20 bg-[#F3C969]/10">
                  <Building2 className="h-6 w-6 text-[#F3C969]" />
                </div>
                <h2 className="mt-5 text-3xl font-medium tracking-[-0.04em] text-[#F3F7FB]">
                  Financials are unavailable right now
                </h2>
                <p className="mt-4 text-sm leading-7 text-[#8EA0B8]">
                  The backend did not return a usable financial payload for {ticker}. Try re-running the analysis workspace or switching to a different symbol while the provider recovers.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Link
                    href={`/?q=${encodeURIComponent(`Analyze ${ticker}`)}`}
                    className="rounded-full border border-white/10 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-[#E7EEF5] transition-colors hover:bg-white/[0.04]"
                  >
                    Retry in workspace
                  </Link>
                  <Link
                    href="/financials/AAPL"
                    className="rounded-full border border-white/10 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-[#E7EEF5] transition-colors hover:bg-white/[0.04]"
                  >
                    Open AAPL
                  </Link>
                </div>
              </div>
            </section>
          )}
        </section>
      </main>
    </div>
  );
}
