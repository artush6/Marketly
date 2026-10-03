"use client";

import { useEffect, useMemo, useState } from "react";
import { MarketSectionHeading } from "./market-section-heading";
import { LoaderCircle } from "lucide-react";

type Stock = { symbol: string; sector: string; marketCap: number; changePercent: number | null };
type Snapshot = { stocks: Stock[]; fetchedAt: string };

export function MarketBreadth() {
  const [revision,setRevision] = useState(0);
  const [data, setData] = useState<Snapshot>();
  const [error, setError] = useState("");
  useEffect(() => {
    setError("");
    const controller = new AbortController();
    void fetch("/api/backend/market/heatmap", { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]) })
      .then(async (response) => { if (!response.ok) throw new Error(); setData(await response.json()); })
      .catch(() => { if (!controller.signal.aborted) setError("Market breadth is temporarily unavailable."); });
    return () => controller.abort();
  }, [revision]);
  const breadth = useMemo(() => {
    const stocks = (data?.stocks ?? []).filter((stock) => stock.changePercent != null && Number.isFinite(stock.changePercent));
    const advancing = stocks.filter((stock) => (stock.changePercent ?? 0) > 0).length;
    const declining = stocks.filter((stock) => (stock.changePercent ?? 0) < 0).length;
    const equalWeight = stocks.length ? stocks.reduce((sum, stock) => sum + (stock.changePercent ?? 0), 0) / stocks.length : 0;
    const cap = stocks.reduce((sum, stock) => sum + Math.max(stock.marketCap || 0, 0), 0);
    const capWeight = cap ? stocks.reduce((sum, stock) => sum + (stock.changePercent ?? 0) * Math.max(stock.marketCap || 0, 0), 0) / cap : 0;
    const sectors = [...stocks.reduce((map, stock) => {
      const current = map.get(stock.sector) ?? { total: 0, count: 0, up:0, down:0 };
      if ((stock.changePercent??0)>0) current.up++; if ((stock.changePercent??0)<0) current.down++;
      current.total += stock.changePercent ?? 0; current.count += 1; map.set(stock.sector, current); return map;
    }, new Map<string, { total: number; count: number; up:number; down:number }>())].map(([sector, values]) => ({ sector, change: values.total / values.count, up:values.up, down:values.down, count:values.count })).toSorted((a, b) => b.change - a.change);
    return { stocks, advancing, declining, equalWeight, capWeight, sectors };
  }, [data]);
  return <section className="market-breadth-wide market-panel">
    <MarketSectionHeading number="03" title="Market breadth / internals" context="US LISTINGS" />
    {error ? <div className="inline-error">{error} <button onClick={()=>setRevision(v=>v+1)}>Retry</button></div> : data && !breadth.stocks.length ? <div className="empty-state">No verified daily moves are available for this snapshot.</div> : !data ? <div className="empty-state"><LoaderCircle className="spin" size={15} /> Loading market internals…</div> : <>
      <div className="breadth-stat-grid">
        <div><strong className="positive">{breadth.advancing.toLocaleString()}</strong><span>Advancing</span></div>
        <div><strong className="negative">{breadth.declining.toLocaleString()}</strong><span>Declining</span></div>
        <div><strong className={breadth.equalWeight >= 0 ? "positive" : "negative"}>{breadth.equalWeight >= 0 ? "+" : ""}{breadth.equalWeight.toFixed(2)}%</strong><span>Equal-weight move</span></div>
        <div><strong className={breadth.capWeight >= 0 ? "positive" : "negative"}>{breadth.capWeight >= 0 ? "+" : ""}{breadth.capWeight.toFixed(2)}%</strong><span>Cap-weight move</span></div>
      </div>
      <div className="breadth-detail"><section><h3>Market participation</h3><p className="disclosure">Current covered universe · daily snapshot</p><div className="participation-bar" aria-label={`${breadth.advancing} advancing, ${breadth.declining} declining`}><i style={{width:`${breadth.stocks.length?breadth.advancing/breadth.stocks.length*100:0}%`}}/><b style={{width:`${breadth.stocks.length?breadth.declining/breadth.stocks.length*100:0}%`}}/></div><div className="participation-legend"><span>Advancing {breadth.advancing}</span><span>Declining {breadth.declining}</span><span>Unchanged {breadth.stocks.length-breadth.advancing-breadth.declining}</span></div><p className="disclosure">Intraday advance/decline history is not supplied by this feed.</p></section><section><h3>Sector breadth</h3><div className="sector-participation">{breadth.sectors.slice(0,11).map(sector=><div key={sector.sector}><span>{sector.sector}</span><div className="participation-bar"><i style={{width:`${sector.up/sector.count*100}%`}}/><b style={{width:`${sector.down/sector.count*100}%`}}/></div><small className={sector.change>=0?"positive":"negative"}>{sector.change>0?"+":""}{sector.change.toFixed(2)}%</small></div>)}</div></section></div>
      <p className="disclosure">Daily breadth across {breadth.stocks.length.toLocaleString()} covered US listings. 50/200-day moving-average breadth will appear when verified history is available.</p>
    </>}
  </section>;
}
