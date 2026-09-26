"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { type Company } from "@/lib/research";

type Stock = Company & {
  sector: string;
  industry: string;
  marketCap: number;
  changePercent: number | null;
};

type MarketUniverse = {
  stocks: Stock[];
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  stale: boolean;
  delayed: boolean;
  marketCapUnit: string;
};

export function SmallCap({ onSelect }: { onSelect: (company: Company) => void }) {
  const [snapshot, setSnapshot] = useState<MarketUniverse>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("");
  const [industry, setIndustry] = useState("");
  const [limit, setLimit] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/backend/market/heatmap", { signal: AbortSignal.timeout(15000) });
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
  useEffect(() => { setLimit(30); }, [query, sector, industry]);

  const stocks = useMemo(() => snapshot?.stocks || [], [snapshot]);
  const sectors = useMemo(() => [...new Set(stocks.map((stock) => stock.sector).filter(Boolean))].sort(), [stocks]);
  const industries = useMemo(() => [...new Set(stocks.filter((stock) => !sector || stock.sector === sector).map((stock) => stock.industry).filter(Boolean))].sort(), [stocks, sector]);
  const candidates = useMemo(() => stocks
    .filter((stock) =>
      stock.marketCap >= 300 &&
      stock.marketCap <= 2000 &&
      (!sector || stock.sector === sector) &&
      (!industry || stock.industry === industry) &&
      `${stock.symbol} ${stock.name} ${stock.sector} ${stock.industry}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.marketCap - a.marketCap), [stocks, sector, industry, query]);

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
      <div className="discovery-filters">
        <input aria-label="Search small caps" placeholder="Company, ticker or industry" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select aria-label="Small-cap sector" value={sector} onChange={(event) => { setSector(event.target.value); setIndustry(""); }}>
          <option value="">All sectors</option>
          {sectors.map((value) => <option key={value}>{value}</option>)}
        </select>
        <select aria-label="Small-cap industry" value={industry} onChange={(event) => setIndustry(event.target.value)}>
          <option value="">All industries</option>
          {industries.map((value) => <option key={value}>{value}</option>)}
        </select>
        <button className="secondary-button" onClick={() => window.dispatchEvent(new CustomEvent("marketly-research-question", { detail: `Research smaller public companies in ${query || industry || sector || "my watchlist sectors"}. Verify current market caps, identify concrete catalysts and traction, assess cash runway, dilution, trading liquidity and downside. Compare 3 candidates for my strategy and cite issuer sources. Do not describe any candidate as a guaranteed winner.` }))}>Research opportunities ↗</button>
      </div>
      {error && <div className="inline-error" role="alert">{error} <button className="text-button" onClick={() => void load()}>Try again</button></div>}
      {loading && !snapshot && <p><LoaderCircle size={14} className="spin" /> Loading market universe…</p>}
      {snapshot && (
        <p className="disclosure">
          {candidates.length} matches · {snapshot.source} · market cap in USD millions · fetched {new Date(snapshot.fetchedAt).toLocaleString()}{snapshot.stale ? " · cached after provider outage" : ""}{snapshot.delayed ? " · quotes may be delayed" : ""}
        </p>
      )}
      <div className="watchlist-grid">
        {candidates.slice(0, limit).map((stock) => (
          <div key={stock.symbol}>
            <button onClick={() => onSelect(stock)}>
              <span><b>{stock.symbol} · {stock.name}</b><small>{stock.sector} · {stock.industry}</small><small>${stock.marketCap.toFixed(0)}M</small></span>
            </button>
          </div>
        ))}
      </div>
      {snapshot && !candidates.length && <div className="empty-state">No companies match these filters. Broaden the sector, industry, or search.</div>}
      {limit < candidates.length && <button className="secondary-button" onClick={() => setLimit((value) => value + 30)}>Show 30 more</button>}
    </section>
  );
}
