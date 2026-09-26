"use client";
import { useMemo, useState } from "react";
import { FinancialDocuments } from "./financial-documents";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import type {
  BackendFinancialsResponse,
  BackendFinancialStatement,
} from "@/lib/api";
import { StyledSelect } from "./styled-select";

type Row = Record<string, string | number | null>;
type Series = { key: string; label: string; color: string };
const colors = ["#b4e45d", "#63baca", "#c0a4ee"];
function num(
  row: Record<string, unknown> | undefined,
  ...keys: string[]
): number | null {
  for (const key of keys) {
    const v = row?.[key];
    if (v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v)))
      return Number(v);
  }
  return null;
}
function compact(v: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(v);
}
function rows(input: BackendFinancialStatement[] | undefined, period: string) {
  return [...(input || [])]
    .filter(
      (r) =>
        period === "All periods" ||
        (period === "Annual"
          ? r.period === "FY"
          : /^Q[1-4]$/.test(r.period || "")),
    )
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .slice(-10);
}
function label(r: BackendFinancialStatement) {
  return `${r.fiscalYear || r.calendarYear || r.date?.slice(0, 4) || "Undated"} ${r.period || ""}`.trim();
}
function ChartPanel({
  title,
  description,
  data,
  series,
  unit,
  source,
  line = false,
}: {
  title: string;
  description: string;
  data: Row[];
  series: Series[];
  unit: string;
  source?: string;
  line?: boolean;
}) {
  const available = data.some((row) =>
    series.some((s) => typeof row[s.key] === "number"),
  );
  const Chart = line ? LineChart : BarChart;
  return (
    <section className="financial-chart-panel">
      <div className="financial-chart-heading">
        <h3>{title}</h3>
        <span>{unit}</span>
      </div>
      <p>{description}</p>
      {available ? (
        <>
          <div className="financial-chart">
            <ResponsiveContainer width="100%" height="100%">
              <Chart
                data={data}
                margin={{ top: 12, right: 12, bottom: 4, left: 0 }}
              >
                <CartesianGrid stroke="#303b30" vertical={false} />
                <XAxis
                  dataKey="period"
                  stroke="#aab5a4"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  stroke="#aab5a4"
                  tickLine={false}
                  axisLine={false}
                  width={55}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => (unit === "%" ? `${v}%` : compact(v))}
                />
                <Tooltip
                  contentStyle={{
                    background: "#20291f",
                    border: "1px solid #59694d",
                    borderRadius: 6,
                    color: "#f3f7ed",
                  }}
                  formatter={(v: number) => [
                    `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v)} ${unit}`,
                  ]}
                  labelStyle={{ color: "#f3f7ed" }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                <ReferenceLine y={0} stroke="#63705b" />
                {series.map((s) =>
                  line ? (
                    <Line
                      key={s.key}
                      name={s.label}
                      dataKey={s.key}
                      stroke={s.color}
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  ) : (
                    <Bar
                      key={s.key}
                      name={s.label}
                      dataKey={s.key}
                      fill={s.color}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={35}
                      isAnimationActive={false}
                    />
                  ),
                )}
              </Chart>
            </ResponsiveContainer>
          </div>
          <details className="financial-data-table">
            <summary>View reported values</summary>
            <div>
              <table>
                <thead>
                  <tr>
                    <th>Period end</th>
                    {series.map((s) => (
                      <th key={s.key}>{s.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((r, i) => (
                    <tr key={i}>
                      <th>{r.date || r.period}</th>
                      {series.map((s) => (
                        <td key={s.key}>
                          {r[s.key] === null
                            ? "—"
                            : new Intl.NumberFormat("en-US", {
                                maximumFractionDigits: 2,
                              }).format(Number(r[s.key]))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <div className="empty-state">
          No reported data available for this period.
        </div>
      )}
      <div className="financial-source">
        Source: {source || "Not supplied"} · Missing values shown as —
      </div>
    </section>
  );
}
export function CompanyFinancials({
  financials,
  symbol,
}: {
  financials?: BackendFinancialsResponse;
  symbol: string;
}) {
  const all = [
    ...(financials?.financials?.income_statement || []),
    ...(financials?.financials?.balance_sheet || []),
    ...(financials?.financials?.cash_flow || []),
  ];
  const annual = all.some((r) => r.period === "FY");
  const quarterly = all.some((r) => /^Q[1-4]$/.test(r.period || ""));
  const [choice, setChoice] = useState("Annual");
  const period = choice === "Annual" && !annual ? "All periods" : choice;
  const data = useMemo(() => {
    const income = rows(financials?.financials?.income_statement, period).map(
      (r) => {
        const revenue = num(r, "revenue", "totalRevenue");
        const net = num(r, "netIncome");
        const operating = num(r, "operatingIncome", "incomeFromOperations");
        const gross = num(r, "grossProfit");
        return {
          date: r.date || "",
          period: label(r),
          revenue,
          net,
          eps: num(r, "epsDiluted", "eps"),
          grossMargin:
            revenue && gross !== null ? (gross / revenue) * 100 : null,
          operatingMargin:
            revenue && operating !== null ? (operating / revenue) * 100 : null,
          netMargin: revenue && net !== null ? (net / revenue) * 100 : null,
        };
      },
    );
    const balance = rows(financials?.financials?.balance_sheet, period).map(
      (r) => ({
        date: r.date || "",
        period: label(r),
        assets: num(r, "totalAssets"),
        liabilities: num(r, "totalLiabilities"),
        equity: num(
          r,
          "totalStockholdersEquity",
          "totalShareholderEquity",
          "totalEquity",
        ),
        cash: num(r, "cashAndCashEquivalents"),
        debt: num(r, "totalDebt"),
      }),
    );
    const cash = rows(financials?.financials?.cash_flow, period).map((r) => ({
      date: r.date || "",
      period: label(r),
      operating: num(
        r,
        "operatingCashFlow",
        "netCashProvidedByOperatingActivities",
      ),
      free: num(r, "freeCashFlow"),
      capex: num(
        r,
        "capitalExpenditure",
        "investmentsInPropertyPlantAndEquipment",
      ),
    }));
    return { income, balance, cash };
  }, [financials, period]);
  const currency =
    all.find((r) => r.reportedCurrency)?.reportedCurrency ||
    financials?.info?.currency ||
    "Reporting currency";
  const mixed =
    new Set(all.map((r) => r.reportedCurrency).filter(Boolean)).size > 1;
  const sources = financials?.sources;
  const quote = financials?.quote;
  const info = financials?.info;
  const facts = [
    ["Open", num(quote, "o")],
    ["Previous close", num(quote, "pc")],
    ["Day high", num(quote, "h")],
    ["Day low", num(quote, "l")],
    ["Trailing P/E", num(info, "trailingPE")],
    ["Forward P/E", num(info, "forwardPE")],
    ["Price / book", num(info, "priceToBook")],
    ["Beta", num(info, "beta")],
  ] as const;
  const series = (keys: string[], labels: string[]) =>
    keys.map((key, i) => ({ key, label: labels[i], color: colors[i] }));
  return (
    <div className="company-financials" id="company-financials">
      <section className="ticker-facts">
        <div className="section-heading">
          <h2>Market snapshot</h2>
          <span>Latest available quote & ratios</span>
        </div>
        <dl>
          {facts.map(([name, value]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>
                {value === null
                  ? "—"
                  : value.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="financials-heading">
        <div>
          <div className="eyebrow">THE BUSINESS BEHIND {symbol}</div>
          <h2>Financial performance</h2>
          <p>Reported results, from revenue to cash generation.</p>
        </div>
        <StyledSelect ariaLabel="Financial reporting period" value={period} onChange={setChoice} options={[
          ...(annual ? [{ value: "Annual", label: "Annual" }] : []),
          ...(quarterly ? [{ value: "Quarterly", label: "Quarterly" }] : []),
          { value: "All periods", label: "All periods" },
        ]} />
      </div>
      {mixed ? (
        <p className="inline-notice">
          Statements use different currencies. Review the original financial
          statements before comparing periods.
        </p>
      ) : (
        <div className="financial-charts-grid">
          <ChartPanel
            title="Revenue & net income"
            description="Top-line scale and bottom-line profit."
            data={data.income}
            series={series(["revenue", "net"], ["Revenue", "Net income"])}
            unit={currency}
            source={sources?.income_statement}
          />
          <ChartPanel
            title="Profitability"
            description="Gross, operating and net income as a percentage of revenue."
            data={data.income}
            series={series(
              ["grossMargin", "operatingMargin", "netMargin"],
              ["Gross margin", "Operating margin", "Net margin"],
            )}
            unit="%"
            line
            source={sources?.income_statement}
          />
          <ChartPanel
            title="Earnings per share"
            description="Diluted EPS where reported; basic EPS otherwise."
            data={data.income}
            series={series(["eps"], ["EPS"])}
            unit={`${currency} / share`}
            line
            source={sources?.income_statement}
          />
          <ChartPanel
            title="Cash generation"
            description="Operating cash flow, free cash flow and signed capital expenditure."
            data={data.cash}
            series={series(
              ["operating", "free", "capex"],
              ["Operating cash flow", "Free cash flow", "Capex"],
            )}
            unit={currency}
            source={sources?.cash_flow}
          />
          <ChartPanel
            title="Balance sheet"
            description="Assets, liabilities and shareholders’ equity at period end."
            data={data.balance}
            series={series(
              ["assets", "liabilities", "equity"],
              ["Assets", "Liabilities", "Equity"],
            )}
            unit={currency}
            source={sources?.balance_sheet}
          />
          <ChartPanel
            title="Cash & debt"
            description="Cash equivalents against total reported debt."
            data={data.balance}
            series={series(["cash", "debt"], ["Cash", "Total debt"])}
            unit={currency}
            source={sources?.balance_sheet}
          />
        </div>
      )}
      <FinancialDocuments rows={all} issuer={symbol} />
      <a
        className="financial-detail-link"
        href={`/financials/${encodeURIComponent(symbol)}`}
      >
        Explore full statements and financial interpretation ↗
      </a>
    </div>
  );
}
