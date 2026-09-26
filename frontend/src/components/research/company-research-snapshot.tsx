"use client";

import { useMemo } from "react";
import type {
  BackendFinancialsResponse,
  BackendScoreResponse,
} from "@/lib/api";
import { format, metrics, number } from "@/lib/research";

type Signal = { label: string; value: string; note?: string };

function signal(label: string, value: unknown, style: "number" | "percent" | "ratioPercent" | "multiple" | "money" = "number", note?: string, currency = "USD"): Signal {
  if (style === "ratioPercent") {
    const ratio = number(value);
    return { label, value: ratio == null ? "—" : format(ratio * 100, "percent"), note };
  }
  return { label, value: format(value, style === "money" ? "money" : style, currency), note };
}

function available(items: Signal[]) {
  return items.filter((item) => item.value !== "—");
}

export function CompanyResearchSnapshot({
  financials,
  analysis,
  loading,
}: {
  financials?: BackendFinancialsResponse;
  analysis?: BackendScoreResponse;
  loading: boolean;
}) {
  const profile = financials?.info;
  const computed = metrics(financials);
  const groups = useMemo(() => {
    const profitability = available([
      signal("Net margin", computed.margin ?? analysis?.profitability?.netMargin, computed.margin != null ? "percent" : "ratioPercent", "Net income ÷ latest reported revenue"),
      signal("Gross margin", analysis?.profitability?.grossMargin ?? profile?.grossMargin, "ratioPercent"),
      signal("Return on equity", analysis?.profitability?.roe ?? profile?.roe, "ratioPercent"),
      signal("Revenue growth", analysis?.growth?.revenueGrowthYoY, "ratioPercent", "Year over year · analysis data"),
    ]);
    const capital = available([
      signal("Return on equity", analysis?.profitability?.roe ?? profile?.roe, "ratioPercent"),
      signal("Dividend yield", analysis?.valuation?.dividendYield ?? profile?.dividendYield, "ratioPercent"),
      signal("Debt to equity", analysis?.stability?.debtToEquity ?? profile?.debtToEquity, "number"),
      signal("Interest coverage", analysis?.stability?.interestCoverage, "number", "Operating income ÷ interest expense · analysis data"),
    ]);
    const valuation = available([
      signal("Trailing P/E", analysis?.valuation?.trailingPE ?? profile?.trailingPE, "multiple"),
      signal("Forward P/E", analysis?.valuation?.forwardPE ?? profile?.forwardPE, "multiple"),
      signal("PEG ratio", analysis?.valuation?.pegRatio ?? profile?.pegRatio, "number"),
      signal("Price to book", analysis?.valuation?.priceToBook ?? profile?.priceToBook, "multiple"),
      signal("Price to sales", analysis?.valuation?.priceToSales ?? profile?.priceToSalesTrailing12Months ?? profile?.priceToSales, "multiple"),
    ]);
    return [
      { title: "Business quality", description: "Reported profitability and growth", items: profitability },
      { title: "Capital returns & balance sheet", description: "Returns and leverage signals", items: capital },
      { title: "Valuation", description: "Market-derived multiples", items: valuation },
    ];
  }, [analysis, computed.margin, profile]);

  const summary = [
    signal("Market cap", profile?.marketCap ?? financials?.quote?.marketCap, "money", undefined, computed.currency),
    signal("Latest revenue", computed.revenue, "money", String(computed.period), computed.currency),
    signal("Net margin", computed.margin ?? analysis?.profitability?.netMargin, computed.margin != null ? "percent" : "ratioPercent"),
    signal("Trailing P/E", analysis?.valuation?.trailingPE ?? profile?.trailingPE, "multiple"),
  ];
  const fetchedAt = financials?.dataQuality?.fetchedAt;
  const sourceNames = [...new Set(Object.values(financials?.sources ?? {}).filter(Boolean))];
  const hasSignals = groups.some((group) => group.items.length > 0);

  return (
    <section className="research-snapshot" aria-labelledby="research-snapshot-title">
      <div className="research-snapshot-heading">
        <div>
          <span className="section-kicker">Company at a glance</span>
          <h2 id="research-snapshot-title">Long-term research signals</h2>
        </div>
        <span className="research-snapshot-status">
          {loading ? "Updating data" : financials?.dataQuality?.status ? `${financials.dataQuality.status.replaceAll("_", " ")} financial data` : "Provider data"}
        </span>
      </div>
      <div className="research-snapshot-summary">
        {summary.map((item) => (
          <div key={item.label}>
            <small>{item.label}</small>
            <strong>{loading ? <span className="text-skeleton" /> : item.value}</strong>
            {item.note && <span>{item.note}</span>}
          </div>
        ))}
      </div>
      <details className="research-snapshot-details">
        <summary>Quality, capital allocation & valuation signals</summary>
        {hasSignals ? (
          <div className="research-signal-groups">
            {groups.map((group) => (
              <section key={group.title}>
                <h3>{group.title}</h3>
                <p>{group.description}</p>
                {group.items.length ? (
                  <dl>
                    {group.items.map((item) => (
                      <div key={item.label}>
                        <dt>{item.label}</dt>
                        <dd>{item.value}</dd>
                        {item.note && <small>{item.note}</small>}
                      </div>
                    ))}
                  </dl>
                ) : <div className="research-signal-empty">No supported fields returned.</div>}
              </section>
            ))}
          </div>
        ) : (
          <p className="research-signal-empty">Signals will appear when financial profile data is available.</p>
        )}
        <div className="research-snapshot-provenance">
          <span>
            {fetchedAt ? `Financial profile fetched ${new Date(fetchedAt).toLocaleString()}` : "Financial profile timestamp not supplied"}
          </span>
          <span>
            {sourceNames.length ? `Sources: ${sourceNames.join(", ")}` : "Provider sources not supplied"}
          </span>
          <span>Multiples are market-derived. Missing values are not estimated.</span>
        </div>
      </details>
    </section>
  );
}
