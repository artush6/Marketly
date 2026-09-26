"use client";
import { CompanyLogo } from "./company-logo";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Bell,
  Bookmark,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  FileText,
  Globe2,
  Layers3,
  LoaderCircle,
  Plus,
  RefreshCw,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
import {
  getCompanyNews,
  getFinancials,
  getTickerScore,
  type BackendFinancialsResponse,
  type BackendNewsItem,
  type BackendScoreResponse,
} from "@/lib/api";
import {
  type Company,
  type PriceAlert,
  type SavedResearch,
  discovery,
  format,
  metrics,
  peerMean,
  safeUrl,
  STARTER_COMPANIES,
} from "@/lib/research";
import { preloadFinancials } from "@/lib/api";
import { CompanySearch } from "./company-search";
import { EarningsReminders } from "./earnings-reminders";
import { CompanyFinancials } from "./company-financials";
import { PriceChart } from "./price-chart";
import { MarketOverview, useMarketSnapshot } from "./market-overview";
import {
  FinancialDocuments,
  financialDocumentUrl,
} from "./financial-documents";
import { SmallCap } from "./small-cap";
import { SavedConversations } from "./saved-conversations";
import { RelationshipResearch } from "./relationship-research";
import { ChatDock } from "./chat-dock";
import "./research.css";
import "./terminal.css";

type Tab = "Overview" | "Compare" | "News" | "Evidence";
type View = "Small CAP" | "Markets" | "Company" | "Watchlist" | "Saved research";
const STORAGE = "marketly.research.v1";
const INITIAL_WATCHLIST = ["AAPL", "MSFT", "NVDA", "GOOGL"];

const articleImageRequests = new Map<string, Promise<string | undefined>>();

function publisherImage(url: string) {
  const existing = articleImageRequests.get(url);
  if (existing) return existing;
  const request = fetch("/api/article-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(12000),
  })
    .then(async (response) => {
      if (!response.ok) return undefined;
      const preview: BackendNewsItem = await response.json();
      return safeUrl(preview.image);
    })
    .catch(() => undefined);
  articleImageRequests.set(url, request);
  return request;
}

function NewsPhoto({ article }: { article: BackendNewsItem }) {
  const url = safeUrl(article.url);
  const shouldResolvePublisherImage =
    article.source?.toLowerCase().includes("yahoo") && Boolean(url);
  const [src, setSrc] = useState<string | undefined>(
    shouldResolvePublisherImage ? undefined : safeUrl(article.image),
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    if (!shouldResolvePublisherImage || !url) {
      setSrc(safeUrl(article.image));
      return () => {
        active = false;
      };
    }
    setSrc(undefined);
    void publisherImage(url).then((image) => {
      if (active) setSrc(image);
    });
    return () => {
      active = false;
    };
  }, [article.image, shouldResolvePublisherImage, url]);

  return safeUrl(src) && !failed ? (
    <Image
      src={safeUrl(src)!}
      alt={article.headline || "Article image"}
      fill
      unoptimized
      sizes="(max-width: 700px) 100vw, 280px"
      onError={() => setFailed(true)}
    />
  ) : (
    <div className="news-photo-fallback">
      <FileText size={27} />
      <span>Publisher image unavailable</span>
    </div>
  );
}

function NewsCard({ article }: { article: BackendNewsItem }) {
  const url = safeUrl(article.url);
  return (
    <article className="news-card">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="news-photo"
        aria-label={`Read ${article.headline ?? "article"}`}
      >
        <NewsPhoto
          key={`${article.url}-${article.image}`}
          article={article}
        />
      </a>
      <div className="news-byline">
        <span>{article.source || "Publisher"}</span>
        <span>
          {article.datetime
            ? new Date(article.datetime * 1000).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : "Linked article"}
        </span>
      </div>
      <a href={url} target="_blank" rel="noreferrer">
        <h3>
          {article.headline || "Read original article"}{" "}
          <ArrowUpRight size={14} />
        </h3>
      </a>
      {article.summary && <p>{article.summary}</p>}
    </article>
  );
}

export function ResearchDashboard() {
  const [company, setCompany] = useState<Company>(STARTER_COMPANIES[0]);
  const [view, setView] = useState<View>("Markets");
  const [companyOpened, setCompanyOpened] = useState(false);
  const [tab, setTab] = useState<Tab>("Overview");
  const [financials, setFinancials] = useState<BackendFinancialsResponse>();
  const [news, setNews] = useState<BackendNewsItem[]>([]);
  const [analysis, setAnalysis] = useState<BackendScoreResponse>();
  const [loading, setLoading] = useState(true);
  const [newsLoading, setNewsLoading] = useState(true);
  const [error, setError] = useState("");
  const [newsError, setNewsError] = useState("");
  const [revision, setRevision] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [watchlist, setWatchlist] = useState<string[]>(INITIAL_WATCHLIST);
  const [saved, setSaved] = useState<SavedResearch[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [snapshot, setSnapshot] = useState<SavedResearch | null>(null);
  const [peerData, setPeerData] = useState<
    Record<string, BackendFinancialsResponse>
  >({});
  const [peersLoading, setPeersLoading] = useState(false);
  const [peerMessage, setPeerMessage] = useState("");
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertDirection, setAlertDirection] = useState<"above" | "below">(
    "above",
  );
  const [alertPrice, setAlertPrice] = useState("");
  const [articleUrl, setArticleUrl] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const generation = useRef(0);
  const linkGeneration = useRef(0);
  const analysisPending = useRef(false);
  const [peerBusy, setPeerBusy] = useState<string[]>([]);
  const market = useMarketSnapshot(ready, watchlist);
  const preloadSymbols = watchlist.join(",");
  useEffect(() => {
    if (ready) preloadFinancials(preloadSymbols.split(","));
  }, [ready, preloadSymbols]);

  useEffect(() => {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE) || "null");
      if (value) {
        if (Array.isArray(value.watchlist))
          setWatchlist(
            value.watchlist
              .filter(
                (s: unknown) =>
                  typeof s === "string" && /^[A-Z0-9.:-]{1,20}$/.test(s),
              )
              .slice(0, 50),
          );
        if (Array.isArray(value.saved))
          setSaved(
            value.saved
              .filter(
                (s: SavedResearch) =>
                  s &&
                  typeof s.id === "string" &&
                  typeof s.symbol === "string" &&
                  s.financials &&
                  Array.isArray(s.news),
              )
              .slice(0, 30),
          );
        if (Array.isArray(value.alerts))
          setAlerts(
            value.alerts.filter(
              (a: PriceAlert) =>
                a &&
                typeof a.id === "string" &&
                typeof a.symbol === "string" &&
                ["above", "below"].includes(a.direction) &&
                typeof a.price === "number" &&
                Number.isFinite(a.price) &&
                a.price > 0,
            ),
          );
      }
    } catch {
      setNotice("Saved browser data could not be restored.");
    }
    setReady(true);
    const symbol = new URLSearchParams(window.location.search).get("symbol");
    if (symbol && /^[A-Z0-9][A-Z0-9.:-]{0,19}$/.test(symbol)) {
      setCompanyOpened(true);
      setView("Company");
      setCompany(
        STARTER_COMPANIES.find((c) => c.symbol === symbol) ?? {
          symbol,
          name: symbol,
        },
      );
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(
        STORAGE,
        JSON.stringify({ watchlist, saved, alerts }),
      );
    } catch {
      setNotice(
        "Browser storage is full or unavailable. Changes will last only for this visit.",
      );
    }
  }, [ready, watchlist, saved, alerts]);

  useEffect(() => {
    if (!ready || !companyOpened) return;
    const id = ++generation.current;
    linkGeneration.current++;
    setLinkLoading(false);
    setArticleUrl("");
    setPeerData({});
    setPeerMessage("");
    setPeersLoading(false);
    setPeerBusy([]);
    setAnalysis(undefined);
    setAnalyzing(false);
    analysisPending.current = false;
    setError("");
    setNewsError("");
    if (snapshot) {
      setFinancials(snapshot.financials);
      setNews(snapshot.news);
      setAnalysis(snapshot.analysis);
      setLoading(false);
      setNewsLoading(false);
      return;
    }
    setLoading(true);
    setNewsLoading(true);
    setFinancials(undefined);
    setNews([]);
    void getFinancials(company.symbol, revision > 0)
      .then((data) => {
        if (generation.current === id) setFinancials(data);
      })
      .catch(() => {
        if (generation.current === id)
          setError("Financial data is unavailable. Refresh to retry.");
      })
      .finally(() => {
        if (generation.current === id) setLoading(false);
      });
    void getCompanyNews(company.symbol)
      .then((data) => {
        if (generation.current === id)
          setNews(data.filter((a) => safeUrl(a.url)));
      })
      .catch(() => {
        if (generation.current === id)
          setNewsError(
            "The news feed is unavailable. You can still paste an article link below.",
          );
      })
      .finally(() => {
        if (generation.current === id) setNewsLoading(false);
      });
    return () => {
      generation.current = id + 1;
    };
  }, [company.symbol, revision, snapshot, ready, companyOpened]);

  function navigate(next: View) {
    setView(next);
    if (next === "Company") setCompanyOpened(true);
    window.history.replaceState(
      null,
      "",
      next === "Company"
        ? `/?symbol=${encodeURIComponent(company.symbol)}`
        : "/",
    );
  }

  function select(c: Company) {
    setRevision(0);
    setCompany(c);
    setCompanyOpened(true);
    setSnapshot(null);
    setView("Company");
    setTab("Overview");
    setAlertOpen(false);
    setNotice("");
    window.history.replaceState(
      null,
      "",
      `/?symbol=${encodeURIComponent(c.symbol)}`,
    );
  }
  function toggleWatch(symbol: string) {
    setWatchlist((items) =>
      items.includes(symbol)
        ? items.filter((s) => s !== symbol)
        : [...items, symbol].slice(-50),
    );
  }
  function saveResearch() {
    if (!financials) return;
    const item: SavedResearch = {
      id: crypto.randomUUID(),
      symbol: company.symbol,
      name: financials.info?.shortName || company.name,
      savedAt: new Date().toISOString(),
      financials,
      news: news.slice(0, 12),
      analysis,
    };
    setSaved((items) => [item, ...items].slice(0, 30));
    setNotice("Research snapshot saved on this device.");
  }
  async function runAnalysis() {
    if (analysisPending.current) return;
    analysisPending.current = true;
    const id = generation.current;
    setAnalyzing(true);
    setNotice("");
    try {
      const data = await getTickerScore(company.symbol);
      if (id === generation.current) setAnalysis(data);
    } catch {
      if (id === generation.current)
        setNotice("Analysis is unavailable. Please try again.");
    } finally {
      if (id === generation.current) {
        setAnalyzing(false);
        analysisPending.current = false;
      }
    }
  }
  async function addPeer(c: Company) {
    if (
      c.symbol === company.symbol ||
      peerData[c.symbol] ||
      peerBusy.includes(c.symbol)
    )
      return;
    if (Object.keys(peerData).length + peerBusy.length >= 6) {
      setPeerMessage(
        "Compare up to six peers. Remove a company to add another.",
      );
      return;
    }
    const id = generation.current;
    setPeerBusy((items) => [...items, c.symbol]);
    try {
      const data = await getFinancials(c.symbol);
      if (id === generation.current)
        setPeerData((items) => ({ ...items, [c.symbol]: data }));
    } catch {
      if (id === generation.current)
        setPeerMessage(`Could not load ${c.symbol}. Try adding it again.`);
    } finally {
      if (id === generation.current)
        setPeerBusy((items) => items.filter((s) => s !== c.symbol));
    }
  }
  async function discoverPeers() {
    const id = generation.current;
    setPeersLoading(true);
    setPeerMessage("");
    try {
      const data = await discovery<{ symbols: string[] }>(
        `peers/${encodeURIComponent(company.symbol)}`,
      );
      if (id !== generation.current) return;
      if (!data.symbols.length) {
        setPeerMessage("No peers returned. Add companies using search.");
        return;
      }
      const results = await Promise.allSettled(
        data.symbols.slice(0, 4).map((symbol) => getFinancials(symbol)),
      );
      if (id !== generation.current) return;
      const loaded: Record<string, BackendFinancialsResponse> = {};
      results.forEach((result, i) => {
        if (result.status === "fulfilled")
          loaded[data.symbols[i]] = result.value;
      });
      setPeerData(loaded);
      setPeerMessage(
        `Finnhub peer suggestions · ${Object.keys(loaded).length} of ${results.length} loaded. Review the group for business-model fit.`,
      );
    } catch {
      if (id === generation.current)
        setPeerMessage(
          "Peer discovery unavailable. Search above to select competitors manually.",
        );
    } finally {
      if (id === generation.current) setPeersLoading(false);
    }
  }
  async function addArticle(event: React.FormEvent) {
    event.preventDefault();
    const url = safeUrl(articleUrl.trim());
    if (!url || !url.startsWith("https://")) {
      setNotice("Enter a valid HTTPS article link.");
      return;
    }
    const existing = news.find((article) => article.url === url);
    if (existing) {
      setNews((items) => [existing, ...items.filter((a) => a !== existing)]);
      setArticleUrl("");
      return;
    }
    const id = ++linkGeneration.current;
    setLinkLoading(true);
    try {
      const response = await fetch("/api/article-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error("Preview unavailable");
      const article: BackendNewsItem = await response.json();
      if (id === linkGeneration.current) {
        setNews((items) => [article, ...items]);
        setArticleUrl("");
      }
    } catch {
      if (id === linkGeneration.current)
        setNotice(
          "This publisher does not provide an accessible preview. Try another article link.",
        );
    } finally {
      if (id === linkGeneration.current) setLinkLoading(false);
    }
  }

  const m = metrics(financials);
  const name = financials?.info?.shortName || company.name;
  const financialRows = [
    ...(financials?.financials?.income_statement || []),
    ...(financials?.financials?.balance_sheet || []),
    ...(financials?.financials?.cash_flow || []),
  ];
  const latestFiling = financialRows.find((row) => financialDocumentUrl(row));
  const latestFilingUrl = latestFiling
    ? financialDocumentUrl(latestFiling)
    : undefined;
  const latestFilingForm = String(
    latestFiling?.acceptedForm || "financial filing",
  );
  const isWatching = watchlist.includes(company.symbol);
  const selectedPeers = Object.values(peerData);
  const triggeredAlerts = snapshot
    ? []
    : alerts.filter(
        (a) =>
          a.symbol === company.symbol &&
          m.price !== null &&
          (a.direction === "above" ? m.price >= a.price : m.price <= a.price),
      );
  const positive = (m.change ?? 0) >= 0;
  const stats = [
    { label: "Market cap", value: format(m.marketCap, "money", m.currency) },
    { label: "P/E ratio", value: format(m.pe, "multiple") },
    {
      label: "Reported revenue",
      value: format(
        m.revenue,
        "money",
        financials?.financials?.income_statement?.[0]?.reportedCurrency ||
          m.currency,
      ),
    },
    { label: "Net margin", value: format(m.margin, "percent") },
  ];
  const companyAssistantContext = {
    symbol: company.symbol,
    watchlist,
    financialMetrics: m,
    dataQuality: financials?.dataQuality,
    financialSources: financials?.sources,
    analysis: analysis
      ? {
          summary: analysis.summary,
          score: analysis.score,
          positives: analysis.positives,
          negatives: analysis.negatives,
        }
      : null,
    news: news.slice(0, 6).map((article) => ({
      headline: article.headline,
      summary: article.summary?.slice(0, 700),
      url: article.url,
    })),
    comparisonCompanies: [
      ...(financials ? [{
        symbol: company.symbol,
        name,
        metrics: m,
        statementDates: {
          income: financials.financials?.income_statement?.[0]?.date,
          balanceSheet: financials.financials?.balance_sheet?.[0]?.date,
          cashFlow: financials.financials?.cash_flow?.[0]?.date,
        },
        dataQuality: financials.dataQuality,
        provenance: financials.sources,
      }] : []),
      ...Object.entries(peerData).map(([symbol, data]) => ({
        symbol,
        name: data.info?.shortName || symbol,
        metrics: metrics(data),
        statementDates: {
          income: data.financials?.income_statement?.[0]?.date,
          balanceSheet: data.financials?.balance_sheet?.[0]?.date,
          cashFlow: data.financials?.cash_flow?.[0]?.date,
        },
        dataQuality: data.dataQuality,
        provenance: data.sources,
      })),
    ],
    savedAt: snapshot?.savedAt,
  };

  return (
    <div className="research-app">
      <header className="research-header">
        <button
          className="research-brand"
          onClick={() => navigate("Markets")}
          aria-label="Marketly markets"
        >
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          marketly<span className="brand-period">.</span>
        </button>
        <CompanySearch onSelect={select} />
        <div className="header-context">
          <span className="device-dot" />
          Personal workspace<span className="avatar">M</span>
        </div>
      </header>
      <nav className="research-nav" aria-label="Primary navigation">
        <div>
          {(
            ["Markets", "Small CAP", "Company", "Watchlist", "Saved research"] as View[]
          ).map((item) => (
            <button
              className={view === item ? "active" : ""}
              onClick={() => navigate(item)}
              key={item}
            >
              {item === "Markets" ? (
                <Globe2 size={16} />
              ) : item === "Company" ? (
                <Layers3 size={16} />
              ) : item === "Watchlist" ? (
                <Star size={16} />
              ) : (
                <Bookmark size={16} />
              )}
              {item}
              {item === "Saved research" && saved.length > 0 && (
                <small>{saved.length}</small>
              )}
            </button>
          ))}
        </div>
        <span>
          <span className="device-dot" />
          Research workspace <span className="nav-divider">/</span> US equities
        </span>
      </nav>
      <main className="research-main">
        <div className="workspace-heading">
          <div className="breadcrumb">
            Workspace <ChevronRight size={12} /> {view}
          </div>
          <span className="local-label">
            Saved on this device <CircleHelp size={13} />
          </span>
        </div>
        <EarningsReminders symbols={watchlist} ready={ready} />
        {notice && (
          <div className="notice" role="status">
            {notice}
            <button
              onClick={() => setNotice("")}
              aria-label="Dismiss notification"
            >
              <X size={15} />
            </button>
          </div>
        )}
        {triggeredAlerts.length > 0 && (
          <div className="notice alert-notice" role="status">
            <Bell size={15} />
            {triggeredAlerts.length} price condition
            {triggeredAlerts.length > 1 ? "s" : ""} met for {company.symbol} at
            the last fetched quote.
          </div>
        )}
        {view === "Markets" ? (
          <MarketOverview
            data={market.data}
            loading={market.loading}
            error={market.error}
            onRefresh={market.refresh}
            watchlist={watchlist}
            onSelect={select}
            onToggle={toggleWatch}
            onWatchlist={() => navigate("Watchlist")}
          />
        ) : view === "Small CAP" ? (<SmallCap onSelect={select} />) : view === "Saved research" ? (
          <section className="library-view">
            <div className="section-heading">
              <div>
                <h1>Saved research</h1>
                <p>Point-in-time snapshots of your companies and analysis.</p>
              </div>
              <Bookmark size={23} />
            </div>
            <SavedConversations />
            {saved.length === 0 ? (
              <div className="large-empty">
                <Bookmark size={32} />
                <h2>Your research, ready to revisit.</h2>
                <p>
                  Open a company and choose Save research to keep its
                  financials, news, and analysis.
                </p>
                <button
                  className="primary-button"
                  onClick={() => navigate("Markets")}
                >
                  Explore companies <ArrowUpRight size={15} />
                </button>
              </div>
            ) : (
              <div className="saved-list">
                {saved.map((item) => (
                  <div key={item.id}>
                    <button
                      className="saved-item"
                      onClick={() => {
                        setCompany({ symbol: item.symbol, name: item.name });
                        setSnapshot(item);
                        setCompanyOpened(true);
                        setView("Company");
                        setTab("Overview");
                      }}
                    >
                      <CompanyLogo symbol={item.symbol} size="medium" />
                      <span>
                        <b>{item.name}</b>
                        <small>
                          {item.symbol} · Saved{" "}
                          {new Date(item.savedAt).toLocaleString()}
                        </small>
                      </span>
                      <span className="saved-score">
                        {item.analysis?.score != null
                          ? `${item.analysis.score}/100`
                          : "Financial snapshot"}
                      </span>
                      <ArrowUpRight size={17} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Delete saved ${item.symbol} research`}
                      onClick={() =>
                        setSaved((items) =>
                          items.filter((s) => s.id !== item.id),
                        )
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : view === "Watchlist" ? (
          <section className="library-view">
            <div className="section-heading">
              <div>
                <h1>Your watchlist</h1>
                <p>
                  Follow companies. Open one to view its latest available quote
                  and research.
                </p>
              </div>
              <Star size={23} />
            </div>
            <div className="watchlist-grid">
              {watchlist.map((symbol) => (
                <div key={symbol}>
                  <button
                    onClick={() =>
                      select(
                        STARTER_COMPANIES.find((c) => c.symbol === symbol) ?? {
                          symbol,
                          name: symbol,
                        },
                      )
                    }
                  >
                    <CompanyLogo symbol={symbol} size="medium" />
                    <span>
                      <b>{symbol}</b>
                      <small>
                        {STARTER_COMPANIES.find((c) => c.symbol === symbol)
                          ?.name || "Open company"}
                      </small>
                    </span>
                    <ArrowUpRight size={18} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Remove ${symbol} from watchlist`}
                    onClick={() => toggleWatch(symbol)}
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
            {!watchlist.length && (
              <div className="empty-state">
                Search for a company, then select Watch to start your list.
              </div>
            )}
            <div className="section-heading">
              <div>
                <h2>Price alerts</h2>
                <p>
                  Conditions are checked when you open or refresh a company. No
                  background or email notifications.
                </p>
              </div>
            </div>
            {!alerts.length ? (
              <div className="empty-state">
                Use Set alert on a company to add a price condition.
              </div>
            ) : (
              alerts.map((a) => (
                <div className="alert-row" key={a.id}>
                  <Bell size={15} />
                  <b>{a.symbol}</b>
                  <span>
                    {a.direction} {format(a.price)}
                  </span>
                  <button
                    className="icon-button"
                    onClick={() =>
                      setAlerts((items) =>
                        items.filter((item) => item.id !== a.id),
                      )
                    }
                    aria-label={`Delete ${a.symbol} alert`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            )}
          </section>
        ) : (
          <div className="research-columns">
            <div className="research-primary">
              <section className="company-overview">
                {snapshot && (
                  <div className="snapshot-banner">
                    <Bookmark size={14} /> Saved snapshot ·{" "}
                    {new Date(snapshot.savedAt).toLocaleString()}
                    <button onClick={() => setSnapshot(null)}>
                      Return to current data
                    </button>
                  </div>
                )}
                <div className="company-title-row">
                  <div className="company-identity">
                    <CompanyLogo symbol={company.symbol} size="large" />
                    <div>
                      <div className="eyebrow">
                        {company.symbol} <span>·</span>{" "}
                        {financials?.info?.sector || "Company research"}
                      </div>
                      <h1>{name}</h1>
                    </div>
                  </div>
                  <button
                    className={`secondary-button watch-button ${isWatching ? "selected" : ""}`}
                    onClick={() => toggleWatch(company.symbol)}
                  >
                    <Star
                      size={15}
                      fill={isWatching ? "currentColor" : "none"}
                    />
                    {isWatching ? "Watching" : "Watch"}
                  </button>
                </div>
                <div className="company-profile-strip" aria-label="Company details">
                  <div>
                    <small>Sector</small>
                    <strong>{financials?.info?.sector || "—"}</strong>
                  </div>
                  <div>
                    <small>Industry</small>
                    <strong>{financials?.info?.industry || "—"}</strong>
                  </div>
                  <div>
                    <small>Country</small>
                    <strong>{financials?.info?.country || "—"}</strong>
                  </div>
                  <div>
                    <small>Currency</small>
                    <strong>{m.currency}</strong>
                  </div>
                  {safeUrl(financials?.info?.website) && (
                    <a
                      href={safeUrl(financials?.info?.website)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Website <ArrowUpRight size={13} />
                    </a>
                  )}
                </div>
                <div className="quote-row">
                  <div className="quote">
                    <span>
                      {loading ? (
                        <span className="text-skeleton" />
                      ) : (
                        format(m.price, "money", m.currency)
                      )}
                    </span>
                    {m.change !== null && (
                      <span
                        className={`quote-change ${positive ? "positive" : "negative"}`}
                      >
                        {positive ? (
                          <ArrowUp size={15} />
                        ) : (
                          <ArrowDown size={15} />
                        )}
                        {format(Math.abs(m.change), "percent")}
                      </span>
                    )}
                    <small>
                      {m.currency} ·{" "}
                      {snapshot
                        ? "Quote at save time"
                        : "Latest available quote"}
                    </small>
                  </div>
                  <div className="quote-actions">
                    <button
                      className="text-button"
                      disabled={loading || !financials || !!snapshot}
                      onClick={() => {
                        setAlertOpen(!alertOpen);
                        setAlertPrice(m.price?.toFixed(2) ?? "");
                      }}
                    >
                      <Bell size={15} /> Set alert
                    </button>
                    <button
                      className="icon-button"
                      disabled={loading || !!snapshot}
                      onClick={() => setRevision((n) => n + 1)}
                      aria-label="Refresh company data"
                    >
                      <RefreshCw size={15} className={loading ? "spin" : ""} />
                    </button>
                  </div>
                </div>
                {alertOpen && (
                  <form
                    className="alert-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const price = Number(alertPrice);
                      if (!Number.isFinite(price) || price <= 0) return;
                      setAlerts((items) => [
                        ...items,
                        {
                          id: crypto.randomUUID(),
                          symbol: company.symbol,
                          direction: alertDirection,
                          price,
                        },
                      ]);
                      setAlertOpen(false);
                      setNotice(
                        "Price condition saved. Checked when this company is opened or refreshed.",
                      );
                    }}
                  >
                    <span>Notify in this workspace when price is</span>
                    <select
                      aria-label="Alert direction"
                      value={alertDirection}
                      onChange={(e) =>
                        setAlertDirection(e.target.value as "above" | "below")
                      }
                    >
                      <option value="above">Above</option>
                      <option value="below">Below</option>
                    </select>
                    <input
                      aria-label="Target price"
                      type="number"
                      min="0.0001"
                      step="any"
                      required
                      value={alertPrice}
                      onChange={(e) => setAlertPrice(e.target.value)}
                    />
                    <span>{m.currency}</span>
                    <button className="primary-button" type="submit">
                      Save alert
                    </button>
                  </form>
                )}
                {error && (
                  <div className="inline-error" role="alert">
                    {error}
                  </div>
                )}
                {!loading &&
                  financials?.dataQuality &&
                  financials.dataQuality.status !== "complete" && (
                    <div className="quality-note">
                      {financials.dataQuality.status === "stale"
                        ? "Cached data"
                        : "Partial coverage"}{" "}
                      ·{" "}
                      {financials.dataQuality.reason ||
                        "Some provider fields are unavailable."}
                    </div>
                  )}
                {snapshot ? (
                  <div className="empty-state">
                    This report preserves financials and analysis from the save
                    time. Open current data for the live chart.
                  </div>
                ) : (
                  <PriceChart symbol={company.symbol} />
                )}
                <div className="key-metrics">
                  {stats.map((stat) => (
                    <div key={stat.label}>
                      <small>{stat.label}</small>
                      <strong>
                        {loading ? (
                          <span className="text-skeleton" />
                        ) : (
                          stat.value
                        )}
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="data-footnote">
                  Statement period: {String(m.period)}{" "}
                  {latestFilingUrl ? (
                    <a
                      href={latestFilingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${name} ${latestFilingForm}`}
                    >
                      Open {name} {latestFilingForm}{" "}
                      <ArrowUpRight size={11} />
                    </a>
                  ) : (
                    <button onClick={() => setTab("Evidence")}>
                      Check source availability <ArrowUpRight size={11} />
                    </button>
                  )}
                </div>
              </section>
              <nav className="company-tabs" aria-label="Company sections">
                {(["Overview", "Compare", "News", "Evidence"] as Tab[]).map(
                  (t) => (
                    <button
                      key={t}
                      className={tab === t ? "active" : ""}
                      onClick={() => setTab(t)}
                    >
                      {t}
                      {t === "Evidence" && <span className="tab-dot" />}
                    </button>
                  ),
                )}
              </nav>
              <div className="tab-content" key={`${company.symbol}-${tab}`}>
                {tab === "Overview" && (
                  <>
                    <RelationshipResearch
                      key={company.symbol}
                      symbol={company.symbol}
                      companyName={name}
                      context={companyAssistantContext}
                    />
                    <CompanyFinancials
                      key={company.symbol}
                      financials={financials}
                      symbol={company.symbol}
                    />
                    <section className="research-section analyst-section">
                      <div className="section-heading">
                        <h2>
                          <Sparkles size={17} /> Research brief
                        </h2>
                        <span className="section-kicker">
                          AI-assisted analysis
                        </span>
                      </div>
                      {analysis ? (
                        <>
                          <p className="analysis-summary">
                            {analysis.summary ||
                              "The provider did not return a summary."}
                          </p>
                          <div className="analysis-factors">
                            <div>
                              <h3>What supports the thesis</h3>
                              {analysis.positives
                                ?.slice(0, 3)
                                .map((text, i) => (
                                  <p key={i}>
                                    <span className="factor-dot" />
                                    {text}
                                  </p>
                                ))}
                            </div>
                            <div>
                              <h3>What to watch</h3>
                              {analysis.negatives
                                ?.slice(0, 3)
                                .map((text, i) => (
                                  <p key={i}>
                                    <span className="factor-dot risk" />
                                    {text}
                                  </p>
                                ))}
                            </div>
                          </div>
                          <div className="analysis-footer">
                            <span>
                              {analysis.score != null
                                ? `Quality score ${analysis.score}/100`
                                : "Score unavailable"}{" "}
                              ·{" "}
                              {analysis.analysisMetadata?.confidenceLevel ||
                                "Unspecified"}{" "}
                              confidence
                            </span>
                            <button
                              className="text-button"
                              onClick={() =>
                                document
                                  .querySelector<HTMLInputElement>(
                                    '[aria-label="Ask Marketly"]',
                                  )
                                  ?.focus()
                              }
                            >
                              Ask a follow-up <ArrowUpRight size={13} />
                            </button>
                          </div>
                          <p className="disclosure">
                            Generated interpretation. Claim-level document
                            citations are not yet available; inspect reported
                            data in Evidence.
                          </p>
                        </>
                      ) : (
                        <div className="brief-empty">
                          <div>
                            <h3>A second perspective on {company.symbol}.</h3>
                            <p>
                              {snapshot
                                ? "No AI brief was included in this snapshot. Return to current data to generate one."
                                : "Bring financial quality, valuation, catalysts, and risks into one research brief."}
                            </p>
                          </div>
                          <button
                            className="primary-button"
                            disabled={
                              analyzing || loading || !financials || !!snapshot
                            }
                            onClick={runAnalysis}
                          >
                            {analyzing ? (
                              <LoaderCircle size={15} className="spin" />
                            ) : (
                              <Sparkles size={15} />
                            )}
                            {analyzing ? "Preparing brief…" : "Generate brief"}
                          </button>
                        </div>
                      )}
                    </section>
                    <section className="comparison-teaser">
                      <div>
                        <div className="eyebrow">
                          PUT THE NUMBERS IN CONTEXT
                        </div>
                        <h2>How does {company.symbol} compare?</h2>
                        <p>
                          Compare valuation and profitability against the
                          companies that matter.
                        </p>
                      </div>
                      <button
                        className="secondary-button"
                        onClick={() => setTab("Compare")}
                      >
                        Compare peers <ArrowUpRight size={15} />
                      </button>
                    </section>
                  </>
                )}
                {tab === "Compare" && snapshot && (
                  <div className="notice">
                    Comparisons use current peer data. Return to current data to
                    compare companies.
                  </div>
                )}
                {tab === "Compare" && !snapshot && (
                  <section className="research-section">
                    <div className="section-heading">
                      <div>
                        <h2>Company comparison</h2>
                        <p>Your company vs selected competitors.</p>
                      </div>
                      <button
                        className="secondary-button"
                        disabled={peersLoading || peerBusy.length > 0}
                        onClick={discoverPeers}
                      >
                        {peersLoading ? (
                          <LoaderCircle size={14} className="spin" />
                        ) : (
                          <Layers3 size={14} />
                        )}
                        Find peers
                      </button>
                    </div>
                    <CompanySearch compact onSelect={addPeer} />
                    {(peerMessage || peerBusy.length > 0) && (
                      <p className="disclosure" role="status">
                        {peerBusy.length
                          ? `Loading ${peerBusy.join(", ")}…`
                          : peerMessage}
                      </p>
                    )}
                    <div className="comparison-table-wrap">
                      <table className="comparison-table">
                        <thead>
                          <tr>
                            <th>Company</th>
                            <th>P/E</th>
                            <th>Net margin</th>
                            <th>Statement period</th>
                            <th aria-label="Actions" />
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="selected-row">
                            <td>
                              <b>{company.symbol}</b>
                              <small>{name}</small>
                            </td>
                            <td>{format(m.pe, "multiple")}</td>
                            <td>{format(m.margin, "percent")}</td>
                            <td>{String(m.period)}</td>
                            <td>You</td>
                          </tr>
                          {Object.entries(peerData).map(([symbol, data]) => {
                            const peer = metrics(data);
                            return (
                              <tr key={symbol}>
                                <td>
                                  <b>{symbol}</b>
                                  <small>
                                    {data.info?.shortName || symbol}
                                  </small>
                                </td>
                                <td>{format(peer.pe, "multiple")}</td>
                                <td>{format(peer.margin, "percent")}</td>
                                <td>{String(peer.period)}</td>
                                <td>
                                  <button
                                    className="icon-button"
                                    aria-label={`Remove ${symbol} comparison`}
                                    onClick={() =>
                                      setPeerData((items) => {
                                        const next = { ...items };
                                        delete next[symbol];
                                        return next;
                                      })
                                    }
                                  >
                                    <X size={13} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          {selectedPeers.length > 0 && (
                            <tr className="average-row">
                              <td>
                                <b>Selected peer average</b>
                                <small>Excludes {company.symbol}</small>
                              </td>
                              <td>
                                {format(
                                  peerMean(
                                    selectedPeers.map((d) => metrics(d).pe),
                                  ).value,
                                  "multiple",
                                )}
                                <small>
                                  n=
                                  {
                                    peerMean(
                                      selectedPeers.map((d) => metrics(d).pe),
                                    ).count
                                  }
                                </small>
                              </td>
                              <td>
                                {format(
                                  peerMean(
                                    selectedPeers.map((d) => metrics(d).margin),
                                  ).value,
                                  "percent",
                                )}
                                <small>
                                  n=
                                  {
                                    peerMean(
                                      selectedPeers.map(
                                        (d) => metrics(d).margin,
                                      ),
                                    ).count
                                  }
                                </small>
                              </td>
                              <td>Latest available</td>
                              <td />
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    {!selectedPeers.length && (
                      <div className="empty-state">
                        <Layers3 size={22} />
                        Find suggested peers or search for a competitor to build
                        your comparison.
                      </div>
                    )}
                    <p className="disclosure">
                      Simple unweighted averages of available values. Missing
                      fields are excluded. This is a selected peer group, not an
                      industry-wide benchmark. Reporting dates and fiscal
                      periods may differ.
                    </p>
                  </section>
                )}
                {tab === "Evidence" && (
                  <section className="research-section">
                    <div className="section-heading">
                      <div>
                        <h2>Evidence behind the numbers</h2>
                        <p>
                          Reported values, calculation methods, and provider
                          provenance.
                        </p>
                      </div>
                      <FileText size={20} />
                    </div>
                    <div className="evidence-list">
                      {[
                        {
                          title: "Revenue",
                          value: format(
                            m.revenue,
                            "money",
                            financials?.financials?.income_statement?.[0]
                              ?.reportedCurrency || m.currency,
                          ),
                          method:
                            "Latest returned income statement · revenue / totalRevenue",
                          source: financials?.sources?.income_statement,
                          document: financialDocumentUrl(
                            financials?.financials?.income_statement?.[0] || {},
                          ),
                        },
                        {
                          title: "Net margin",
                          value: format(m.margin, "percent"),
                          method:
                            "Calculated: net income ÷ revenue × 100, from the same statement",
                          source: financials?.sources?.income_statement,
                          document: financialDocumentUrl(
                            financials?.financials?.income_statement?.[0] || {},
                          ),
                        },
                        {
                          title: "Trailing P/E",
                          value: format(m.pe, "multiple"),
                          method:
                            "Provider-reported trailing price-to-earnings ratio",
                          source:
                            financials?.sources?.metrics ||
                            financials?.sources?.profile,
                          sourceNote:
                            "Market-derived metric · not reported in an issuer filing",
                          document: undefined,
                        },
                      ].map((item) => (
                        <div className="evidence-row" key={item.title}>
                          <div>
                            <h3>
                              {item.title} <span>{item.value}</span>
                            </h3>
                            <p>{item.method}</p>
                            <small>
                              {item.sourceNote ||
                                `${item.source || "Provider not specified"} · ${String(m.period)}`}
                            </small>
                          </div>
                          {item.document ? (
                            <a
                              aria-label={`Open the original filing for ${item.title}`}
                              href={item.document}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ArrowUpRight size={17} />
                            </a>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <FinancialDocuments
                      rows={financialRows}
                      issuer={name}
                      defaultOpen
                    />
                    <p className="disclosure">
                      Filing links open the original SEC document for the
                      corresponding statement period. Market-derived metrics
                      are labeled separately because they do not appear in an
                      issuer filing. News links below lead to the original
                      publisher.
                    </p>
                    {financials?.dataQuality?.fetchedAt && (
                      <p className="disclosure">
                        Financial data fetched:{" "}
                        {new Date(
                          financials.dataQuality.fetchedAt,
                        ).toLocaleString()}
                      </p>
                    )}
                  </section>
                )}
                {(tab === "Overview" ||
                  tab === "News" ||
                  tab === "Evidence") && (
                  <section className="research-section news-section">
                    <div className="section-heading">
                      <h2>
                        In the news{" "}
                        <span className="count-label">{news.length}</span>
                      </h2>
                      {tab === "Overview" && (
                        <button
                          className="text-button"
                          onClick={() => setTab("News")}
                        >
                          View all <ArrowUpRight size={14} />
                        </button>
                      )}
                    </div>
                    {!snapshot && (
                      <form className="article-link-form" onSubmit={addArticle}>
                        <ExternalLink size={15} />
                        <input
                          aria-label="Paste a news article link"
                          type="url"
                          required
                          placeholder="Paste an article link to add its headline and image"
                          value={articleUrl}
                          onChange={(e) => setArticleUrl(e.target.value)}
                        />
                        <button
                          type="submit"
                          aria-label="Add article"
                          disabled={linkLoading || !articleUrl}
                        >
                          {linkLoading ? (
                            <LoaderCircle size={16} className="spin" />
                          ) : (
                            <Plus size={17} />
                          )}
                          <span>Add article</span>
                        </button>
                      </form>
                    )}
                    {newsError && (
                      <p className="disclosure" role="status">
                        {newsError}
                      </p>
                    )}
                    {newsLoading ? (
                      <div className="news-grid">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="news-skeleton">
                            <div />
                            <span />
                            <span />
                          </div>
                        ))}
                      </div>
                    ) : news.length ? (
                      <div className="news-grid">
                        {news
                          .slice(0, tab === "Overview" ? 3 : 18)
                          .map((article, i) => (
                            <NewsCard
                              key={`${article.url}-${i}`}
                              article={article}
                            />
                          ))}
                      </div>
                    ) : (
                      <div className="empty-state">
                        <FileText size={23} />
                        No articles available. Add a publisher link to start
                        your reading list.
                      </div>
                    )}
                  </section>
                )}
              </div>
            </div>
            <aside className="research-sidebar">
              <section className="sidebar-section">
                <div className="section-heading">
                  <h2>Your watchlist</h2>
                  <button
                    className="icon-button"
                    aria-label="Open watchlist"
                    onClick={() => setView("Watchlist")}
                  >
                    <ArrowUpRight size={16} />
                  </button>
                </div>
                <div className="sidebar-watchlist">
                  {watchlist.slice(0, 7).map((symbol) => {
                    const quote = market.data?.quotes.find((item) => item.symbol === symbol);
                    const price = quote?.price ?? (symbol === company.symbol ? m.price : null);
                    const change = quote?.changePercent ?? (symbol === company.symbol ? m.change : null);
                    return (
                    <div
                      key={symbol}
                      className={symbol === company.symbol ? "current" : ""}
                    >
                      <button
                        onClick={() =>
                          select(
                            STARTER_COMPANIES.find(
                              (c) => c.symbol === symbol,
                            ) ?? { symbol, name: symbol },
                          )
                        }
                      >
                        <CompanyLogo symbol={symbol} />
                        <span>
                          <b>{symbol}</b>
                          <small>
                            {STARTER_COMPANIES.find((c) => c.symbol === symbol)
                              ?.name || "Company"}
                          </small>
                        </span>
                        {price != null ? (
                          <span className="watchlist-price">
                            {format(price, "number")}
                            <small
                              className={(change ?? 0) >= 0 ? "positive" : "negative"}
                            >
                              {format(change, "percent")}
                            </small>
                          </span>
                        ) : (
                          <ChevronRight size={14} />
                        )}
                      </button>
                      <button
                        className="remove-watch"
                        aria-label={`Remove ${symbol} from watchlist`}
                        onClick={() => toggleWatch(symbol)}
                      >
                        <Star size={14} fill="currentColor" />
                      </button>
                    </div>
                  );})}
                </div>
                {watchlist.length === 0 && (
                  <p className="disclosure">Watch a company to add it here.</p>
                )}
                <button
                  className="watchlist-add"
                  onClick={() => {
                    const input = document.querySelector<HTMLInputElement>(
                      '[aria-label="Search companies or tickers"]',
                    );
                    input?.focus();
                  }}
                >
                  <Plus size={14} /> Add company
                </button>
              </section>
              <section className="sidebar-section research-save">
                <div className="save-illustration">
                  <FileText size={28} />
                  <Bookmark size={17} />
                </div>
                <h2>Build your research library.</h2>
                <p>
                  Keep a snapshot of the financials, headlines, and your latest
                  brief.
                </p>
                <button
                  className="primary-button"
                  disabled={!financials || loading}
                  onClick={saveResearch}
                >
                  <Bookmark size={15} />
                  Save research
                </button>
                <small>Stored locally · No account required</small>
              </section>
              <Link
                className="financials-link"
                href={`/financials/${encodeURIComponent(company.symbol)}`}
              >
                <FileText size={17} />
                <span>
                  Explore financial statements
                  <small>Income, balance sheet & cash flow</small>
                </span>
                <ArrowUpRight size={15} />
              </Link>
            </aside>
          </div>
        )}
        <ChatDock
          key={
            view === "Company"
              ? `${company.symbol}:${snapshot?.id || "current"}`
              : "MARKET"
          }
          scope={view === "Company" ? company.symbol : "MARKET"}
          context={
            view === "Company"
              ? companyAssistantContext
              : {
                  scope: "US markets",
                  quotes: market.data?.quotes || [],
                  watchlist,
                  news:
                    market.data?.news.slice(0, 6).map((a) => ({
                      headline: a.headline,
                      summary: a.summary?.slice(0, 700),
                      url: a.url,
                    })) || [],
                  fetchedAt: market.data?.fetchedAt,
                }
          }
        />
        <footer className="research-footer">
          <span>
            marketly<span className="brand-period">.</span>{" "}
            <span>Independent research starts here.</span>
          </span>
          <span>
            Provider data may be delayed. Missing values are shown as —.
          </span>
        </footer>
      </main>
    </div>
  );
}
