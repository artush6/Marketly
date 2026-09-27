"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FinancialTrends as TrendData, FinancialTrendPoint } from "@/lib/api";
import { safeUrl } from "@/lib/research";
import { StyledSelect } from "./styled-select";

const labels: Record<string, string> = {
  revenue: "Revenue", grossProfit: "Gross profit", operatingIncome: "Operating income",
  ebitda: "EBITDA", netIncome: "Net income", eps: "EPS (diluted where available)",
  dilutedShares: "Weighted average diluted shares", cash: "Cash & equivalents", totalAssets: "Total assets",
  debt: "Total debt", equity: "Equity", operatingCashFlow: "Operating cash flow", capex: "Capital expenditure",
  stockBasedCompensation: "Stock-based compensation", dividendsPaid: "Dividends paid", buybacks: "Share repurchases",
  acquisitions: "Acquisitions, net", debtRepayment: "Debt repayment", stockIssuance: "Share issuance",
  freeCashFlow: "Free cash flow", netDebt: "Net debt", grossMargin: "Gross margin",
  operatingMargin: "Operating margin", fcfMargin: "Free cash flow margin", fcfPayout: "FCF dividend payout",
};
const percent = (n: number | null | undefined) => n == null ? "—" : new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(n);
function display(point?: FinancialTrendPoint, compact = true) {
  if (point?.value == null) return "—";
  return point.unit === "ratio" ? percent(point.value) : new Intl.NumberFormat("en-US", { notation: compact ? "compact" : "standard", maximumFractionDigits: compact ? 2 : 8 }).format(point.value);
}

export function FinancialTrends({ data }: { data?: TrendData }) {
  const [frequency, setFrequency] = useState("annual");
  const [metric, setMetric] = useState("revenue");
  const [currencyChoice, setCurrencyChoice] = useState("");
  const [horizon, setHorizon] = useState("5");
  if (!data) return null;
  const frequencies = [...new Set(data.observations.map((o) => o.frequency))];
  const selectedFrequency = frequencies.includes(frequency as "annual" | "quarterly") ? frequency : frequencies[0];
  const currencies = [...new Set(data.observations.filter((o) => o.frequency === selectedFrequency).map((o) => o.currency || "Unknown"))];
  const currency = currencies.includes(currencyChoice) ? currencyChoice : currencies[0];
  const all = data.observations.filter((o) => o.frequency === selectedFrequency && (o.currency || "Unknown") === currency);
  const latest = all.at(-1);
  const cutoff = latest ? Number(latest.date.slice(0, 4)) - Number(horizon) : 0;
  const rows = all.filter((o) => Number(o.date.slice(0, 4)) >= cutoff);
  const point = latest?.metrics[metric];
  const chart = rows.map((o) => ({ label: `${o.date} ${o.period}`, value: o.metrics[metric]?.value == null ? null : o.metrics[metric].value! * (point?.unit === "ratio" ? 100 : 1) }));
  const hasValues = chart.some((o) => o.value != null);
  const sourceUrl = safeUrl(point?.sourceUrl);
  const availableRows = rows.filter((o) => o.metrics[metric]?.value != null);
  const first = availableRows[0];
  const span = first && latest ? Number(latest.date.slice(0,4)) - Number(first.date.slice(0,4)) : 0;
  const cagrReason = selectedFrequency === "quarterly" ? "CAGR requires annual observations" : point?.unit === "ratio" ? "CAGR is not meaningful for this ratio" : span < Number(horizon) ? `Only ${span} years of history available; ${horizon} years required` : point?.cagr[horizon] != null ? "Calculated from matching annual endpoints" : "Matching positive annual endpoints unavailable";

  return <section className="financial-trends" aria-labelledby="financial-trends-title">
    <div className="financials-heading">
      <div><div className="eyebrow">LONG-TERM FUNDAMENTALS</div><h2 id="financial-trends-title">Quality & capital allocation trends</h2><p>Compare like reporting periods and inspect the evidence behind each value.</p></div>
      <div className="trend-controls">
        <StyledSelect ariaLabel="Trend metric" value={metric} onChange={setMetric} options={Object.entries(labels).map(([value, label]) => ({ value, label }))} />
        {frequencies.length > 0 && <StyledSelect ariaLabel="Trend reporting frequency" value={selectedFrequency} onChange={setFrequency} options={frequencies.map((value) => ({ value, label: value === "annual" ? "Annual" : "Quarterly" }))} />}
        {currencies.length > 0 && <StyledSelect ariaLabel="Trend currency" value={currency} onChange={setCurrencyChoice} options={currencies.map((value) => ({ value, label: value }))} />}
        <StyledSelect ariaLabel="Trend history range" value={horizon} onChange={setHorizon} options={[3, 5, 10].map((n) => ({ value: String(n), label: `${n} years` }))} />
      </div>
    </div>
    <div className="research-snapshot-summary">
      <div><small>{labels[metric]}</small><strong>{display(point)}</strong><span>{latest ? `${latest.period} · ${latest.date} · ${point?.unit === "shares" ? "shares" : point?.unit === "ratio" ? "%" : currency}` : "No classified reporting periods"}</span></div>
      <div><small>Year-over-year change</small><strong>{percent(point?.yoyChange)}</strong><span>{point?.yoyBasePeriod ? `Compared with ${point.yoyBasePeriod}` : "Comparable prior period unavailable"}</span></div>
      <div><small>{horizon}-year CAGR</small><strong>{percent(point?.cagr[horizon])}</strong><span>{cagrReason}</span></div>
    </div>
    <p className="trend-coverage">{first && latest ? `${availableRows.length} observations · ${first.date} to ${latest.date} · ${horizon}-year requested range` : "No observations available"}</p>
    {hasValues ? <div className="financial-chart" role="img" aria-label={`${labels[metric]} history; exact values available in the table below`}>
      <ResponsiveContainer width="100%" height="100%"><LineChart data={chart} margin={{ top: 12, right: 20, bottom: 8, left: 0 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--chart-axis)" minTickGap={45} />
        <YAxis width={64} stroke="var(--chart-axis)" tickFormatter={(n) => point?.unit === "ratio" ? `${n}%` : new Intl.NumberFormat("en-US", { notation: "compact" }).format(n)} />
        <Tooltip contentStyle={{ background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", color: "var(--chart-tooltip-text)" }} formatter={(n: number) => [new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n), labels[metric]]} />
        <Line dataKey="value" stroke="var(--chart-primary)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
      </LineChart></ResponsiveContainer>
    </div> : <p className="empty-state">No reported {labels[metric].toLowerCase()} data for these periods.</p>}
    <details className="financial-data-table">
      <summary>Values, sources & calculation methodology</summary>
      <p>{point?.methodology || "Reported provider value. Cash flow signs are preserved as supplied."}</p>
      <div className="trend-table-scroll"><table><thead><tr><th>Period</th><th>Value</th><th>YoY</th><th>Evidence</th></tr></thead><tbody>
        {[...rows].reverse().map((o) => { const p = o.metrics[metric]; const url = safeUrl(p?.sourceUrl); return <tr key={`${o.date}-${o.period}`}><th>{o.date} · {o.period}</th><td>{display(p, false)}</td><td>{percent(p?.yoyChange)}</td><td>{p?.kind} · {p?.source || "Source not supplied"}{url && <> · <a href={url} target="_blank" rel="noopener noreferrer">Filing ↗</a></>}{p?.filedAt && <> · Filed {p.filedAt}</>}</td></tr>; })}
      </tbody></table></div>
      {point?.inputs && <p>Inputs: {point.inputs.map((key) => { const p = latest?.metrics[key]; const url = safeUrl(p?.sourceUrl); return <span key={key}>{labels[key]} ({p?.source || "source unavailable"}) {url && <a href={url} target="_blank" rel="noopener noreferrer">filing ↗</a>}; </span>; })}</p>}
      <p>{data.methodology}</p>
      {data.excludedRows > 0 && <p>{data.excludedRows} statement rows excluded because the reporting date or frequency was not supplied.</p>}
    </details>
    <div className="financial-source">{point?.kind === "calculated" ? "Calculated from reported statements" : "Reported statements"} · {point?.source || "Source not supplied"}{sourceUrl && <> · <a href={sourceUrl} target="_blank" rel="noopener noreferrer">Original filing ↗</a></>} · {data.updatedAt ? `Snapshot retrieved ${new Date(data.updatedAt).toLocaleString()}` : "Retrieval time unavailable"}. Coverage depends on the available statement history.</div>
  </section>;
}
