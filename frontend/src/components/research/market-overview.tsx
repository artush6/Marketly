"use client";
import { CompanyLogo } from "./company-logo";
import { useEffect, useState } from "react";
import Image from "next/image";
import { FullMarketMap } from "./full-market-map";
import { MarketMovers } from "./market-movers";
import { MarketBreadth } from "./market-breadth";
import { MarketUpcoming } from "./market-upcoming";
import {
  ArrowUpRight,
  ChevronDown,
  Globe2,
  Plus,
  RefreshCw,
  Star,
} from "lucide-react";
import type { BackendNewsItem } from "@/lib/api";
import {
  type Company,
  format,
  safeUrl,
  STARTER_COMPANIES,
} from "@/lib/research";

export type MarketQuote = {
  symbol: string;
  price: number | null;
  changePercent: number | null;
  timestamp?: number;
  source: string;
  stale?: boolean;
};
export type MarketSnapshot = {
  quotes: MarketQuote[];
  news: BackendNewsItem[];
  fetchedAt: string;
  newsStatus: string;
};
const BENCHMARKS = [
  { symbol: "SPY", name: "S&P 500" },
  { symbol: "QQQ", name: "Nasdaq 100" },
  { symbol: "DIA", name: "Dow Jones" },
  { symbol: "IWM", name: "Russell 2000" },
];
export const FIXED_INCOME = [
  { symbol: "TIP", name: "T.I.P.S." },
  { symbol: "IEF", name: "U.S. Treasuries" },
  { symbol: "MUB", name: "Municipals" },
  { symbol: "CWB", name: "Convertibles" },
  { symbol: "HYG", name: "High Yield" },
  { symbol: "LQD", name: "High Grade" },
] as const;
export function useMarketSnapshot(ready: boolean, watchlist: string[]) {
  const [data, setData] = useState<MarketSnapshot>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const symbols = watchlist.slice(0, 12).join(",");
  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(() => {
      if (!document.hidden) setRevision((n) => n + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, [ready]);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const base = (process.env.NEXT_PUBLIC_API_URL || "/api/backend").replace(
      /\/$/,
      "",
    );
    void fetch(
      `${base}/market/overview?symbols=${encodeURIComponent(symbols)}`,
      {
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(40000),
        ]),
      },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const result: MarketSnapshot = await response.json();
        if (!controller.signal.aborted) setData(result);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Market feed unavailable. Retry to reconnect.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [ready, symbols, revision]);
  return { data, loading, error, refresh: () => setRevision((n) => n + 1) };
}

function ArticleImage({ article }: { article: BackendNewsItem }) {
  const [failed, setFailed] = useState(false);
  return safeUrl(article.image) && !failed ? (
    <Image
      src={safeUrl(article.image)!}
      alt=""
      fill
      unoptimized
      sizes="(max-width: 700px) 100vw, 300px"
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="market-image-fallback">
      <Globe2 size={26} />
      {article.source || "Market news"}
    </span>
  );
}
export function MarketOverview({
  data,
  loading,
  error,
  onRefresh,
  watchlist,
  onSelect,
  onToggle,
  onWatchlist,
}: {
  data?: MarketSnapshot;
  loading: boolean;
  error: string;
  onRefresh: () => void;
  watchlist: string[];
  onSelect: (c: Company) => void;
  onToggle: (s: string) => void;
  onWatchlist: () => void;
}) {
  const quotes = new Map(data?.quotes.map((q) => [q.symbol, q]));
  return (
    <div className="market-home">
      <div className="market-page-heading">
        <div>
          <div className="eyebrow">MARKETLY / OVERVIEW</div>
          <h1>
            The market, in focus<span>.</span>
          </h1>
        </div>
        <div className="market-refresh">
          <span>
            {data
              ? `Fetched ${new Date(data.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "Connecting to market data"}
            <small>Quotes may be delayed</small>
          </span>
          <button
            className="icon-button"
            aria-label="Refresh market overview"
            disabled={loading}
            onClick={onRefresh}
          >
            <RefreshCw size={16} className={loading ? "spin" : ""} />
          </button>
        </div>
      </div>
      {error && (
        <div className="inline-error" role="alert">
          {error} {data && "Showing the previous snapshot."}
        </div>
      )}
      <div className="benchmark-strip">
        {BENCHMARKS.map((item) => {
          const quote = quotes.get(item.symbol);
          return (
            <a
              href={`https://www.tradingview.com/symbols/${item.symbol}/`}
              target="_blank"
              rel="noreferrer"
              className="benchmark"
              key={item.symbol}
            >
              <div>
                <span>{item.name}</span>
                <small>{item.symbol} · ETF</small>
                <ArrowUpRight size={12} />
              </div>
              <strong>
                {loading && !data ? "…" : format(quote?.price, "money")}
              </strong>
              <span
                className={
                  (quote?.changePercent ?? 0) >= 0 ? "positive" : "negative"
                }
              >
                {(quote?.changePercent ?? 0) > 0 ? "+" : ""}
                {format(quote?.changePercent, "percent")}
              </span>
              <small>Index-tracking ETF · USD</small>
            </a>
          );
        })}
      </div>
      <div className="market-home-columns">
        <div className="market-main-column">
          <section className="market-panel">
            <div className="terminal-heading">
              <h2>
                <span>01</span> Market briefing
              </h2>
              <span>WHY MARKETS ARE MOVING</span>
            </div>
            {loading && !data ? (
              <div className="empty-state">Loading market headlines…</div>
            ) : !data?.news.length ? (
              <div className="empty-state">
                Headlines are temporarily unavailable.
              </div>
            ) : (
              <div className="market-headlines">
                {data.news.toSorted((a, b) => (b.importanceScore ?? 0) - (a.importanceScore ?? 0) || (b.datetime ?? 0) - (a.datetime ?? 0)).slice(0, 6).map((article, i) => (
                  <details key={article.url ?? i} open={i === 0}>
                    <summary>
                      <span>{article.headline}</span>
                      <ChevronDown size={14} />
                    </summary>
                    <p>
                      {article.summary ||
                        "Read the original article for the full report."}
                    </p>
                    <a
                      href={safeUrl(article.url)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {article.source || "Original source"}{" "}
                      <ArrowUpRight size={11} />
                    </a>
                  </details>
                ))}
              </div>
            )}
          </section>
          <section className="market-panel heatmap-panel">
            <div className="terminal-heading">
              <h2>
                <span>02</span> Market map
              </h2>
              <span>US LISTINGS / DAILY CHANGE</span>
            </div>
            <FullMarketMap onSelect={onSelect} />
          </section>
        </div>
        <aside className="market-home-sidebar">
          <section className="market-panel">
            <div className="terminal-heading">
              <h2>Your watchlist</h2>
              <button
                className="icon-button"
                onClick={onWatchlist}
                aria-label="Manage watchlist"
              >
                <ArrowUpRight size={15} />
              </button>
            </div>
            <p className="watchlist-unit">Prices in listing currency</p>
            <div className="market-watchlist">
              {watchlist.slice(0, 12).map((symbol) => {
                const c = STARTER_COMPANIES.find(
                  (item) => item.symbol === symbol,
                ) ?? { symbol, name: symbol };
                const q = quotes.get(symbol);
                return (
                  <div key={symbol}>
                    <button onClick={() => onSelect(c)}>
                      <CompanyLogo symbol={symbol} />
                      <span>
                        <b>{symbol}</b>
                        <small>{c.name}</small>
                      </span>
                      <span className="market-watch-price">
                        {format(q?.price, "number")}
                        {q?.stale && <small>Last known price</small>}
                        <small
                          className={
                            (q?.changePercent ?? 0) >= 0
                              ? "positive"
                              : "negative"
                          }
                        >
                          {(q?.changePercent ?? 0) > 0 ? "+" : ""}
                          {format(q?.changePercent, "percent")}
                        </small>
                      </span>
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Unwatch ${symbol}`}
                      onClick={() => onToggle(symbol)}
                    >
                      <Star size={13} fill="currentColor" />
                    </button>
                  </div>
                );
              })}
            </div>
            {!watchlist.length && (
              <p className="empty-state">
                Search for a company to start your watchlist.
              </p>
            )}
            <button
              className="watchlist-add"
              onClick={() =>
                document
                  .querySelector<HTMLInputElement>(
                    '[aria-label="Search companies or tickers"]',
                  )
                  ?.focus()
              }
            >
              <Plus size={13} />
              Add company
            </button>
            {watchlist.length > 12 && (
              <p className="disclosure">
                Showing quotes for the first 12 companies.
              </p>
            )}
          </section>
          <MarketUpcoming symbols={watchlist} />
          <section className="market-panel fixed-income-card">
            <div className="terminal-heading">
              <h2>Fixed income</h2>
              <span>ETF PROXIES</span>
            </div>
            <div className="fixed-income-list">
              {FIXED_INCOME.map((item) => {
                const quote = quotes.get(item.symbol);
                const change = quote?.changePercent;
                return (
                  <a
                    key={item.symbol}
                    href={`https://www.tradingview.com/symbols/${item.symbol}/`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${item.name} market quote`}
                  >
                    <span>{item.name}</span>
                    <strong>
                      {loading && !data
                        ? "…"
                        : format(quote?.price, "money")}
                    </strong>
                    <small
                      className={
                        change == null
                          ? "muted"
                          : change >= 0
                            ? "positive"
                            : "negative"
                      }
                    >
                      {change == null
                        ? "—"
                        : `${change >= 0 ? "↗" : "↘"} ${format(Math.abs(change), "percent")}`}
                    </small>
                  </a>
                );
              })}
            </div>
            <p className="disclosure">
              Liquid ETF proxies · quotes may be delayed
            </p>
          </section>
          <section className="terminal-note">
            <span>RESEARCH WORKFLOW</span>
            <h3>
              Start wide.
              <br />
              Then go deep.
            </h3>
            <p>
              Select a company for financials, competitors, source data, and an
              AI research brief.
            </p>
            <button onClick={() => onSelect(STARTER_COMPANIES[0])}>
              Explore a company <ArrowUpRight size={14} />
            </button>
          </section>
        </aside>
      </div>
      <MarketBreadth />
      <MarketMovers scope="sp500" onSelect={onSelect} />
      <section className="market-discover">
        <div className="terminal-heading"><h2><span>05</span> Beyond the ticker</h2><span>DEEPER RESEARCH / STORIES</span></div>
        <div className="news-grid">
          {data?.news.slice(6, 9).map((article, i) => <article className="market-story" key={article.url ?? i}>
            <a href={safeUrl(article.url)} target="_blank" rel="noreferrer">
              <div className="news-photo"><ArticleImage article={article} /></div>
              <small>{article.source} / {article.datetime ? new Date(article.datetime * 1000).toLocaleDateString([], { month: "short", day: "numeric" }) : "News"}</small>
              <h3>{article.headline}</h3>
            </a>
          </article>)}
        </div>
      </section>
    </div>
  );
}
