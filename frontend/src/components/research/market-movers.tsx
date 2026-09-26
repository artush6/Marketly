"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, LoaderCircle } from "lucide-react";
import type { Company } from "@/lib/research";
import { CompanyLogo } from "./company-logo";

type Mover = Company & { changePercent: number; marketCap?: number; sector?: string };
type MoversResponse = { sp500: { gainers: Mover[]; losers: Mover[] }; smallCap: { gainers: Mover[]; losers: Mover[] }; fetchedAt: string };
type MoverTab = "gainers" | "losers" | "unusual" | "earnings" | "revisions";

export function MarketMovers({ scope, onSelect }: { scope: "sp500" | "smallCap"; onSelect: (company: Company) => void }) {
  const [data, setData] = useState<MoversResponse>();
  const [error, setError] = useState("");
  const [tab, setTab] = useState<MoverTab>("gainers");
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/backend/market/movers", { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) })
      .then(async (response) => { if (!response.ok) throw new Error(); setData(await response.json()); })
      .catch(() => { if (!controller.signal.aborted) setError("Mover data is temporarily unavailable."); });
    return () => controller.abort();
  }, []);
  const group = data?.[scope];
  const rows = group && (tab === "gainers" ? group.gainers : tab === "losers" ? group.losers : tab === "unusual" ? [...group.gainers, ...group.losers].toSorted((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)).slice(0, 10) : []);
  return <section className="movers-panel">
    <div className="terminal-heading"><h2>{scope === "sp500" ? "Market movers" : "Small-cap attention list"}</h2><span>{scope === "sp500" ? "S&P 500" : "SMALL CAP"}</span></div>
    <nav className="mover-tabs" aria-label="Mover views">{(["gainers", "losers", "unusual", "earnings", "revisions"] as MoverTab[]).map((item) => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>)}</nav>
    {error ? <div className="inline-error">{error}</div> : !group ? <div className="empty-state"><LoaderCircle className="spin" size={15} /> Loading movers…</div> : !rows?.length ? <div className="mover-empty"><strong>{tab === "earnings" ? "Earnings movers" : "Estimate revisions"}</strong><span>No verified {tab} feed is connected yet. Marketly will not manufacture this signal.</span></div> : <div className="mover-list">
      <h3 className={tab === "gainers" ? "positive" : tab === "losers" ? "negative" : ""}>{tab === "gainers" ? <ArrowUp size={14} /> : tab === "losers" ? <ArrowDown size={14} /> : null}{tab}</h3>
      {rows.map((stock) => <button onClick={() => onSelect(stock)} key={stock.symbol}><CompanyLogo symbol={stock.symbol} /><span><b>{stock.symbol}</b><small>{stock.name}{stock.sector ? ` · ${stock.sector}` : ""}</small></span><strong className={stock.changePercent >= 0 ? "positive" : "negative"}>{stock.changePercent > 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%</strong></button>)}
    </div>}
  </section>;
}
