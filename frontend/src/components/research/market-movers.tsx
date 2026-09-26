"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, LoaderCircle } from "lucide-react";
import type { Company } from "@/lib/research";
import { CompanyLogo } from "./company-logo";

type Mover = Company & { changePercent: number; marketCap?: number; sector?: string };
type MoversResponse = { sp500: { gainers: Mover[]; losers: Mover[] }; smallCap: { gainers: Mover[]; losers: Mover[] }; fetchedAt: string };

export function MarketMovers({ scope, onSelect }: { scope: "sp500" | "smallCap"; onSelect: (company: Company) => void }) {
  const [data, setData] = useState<MoversResponse>();
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/backend/market/movers", { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) })
      .then(async (response) => { if (!response.ok) throw new Error(); setData(await response.json()); })
      .catch(() => { if (!controller.signal.aborted) setError("Mover data is temporarily unavailable."); });
    return () => controller.abort();
  }, []);
  const group = data?.[scope];
  return <section className="movers-panel">
    <div className="terminal-heading"><h2>{scope === "sp500" ? "S&P 500 movers" : "Small-cap attention list"}</h2><span>GAINERS / LOSERS</span></div>
    {error ? <div className="inline-error">{error}</div> : !group ? <div className="empty-state"><LoaderCircle className="spin" size={15} /> Loading movers…</div> : <div className="movers-columns">
      {(["gainers", "losers"] as const).map((kind) => <div key={kind}><h3>{kind === "gainers" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}{kind}</h3>{group[kind].map((stock) => <button onClick={() => onSelect(stock)} key={stock.symbol}><CompanyLogo symbol={stock.symbol} /><span><b>{stock.symbol}</b><small>{stock.name}{stock.sector ? ` · ${stock.sector}` : ""}</small></span><strong className={kind === "gainers" ? "positive" : "negative"}>{stock.changePercent > 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%</strong></button>)}</div>)}
    </div>}
  </section>;
}
