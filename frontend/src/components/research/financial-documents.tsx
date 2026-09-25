import type { BackendFinancialStatement } from "@/lib/api";
import { safeUrl } from "@/lib/research";

export function FinancialDocuments({ rows }: { rows: BackendFinancialStatement[] }) {
  const documents = Array.from(new Map(rows.map((row) => {
    const url = safeUrl(row.finalLink) || safeUrl(row.link) || safeUrl(row.sourceUrl);
    return [url, { url, row }] as const;
  }).filter(([url]) => url)).values());
  return <details className="financial-data-table">
    <summary>Original filings and source documents</summary>
    {documents.length ? <ul>
      {documents.map(({ url, row }) => <li key={url}>
        <a href={url!} target="_blank" rel="noopener noreferrer">
          {String(row.acceptedForm || "Financial filing")} · {String(row.date || row.fiscalDateEnding || "Period unavailable")}
          {row.sourceDocumentType === "filing_index" ? " · Filing index" : ""} ↗
        </a>
        {typeof row.filedDate === "string" && <span> · Filed {row.filedDate}</span>}
      </li>)}
    </ul> : <p>The provider has not supplied original document links for these statements.</p>}
    <p>Links identify supporting filings. Statements can combine providers and restated values.</p>
  </details>;
}
