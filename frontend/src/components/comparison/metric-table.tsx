import type { BackendFinancialsResponse } from "@/lib/api";
import { benchmark, difference, metricLabels, metricText } from "@/lib/comparison";
export function MetricTable({ symbols, data, metrics }: { symbols: string[]; data: Record<string, BackendFinancialsResponse>; metrics: string[] }) {
  return <div className="comparison-table-wrap"><table className="comparison-table"><thead><tr><th>Metric</th>{symbols.map((s,i) => <th key={s}>{s}{i===0 ? " · Base" : ""}</th>)}<th>Peer median</th><th>Base difference</th></tr></thead><tbody>{metrics.filter((key) => !Object.keys(data).length || symbols.some((s) => data[s]?.comparisonMetrics?.[key]?.value != null)).map((key) => {
    const base = data[symbols[0]]; const peers = symbols.slice(1).map((s) => data[s]).filter(Boolean); const stat=benchmark(base,peers,key);
    return <tr key={key}><th>{metricLabels[key]}</th>{symbols.map((s) => { const p=data[s]?.comparisonMetrics?.[key]; return <td key={s} title={[p?.basis,p?.period,p?.source,p?.note].filter(Boolean).join(" · ")}>{metricText(p)}<small>{p?.period || p?.basis || "Unavailable"}</small></td>; })}<td>{stat.value == null ? "—" : metricText({ ...base!.comparisonMetrics![key], value: stat.value })}<small>n = {stat.count}</small></td><td>{difference(base?.comparisonMetrics?.[key],stat.value)}</td></tr>;
  })}</tbody></table></div>;
}
