"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, LoaderCircle, Plus, Settings2, X } from "lucide-react";
import { format } from "@/lib/research";

type TapeItem = {
  symbol: string;
  name: string;
  category: string;
  price: number | null;
  changePercent: number | null;
  stale?: boolean;
};

type TapeResponse = { items: TapeItem[]; available: TapeItem[] };
const WORKSPACE_KEY = "marketly.workspace.id";

function workspaceId() {
  const existing = localStorage.getItem(WORKSPACE_KEY);
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(WORKSPACE_KEY, created);
  return created;
}

export function MarketTickerTape() {
  const [data, setData] = useState<TapeResponse>({ items: [], available: [] });
  const [workspace, setWorkspace] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    const id = workspace || workspaceId();
    if (!workspace) setWorkspace(id);
    setBusy(true);
    try {
      const response = await fetch(`/api/backend/market/tape?workspace_key=${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error();
      setData(await response.json() as TapeResponse);
    } finally {
      setBusy(false);
    }
  }, [workspace]);

  useEffect(() => { void load(); }, [load]);

  const selected = useMemo(() => new Set(data.items.map((item) => item.symbol)), [data.items]);
  const loop = data.items.length > 4 ? [...data.items, ...data.items] : data.items;

  async function update(symbol: string) {
    const next = selected.has(symbol)
      ? data.items.map((item) => item.symbol).filter((item) => item !== symbol)
      : [...data.items.map((item) => item.symbol), symbol];
    if (!next.length || next.length > 13) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/backend/market/tape/${encodeURIComponent(workspace)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: next }),
      });
      if (!response.ok) throw new Error();
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="market-tape" aria-label="Global market ticker">
      <div className="market-tape-viewport">
        <div className={`market-tape-track ${data.items.length > 4 ? "scrolling" : ""}`}>
          {loop.map((item, index) => (
            <a href={`https://www.tradingview.com/symbols/${item.symbol}/`} target="_blank" rel="noreferrer" key={`${item.symbol}-${index}`}>
              <span>{item.name}</span><b>{format(item.price, "money")}</b>
              <small className={(item.changePercent || 0) >= 0 ? "positive" : "negative"}>{(item.changePercent || 0) > 0 ? "+" : ""}{format(item.changePercent, "percent")}</small>
            </a>
          ))}
          {busy && !data.items.length && <span className="market-tape-loading"><LoaderCircle className="spin" size={13} /> Loading global markets</span>}
        </div>
      </div>
      <button className="market-tape-manage" aria-label="Customize market ticker" onClick={() => setEditing((value) => !value)}><Settings2 size={14} /></button>
      {editing && <div className="market-tape-picker">
        <header><span>Market tape</span><button onClick={() => setEditing(false)} aria-label="Close ticker settings"><X size={14} /></button></header>
        <p>Choose up to 13 instruments. Your selection follows this workspace.</p>
        <div>{data.available.map((item) => <button disabled={busy || (!selected.has(item.symbol) && selected.size >= 13)} className={selected.has(item.symbol) ? "selected" : ""} key={item.symbol} onClick={() => void update(item.symbol)}>{selected.has(item.symbol) ? <Check size={13} /> : <Plus size={13} />}<span>{item.symbol}<small>{item.name}</small></span></button>)}</div>
      </div>}
    </section>
  );
}
