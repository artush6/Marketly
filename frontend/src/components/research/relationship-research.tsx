"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, List, LoaderCircle, Network, RefreshCw, Search } from "lucide-react";
import { getRelationships, refreshRelationships, type CompanyRelationship, type RelationshipResponse } from "@/lib/api";
import { safeUrl } from "@/lib/research";

const GROUPS = ["supplier", "customer", "partner", "competitor", "investor", "subsidiary", "other"] as const;
const COLORS: Record<string, string> = { supplier: "#f6aa50", customer: "#64b5f6", partner: "#58c7c2", competitor: "#b59af5", investor: "#e3b5df", subsidiary: "#e6ce79", other: "#939ba7" };
type Entity = CompanyRelationship & { evidence: CompanyRelationship[] };
const nameKey = (name: string) => name.toLowerCase().replace(/\b(incorporated|inc|corporation|corp|limited|ltd|plc)\b/g, "").replace(/[^a-z0-9]/g, "");
function consolidate(rows: CompanyRelationship[]): Entity[] {
  const grouped = new Map<string, Entity>();
  for (const row of [...rows].sort((a, b) => (b.source_date || "").localeCompare(a.source_date || ""))) {
    const key = `${nameKey(row.related_company_name)}:${row.relationship_type}`;
    const existing = grouped.get(key);
    if (existing) existing.evidence.push(row);
    else grouped.set(key, { ...row, evidence: [row] });
  }
  return [...grouped.values()];
}
function graphLayout(items: Entity[]) {
  const left = items.filter((r) => r.relationship_type === "supplier");
  const right = items.filter((r) => r.relationship_type === "customer");
  const rest = items.filter((r) => !["supplier", "customer"].includes(r.relationship_type));
  const middle = Math.max(240, Math.max(left.length, right.length) * 68 + 70);
  const nodes = [
    ...left.map((item, i) => ({ ...item, x: 130, y: 70 + i * 68 })),
    ...right.map((item, i) => ({ ...item, x: 770, y: 70 + i * 68 })),
    ...rest.map((item, i) => ({ ...item, x: 130 + (i % 3) * 320, y: middle + 75 + Math.floor(i / 3) * 68 })),
  ];
  return { nodes, centerY: Math.min(middle / 2, 300), height: middle + (rest.length ? Math.ceil(rest.length / 3) * 68 + 55 : 0) };
}
function status(row: CompanyRelationship) {
  return row.evidence_summary.match(/^\[(CURRENT|HISTORICAL|UNCERTAIN)\]/)?.[1].toLowerCase() || "uncertain";
}

export function RelationshipResearch({ symbol, companyName }: { symbol: string; companyName: string; context?: Record<string, unknown> }) {
  const [data, setData] = useState<RelationshipResponse>();
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState<"map" | "table">("map");
  const busy = requesting || data?.researchState === "queued" || data?.researchState === "running";
  const load = useCallback(async () => {
    try { setData(await getRelationships(symbol)); setError(""); }
    catch { setError("Relationship intelligence is temporarily unavailable. Saved evidence will remain intact."); }
    finally { setLoading(false); }
  }, [symbol]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => { void load(); }, 6000);
    return () => clearInterval(timer);
  }, [busy, load]);
  async function refresh() {
    if (busy) return;
    setRequesting(true); setError("");
    try { setData(await refreshRelationships(symbol)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Research could not be queued."); }
    finally { setRequesting(false); }
  }
  const entities = useMemo(() => consolidate(data?.relationships || []), [data]);
  const filtered = useMemo(() => entities.filter((r) => (filter === "all" || r.relationship_type === filter) && `${r.related_company_name} ${r.related_symbol || ""} ${r.product_service || ""}`.toLowerCase().includes(query.toLowerCase())), [entities, filter, query]);
  const selected = filtered.find((r) => r.id === selectedId) || filtered[0];
  const graph = useMemo(() => graphLayout(filtered), [filtered]);
  // SVG paints in document order: selection is always the last layer.
  const nodes = [...graph.nodes].sort((a, b) => Number(a.id === selected?.id) - Number(b.id === selected?.id));
  const report = data?.researchReport;
  return <section className="relationship-map-section">
    <header className="relationship-map-heading">
      <div><span className="eyebrow">CORPORATE INTELLIGENCE / {symbol}</span><h2>Business relationships</h2><p>Supply chain, strategic partners, ownership and competition.</p></div>
      <button className="primary-button" disabled={busy} onClick={() => void refresh()}>{busy ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />}{busy ? "Research in progress" : "Deep research"}</button>
    </header>
    <div className="network-summary"><span><b>{entities.length}</b> relationships</span><span><b>{data?.relationships.length || 0}</b> evidence records</span><span>{report ? `Last researched ${new Date(report.completedAt).toLocaleDateString()}` : "Historical baseline awaiting research"}</span></div>
    <div className="network-toolbar"><label><Search size={14} /><input aria-label="Search relationships" placeholder="Find a company or product…" value={query} onChange={(e) => setQuery(e.target.value)} /></label><div className="network-view-switch"><button aria-pressed={view === "map"} onClick={() => setView("map")}><Network size={14} /> Map</button><button aria-pressed={view === "table"} onClick={() => setView("table")}><List size={14} /> Table</button></div></div>
    <nav className="relationship-map-legend" aria-label="Relationship categories"><button aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All <b>{entities.length}</b></button>{GROUPS.map((group) => <button aria-pressed={filter === group} onClick={() => setFilter(group)} key={group}><i style={{ background: COLORS[group] }} />{group === "subsidiary" ? "subsidiaries" : group === "other" ? "other" : `${group}s`} <b>{entities.filter((r) => r.relationship_type === group).length}</b></button>)}</nav>
    {busy && <p className="relationship-scan-status" role="status"><LoaderCircle className="spin" size={14} />{data?.researchState === "running" ? "Researching filings, supplier disclosures and historical corporate announcements. This may take several minutes." : "Research queued. You can leave this tab; results are saved automatically."}</p>}
    {data?.researchState === "failed" && <p className="inline-error">The last research run failed. Existing evidence is preserved; the background queue will retry.</p>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    {loading ? <div className="relationship-map-empty"><LoaderCircle className="spin" size={22} />Loading saved relationships…</div> : !filtered.length ? <div className="relationship-map-empty"><Network size={32} /><h3>{entities.length ? "No matching relationships" : "Build the company’s relationship baseline"}</h3><p>{entities.length ? "Try another category or search." : "Deep research searches years of public disclosures, then saves dated evidence for each connection."}</p>{!entities.length && <button className="secondary-button" disabled={busy} onClick={() => void refresh()}>Research {symbol}</button>}</div> : <div className="relationship-map-canvas">
      <div className="network-scroll">{view === "map" ? <svg viewBox={`0 0 900 ${graph.height}`} style={{ height: graph.height }} role="group" aria-label={`${companyName} relationship map`}>
        <text className="network-column-label" x="20" y="25">SUPPLIERS →</text><text className="network-column-label" x="660" y="25">→ CUSTOMERS</text>
        {graph.nodes.map((node) => <path key={`edge-${node.id}`} d={`M450,${graph.centerY} C450,${node.y} ${node.x},${graph.centerY} ${node.x},${node.y}`} fill="none" stroke={COLORS[node.relationship_type]} strokeOpacity={selected?.id === node.id ? .9 : .2} strokeWidth={selected?.id === node.id ? 2 : 1} />)}
        <g className="relationship-core"><rect x="350" y={graph.centerY - 36} width="200" height="72" rx="3" /><text x="450" y={graph.centerY - 5} textAnchor="middle">{symbol}</text><text x="450" y={graph.centerY + 16} textAnchor="middle">{companyName.length > 26 ? `${companyName.slice(0, 25)}…` : companyName}</text></g>
        {nodes.map((node) => <g className={`relationship-node ${selected?.id === node.id ? "selected" : ""}`} key={node.id} onClick={() => setSelectedId(node.id)} role="button" aria-pressed={selected?.id === node.id} aria-label={`${node.related_company_name}, ${node.relationship_type}`} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedId(node.id); } }}><title>{node.related_company_name} · {node.product_service || node.relationship_type}</title><rect x={node.x - 110} y={node.y - 26} width="220" height="52" rx="3" stroke={COLORS[node.relationship_type]} /><text x={node.x - 98} y={node.y - 5}>{(node.related_symbol || node.related_company_name).slice(0, 28)}</text><text className="relationship-node-type" x={node.x - 98} y={node.y + 14}>{node.relationship_type.toUpperCase()} · {node.evidence.length} SOURCE{node.evidence.length > 1 ? "S" : ""}</text></g>)}
      </svg> : <table className="network-table"><thead><tr><th>Company</th><th>Relationship</th><th>Evidence date</th><th>Status</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id} className={row.id === selected?.id ? "selected-row" : ""}><td><button onClick={() => setSelectedId(row.id)}>{row.related_company_name}<small>{row.related_symbol || "Private / unlisted"}</small></button></td><td style={{ color: COLORS[row.relationship_type] }}>{row.relationship_type}</td><td>{row.source_date || "Unknown"}</td><td>{status(row)}</td></tr>)}</tbody></table>}</div>
      <aside className="relationship-evidence-panel" aria-live="polite" key={selected?.id}>{selected && <><span style={{ color: COLORS[selected.relationship_type] }}>{selected.relationship_type.toUpperCase()}</span><h3>{selected.related_company_name}</h3><div className="network-status">{status(selected)} · {selected.evidence.length} source{selected.evidence.length > 1 ? "s" : ""}</div>{selected.product_service && <dl><dt>Product / service</dt><dd>{selected.product_service}</dd></dl>}<dl><dt>Commercial direction</dt><dd>{selected.relationship_type === "supplier" ? `${selected.related_company_name} → ${symbol}` : selected.relationship_type === "customer" ? `${symbol} → ${selected.related_company_name}` : selected.direction}</dd></dl>{selected.evidence.map((evidence) => <article key={evidence.id}><div className="network-evidence-date">{evidence.source_date || "Date unavailable"} · {Math.round(Number(evidence.confidence) * 100)}% confidence</div><p>{evidence.evidence_summary.replace(/^\[\w+\]\s*/, "")}</p>{safeUrl(evidence.source_url) && <a href={safeUrl(evidence.source_url)} target="_blank" rel="noreferrer">Read source <ArrowUpRight size={12} /></a>}</article>)}</>}</aside>
    </div>}
    {report && <details className="network-coverage"><summary>Research coverage · {report.passes.length}/3 passes completed{report.failures.length ? " · partial results" : ""}</summary>{report.passes.map((pass) => <div key={pass.scope}><b>{pass.scope.replaceAll("_", " ")}</b><span>{pass.saved} evidence records saved</span>{pass.coverageGaps.map((gap, i) => <p key={i}>{gap}</p>)}</div>)}</details>}
    <p className="disclosure">{data?.coverageNote || "Public disclosure coverage is not exhaustive."} Active companies are researched every 14 days.</p>
  </section>;
}
