"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import type { ComparisonMetric } from "@/lib/api";
import { comparisonUrl, metricText } from "@/lib/comparison";
import { format } from "@/lib/research";
import { type Company } from "@/lib/research";
import { MarketMovers } from "./market-movers";
import { StyledSelect } from "./styled-select";

type Stock = Company & {
  sector: string;
  industry: string;
  marketCap: number;
  changePercent: number | null;
  metrics?: Record<string, ComparisonMetric>;
};

type MarketUniverse = {
  stocks: Stock[];
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  stale: boolean;
  delayed: boolean;
  marketCapUnit: string;
  fundamentalsStatus?: string;
};

export function SmallCap({ onSelect }: { onSelect: (company: Company) => void }) {
  const [snapshot, setSnapshot] = useState<MarketUniverse>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("");
  const [industry, setIndustry] = useState("");
  const [sort,setSort] = useState("marketCap");
  const [ascending,setAscending] = useState(false);
  const [cap,setCap] = useState("");
  const [quick,setQuick] = useState("");
  const [selected,setSelected] = useState<string[]>([]);
  const [limit, setLimit] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/backend/market/small-caps", { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("Discovery is temporarily unavailable.");
      const data = await response.json() as MarketUniverse;
      if (!Array.isArray(data.stocks) || data.marketCapUnit !== "USD millions") {
        throw new Error("Market-cap units could not be verified, so the small-cap filter was not applied.");
      }
      setSnapshot(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Discovery is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setLimit(30); }, [query, sector, industry, sort, ascending, cap, quick]);

  const stocks = useMemo(() => snapshot?.stocks || [], [snapshot]);
  const sectors = useMemo(() => [...new Set(stocks.map((stock) => stock.sector).filter(Boolean))].sort(), [stocks]);
  const industries = useMemo(() => [...new Set(stocks.filter((stock) => !sector || stock.sector === sector).map((stock) => stock.industry).filter(Boolean))].sort(), [stocks, sector]);
  const candidates = useMemo(() => stocks
    .filter((stock) =>
      stock.marketCap >= 300 &&
      stock.marketCap <= 2000 &&
      (!cap || (cap === "small" ? stock.marketCap < 500 : cap === "mid" ? stock.marketCap >= 500 && stock.marketCap < 1000 : stock.marketCap >= 1000)) &&
      (!quick || (quick === "netCash" ? (stock.metrics?.netDebt?.value ?? Infinity) < 0 : (stock.metrics?.[quick]?.value ?? -Infinity) > (quick === "revenueGrowth" ? 10 : 0))) &&
      (!sector || stock.sector === sector) &&
      (!industry || stock.industry === industry) &&
      `${stock.symbol} ${stock.name} ${stock.sector} ${stock.industry}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a,b) => {
      const av = sort === "marketCap" ? a.marketCap : sort === "changePercent" ? a.changePercent : a.metrics?.[sort]?.value;
      const bv = sort === "marketCap" ? b.marketCap : sort === "changePercent" ? b.changePercent : b.metrics?.[sort]?.value;
      if (av == null) return bv == null ? a.symbol.localeCompare(b.symbol) : 1;
      if (bv == null) return -1;
      return (ascending ? av-bv : bv-av) || a.symbol.localeCompare(b.symbol);
    }), [stocks, sector, industry, query, sort, ascending, cap, quick]);

  return (
    <section className="library-view small-cap-view">
      <div className="section-heading">
        <div>
          <h1>Small cap discovery</h1>
          <p>US-listed companies with verified market value of $300M–$2B. A research shortlist, not a prediction.</p>
        </div>
        <button className="secondary-button" disabled={loading} onClick={() => void load()}>
          {loading ? <LoaderCircle size={14} className="spin" /> : <RefreshCw size={14} />} Retry
        </button>
      </div>
      <MarketMovers scope="smallCap" onSelect={onSelect} />
      <div className="discovery-filters">
        <input aria-label="Search small caps" placeholder="Company, ticker or industry" value={query} onChange={(event) => setQuery(event.target.value)} />
        <StyledSelect ariaLabel="Small-cap sector" value={sector} onChange={(value) => { setSector(value); setIndustry(""); }} options={[{ value: "", label: "All sectors" }, ...sectors.map((value) => ({ value, label: value }))]} />
        <StyledSelect ariaLabel="Small-cap industry" value={industry} onChange={setIndustry} options={[{ value: "", label: "All industries" }, ...industries.map((value) => ({ value, label: value }))]} />
        <StyledSelect ariaLabel="Market-cap range" value={cap} onChange={setCap} options={[{value:"",label:"$300M–$2B"},{value:"small",label:"$300M–$500M"},{value:"mid",label:"$500M–$1B"},{value:"large",label:"$1B–$2B"}]} />
        <StyledSelect ariaLabel="Sort companies" value={sort} onChange={setSort} options={[{value:"marketCap",label:"Market cap"},{value:"changePercent",label:"Daily performance"},{value:"revenueGrowth",label:"Revenue growth"},{value:"trailingPE",label:"Trailing P/E"},{value:"netMargin",label:"Net margin"},{value:"fcfYield",label:"FCF yield (FY)"}]} />
        <button className="secondary-button" onClick={()=>setAscending(!ascending)}>{ascending?"Ascending ↑":"Descending ↓"}</button>
        <StyledSelect ariaLabel="Fundamental filter" value={quick} onChange={setQuick} options={[{value:"",label:"All companies"},{value:"netIncome",label:"Profitable (FY)"},{value:"freeCashFlow",label:"Positive FCF (FY)"},{value:"netCash",label:"Net cash"},{value:"revenueGrowth",label:"Revenue growth >10%"}]} />
        <button className="secondary-button" onClick={() => window.dispatchEvent(new CustomEvent("marketly-research-question", { detail: `Research smaller public companies in ${query || industry || sector || "my watchlist sectors"}. Verify current market caps, identify concrete catalysts and traction, assess cash runway, dilution, trading liquidity and downside. Compare 3 candidates for my strategy and cite issuer sources. Do not describe any candidate as a guaranteed winner.` }))}>Research opportunities ↗</button>
      </div>
      {error && <div className="inline-error" role="alert">{error} <button className="text-button" onClick={() => void load()}>Try again</button></div>}
      {loading && !snapshot && <p><LoaderCircle size={14} className="spin" /> Loading market universe…</p>}
      {snapshot && (
        <p className="disclosure">
          {candidates.length} matches · {snapshot.source} · market cap in USD millions · fetched {new Date(snapshot.fetchedAt).toLocaleString()}{snapshot.stale ? " · cached after provider outage" : ""}{snapshot.delayed ? " · quotes may be delayed" : ""}
        </p>
      )}
      {snapshot?.fundamentalsStatus === "unavailable" && <p className="disclosure">Fundamental cache is unavailable. Market-cap and price screening remain available.</p>}
      {selected.length>0&&<div className="compare-selection"><span>{selected.length} selected</span>{selected.length>=2&&<a className="secondary-button" href={comparisonUrl(selected)} target="_blank" rel="noopener noreferrer">Compare selected ↗</a>}<button onClick={()=>setSelected([])}>Clear</button></div>}
      <div className="watchlist-grid discovery-grid">
        {candidates.slice(0, limit).map((stock) => (
          <article key={stock.symbol} className="discovery-company">
            <button className="discovery-company-open" onClick={() => onSelect(stock)}><span><b>{stock.symbol} · {stock.name}</b><small>{stock.sector} · {stock.industry}</small></span><strong>{format(stock.marketCap*1e6,"money")}</strong></button>
            <dl className="discovery-metrics">{[["revenueGrowth","Rev growth"],["trailingPE","Trailing P/E"],["netMargin","Net margin"],["fcfYield","FCF yield (FY)"]].map(([key,label])=><div key={key} title={[stock.metrics?.[key]?.period,stock.metrics?.[key]?.source].filter(Boolean).join(" · ")}><dt>{label}</dt><dd>{metricText(stock.metrics?.[key])}</dd></div>)}</dl>
            <div className="discovery-tags">{(stock.metrics?.netIncome?.value ?? 0)>0&&<span>Profitable FY</span>}{(stock.metrics?.freeCashFlow?.value ?? 0)>0&&<span>Positive FCF FY</span>}{(stock.metrics?.netDebt?.value ?? 0)<0&&<span>Net cash</span>}</div>
            <label className="discovery-compare"><input type="checkbox" checked={selected.includes(stock.symbol)} disabled={!selected.includes(stock.symbol)&&selected.length>=6} onChange={()=>setSelected(selected.includes(stock.symbol)?selected.filter((s)=>s!==stock.symbol):[...selected,stock.symbol])}/>Compare</label>
          </article>
        ))}
      </div>
      {snapshot && !candidates.length && <div className="empty-state">No companies match these filters. Broaden the sector, industry, or search.</div>}
      {limit < candidates.length && <button className="secondary-button" onClick={() => setLimit((value) => value + 30)}>Show 30 more</button>}
    </section>
  );
}
