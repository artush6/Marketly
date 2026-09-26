"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Pin, RefreshCw } from "lucide-react";
import { getGroupedNews, type BackendNewsItem } from "@/lib/api";
import { safeUrl } from "@/lib/research";
import { CompanyLogo } from "./company-logo";
import { StyledSelect } from "./styled-select";

type SortMode = "importance" | "newest" | "ticker";

function score(article: BackendNewsItem) { return article.importanceScore || 1; }

export function NewsHub({ symbols }: { symbols: string[] }) {
  const [grouped, setGrouped] = useState<Record<string, BackendNewsItem[]>>({});
  const [activeTicker, setActiveTicker] = useState("ALL");
  const [sort, setSort] = useState<SortMode>("importance");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const tickerList = useMemo(() => [...new Set(symbols)].slice(0, 12), [symbols]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void getGroupedNews(tickerList).then((data) => {
      if (!cancelled) setGrouped(data);
    }).catch(() => {
      if (!cancelled) setError("Company news is temporarily unavailable.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [tickerList, revision]);

  const articles = useMemo(() => {
    const flattened = Object.entries(grouped).flatMap(([symbol, items]) => items.map((item) => ({ ...item, symbol })));
    const filtered = activeTicker === "ALL" ? flattened : flattened.filter((article) => article.symbol === activeTicker);
    return filtered.toSorted((a, b) => {
      if (sort === "ticker") return a.symbol.localeCompare(b.symbol) || (b.datetime || 0) - (a.datetime || 0);
      if (sort === "newest") return (b.datetime || 0) - (a.datetime || 0);
      return score(b) - score(a) || (b.datetime || 0) - (a.datetime || 0);
    });
  }, [activeTicker, grouped, sort]);
  const mustKnow = useMemo(() => Object.entries(grouped).flatMap(([symbol, items]) => items.map((item) => ({ ...item, symbol }))).filter((article) => score(article) >= 4).toSorted((a, b) => score(b) - score(a) || (b.datetime || 0) - (a.datetime || 0)).slice(0, 6), [grouped]);

  return (
    <section className="news-hub">
      <div className="news-hub-main">
        <header className="section-heading news-hub-heading">
          <div><span className="eyebrow">WATCHLIST / NEWS INTELLIGENCE</span><h1>Company news</h1><p>Ranked by likely thesis impact, with a dedicated feed for every tracked ticker.</p></div>
          <div className="news-hub-actions">
            <StyledSelect ariaLabel="Sort news" value={sort} onChange={(value) => setSort(value as SortMode)} options={[{ value: "importance", label: "Importance" }, { value: "newest", label: "Newest" }, { value: "ticker", label: "Ticker" }]} />
            <button className="secondary-button" disabled={loading} onClick={() => setRevision((value) => value + 1)}><RefreshCw className={loading ? "spin" : ""} size={14} /> Refresh</button>
          </div>
        </header>

        <nav className="news-ticker-tabs" aria-label="News ticker groups">
          <button className={activeTicker === "ALL" ? "active" : ""} onClick={() => setActiveTicker("ALL")}>All <small>{Object.values(grouped).reduce((total, items) => total + items.length, 0)}</small></button>
          {tickerList.map((symbol) => <button className={activeTicker === symbol ? "active" : ""} onClick={() => setActiveTicker(symbol)} key={symbol}><CompanyLogo symbol={symbol} /> {symbol}<small>{grouped[symbol]?.length || 0}</small></button>)}
        </nav>

        {mustKnow.length > 0 && activeTicker === "ALL" && <section className="must-know-news">
          <div className="terminal-heading"><h2><Pin size={14} /> Must know</h2><span>IMPORTANT / CRITICAL</span></div>
          <div className="must-know-list">{mustKnow.map((article) => <a href={safeUrl(article.url)} target="_blank" rel="noreferrer" key={`${article.symbol}-${article.url}`}><span className="must-know-symbol"><CompanyLogo symbol={article.symbol} />{article.symbol}</span><strong>{article.headline}</strong><small>{article.importanceLabel} · {article.source}</small></a>)}</div>
        </section>}

        {error && <div className="inline-error">{error}</div>}
        {loading && !articles.length ? <div className="large-empty"><LoaderCircle className="spin" size={24} /><h2>Loading company feeds…</h2></div> : (
          <div className="news-ledger">
            {articles.map((article) => {
              const image = safeUrl(article.image);
              return <a className="news-ledger-row" href={safeUrl(article.url)} target="_blank" rel="noreferrer" key={`${article.symbol}-${article.url}-${article.datetime}`}>
                <span className="news-ledger-company"><CompanyLogo symbol={article.symbol} /><span>{article.symbol}</span></span>
                <div className="news-ledger-copy"><div><span className={`importance importance-${article.importanceLabel || "routine"}`}>{article.importanceLabel || "routine"}</span><small>{article.source || "Publisher"} · {article.datetime ? new Date(article.datetime * 1000).toLocaleDateString() : "Date unavailable"}</small></div><h2>{article.headline}</h2><p>{article.summary}</p>{article.relationshipSignal && <span className="relationship-chip">{article.relationshipSignal.relationshipType} · {article.relationshipSignal.relatedCompanyName}</span>}</div>
                {image && <div className="news-ledger-image"><Image src={image} alt="" fill unoptimized sizes="180px" /></div>}
              </a>;
            })}
          </div>
        )}
      </div>
    </section>
  );
}
