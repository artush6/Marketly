"use client";
import { userStorage } from "@/lib/user-storage";
import { CompactComparison } from "../comparison/compact-comparison";
import { DeferredSection } from "./deferred-section";
import { Expectations } from "./expectations";
import { CompanyLogo } from "./company-logo";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";

import {
  ArrowUpRight,
  Bell,
  Bookmark,
  Building2,
  ChevronRight,
  ExternalLink,
  FileText,
  LoaderCircle,
  Plus,
  RefreshCw,
  Sparkles,
  Star,
  Trash2,
  Users,
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
  type SymbolAlertRule,
  type SavedResearch,
  discovery,
  format,
  metrics,
  safeUrl,
  STARTER_COMPANIES,
} from "@/lib/research";
import { preloadFinancials } from "@/lib/api";
import { CompanySearch } from "./company-search";
import { EarningsReminders } from "./earnings-reminders";
import { CompanyFinancials } from "./company-financials";
import { CompanyResearchSnapshot } from "./company-research-snapshot";
import { PriceChart } from "./price-chart";
import { MarketOverview, useMarketSnapshot } from "./market-overview";
import { MarketMovers } from "./market-movers";
import {
  FinancialDocuments,
  financialDocumentUrl,
} from "./financial-documents";
import { SmallCap } from "./small-cap";
import { ResearchLibrary } from "./research-library";
import { RelationshipResearch } from "./relationship-research";
import { WorkspaceChrome } from "./workspace-shell";
import { ChatDock } from "./chat-dock";
import { NewsHub } from "./news-hub";
import { ResearchCalendar } from "./research-calendar";

import { AlertCenter } from "./alert-center";

type View = "Small CAP" | "Markets" | "News" | "Company" | "Watchlist" | "Saved research" | "Calendar" | "Alerts";
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
      <button className="text-button" onClick={() => window.dispatchEvent(new CustomEvent("marketly-research-question", {detail: `Analyze this article: ${url}. ${article.headline || ""} Read the source if accessible, summarize the key facts and implications, and clearly state if only an excerpt is available.`}))}>Analyze in chat ↗</button>
    </article>
  );
}

export function ResearchDashboard({ initialView = "Markets" }: { initialView?: View }) {

  const [company, setCompany] = useState<Company>(STARTER_COMPANIES[0]);
  const [view, setView] = useState<View>(initialView);
  const [companyOpened, setCompanyOpened] = useState(false);
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
  const [alertRules, setAlertRules] = useState<SymbolAlertRule[]>([]);
  const [alertRulesError, setAlertRulesError] = useState("");
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [snapshot, setSnapshot] = useState<SavedResearch | null>(null);
  const [peerData, setPeerData] = useState<
    Record<string, BackendFinancialsResponse>
  >({});
  const [peersLoading, setPeersLoading] = useState(false);
  const [peerMessage, setPeerMessage] = useState("");
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertBusy, setAlertBusy] = useState(false);
  const [alertError, setAlertError] = useState("");
  const [alertKind, setAlertKind] = useState<"price" | "percent_change">("price");
  const [followFromAlert, setFollowFromAlert] = useState(false);
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
      const value = JSON.parse(userStorage.getItem(STORAGE) || "null");
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
      }
    } catch {
      setNotice("Saved browser data could not be restored.");
    }
    setReady(true);
    const requestedView = new URLSearchParams(window.location.search).get("view");
    if (["Markets", "Small CAP", "News", "Company", "Watchlist", "Saved research", "Calendar", "Alerts"].includes(requestedView || "")) setView(requestedView as View);
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
    let active = true;
    void fetch("/api/backend/notifications/rules", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.detail || "Ticker alert rules could not be loaded.");
        if (active) setAlertRules(Array.isArray(payload.rules) ? payload.rules : []);
      })
      .catch((reason) => {
        if (active && reason instanceof Error && !reason.message.includes("Sign in")) setAlertRulesError(reason.message);
      });
    return () => { active = false; };
  }, [ready]);

  useEffect(() => {
    if (!alertOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setAlertOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [alertOpen]);

  useEffect(() => {
    if (!ready) return;
    try {
      userStorage.setItem(
        STORAGE,
        JSON.stringify({ watchlist, saved }),
      );
    } catch {
      setNotice(
        "Browser storage is full or unavailable. Changes will last only for this visit.",
      );
    }
  }, [ready, watchlist, saved]);

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
        : `/?view=${encodeURIComponent(next)}`,
    );
  }

  function select(c: Company) {
    setRevision(0);
    setCompany(c);
    setCompanyOpened(true);
    setSnapshot(null);
    setView("Company");
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
  async function saveTickerAlert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const threshold = Number(alertPrice);
    if (!Number.isFinite(threshold) || threshold <= 0 || (alertKind === "percent_change" && threshold > 100)) return;
    setAlertBusy(true); setAlertError("");
    try {
      const response = await fetch("/api/backend/notifications/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: company.symbol,
          trigger_type: alertKind,
          direction: alertDirection,
          threshold,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || "Could not save this ticker alert.");
      const rule = payload.rule as SymbolAlertRule;
      setAlertRules((items) => [rule, ...items.filter((item) => item.id !== rule.id)]);
      if (followFromAlert && !watchlist.includes(company.symbol)) toggleWatch(company.symbol);
      setAlertOpen(false);
      setNotice("Alert saved. Marketly will check it during background quote refreshes and notify your enabled devices.");
    } catch (reason) {
      setAlertError(reason instanceof Error ? reason.message : "Could not save this ticker alert.");
    } finally {
      setAlertBusy(false);
    }
  }
  async function deleteTickerAlert(rule: SymbolAlertRule) {
    try {
      const response = await fetch(`/api/backend/notifications/rules/${encodeURIComponent(rule.id)}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || "Could not remove this ticker alert.");
      setAlertRules((items) => items.filter((item) => item.id !== rule.id));
    } catch (reason) {
      setAlertRulesError(reason instanceof Error ? reason.message : "Could not remove this ticker alert.");
    }
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
    if (Object.keys(peerData).length + peerBusy.length >= 5) {
      setPeerMessage(
        "Compare up to six companies. Remove a company to add another.",
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
      const data = await discovery<{ groups: { type: string; label: string; candidates: { symbol: string }[] }[] }>(
        `comparables/${encodeURIComponent(company.symbol)}`,
      );
      if (id !== generation.current) return;
      const direct = data.groups.find((group) => group.type === "verified_competitor")?.candidates.map((item) => item.symbol) || [];
      const industry = data.groups.find((group) => group.type === "industry_peer")?.candidates.map((item) => item.symbol) || [];
      const symbols = [...new Set([...direct, ...industry])].filter((symbol) => symbol !== company.symbol);
      if (!symbols.length) {
        setPeerMessage("No peers returned. Add companies using search.");
        return;
      }
      const results = await Promise.allSettled(
        symbols.slice(0, 4).map((symbol) => getFinancials(symbol)),
      );
      if (id !== generation.current) return;
      const loaded: Record<string, BackendFinancialsResponse> = {};
      results.forEach((result, i) => {
        if (result.status === "fulfilled")
          loaded[symbols[i]] = result.value;
      });
      setPeerData(loaded);
      setPeerMessage(
        `${direct.length ? "Verified competitors first, then industry peers" : "Industry peer suggestions"} · ${Object.keys(loaded).length} of ${results.length} loaded. Review business-model fit before comparing.`,
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
      image: article.image,
      source: article.source,
      datetime: article.datetime,
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
      <WorkspaceChrome active={view} onNavigate={navigate} onSelect={select} />
      <main className="research-main">
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
        {view === "Alerts" ? (
          <AlertCenter onSelectSymbol={select} />
        ) : view === "Calendar" ? (
          <ResearchCalendar symbols={watchlist} onSelectSymbol={(symbol) => select({
            symbol,
            name: STARTER_COMPANIES.find((item) => item.symbol === symbol)?.name || symbol,
          })} />
        ) : view === "Markets" ? (
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
        ) : view === "Small CAP" ? (<SmallCap onSelect={select} />) : view === "News" ? (
          <NewsHub symbols={watchlist} />
        ) : view === "Saved research" ? (
          <ResearchLibrary items={saved} onExplore={() => navigate("Company")} onDelete={id=>setSaved(items=>items.filter(item=>item.id!==id))} onOpen={item=>{ setCompany({symbol:item.symbol,name:item.name}); setSnapshot(item); setCompanyOpened(true); setView("Company"); }} />
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
            <div className="ui-toolbar"><CompanySearch compact onSelect={c=>{if(!watchlist.includes(c.symbol))toggleWatch(c.symbol);}}/><button onClick={()=>navigate("Calendar")}>Upcoming earnings</button><button onClick={()=>navigate("News")}>Watchlist news</button></div>
            <div className="comparison-table-wrap"><table className="terminal-table"><thead><tr><th>Company</th><th>Price</th><th>1D</th><th>Research</th><th>Following</th></tr></thead><tbody>{watchlist.map(symbol=>{const c=STARTER_COMPANIES.find(item=>item.symbol===symbol)||{symbol,name:symbol};const q=market.data?.quotes.find(item=>item.symbol===symbol);return <tr key={symbol}><th><button onClick={()=>select(c)}>{symbol}<small>{c.name}</small></button></th><td>{format(q?.price,"number")}</td><td className={(q?.changePercent??0)>=0?"positive":"negative"}>{format(q?.changePercent,"percent")}</td><td><button onClick={()=>select(c)}>Open research ↗</button></td><td><button aria-label={`Remove ${symbol} from watchlist`} onClick={()=>toggleWatch(symbol)}><Star size={15} fill="currentColor"/></button></td></tr>;})}</tbody></table></div>
            {!watchlist.length && (
              <div className="empty-state">
                Search for a company, then select Watch to start your list.
              </div>
            )}
            <div className="section-heading">
              <div>
                <h2>Ticker alerts</h2>
                <p>Custom rules are checked by the background market worker. Enable a device on Alerts to receive push notifications.</p>
              </div>
            </div>
            {alertRulesError && <div className="inline-error" role="alert">{alertRulesError}</div>}
            {!alertRules.length ? (
              <div className="empty-state">Use Set alert on a company to add a background price or daily-move condition.</div>
            ) : alertRules.map((rule) => (
                <div className="alert-row" key={rule.id}>
                  <Bell size={15} />
                  <b>{rule.symbol}</b>
                  <span>
                    {rule.trigger_type === "price"
                      ? `Price ${rule.direction} ${Number(rule.threshold).toLocaleString(undefined, { maximumFractionDigits: 4 })}`
                      : `Daily move ${rule.direction === "above" ? "up" : "down"} ${rule.threshold}%`}
                  </span>
                  <button
                    className="icon-button"
                    onClick={() => void deleteTickerAlert(rule)}
                    aria-label={`Delete ${rule.symbol} alert`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
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
                  <div className="company-title-actions">
                    <button
                      className={`secondary-button watch-button ${isWatching ? "selected" : ""}`}
                      onClick={() => toggleWatch(company.symbol)}
                    >
                      <Star size={15} fill={isWatching ? "currentColor" : "none"} />
                      {isWatching ? "Watching" : "Watch"}
                    </button>
                    <button
                      className="text-button"
                      disabled={loading || !financials || !!snapshot}
                      onClick={() => {
                        setAlertKind("price");
                        setAlertDirection("above");
                        setAlertPrice(m.price?.toFixed(2) ?? "");
                        setFollowFromAlert(!isWatching);
                        setAlertError("");
                        setAlertOpen(true);
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
                {alertOpen && (
                  <div className="alert-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAlertOpen(false); }}>
                    <section className="alert-modal" role="dialog" aria-modal="true" aria-labelledby="symbol-alert-title">
                      <header><div><span className="eyebrow">BACKGROUND MARKET WATCH</span><h2 id="symbol-alert-title">Set alert for {company.symbol}</h2><p>Choose a price level or a daily percentage move to monitor.</p></div><button type="button" className="icon-button" aria-label="Close alert dialog" onClick={() => setAlertOpen(false)}><X size={17} /></button></header>
                      <form className="alert-rule-form" onSubmit={(event) => void saveTickerAlert(event)}>
                        <label>Alert type<select value={alertKind} onChange={(event) => { const next = event.target.value as "price" | "percent_change"; setAlertKind(next); setAlertPrice(next === "price" ? m.price?.toFixed(2) ?? "" : "5"); }}><option value="price">Price reaches</option><option value="percent_change">Daily change reaches</option></select></label>
                        <label>{alertKind === "price" ? "Condition" : "Direction"}<select value={alertDirection} onChange={(event) => setAlertDirection(event.target.value as "above" | "below")}><option value="above">{alertKind === "price" ? "Above" : "Up by"}</option><option value="below">{alertKind === "price" ? "Below" : "Down by"}</option></select></label>
                        <label>{alertKind === "price" ? `Target price (${m.currency})` : "Daily change (%)"}<input autoFocus type="number" min="0.01" max={alertKind === "percent_change" ? 100 : undefined} step={alertKind === "price" ? "any" : "0.1"} required value={alertPrice} onChange={(event) => setAlertPrice(event.target.value)} /></label>
                        <label className="alert-modal-follow"><input type="checkbox" checked={isWatching || followFromAlert} disabled={isWatching} onChange={(event) => setFollowFromAlert(event.target.checked)} /><span><strong>{isWatching ? "In your watchlist" : "Also follow this company"}</strong><small>Followed stocks receive your general price-drop and important-news alerts.</small></span></label>
                        <p className="disclosure">Rules are checked during background quote refreshes. Price changes use the provider’s daily move versus the previous close. Push delivery requires an enabled device.</p>
                        {alertError && <div className="inline-error" role="alert">{alertError}</div>}
                        <footer><button type="button" className="secondary-button" disabled={alertBusy} onClick={() => setAlertOpen(false)}>Cancel</button><button type="submit" className="primary-button" disabled={alertBusy}>{alertBusy ? "Saving…" : "Save alert"}</button></footer>
                      </form>
                    </section>
                  </div>
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
                <CompanyResearchSnapshot
                  financials={financials}
                  analysis={analysis}
                  loading={loading}
                />
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
                    <button onClick={() => { location.hash="company-evidence"; }}>
                      Check source availability <ArrowUpRight size={11} />
                    </button>
                  )}
                </div>
              </section>
              <nav className="company-tabs ticker-section-nav" aria-label="Company sections">
                {(["Financials", "Expectations", "Network", "Compare", "News", "Profile", "Evidence"] as const).map((t) => <a key={t} href={`#company-${t.toLowerCase()}`}>{t}</a>)}
              </nav>
              <div className="tab-content" key={company.symbol}>
                {companyOpened && (
                  <>
                    <CompanyFinancials
                      key={company.symbol}
                      financials={financials}
                      symbol={company.symbol}
                    />
                    {!snapshot && <DeferredSection id="company-expectations" title="Expectations vs actuals"><Expectations symbol={company.symbol} /></DeferredSection>}
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
                  </>
                )}
                {companyOpened && (
                  <section id="company-profile" className="research-section company-facts">
                    <div className="section-heading"><div><h2><Building2 size={17} /> Company profile</h2><p>Leadership, scale, and operating footprint from the latest available profile.</p></div></div>
                    <div className="company-fact-grid">
                      <div><small><Users size={13} /> Employees</small><strong>{financials?.info?.fullTimeEmployees?.toLocaleString() || "Not reported"}</strong></div>
                      <div><small>Chief executive</small><strong>{financials?.info?.chiefExecutive || "Not reported"}</strong></div>
                      <div><small>Headquarters</small><strong>{financials?.info?.headquarters || "Not reported"}</strong></div>
                      <div><small>Founded</small><strong>{financials?.info?.foundedYear || "Not reported"}</strong></div>
                      <div><small>Public since</small><strong>{financials?.info?.ipoDate || "Not reported"}</strong></div>
                      <div><small>Industry</small><strong>{financials?.info?.industry || "Not reported"}</strong></div>
                    </div>
                    {financials?.info?.longBusinessSummary && <div className="company-description"><h3>What the company does</h3><p>{financials.info.longBusinessSummary}</p></div>}
                    {financials?.info?.officeLocations?.length ? <div className="company-description"><h3>Office footprint</h3><div className="office-list">{financials.info.officeLocations.slice(0, 12).map((office, index) => <span key={`${office.address1 || office.city}-${index}`}>{[office.address1, office.city, office.state, office.country].filter(Boolean).join(", ")}</span>)}</div></div> : null}
                    {financials?.info?.companyOfficers?.length ? <div className="company-description"><h3>Leadership</h3><div className="officer-list">{financials.info.companyOfficers.slice(0, 10).map((officer, index) => <div key={`${officer.name}-${index}`}><b>{officer.name || "Name unavailable"}</b><span>{officer.title || "Title unavailable"}</span></div>)}</div></div> : null}
                  </section>
                )}
                {!snapshot && <DeferredSection id="company-network" title="Business relationships"><RelationshipResearch key={company.symbol} symbol={company.symbol} companyName={name} /></DeferredSection>}
                {snapshot && (
                  <div className="notice">
                    Comparisons use current peer data. Return to current data to
                    compare companies.
                  </div>
                )}
                {!snapshot && <div id="company-compare"><CompactComparison symbol={company.symbol} base={financials} peers={peerData} add={addPeer} remove={(symbol) => setPeerData((items) => { const next = { ...items }; delete next[symbol]; return next; })} reset={discoverPeers} busy={peersLoading || peerBusy.length > 0} message={peerBusy.length ? `Loading ${peerBusy.join(", ")}…` : peerMessage} /></div>}

                {companyOpened && (
                  <section id="company-evidence" className="research-section">
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
                {companyOpened && (
                  <section id="company-news" className="research-section news-section">
                    <div className="section-heading">
                      <h2>
                        In the news{" "}
                        <span className="count-label">{news.length}</span>
                      </h2>

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
                          .slice(0, 18)
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
              <MarketMovers scope="sp500" onSelect={select} />
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
                      image: a.image,
                      source: a.source,
                      datetime: a.datetime,
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
