"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { getSmallCapCandidates, getSmallCapProfilePresets, getSmallCapScanStatus, queueSmallCapScan, type ComparisonMetric, type SmallCapCandidate, type SmallCapProfilePreset } from "@/lib/api";
import { comparisonUrl, metricText } from "@/lib/comparison";
import { userStorage } from "@/lib/user-storage";
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
  const [screenNotice, setScreenNotice] = useState("");
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("");
  const [industry, setIndustry] = useState("");
  const [sort,setSort] = useState("marketCap");
  const [ascending,setAscending] = useState(false);
  const [cap,setCap] = useState("");
  const [selected,setSelected] = useState<string[]>([]);
  const [limit, setLimit] = useState(30);
  const [shortlist, setShortlist] = useState<SmallCapCandidate[]>([]);
  const [profiles, setProfiles] = useState<SmallCapProfilePreset[]>([]);
  const [profileName, setProfileName] = useState("small");
  const [scanStatus, setScanStatus] = useState<Awaited<ReturnType<typeof getSmallCapScanStatus>>>();
  const [scanBusy, setScanBusy] = useState(false);
  const [scanError, setScanError] = useState("");
  const activeScanStatus = scanStatus?.scan?.status;

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
  const loadShortlist = useCallback(async () => {
    const [result, presetResult, statusResult] = await Promise.all([
      getSmallCapCandidates({ limit: 50 }), getSmallCapProfilePresets(), getSmallCapScanStatus(),
    ]);
    setShortlist(result.candidates);
    setProfiles(presetResult.profiles);
    setScanStatus(statusResult);
  }, []);
  useEffect(() => {
    void loadShortlist().catch((reason) => setScanError(reason instanceof Error ? reason.message : "Saved discovery shortlist is unavailable."));
  }, [loadShortlist]);
  useEffect(() => {
    if (!activeScanStatus || !["queued", "running", "retrying"].includes(activeScanStatus)) return;
    const timer = window.setInterval(() => {
      void Promise.all([getSmallCapScanStatus(), getSmallCapCandidates({ limit: 50 })]).then(([status, result]) => {
        setScanStatus(status);
        setShortlist(result.candidates);
      }).catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeScanStatus]);
  const startScan = async () => {
    const profile = profiles.find((item) => item.name === profileName);
    if (!profile) return;
    setScanBusy(true);
    setScanError("");
    try {
      await queueSmallCapScan(profile);
      setScanStatus(await getSmallCapScanStatus());
    } catch (reason) {
      setScanError(reason instanceof Error ? reason.message : "Could not queue the discovery scan.");
    } finally {
      setScanBusy(false);
    }
  };
  useEffect(() => { setLimit(30); }, [query, sector, industry, sort, ascending, cap]);

  const stocks = useMemo(() => snapshot?.stocks || [], [snapshot]);
  const sectors = useMemo(() => [...new Set(stocks.map((stock) => stock.sector).filter(Boolean))].sort(), [stocks]);
  const industries = useMemo(() => [...new Set(stocks.filter((stock) => !sector || stock.sector === sector).map((stock) => stock.industry).filter(Boolean))].sort(), [stocks, sector]);
  const candidates = useMemo(() => stocks
    .filter((stock) =>
      stock.marketCap >= 300 &&
      stock.marketCap <= 2000 &&
      (!cap || (cap === "small" ? stock.marketCap < 500 : cap === "mid" ? stock.marketCap >= 500 && stock.marketCap < 1000 : stock.marketCap >= 1000)) &&
      (!sector || stock.sector === sector) &&
      (!industry || stock.industry === industry) &&
      `${stock.symbol} ${stock.name} ${stock.sector} ${stock.industry}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a,b) => {
      const av = sort === "marketCap" ? a.marketCap : sort === "changePercent" ? a.changePercent : a.metrics?.[sort]?.value;
      const bv = sort === "marketCap" ? b.marketCap : sort === "changePercent" ? b.changePercent : b.metrics?.[sort]?.value;
      if (av == null) return bv == null ? a.symbol.localeCompare(b.symbol) : 1;
      if (bv == null) return -1;
      return (ascending ? av-bv : bv-av) || a.symbol.localeCompare(b.symbol);
    }), [stocks, sector, industry, query, sort, ascending, cap]);

  return (
    <div className="small-cap-workspace"><section className="library-view small-cap-view">
      <div className="section-heading">
        <div>
          <h1>Small cap discovery</h1>
          <p>US-listed companies with verified market value of $300M–$2B. A research shortlist, not a prediction.</p>
        </div>
        <button className="secondary-button" disabled={loading} onClick={() => void load()}>
          {loading ? <LoaderCircle size={14} className="spin" /> : <RefreshCw size={14} />} Retry
        </button>
      </div>
      <div className="ui-toolbar"><button onClick={()=>{userStorage.setItem("marketly.smallcap.screen",JSON.stringify({query,sector,industry,cap,sort,ascending}));setScreenNotice("Screen saved to your workspace.");}}>Save screen</button><button onClick={()=>{try{const v=JSON.parse(userStorage.getItem("marketly.smallcap.screen")||"null");if(!v){setScreenNotice("No saved screen yet.");return;}setQuery(v.query||"");setSector(v.sector||"");setIndustry(v.industry||"");setCap(v.cap||"");setSort(v.sort||"marketCap");setAscending(Boolean(v.ascending));setScreenNotice("Saved screen restored.");}catch{setScreenNotice("Saved screen could not be restored.");}}}>Load screen</button><button onClick={()=>{setQuery("");setSector("");setIndustry("");setCap("");setSelected([]);}}>Reset filters</button><span role="status">{screenNotice}</span></div>
      <div className="discovery-filters">
        <input aria-label="Search small caps" placeholder="Company, ticker or industry" value={query} onChange={(event) => setQuery(event.target.value)} />
        <StyledSelect ariaLabel="Small-cap sector" value={sector} onChange={(value) => { setSector(value); setIndustry(""); }} options={[{ value: "", label: "All sectors" }, ...sectors.map((value) => ({ value, label: value }))]} />
        <StyledSelect ariaLabel="Small-cap industry" value={industry} onChange={setIndustry} options={[{ value: "", label: "All industries" }, ...industries.map((value) => ({ value, label: value }))]} />
        <StyledSelect ariaLabel="Market-cap range" value={cap} onChange={setCap} options={[{value:"",label:"$300M–$2B"},{value:"small",label:"$300M–$500M"},{value:"mid",label:"$500M–$1B"},{value:"large",label:"$1B–$2B"}]} />
        <StyledSelect ariaLabel="Sort companies" value={sort} onChange={setSort} options={[{value:"marketCap",label:"Market cap"},{value:"changePercent",label:"Daily performance"}]} />
        <button className="secondary-button" onClick={()=>setAscending(!ascending)}>{ascending?"Ascending ↑":"Descending ↓"}</button>
        <button className="secondary-button" onClick={() => window.dispatchEvent(new CustomEvent("marketly-research-question", { detail: `Research smaller public companies in ${query || industry || sector || "my watchlist sectors"}. Verify current market caps, identify concrete catalysts and traction, assess cash runway, dilution, trading liquidity and downside. Compare 3 candidates for my strategy and cite issuer sources. Do not describe any candidate as a guaranteed winner.` }))}>Research opportunities ↗</button>
      </div>
      <details className="potential-discovery"><summary>Potential shortlist · {shortlist.length} saved candidates<span>Open research scan</span></summary>
        <div className="potential-heading">
          <div><div className="eyebrow">RANKED RESEARCH QUEUE</div><h2 id="potential-title">Potential shortlist</h2><p>Structured fundamentals, valuation, balance-sheet signals, and available relationship evidence.</p></div>
          <div className="potential-controls">
            <StyledSelect ariaLabel="Discovery universe" value={profileName} onChange={setProfileName} options={profiles.map((item) => ({ value: item.name, label: item.name.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) }))} />
            <button className="secondary-button" disabled={scanBusy || ["queued", "running", "retrying"].includes(scanStatus?.scan?.status || "")} onClick={() => void startScan()}>
              {scanBusy || ["queued", "running", "retrying"].includes(scanStatus?.scan?.status || "") ? <LoaderCircle size={14} className="spin" /> : <RefreshCw size={14} />}
              {scanBusy ? "Queueing…" : ["queued", "running", "retrying"].includes(scanStatus?.scan?.status || "") ? `Scan ${scanStatus?.scan?.status}` : "Run scan"}
            </button>
          </div>
        </div>
        <p className="disclosure">Potential scores are deterministic research heuristics. Any outperformance probability is uncalibrated, has no historical outcome validation, and is not an investment forecast. This scan does not provide a point-in-time universe.</p>
        {scanError && <div className="inline-error" role="alert">{scanError}</div>}
        {!scanStatus?.available && <p className="disclosure">Durable scan status is unavailable. Configure the discovery worker and Supabase to run scans.</p>}
        {scanStatus?.scan?.last_error && <p className="inline-error" role="status">Last scan issue: {scanStatus.scan.last_error}</p>}
        {shortlist.length ? <div className="potential-list">
          {shortlist.map((candidate) => <article className="potential-row" key={candidate.symbol}>
            <button className="potential-company" onClick={() => onSelect({ symbol: candidate.symbol, name: candidate.company_name || candidate.symbol })}><strong>{candidate.symbol}</strong><span>{candidate.company_name || candidate.symbol}</span><small>{[candidate.sector, candidate.industry].filter(Boolean).join(" · ") || "Sector unavailable"}</small></button>
            <div className="potential-score"><strong>{candidate.potential_score == null ? "—" : Math.round(candidate.potential_score)}</strong><small>Potential score</small></div>
            <div className="potential-score"><strong>{candidate.estimated_outperformance_probability == null ? "—" : `${Math.round(candidate.estimated_outperformance_probability * 100)}%`}</strong><small>Heuristic · {candidate.confidence || "low"} confidence</small></div>
            <div className="potential-evidence"><span>{Math.round((candidate.evidence_coverage || 0) * 100)}% evidence coverage</span><small>{candidate.positives.slice(0, 2).join(" · ") || "Limited positive evidence"}</small></div>
            <div className="potential-risks">{candidate.risk_flags.slice(0, 2).map((flag) => <span key={flag}>{flag.replaceAll("_", " ")}</span>)}</div>
          </article>)}
        </div> : <div className="empty-state">No saved scan results yet. Run a bounded scan to build the first ranked shortlist.</div>}
      </details>
      {error && <div className="inline-error" role="alert">{error} <button className="text-button" onClick={() => void load()}>Try again</button></div>}
      {loading && !snapshot && <p><LoaderCircle size={14} className="spin" /> Loading market universe…</p>}
      {snapshot && (
        <p className="disclosure">
          {candidates.length} matches · {snapshot.source} · market cap in USD millions · fetched {new Date(snapshot.fetchedAt).toLocaleString()}{snapshot.stale ? " · cached after provider outage" : ""}{snapshot.delayed ? " · quotes may be delayed" : ""}
        </p>
      )}
      {snapshot?.fundamentalsStatus === "unavailable" && <p className="disclosure">Fundamental cache is unavailable. Market-cap and price screening remain available.</p>}
      {selected.length>0&&<div className="compare-selection"><span>{selected.length} selected</span>{selected.length>=2&&<a className="secondary-button" href={comparisonUrl(selected)} target="_blank" rel="noopener noreferrer">Compare selected ↗</a>}<button onClick={()=>setSelected([])}>Clear</button></div>}
      <div className="comparison-table-wrap"><table className="terminal-table"><thead><tr><th>Company</th><th>1D</th><th>Market cap</th><th>Revenue growth</th><th>P/E</th><th>Net margin</th><th>FCF yield</th><th>Compare</th></tr></thead><tbody>{candidates.slice(0,limit).map(stock=><tr key={stock.symbol}><th><button onClick={()=>onSelect(stock)}><b>{stock.symbol}</b><small>{stock.name}</small><small>{stock.sector}</small></button></th><td className={(stock.changePercent??0)>=0?"positive":"negative"}>{format(stock.changePercent,"percent")}</td><td>{format(stock.marketCap*1e6,"money")}</td>{["revenueGrowth","trailingPE","netMargin","fcfYield"].map(key=><td key={key} title={[stock.metrics?.[key]?.period,stock.metrics?.[key]?.source].filter(Boolean).join(" · ")}>{metricText(stock.metrics?.[key])}</td>)}<td><input aria-label={`Compare ${stock.symbol}`} type="checkbox" checked={selected.includes(stock.symbol)} disabled={!selected.includes(stock.symbol)&&selected.length>=6} onChange={()=>setSelected(selected.includes(stock.symbol)?selected.filter(s=>s!==stock.symbol):[...selected,stock.symbol])}/></td></tr>)}</tbody></table></div>
      {snapshot && !candidates.length && <div className="empty-state">No companies match these filters. Broaden the sector, industry, or search.</div>}
      {limit < candidates.length && <button className="secondary-button" onClick={() => setLimit((value) => value + 30)}>Show 30 more</button>}
    </section><aside className="small-cap-sidebar"><MarketMovers scope="smallCap" onSelect={onSelect} /></aside></div>
  );
}
