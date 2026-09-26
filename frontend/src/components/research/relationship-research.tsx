"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, LoaderCircle, Network, RefreshCw } from "lucide-react";
import { getRelationships, refreshRelationships, type CompanyRelationship } from "@/lib/api";
import { safeUrl } from "@/lib/research";

const GROUPS = ["supplier", "customer", "partner", "competitor", "investor", "other"] as const;
const COLORS: Record<string, string> = {
  supplier: "#d4a85e", customer: "#75b6a4", partner: "#b4e45d",
  competitor: "#d87969", investor: "#a88fd1", other: "#829a6c",
};

function layout(items: CompanyRelationship[]) {
  const anchors: Record<string, { x: number; y: number }> = {
    supplier: { x: 180, y: 145 }, customer: { x: 180, y: 415 },
    partner: { x: 820, y: 145 }, competitor: { x: 820, y: 415 },
    investor: { x: 500, y: 80 }, other: { x: 500, y: 490 },
  };
  return items.map((item, index) => {
    const peers = items.filter((candidate) => candidate.relationship_type === item.relationship_type);
    const groupIndex = peers.findIndex((candidate) => candidate.id === item.id);
    const anchor = anchors[item.relationship_type] || anchors.other;
    const spread = Math.min(210, Math.max(80, peers.length * 42));
    const offset = peers.length > 1 ? (groupIndex / (peers.length - 1) - 0.5) * spread : 0;
    return { ...item, x: anchor.x + offset, y: anchor.y, index };
  });
}

export function RelationshipResearch({ symbol, companyName }: {
  symbol: string;
  companyName: string;
  context?: Record<string, unknown>;
}) {
  const [relationships, setRelationships] = useState<CompanyRelationship[]>([]);
  const [selected, setSelected] = useState<CompanyRelationship>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [coverageNote, setCoverageNote] = useState("");
  const [scanNote, setScanNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getRelationships(symbol);
      setRelationships(response.relationships);
      setCoverageNote(response.coverageNote);
      setSelected(response.relationships[0]);
    } catch {
      setError("Relationship intelligence is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => { void load(); }, [load]);

  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    setError("");
    setScanNote("Reading the latest 30 days of company headlines for dated partnership, customer, supplier, and contract evidence…");
    try {
      const response = await refreshRelationships(symbol);
      setRelationships(response.relationships);
      setCoverageNote(response.coverageNote);
      setSelected(response.relationships[0]);
      setScanNote(response.relationships.length
        ? `Scan complete. ${response.relationships.length} dated relationship${response.relationships.length === 1 ? "" : "s"} available.`
        : "Scan complete. No qualifying dated relationship evidence was found in the current news window.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The evidence refresh could not be completed. Existing relationships are unchanged.");
      setScanNote("");
    } finally {
      setRefreshing(false);
    }
  }

  const nodes = useMemo(() => layout(relationships.slice(0, 28)), [relationships]);
  const counts = useMemo(() => Object.fromEntries(GROUPS.map((group) => [group, relationships.filter((item) => item.relationship_type === group).length])), [relationships]);

  return (
    <section className="relationship-map-section">
      <header className="relationship-map-heading">
        <div>
          <span className="eyebrow">RELATIONSHIP INTELLIGENCE / DATED EVIDENCE</span>
          <h2>{companyName} network</h2>
          <p>Companies connected through disclosed supply, customer, partnership, investment, and competitive relationships.</p>
        </div>
        <button className="secondary-button" disabled={refreshing} onClick={() => void refresh()}>
          {refreshing ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />}
          {refreshing ? "Scanning 30 days…" : "Recheck evidence"}
        </button>
      </header>

      <div className="relationship-map-legend">
        {GROUPS.map((group) => <span key={group}><i style={{ background: COLORS[group] }} />{group}s <b>{counts[group] || 0}</b></span>)}
      </div>

      {loading ? <div className="relationship-map-empty"><LoaderCircle className="spin" size={18} /> Loading saved relationships…</div> : error && !relationships.length ? <div className="inline-error">{error}</div> : !relationships.length ? (
        <div className="relationship-map-empty">
          <Network size={30} />
          <h3>No dated relationship evidence saved yet.</h3>
          <p>Run a recheck to skim recent company news for partnerships, contracts, suppliers, and customers.</p>
          <button className="primary-button" onClick={() => void refresh()}>Scan recent news</button>
        </div>
      ) : (
        <div className="relationship-map-canvas">
          <svg viewBox="0 0 1000 560" role="img" aria-label={`${companyName} business relationship map`}>
            <defs><marker id="relationship-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7" fill="#526c46" /></marker></defs>
            {nodes.map((node) => <line key={`edge-${node.id}`} x1="500" y1="280" x2={node.x} y2={node.y} stroke={COLORS[node.relationship_type] || COLORS.other} strokeOpacity=".42" markerEnd="url(#relationship-arrow)" />)}
            <g className="relationship-core"><rect x="410" y="244" width="180" height="72" rx="8" /><text x="500" y="273" textAnchor="middle">{symbol}</text><text x="500" y="297" textAnchor="middle">{companyName.slice(0, 25)}</text></g>
            {nodes.map((node) => (
              <g className={`relationship-node ${selected?.id === node.id ? "selected" : ""}`} key={node.id} onClick={() => setSelected(node)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") setSelected(node); }}>
                <rect x={node.x - 72} y={node.y - 27} width="144" height="54" rx="6" fill="#162110" stroke={COLORS[node.relationship_type] || COLORS.other} />
                <text x={node.x} y={node.y - 4} textAnchor="middle">{(node.related_symbol || node.related_company_name).slice(0, 18)}</text>
                <text className="relationship-node-type" x={node.x} y={node.y + 15} textAnchor="middle">{node.relationship_type}</text>
              </g>
            ))}
          </svg>
          <aside className="relationship-evidence-panel">
            {selected && <>
              <span style={{ color: COLORS[selected.relationship_type] }}>{selected.relationship_type.toUpperCase()}</span>
              <h3>{selected.related_company_name}</h3>
              <p>{selected.evidence_summary}</p>
              {selected.product_service && <dl><dt>Product / service</dt><dd>{selected.product_service}</dd></dl>}
              <dl><dt>Evidence date</dt><dd>{selected.source_date || "Date unavailable"}</dd><dt>Confidence</dt><dd>{Math.round(Number(selected.confidence) * 100)}%</dd></dl>
              {safeUrl(selected.source_url) && <a href={safeUrl(selected.source_url)} target="_blank" rel="noreferrer">Open evidence <ArrowUpRight size={12} /></a>}
            </>}
          </aside>
        </div>
      )}
      {error && relationships.length > 0 && <p className="inline-error">{error}</p>}
      {scanNote && <p className="relationship-scan-status" role="status">{refreshing && <LoaderCircle className="spin" size={13} />}{scanNote}</p>}
      <p className="disclosure">{coverageNote || "Coverage depends on public disclosure and may be incomplete."} Automatic safety rechecks run every 14 days for active companies.</p>
    </section>
  );
}
