"use client";
import { useEffect,useState } from "react";
import { format } from "@/lib/research";
type Period={period:string;changePercent:number|null;startDate:string|null;endDate:string;change:number|null};
export function PricePerformance({symbol}:{symbol:string}) {
  const [data,setData]=useState<{periods:Period[];methodology:string}>();const [error,setError]=useState("");const [selected,setSelected]=useState("1Y");const [retry,setRetry]=useState(0);
  useEffect(()=>{let alive=true;setData(undefined);setError("");void fetch(`/api/backend/companies/${encodeURIComponent(symbol)}/performance`).then(async r=>{if(!r.ok)throw Error("Price-period returns are unavailable from the configured data provider.");const v=await r.json();if(alive)setData(v);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[symbol,retry]);
  const point=data?.periods.find(p=>p.period===selected);
  return <section className="price-performance" aria-label="Price performance"><div className="compare-tabs">{["1D","1M","3M","6M","YTD","1Y","3Y","5Y"].map(p=><button key={p} aria-pressed={selected===p} onClick={()=>setSelected(p)}>{p}</button>)}</div>{error?<p className="disclosure">{error} <button onClick={()=>setRetry(retry+1)}>Retry</button></p>:<p><strong>{format(point?.changePercent,"percent")}</strong> <span>{point?.startDate?`${point.startDate} → ${point.endDate}`:data?"Insufficient history for this period":"Loading period returns…"}</span></p>}<details><summary>Return methodology</summary><p className="disclosure">{data?.methodology || "Verified close-to-close price returns. Unavailable values are never estimated."}</p></details></section>;
}
