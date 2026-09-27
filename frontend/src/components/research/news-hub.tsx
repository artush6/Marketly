"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Pin, RefreshCw } from "lucide-react";
import { getGroupedNews, getNewsBriefing, type NewsBriefing, type BackendNewsItem } from "@/lib/api";
import { safeUrl } from "@/lib/research";
import { CompanyLogo } from "./company-logo";
import { StyledSelect } from "./styled-select";

type SortMode = "importance" | "newest" | "ticker";

function score(article: BackendNewsItem) { return article.importanceScore || 1; }

export function NewsHub({ symbols }: { symbols: string[] }) {
  const [briefing, setBriefing] = useState<NewsBriefing>();
  const [briefingLoading, setBriefingLoading] = useState(true);
  const [briefingError, setBriefingError] = useState("");
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
    void (tickerList.length ? getGroupedNews(tickerList) : Promise.resolve({})).then((data) => {
      if (!cancelled) setGrouped(data);
    }).catch(() => {
      if (!cancelled) setError("Company news is temporarily unavailable.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [tickerList, revision]);

  useEffect(() => {
    let cancelled = false;
    setBriefingLoading(true);
    setBriefingError("");
    void getNewsBriefing().then((data) => {
      if (!cancelled) setBriefing(data);
    }).catch(() => {
      if (!cancelled) setBriefingError("Broad news feeds are temporarily unavailable.");
    }).finally(() => { if (!cancelled) setBriefingLoading(false); });
    return () => { cancelled = true; };
  }, [revision]);

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
          <div><span className="eyebrow">MARKETLY / NEWS INTELLIGENCE</span><h1>News & world affairs</h1><p>Major market developments, companies to discover, and the world beyond the market.</p></div>
          <div className="news-hub-actions">
            <button className="secondary-button" disabled={loading || briefingLoading} onClick={() => setRevision((value) => value + 1)}><RefreshCw className={loading || briefingLoading ? "spin" : ""} size={14} /> Refresh</button>
          </div>
        </header>

        {briefingError && <div className="inline-error" role="alert">{briefingError}{briefing && " Showing the previous feed."}</div>}
        <BroadNewsSection title="Market headlines" subtitle="Across companies & sectors" description="Broad market coverage, ranked by reported developments. Independent of your watchlist." feed={briefing?.market} loading={briefingLoading} />
        <BroadNewsSection title="Beyond the market" subtitle="World affairs / geopolitics" description="Geopolitics, policy and global developments from BBC News." feed={briefing?.world} loading={briefingLoading} />
        <header className="news-section-heading"><div><span className="eyebrow">YOUR WATCHLIST</span><h2>Your companies</h2><p>Company-specific reporting for the tickers you follow.</p></div><StyledSelect ariaLabel="Sort company news" value={sort} onChange={(value) => setSort(value as SortMode)} options={[{ value: "importance", label: "Importance" }, { value: "newest", label: "Newest" }, { value: "ticker", label: "Ticker" }]} /></header>
        <nav className="news-ticker-tabs" aria-label="News ticker groups">
          <button className={activeTicker === "ALL" ? "active" : ""} onClick={() => setActiveTicker("ALL")}>All <small>{Object.values(grouped).reduce((total, items) => total + items.length, 0)}</small></button>
          {tickerList.map((symbol) => <button className={activeTicker === symbol ? "active" : ""} onClick={() => setActiveTicker(symbol)} key={symbol}><CompanyLogo symbol={symbol} /> {symbol}<small>{grouped[symbol]?.length || 0}</small></button>)}
        </nav>

        {mustKnow.length > 0 && activeTicker === "ALL" && <section className="must-know-news">
          <div className="terminal-heading"><h2><Pin size={14} /> Must know</h2><span>IMPORTANT / CRITICAL</span></div>
          <div className="must-know-list">{mustKnow.map((article) => <a href={safeUrl(article.url)} target="_blank" rel="noreferrer" key={`${article.symbol}-${article.url}`}><span className="must-know-symbol"><CompanyLogo symbol={article.symbol} />{article.symbol}</span><strong>{article.headline}</strong><small>{article.importanceLabel} · {article.source}</small></a>)}</div>
        </section>}

        {error && <div className="inline-error" role="alert">{error}</div>}
        {!loading && !articles.length && <p className="news-feed-empty">{tickerList.length ? "No recent news for this selection." : "Add companies to your watchlist to see their news here. Market and world coverage remain available above."}</p>}
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

function BroadNewsSection({ title, subtitle, description, feed, loading }: {
  title: string; subtitle: string; description: string; feed?: NewsBriefing["market"]; loading: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const articles = feed?.articles || [];
  return <section className="broad-news-section" aria-label={title}>
    <header className="news-section-heading"><div><span className="eyebrow">{subtitle}</span><h2>{title}</h2><p>{description}</p></div>
      {feed?.fetchedAt && <small>Fetched {new Date(feed.fetchedAt).toLocaleString()}</small>}
    </header>
    {loading && !feed ? <p className="news-feed-empty" role="status">Loading {title.toLowerCase()}…</p> : !articles.length ? <p className="news-feed-empty">{feed?.status === "unavailable" || !feed ? "This feed is temporarily unavailable. Try Refresh." : "No recent stories in this feed."}</p> : <>
      <div className="broad-news-grid">{articles.slice(0, expanded ? 24 : 6).map((article) => <a className="broad-news-story" key={article.url} href={safeUrl(article.url)} target="_blank" rel="noopener noreferrer">
        <div className="news-story-meta"><span>{article.source || "Publisher"}</span><time>{article.datetime ? new Date(article.datetime * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Date unavailable"}</time></div>
        <h3>{article.headline}</h3><p>{article.summary}</p><span className="news-story-open">Read original story ↗</span>
      </a>)}</div>
      {articles.length > 6 && <button className="secondary-button news-show-more" onClick={() => setExpanded((value) => !value)}>{expanded ? "Show fewer stories" : `More stories (${articles.length - 6})`}</button>}
    </>}
  </section>;
}
