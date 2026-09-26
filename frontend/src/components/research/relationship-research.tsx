"use client";

import { useState } from "react";
import { LoaderCircle, Network, RefreshCw } from "lucide-react";
import { BackendRequestError, postFollowUp } from "@/lib/api";
import { safeUrl } from "@/lib/research";

type Source = { url: string; title: string };

export function RelationshipResearch({ symbol, companyName, context }: {
  symbol: string;
  companyName: string;
  context: Record<string, unknown>;
}) {
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function research() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await postFollowUp(
        symbol,
        `Map the publicly disclosed business relationships of ${symbol} (${companyName}). ` +
          "Use separate sections for suppliers, customers, partners, and competitors, with no more than five high-confidence named companies per section and no generic categories. For each relationship, give the company name, verified public ticker when available, relationship direction, product or service, evidence date, and source. Put a company under supplier or customer only when the source explicitly confirms that buying or selling direction; otherwise put a disclosed collaboration under partners or omit it. Prefer issuer filings and investor relations. Keep the full answer under 900 words, label uncertain evidence, say coverage is not exhaustive, and do not end with a follow-up question. Do not infer a commercial relationship from sector similarity.",
        context,
        [],
        true,
      );
      setAnswer(response.answer);
      setSources(response.sources || []);
    } catch (requestError) {
      setError(requestError instanceof BackendRequestError ? requestError.message : "Relationship research is unavailable. Please retry.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="research-section relationship-research">
      <div className="section-heading">
        <div>
          <h2><Network size={17} /> Business relationships</h2>
          <p>Suppliers, customers, partners, and competitors backed by dated public evidence.</p>
        </div>
        <button className="secondary-button" disabled={loading} onClick={research}>
          {loading ? <LoaderCircle size={14} className="spin" /> : answer ? <RefreshCw size={14} /> : <Network size={14} />}
          {loading ? "Researching…" : answer ? "Refresh research" : "Research supply chain"}
        </button>
      </div>
      {!answer && !loading && !error && <p className="disclosure">Coverage depends on what companies disclose publicly and may be incomplete.</p>}
      {loading && <p className="relationship-status"><LoaderCircle size={15} className="spin" /> Searching filings and issuer sources…</p>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      {answer && <div className="relationship-answer">{answer}</div>}
      {sources.length > 0 && (
        <div className="relationship-sources">
          <h3>Sources</h3>
          {sources.map((source) => {
            const url = safeUrl(source.url);
            return url ? <a key={url} href={url} target="_blank" rel="noreferrer">{source.title || "Source"} ↗</a> : null;
          })}
        </div>
      )}
    </section>
  );
}
