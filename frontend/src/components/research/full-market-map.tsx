"use client";
import { useEffect, useMemo, useState } from "react";
import { preloadFinancials } from "@/lib/api";
import type { Company } from "@/lib/research";

type Stock = {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  marketCap: number;
  changePercent: number | null;
};
type Snapshot = { stocks: Stock[]; fetchedAt: string; stale: boolean };
type Box = { x: number; y: number; w: number; h: number };
type Node = { name: string; weight: number; stock?: Stock; children?: Node[] };
// Balanced binary partition preserves area ratios and keeps sector groups together.
function layout(nodes: Node[], box: Box): { node: Node; box: Box }[] {
  if (!nodes.length) return [];
  if (nodes.length === 1) return [{ node: nodes[0], box }];
  const total = nodes.reduce((s, n) => s + n.weight, 0);
  let split = 1,
    sum = nodes[0].weight;
  while (split < nodes.length - 1 && sum + nodes[split].weight / 2 < total / 2)
    sum += nodes[split++].weight;
  const ratio = sum / total;
  const horizontal = box.w >= box.h;
  const first = horizontal
    ? { ...box, w: box.w * ratio }
    : { ...box, h: box.h * ratio };
  const second = horizontal
    ? { ...box, x: box.x + first.w, w: box.w - first.w }
    : { ...box, y: box.y + first.h, h: box.h - first.h };
  return [
    ...layout(nodes.slice(0, split), first),
    ...layout(nodes.slice(split), second),
  ];
}
function color(change: number | null) {
  if (change === null) return "#454c49";
  if (Math.abs(change) < 0.05) return "#59615c";
  const intensity = Math.min(Math.abs(change) / 3, 1);
  return change > 0
    ? `hsl(137 38% ${23 + intensity * 22}%)`
    : `hsl(354 48% ${25 + intensity * 23}%)`;
}
export function FullMarketMap({
  onSelect,
}: {
  onSelect: (c: Company) => void;
}) {
  const [data, setData] = useState<Snapshot>();
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [sector, setSector] = useState("All sectors");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch("/api/backend/market/heatmap", {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]),
    })
      .then(async (r) => {
        if (!r.ok)
          throw new Error("Full-market data is temporarily unavailable.");
        return r.json();
      })
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [revision]);
  const sectors = useMemo(
    () => [...new Set(data?.stocks.map((s) => s.sector))].sort(),
    [data],
  );
  const nodes = useMemo(() => {
    const groups = new Map<string, Map<string, Stock[]>>();
    for (const s of data?.stocks || []) {
      if (sector !== "All sectors" && s.sector !== sector) continue;
      if (!groups.has(s.sector)) groups.set(s.sector, new Map());
      const g = groups.get(s.sector)!;
      g.set(s.industry, [...(g.get(s.industry) || []), s]);
    }
    return [...groups]
      .map(([name, industries]) => ({
        name,
        weight: [...industries.values()]
          .flat()
          .reduce((n, s) => n + s.marketCap, 0),
        children: [...industries]
          .map(([name, stocks]) => ({
            name,
            weight: stocks.reduce((n, s) => n + s.marketCap, 0),
            children: stocks
              .map((stock) => ({
                name: stock.symbol,
                weight: stock.marketCap,
                stock,
              }))
              .sort((a, b) => b.weight - a.weight),
          }))
          .sort((a, b) => b.weight - a.weight),
      }))
      .sort((a, b) => b.weight - a.weight);
  }, [data, sector]);
  const hits = query.trim()
    ? data?.stocks
        .filter((s) =>
          (s.symbol + " " + s.name).toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, 8)
    : [];
  const visibleMatches = hits?.slice(0, 5).map((stock) => stock.symbol).join(",") || "";
  useEffect(() => {
    if (!visibleMatches) return;
    const timer = setTimeout(() => preloadFinancials(visibleMatches.split(","), true), 400);
    return () => clearTimeout(timer);
  }, [visibleMatches]);
  const tiles = useMemo(
    () => layout(nodes, { x: 0, y: 0, w: 1200, h: expanded ? 1000 : 720 }),
    [nodes, expanded],
  );
  function render(nodes: Node[], box: Box, depth: number): React.ReactNode {
    return layout(nodes, box).map(({ node, box: b }) => {
      if (node.stock) {
        const s = node.stock;
        const show = b.w > 36 && b.h > 23;
        const delta =
          s.changePercent === null
            ? "No quote"
            : `${s.changePercent > 0 ? "+" : ""}${s.changePercent.toFixed(2)}%`;
        return (
          <g
            key={s.symbol}
            role="button"
            tabIndex={show ? 0 : -1}
            aria-label={`${s.name}, ${delta}`}
            onMouseEnter={() => preloadFinancials([s.symbol], true)}
            onFocus={() => preloadFinancials([s.symbol], true)}
            onClick={() => onSelect({ symbol: s.symbol, name: s.name })}
            onKeyDown={(e) => {
              if (e.key === "Enter")
                onSelect({ symbol: s.symbol, name: s.name });
            }}
            className="market-map-stock"
          >
            <title>{`${s.name} (${s.symbol}) · ${s.industry}\n${delta}`}</title>
            <rect
              x={b.x}
              y={b.y}
              width={Math.max(0, b.w - 1)}
              height={Math.max(0, b.h - 1)}
              fill={color(s.changePercent)}
            />
            {show && (
              <text
                x={b.x + 5}
                y={b.y + 17}
                fontSize={Math.min(22, b.w / 4)}
                fill="white"
              >
                {s.symbol}
              </text>
            )}
            {b.w > 58 && b.h > 46 && (
              <text x={b.x + 5} y={b.y + 35} fontSize="13" fill="white">
                {delta}
              </text>
            )}
          </g>
        );
      }
      const header = depth === 0 ? 24 : b.w > 100 && b.h > 60 ? 16 : 0;
      return (
        <g key={node.name}>
          <rect
            {...{ x: b.x, y: b.y, width: b.w, height: b.h }}
            fill="#141b16"
          />
          {header > 0 && (
            <text
              x={b.x + 4}
              y={b.y + header - 6}
              fontSize={depth === 0 ? 14 : 10}
              fill="#d7dfd2"
            >
              {node.name.length > b.w / 7
                ? node.name.slice(0, Math.max(0, Math.floor(b.w / 7) - 1)) + "…"
                : node.name}
            </text>
          )}
          {render(
            node.children || [],
            {
              x: b.x + 2,
              y: b.y + header,
              w: Math.max(0, b.w - 4),
              h: Math.max(0, b.h - header - 2),
            },
            depth + 1,
          )}
        </g>
      );
    });
  }
  return (
    <div className="full-market-map">
      <div className="map-controls">
        <select
          aria-label="Map sector"
          value={sector}
          onChange={(e) => setSector(e.target.value)}
        >
          <option>All sectors</option>
          {sectors.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <input
          aria-label="Find a stock on the market map"
          placeholder="Find any company…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button onClick={() => setExpanded(!expanded)}>
          {expanded ? "Compact" : "Expand"}
        </button>
        <button onClick={() => setRevision((n) => n + 1)}>Refresh</button>
      </div>
      {!!hits?.length && (
        <div className="map-search-results">
          {hits.map((s) => (
            <button
              key={s.symbol}
              onClick={() => {
                setSector(s.sector);
                setQuery("");
              }}
            >
              {s.symbol} · {s.name} <small>{s.sector}</small>
            </button>
          ))}
        </div>
      )}
      {query && !hits?.length && data && (
        <p>No matching company in this map.</p>
      )}
      {error && (
        <p role="alert">
          {error}{" "}
          <button onClick={() => setRevision((n) => n + 1)}>Retry</button>
        </p>
      )}
      {!data && !error && (
        <p className="empty-state">Loading the full US market…</p>
      )}
      {data && (
        <>
          <div className="map-coverage">
            {data.stocks.length.toLocaleString()} US-listed stocks ·{" "}
            {sectors.length} sectors · Size: market capitalization
          </div>
          <div className="market-map-canvas">
            <svg
              viewBox={`0 0 1200 ${expanded ? 1000 : 720}`}
              aria-label="US stock market heatmap grouped by sector and industry"
            >
              {tiles.map(({ node, box }) => render([node], box, 0))}
            </svg>
          </div>
          <div className="map-legend">
            <span>−3%</span>
            {[-3, -2, -1, 0, 1, 2, 3].map((n) => (
              <i key={n} style={{ background: color(n) }} />
            ))}
            <span>+3%</span>
            <span>Gray: missing or flat</span>
          </div>
          <p className="map-caption">
            {data.stale ? "Last available snapshot · " : ""}Fetched{" "}
            {new Date(data.fetchedAt).toLocaleString()} · Quotes may be delayed.
            Includes ADRs; coverage is not every global exchange. Click a stock
            to research it.
          </p>
        </>
      )}
      <a
        href="https://finviz.com/map.ashx?t=sec_all"
        target="_blank"
        rel="noreferrer"
      >
        Market data: Finviz ↗
      </a>
    </div>
  );
}
