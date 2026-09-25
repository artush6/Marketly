import type { BackendFinancialStatement } from "@/lib/api";
import { safeUrl } from "@/lib/research";

export function financialDocumentUrl(row: BackendFinancialStatement) {
  // sourceUrl is resolved against the statement's SEC accession by the backend.
  // Provider link/finalLink fields are legacy fallbacks and may point at retired APIs.
  return safeUrl(row.sourceUrl) || safeUrl(row.finalLink) || safeUrl(row.link);
}

export function FinancialDocuments({
  rows,
  issuer,
}: {
  rows: BackendFinancialStatement[];
  issuer?: string;
}) {
  const documents = Array.from(new Map(rows.map((row) => {
    const url = financialDocumentUrl(row);
    return [url, { url, row }] as const;
  }).filter(([url]) => url)).values());
  return <details className="financial-data-table">
    <summary>
      Open filings published by {issuer || "the company"}
    </summary>
    {documents.length ? <ul>
      {documents.map(({ url, row }) => <li key={url}>
        <a href={url!} target="_blank" rel="noopener noreferrer">
          {String(row.acceptedForm || "Financial filing")} · {String(row.date || row.fiscalDateEnding || "Period unavailable")}
          {safeUrl(row.sourceUrl)
            ? row.sourceDocumentType === "filing_index"
              ? " · SEC filing index"
              : " · SEC filing"
            : " · Original source"} ↗
        </a>
        {typeof row.filedDate === "string" && <span> · Filed {row.filedDate}</span>}
      </li>)}
    </ul> : <p>The provider has not supplied original document links for these statements.</p>}
    <p>Each link opens the filing used to support that statement period. Statements can combine providers and restated values.</p>
  </details>;
}
