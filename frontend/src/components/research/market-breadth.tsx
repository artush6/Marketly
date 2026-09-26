"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";

type Stock = { symbol: string; sector: string; marketCap: number; changePercent: number | null };
type Snapshot = { stocks: Stock[]; fetchedAt: string };

export function MarketBreadth() {
  const [data, setData] = useState<Snapshot>();
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/backend/market/heatmap", { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]) })
      .then(async (response) => { if (!response.ok) throw new Error(); setData(await response.json()); })
      .catch(() => { if (!controller.signal.aborted) setError("Market breadth is temporarily unavailable."); });
    return () => controller.abort();
  }, []);
  const breadth = useMemo(() => {
    const stocks = (data?.stocks ?? []).filter((stock) => stock.changePercent != null && Number.isFinite(stock.changePercent));
    const advancing = stocks.filter((stock) => (stock.changePercent ?? 0) > 0).length;
    const declining = stocks.filter((stock) => (stock.changePercent ?? 0) < 0).length;
    const equalWeight = stocks.length ? stocks.reduce((sum, stock) => sum + (stock.changePercent ?? 0), 0) / stocks.length : 0;
    const cap = stocks.reduce((sum, stock) => sum + Math.max(stock.marketCap || 0, 0), 0);
    const capWeight = cap ? stocks.reduce((sum, stock) => sum + (stock.changePercent ?? 0) * Math.max(stock.marketCap || 0, 0), 0) / cap : 0;
    const sectors = [...stocks.reduce((map, stock) => {
      const current = map.get(stock.sector) ?? { total: 0, count: 0 };
      current.total += stock.changePercent ?? 0; current.count += 1; map.set(stock.sector, current); return map;
    }, new Map<string, { total: number; count: number }>())].map(([sector, values]) => ({ sector, change: values.total / values.count })).toSorted((a, b) => b.change - a.change);
    return { stocks, advancing, declining, equalWeight, capWeight, sectors };
  }, [data]);
  return <section className="market-breadth-wide market-panel">
    <div className="terminal-heading"><h2><span>03</span> Market breadth / internals</h2><span>US LISTINGS</span></div>
    {error ? <div className="inline-error">{error}</div> : !data ? <div className="empty-state"><LoaderCircle className="spin" size={15} /> Loading market internals…</div> : <>
      <div className="breadth-stat-grid">
        <div><strong className="positive">{breadth.advancing.toLocaleString()}</strong><span>Advancing</span></div>
        <div><strong className="negative">{breadth.declining.toLocaleString()}</strong><span>Declining</span></div>
        <div><strong className={breadth.equalWeight >= 0 ? "positive" : "negative"}>{breadth.equalWeight >= 0 ? "+" : ""}{breadth.equalWeight.toFixed(2)}%</strong><span>Equal-weight move</span></div>
        <div><strong className={breadth.capWeight >= 0 ? "positive" : "negative"}>{breadth.capWeight >= 0 ? "+" : ""}{breadth.capWeight.toFixed(2)}%</strong><span>Cap-weight move</span></div>
      </div>
      <div className="sector-breadth">{breadth.sectors.slice(0, 11).map((sector) => <span key={sector.sector}><b>{sector.sector}</b><small className={sector.change >= 0 ? "positive" : "negative"}>{sector.change >= 0 ? "+" : ""}{sector.change.toFixed(2)}%</small></span>)}</div>
      <p className="disclosure">Daily breadth across {breadth.stocks.length.toLocaleString()} covered US listings. 50/200-day moving-average breadth will appear when verified history is available.</p>
    </>}
  </section>;
}
