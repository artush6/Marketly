"use client";
import { useState } from "react";
import type { BackendFinancialsResponse } from "@/lib/api";
import type { Company } from "@/lib/research";
import { categories, comparisonUrl } from "@/lib/comparison";
import { CompanySearch } from "../research/company-search";
import { MetricTable } from "./metric-table";
export function CompactComparison({ symbol, base, peers, add, remove, reset, busy, message }: { symbol: string; base?: BackendFinancialsResponse; peers: Record<string,BackendFinancialsResponse>; add: (company: Company) => void; remove: (symbol: string) => void; reset: () => void; busy: boolean; message: string }) {
  const [category,setCategory]=useState("Overview"); const symbols=[symbol,...Object.keys(peers)]; const data={...peers,...(base?{[symbol]:base}:{})};
  return <section className="research-section"><div className="section-heading"><div><h2>Company comparison</h2><p>Compare valuation, growth and operating results.</p></div><a className="secondary-button" href={comparisonUrl(symbols)} target="_blank" rel="noopener noreferrer">Open full comparison ↗</a></div>
    <div className="compare-selection">{symbols.map((s,i)=><span key={s}>{s}{i===0 ? " · Base" : <button aria-label={`Remove ${s}`} onClick={()=>remove(s)}>×</button>}</span>)}<button className="text-button" disabled={busy} onClick={reset}>Reset to suggested peers</button></div>
    {symbols.length<6 && <CompanySearch compact onSelect={add} />}<p role="status" className="disclosure">{message}</p>
    <div className="compare-tabs" role="tablist" aria-label="Comparison categories">{Object.keys(categories).map((c)=><button key={c} role="tab" aria-selected={c===category} onClick={()=>setCategory(c)}>{c}</button>)}</div>
    <MetricTable symbols={symbols} data={data} metrics={categories[category]} />
    <p className="disclosure">Peer medians exclude the base company, missing values, different fiscal years and incompatible currencies. This selected group is not a sector-wide benchmark.</p>
  </section>;
}
