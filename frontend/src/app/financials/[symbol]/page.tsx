import Link from "next/link";
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
      const value = keys
        .map((key) => toNumber(row[key]))
        .find((entry) => entry != null) ?? null;

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
    <section className="border border-white/8 bg-[#0F141C] p-5">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-[11px] uppercase tracking-[0.24em] text-[#9CA3AF]">{title}</h2>
        <span className="text-[11px] uppercase tracking-[0.22em] text-[#6B7280]">
          Backend data
        </span>
      </div>

      {points.length > 0 ? (
        <div className="grid min-h-[320px] grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {points.map((point) => (
            <div key={point.label} className="flex flex-col justify-end gap-3">
              <div className="flex min-h-[240px] items-end rounded-[24px] border border-white/8 bg-[#121821] p-3">
                <div
                  className="w-full rounded-[18px] bg-[linear-gradient(180deg,rgba(34,197,94,0.95),rgba(21,128,61,0.7))]"
                  style={{ height: `${Math.max((point.value / max) * 100, 10)}%` }}
                />
              </div>
              <div>
                <p className="text-sm tabular-nums text-[#E5E7EB]">{formatCurrency(point.value)}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#6B7280]">
                  {point.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex min-h-[320px] items-center justify-center rounded-[24px] border border-dashed border-white/8 bg-[#121821] text-sm text-[#6B7280]">
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
    <section className="border border-white/8 bg-[#0F141C] p-5">
      <h2 className="text-[11px] uppercase tracking-[0.24em] text-[#9CA3AF]">{title}</h2>
      {Array.isArray(rows) && rows.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.2em] text-[#6B7280]">
                <th className="border-b border-white/8 px-0 py-3 pr-6">Period</th>
                <th className="border-b border-white/8 px-0 py-3 pr-6">Revenue</th>
                <th className="border-b border-white/8 px-0 py-3 pr-6">Net Income</th>
                <th className="border-b border-white/8 px-0 py-3 pr-6">Operating Income</th>
                <th className="border-b border-white/8 px-0 py-3">EPS</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 6).map((row, index) => (
                <tr key={`${title}-${statementLabel(row, index)}`} className="text-sm text-[#D1D5DB]">
                  <td className="border-b border-white/6 py-3 pr-6">{statementLabel(row, index)}</td>
                  <td className="border-b border-white/6 py-3 pr-6">
                    {formatCurrency(toNumber(row.revenue) ?? toNumber(row.totalRevenue))}
                  </td>
                  <td className="border-b border-white/6 py-3 pr-6">
                    {formatCurrency(toNumber(row.netIncome))}
                  </td>
                  <td className="border-b border-white/6 py-3 pr-6">
                    {formatCurrency(toNumber(row.operatingIncome) ?? toNumber(row.incomeFromOperations))}
                  </td>
                  <td className="border-b border-white/6 py-3">{toNumber(row.eps) ?? "Data missing"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-sm text-[#6B7280]">Data is missing.</p>
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

  return (
    <section className="border border-white/8 bg-[#0F141C] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[11px] uppercase tracking-[0.24em] text-[#9CA3AF]">Data Availability</h2>
          <p className="mt-3 max-w-[760px] text-sm leading-6 text-[#9CA3AF]">
            {hasStatements
              ? "The backend returned statement history and market/profile data."
              : "The backend returned market/profile data, but no statement history. This usually means the upstream statements provider failed or returned nothing."}
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.22em] ${
            hasStatements
              ? "border-[#22C55E]/20 bg-[#22C55E]/10 text-[#22C55E]"
              : "border-[#F59E0B]/20 bg-[#F59E0B]/10 text-[#F59E0B]"
          }`}
        >
          {hasStatements ? "Statements loaded" : "Statements missing"}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {sources.length > 0 ? (
          sources.map(([key, value]) => (
            <span
              key={key}
              className="rounded-full border border-white/8 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#D1D5DB]"
            >
              {key}: {value}
            </span>
          ))
        ) : (
          <span className="text-sm text-[#6B7280]">No backend sources reported.</span>
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
    <section className="border border-white/8 bg-[#0F141C] p-5">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-[11px] uppercase tracking-[0.24em] text-[#9CA3AF]">Analyst Snapshot</h2>
        <span className="text-[11px] uppercase tracking-[0.22em] text-[#6B7280]">Backend data</span>
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
            <div key={item.label} className="border border-white/8 bg-[#121821] p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#6B7280]">{item.label}</p>
              <p className="mt-3 text-3xl font-medium text-[#E5E7EB]">{String(item.value ?? 0)}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[#6B7280]">Analyst recommendation data is missing.</p>
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

export default async function FinancialsPage({ params }: FinancialsPageProps) {
  const { symbol } = await params;
  const ticker = symbol.toUpperCase();
  const data = await loadFinancials(ticker);
  const incomeRows = data?.financials?.income_statement;
  const revenueSeries = extractSeries(incomeRows, ["revenue", "totalRevenue"]);
  const netIncomeSeries = extractSeries(incomeRows, ["netIncome"]);
  const companyName = data?.info?.shortName || ticker;
  const normalizedMarketCap = normalizeMarketCap(data?.info?.marketCap ?? data?.quote?.marketCap);

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_38%),linear-gradient(180deg,rgba(12,16,22,0.92),rgba(11,15,20,1))]" />
      <div className="terminal-grid pointer-events-none absolute inset-0 opacity-40" />

      <MarketlyNavbar />

      <main className="relative mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 pb-16 pt-[84px] sm:px-6 lg:px-10">
        <section className="mx-auto w-full max-w-[1180px]">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/8 pb-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[#9CA3AF]">Financial Deep Dive</p>
              <h1 className="mt-3 text-4xl font-medium tracking-[-0.04em] text-[#E5E7EB]">
                {companyName}
              </h1>
              <p className="mt-3 max-w-[720px] text-sm leading-6 text-[#9CA3AF]">
                Full backend financial view for {ticker}, with reported history and statement slices.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/"
                className="rounded-full border border-white/10 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-[#E5E7EB] transition-colors hover:bg-white/[0.04]"
              >
                Back To Analysis
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
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
                value: data?.info?.trailingPE != null ? data.info.trailingPE.toFixed(2) : "Data missing",
              },
            ].map((item) => (
              <div key={item.label} className="border border-white/8 bg-[#0F141C] p-5">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#9CA3AF]">{item.label}</p>
                <p className="mt-3 text-3xl font-medium tracking-[-0.03em] text-[#E5E7EB]">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-4">
            {[
              {
                label: "Gross Margin",
                value: formatPercent(data?.info?.grossMargin),
              },
              {
                label: "ROE",
                value: formatPercent(data?.info?.roe),
              },
              {
                label: "Price To Book",
                value: data?.info?.priceToBook != null ? data.info.priceToBook.toFixed(2) : "Data missing",
              },
              {
                label: "Country / Currency",
                value:
                  data?.info?.country && data?.info?.currency
                    ? `${data.info.country} / ${data.info.currency}`
                    : "Data missing",
              },
            ].map((item) => (
              <div key={item.label} className="border border-white/8 bg-[#0F141C] p-5">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#9CA3AF]">{item.label}</p>
                <p className="mt-3 text-xl font-medium tracking-[-0.02em] text-[#E5E7EB]">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-6">
            <DataAvailability data={data} />
            <AnalystSummary data={data} />
            <BigChart title="Reported Revenue" points={revenueSeries} />
            <BigChart title="Net Income" points={netIncomeSeries} />
            <StatementTable title="Income Statement" rows={incomeRows} />
          </div>
        </section>
      </main>
    </div>
  );
}
