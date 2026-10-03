"use client";
import { Drawer } from "vaul";
import { accountId, flushStorage, hasPendingChanges, userStorage } from "@/lib/user-storage";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, ArrowUp, ExternalLink, History, LoaderCircle, Maximize2, MessageSquare, Sparkles, X, Plus, TrendingUp, Scale, FileText, Search, BarChart3, Globe2, MoreHorizontal } from "lucide-react";
import { BackendRequestError, getFinancials, postFollowUp, type BackendFinancialsResponse } from "@/lib/api";
import { metrics, safeUrl, STARTER_COMPANIES } from "@/lib/research";
import {
  readConversations,
  writeConversations,
  type ChatMessage as Message,
  type ChatVisual,
  type Conversation,
} from "./saved-conversations";
import { ChatHistory } from "./chat-history";
import "./assistant.css";

const RichChatMessage = dynamic(
  () => import("./rich-chat-message").then((module) => module.RichChatMessage),
  { ssr: false },
);

const COMPANY_ALIASES: Record<string, string> = {
  nvidia: "NVDA",
  amd: "AMD",
  "advanced micro devices": "AMD",
  apple: "AAPL",
  microsoft: "MSFT",
  alphabet: "GOOGL",
  google: "GOOGL",
  amazon: "AMZN",
  meta: "META",
  tesla: "TSLA",
};
const CHAT_CHANNEL = "marketly-chat-state";
const CHAT_OPEN_KEY = "marketly.chat.open.v2";
const CHAT_PINNED_KEY = "marketly.chat.pinned.v4";
const CHAT_HISTORY_KEY = "marketly.chat.history-visible.v1";

function comparisonSymbols(question: string, scope: string) {
  if (!/\b(compare|comparison|versus|vs\.?|choose between|better|revenue|sales|margin|valuation|market cap|metrics|financials|graph|chart|measure|performance)\b/i.test(question)) return [];
  const symbols: string[] = [];
  const add = (symbol: string) => {
    if (!symbols.includes(symbol) && symbols.length < 3) symbols.push(symbol);
  };
  Object.entries(COMPANY_ALIASES).forEach(([name, symbol]) => {
    if (new RegExp(`\\b${name.replaceAll(" ", "\\s+")}\\b`, "i").test(question)) add(symbol);
  });
  STARTER_COMPANIES.forEach(({ symbol }) => {
    if (new RegExp(`\\b${symbol}\\b`, "i").test(question)) add(symbol);
  });
  if (scope !== "MARKET" && symbols.length === 1 && symbols[0] !== scope) add(scope);
  return symbols;
}

function comparisonCompany(data: BackendFinancialsResponse) {
  const values = metrics(data);
  const shared = data.comparisonMetrics;
  if (shared) {
    values.revenue = shared.revenue?.value ?? null;
    values.margin = shared.netMargin?.value ?? null;
    values.pe = shared.trailingPE?.value ?? null;
    values.marketCap = shared.marketCap?.value ?? null;
  }
  return {
    symbol: data.symbol,
    name: data.info?.shortName,
    metrics: values,
    statementDates: {
      income: data.financials?.income_statement?.[0]?.date,
      balanceSheet: data.financials?.balance_sheet?.[0]?.date,
      cashFlow: data.financials?.cash_flow?.[0]?.date,
    },
    dataQuality: data.dataQuality,
    provenance: data.sources,
  };
}

export function ChatDock({ scope, context, mode = "dock", initialConversationId }: {
  scope: string;
  context: Record<string, unknown>;
  mode?: "dock" | "workspace";
  initialConversationId?: string;
}) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)");
    const update = () => { setMobile(query.matches); if (query.matches && mode === "dock") setOpen(false); };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [mode]);
  const [menuOpen, setMenuOpen] = useState(false);
  const optionsMenu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => { if (!optionsMenu.current?.contains(event.target as Node)) setMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenuOpen(false); optionsMenu.current?.querySelector<HTMLButtonElement>("button")?.focus(); } };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [menuOpen]);
  const composerInput = useRef<HTMLTextAreaElement>(null);
  const [pinned, setPinned] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [strategy, setStrategy] = useState("Balanced");
  const [horizon, setHorizon] = useState("3–5 years");
  const [research, setResearch] = useState(false);
  const [activeScope, setActiveScope] = useState(scope);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [open, setOpen] = useState(mode === "workspace");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const conversationId = useRef("");
  const [activeConversationId, setActiveConversationId] = useState("");
  const activeContext = useRef(context);
  const activeScopeRef = useRef(scope);
  const resumed = useRef(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  const bottom = useRef<HTMLDivElement>(null);
  const loadedInitialConversation = useRef(false);
  const stateChannel = useRef<BroadcastChannel | null>(null);

  const openConversation = useCallback((conversation: Conversation) => {
    if (pending.current || !conversation?.id || !Array.isArray(conversation.messages)) return;
    conversationId.current = conversation.id;
    activeScopeRef.current = conversation.scope;
    activeContext.current = conversation.context || {
      scope: conversation.scope,
      contextNote: "Saved context was unavailable; current data may differ.",
    };
    resumed.current = true;
    setActiveConversationId(conversation.id);
    setActiveScope(conversation.scope);
    setMessages(conversation.messages);
    setStrategy(conversation.strategy || "Balanced");
    setHorizon(conversation.horizon || "3–5 years");
    setResearch(Boolean(conversation.research));
    setError("");
    setHistoryVisible(false);
    setOpen(true);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!resumed.current) {
      activeContext.current = context;
      activeScopeRef.current = scope;
      setActiveScope(scope);
    }
  }, [context, scope]);

  useEffect(() => {
    if (open) bottom.current?.scrollIntoView({ block: "nearest" });
  }, [messages, busy, open]);

  useEffect(() => {
    try {
      setStrategy(userStorage.getItem("marketly.strategy") || "Balanced");
      setHorizon(userStorage.getItem("marketly.horizon") || "3–5 years");
      setPinned(userStorage.getItem(CHAT_PINNED_KEY) === "true");
      setHistoryVisible(userStorage.getItem(CHAT_HISTORY_KEY) === "true");
      setOpen(mode === "workspace" || (window.matchMedia("(min-width: 1024px)").matches ? userStorage.getItem(CHAT_OPEN_KEY) !== "false" : false));
    } catch { /* Defaults remain usable. */ }

    const applyState = (value: { open?: boolean; pinned?: boolean }) => {
      if (typeof value.open === "boolean") setOpen(value.open);
      if (typeof value.pinned === "boolean") setPinned(value.pinned);
    };
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(`${CHAT_CHANNEL}:${accountId() || "local"}`) : null;
    stateChannel.current = channel;
    if (channel) channel.onmessage = (event: MessageEvent<{ open?: boolean; pinned?: boolean }>) => applyState(event.data || {});
    const syncStorage = (event: StorageEvent) => {
      if (mode === "dock" && event.key === CHAT_OPEN_KEY) setOpen(event.newValue === "true");
      if (event.key === CHAT_PINNED_KEY) setPinned(event.newValue === "true");
    };
    window.addEventListener("storage", syncStorage);

    const resumeConversation = (event: Event) => openConversation((event as CustomEvent<Conversation>).detail);
    const askResearchQuestion = (event: Event) => {
      setQuestion((event as CustomEvent<string>).detail);
      setResearch(true);
      setOpen(true);
    };
    window.addEventListener("marketly-resume-chat", resumeConversation);
    window.addEventListener("marketly-research-question", askResearchQuestion);
    return () => {
      channel?.close();
      stateChannel.current = null;
      window.removeEventListener("storage", syncStorage);
      window.removeEventListener("marketly-resume-chat", resumeConversation);
      window.removeEventListener("marketly-research-question", askResearchQuestion);
    };
  }, [mode, openConversation]);

  useEffect(() => {
    if (loadedInitialConversation.current || typeof window === "undefined") return;
    loadedInitialConversation.current = true;
    const requestedId = initialConversationId || new URLSearchParams(window.location.search).get("conversation") || "";
    const conversations = readConversations();
    const selected = conversations.find((conversation) => conversation.id === requestedId) || (mode === "workspace" ? conversations[0] : undefined);
    if (selected) openConversation(selected);
  }, [initialConversationId, mode, openConversation]);

  useEffect(() => {
    document.body.classList.toggle("marketly-chat-pinned", mode === "dock" && pinned);
    try {
      if (mode === "dock") {
        userStorage.setItem(CHAT_OPEN_KEY, String(open));
        userStorage.setItem(CHAT_PINNED_KEY, String(pinned));
      }
    } catch { /* Session only. */ }
    stateChannel.current?.postMessage(mode === "dock" ? { open, pinned } : { open });
    return () => document.body.classList.remove("marketly-chat-pinned");
  }, [mode, open, pinned]);

  useEffect(() => {
    try { userStorage.setItem(CHAT_HISTORY_KEY, String(historyVisible)); } catch { /* Session only. */ }
  }, [historyVisible]);

  useEffect(() => {
    if (!messages.some((message) => message.role === "assistant") || busy) return;
    try {
      conversationId.current ||= crypto.randomUUID();
      setActiveConversationId(conversationId.current);
      const entry: Conversation = {
        id: conversationId.current,
        scope: activeScopeRef.current,
        title: messages.find((message) => message.role === "user")?.content.slice(0, 90) || "Research",
        updatedAt: new Date().toISOString(),
        messages,
        strategy,
        horizon,
        research,
        context: activeContext.current,
      };
      writeConversations([entry, ...readConversations().filter((item) => item.id !== entry.id)]);
    } catch {
      setError("Conversation could not be saved: browser storage is full or unavailable.");
    }
  }, [messages, busy, strategy, horizon, research]);

  function startNewConversation() {
    if (busy) return;
    conversationId.current = "";
    setActiveConversationId("");
    activeScopeRef.current = scope;
    activeContext.current = context;
    resumed.current = false;
    setActiveScope(scope);
    setHistoryVisible(false);
    setMessages([]);
    setQuestion("");
    setError("");
  }

  async function assistantContext(text: string) {
    const nextContext: Record<string, unknown> = {
      ...activeContext.current,
      investorStrategy: strategy,
      investmentHorizon: horizon,
    };
    try {
      const profile = JSON.parse(userStorage.getItem("marketly.profile") || "{}");
      if (profile.useProfile) nextContext.investorProfile = profile;
      if (profile.useHoldings && /portfolio|holdings|allocation|exposure/i.test(text)) nextContext.holdings = JSON.parse(userStorage.getItem("marketly.holdings") || "[]");
    } catch { /* Optional private context is omitted when invalid. */ }
    const visuals: ChatVisual[] = [];
    const symbols = comparisonSymbols(text, activeScopeRef.current);
    if (symbols.length) {
      const results = await Promise.allSettled(symbols.map((symbol) => getFinancials(symbol)));
      nextContext.comparisonCompanies = results.flatMap((result) => result.status === "fulfilled" ? [comparisonCompany(result.value)] : []);
      nextContext.comparisonDataFailures = results.flatMap((result, index) => result.status === "rejected" ? [symbols[index]] : []);
    }
    const comparison = Array.isArray(nextContext.comparisonCompanies)
      ? nextContext.comparisonCompanies as Array<{ symbol: string; name?: string; metrics?: { pe?: number | null; margin?: number | null; marketCap?: number | null; revenue?: number | null; currency?: string } }>
      : [];
    if (comparison.length >= 2 && /\b(compare|comparison|versus|vs\.?|choose|better|revenue|sales|margin|valuation|market cap|metrics|financials|graph|chart|measure|performance)\b/i.test(text)) {
      visuals.push({
        type: "comparison",
        title: `${comparison.slice(0, 3).map((company) => company.symbol).join(" vs ")} at a glance`,
        companies: comparison.slice(0, 3).map((company) => ({ symbol: company.symbol, name: company.name, ...company.metrics })),
      });
    }
    const news = Array.isArray(nextContext.news)
      ? nextContext.news as Array<{ headline?: string; image?: string; url?: string; source?: string }>
      : [];
    const illustratedStory = /\b(news|headline|catalyst|what happened|why did|market move)\b/i.test(text)
      ? news.find((story) => safeUrl(story.image))
      : undefined;
    if (illustratedStory?.image) {
      visuals.push({
        type: "image",
        url: illustratedStory.image,
        alt: illustratedStory.headline || "Related market story",
        caption: illustratedStory.headline || illustratedStory.source,
        sourceUrl: illustratedStory.url,
      });
    }
    return { requestContext: nextContext, visuals };
  }

  function saveForTransfer() {
    conversationId.current ||= crypto.randomUUID();
    setActiveConversationId(conversationId.current);
    const entry: Conversation = {
      id: conversationId.current,
      scope: activeScopeRef.current,
      title: messages.find((message) => message.role === "user")?.content.slice(0, 90) || `New ${activeScopeRef.current} research`,
      updatedAt: new Date().toISOString(),
      messages,
      strategy,
      horizon,
      research,
      context: activeContext.current,
    };
    writeConversations([entry, ...readConversations().filter((item) => item.id !== entry.id)]);
    return entry.id;
  }

  async function openWorkspace(popout = false) {
    const popup = popout ? window.open("about:blank", "marketly-research-chat", "popup,width=1120,height=820,resizable=yes,scrollbars=yes") : null;
    const id = saveForTransfer();
    await flushStorage();
    if (hasPendingChanges()) { popup?.close(); setError("Synchronize this conversation before opening another window."); return; }
    const url = `/research-chat?conversation=${encodeURIComponent(id)}${popout ? "&popout=1" : ""}`;
    if (popout) {
      if (popup) popup.location.href = url;
    } else {
      window.location.assign(url);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setOpen(true);
    setQuestion("");
    const history = messages.slice(-10).map((message) => ({ role: message.role, content: message.content.slice(0, 6000) }));
    setMessages((items) => [...items, { role: "user", content: text }]);
    try {
      const { requestContext, visuals } = await assistantContext(text);
      const response = await postFollowUp(activeScopeRef.current, text, requestContext, history, research || /\b(news|article|headline)\b/i.test(text));
      if (mounted.current) {
        setMessages((items) => [...items, { role: "assistant", content: response.answer, sources: response.sources, visuals }]);
      }
    } catch (requestError) {
      if (mounted.current) {
        setError(requestError instanceof BackendRequestError ? `Assistant unavailable: ${requestError.message}` : "Could not reach the assistant. Your question is restored below—try again.");
        setQuestion(text);
        setMessages((items) => items.slice(0, -1));
      }
    } finally {
      if (mounted.current) {
        setBusy(false);
        pending.current = false;
      }
    }
  }

  const suggestions = activeScope !== "MARKET" ? [
    { icon: FileText, text: `Summarize ${activeScope}’s financial performance` },
    { icon: Scale, text: `Compare ${activeScope} with its closest peers` },
    { icon: TrendingUp, text: `What drives ${activeScope}’s growth?` },
    { icon: Search, text: `Challenge the investment thesis for ${activeScope}` },
    { icon: BarChart3, text: `What risks matter most for ${activeScope}?` },
  ] : [
    { icon: TrendingUp, text: "Why are markets moving today?" },
    { icon: Scale, text: "Compare AAPL vs MSFT" },
    { icon: BarChart3, text: "What are the top AI stocks?" },
    { icon: FileText, text: "Summarize today’s market news" },
    { icon: Search, text: "Find undervalued large-cap stocks" },
  ];
  const panel = (
    <section className={`chat-dock assistant-v2 ${open ? "expanded" : ""} ${mode === "workspace" ? "workspace" : ""}`} aria-label="Research assistant">
      {!open && mode === "dock" ? <button className="assistant-launcher" onClick={() => setOpen(true)} aria-label="Open Marketly assistant"><Sparkles size={19} /><span>Ask AI</span></button> : <>
        <header className="ai-header">
          <div><Sparkles size={18} /><h2>Marketly assistant</h2><span className="ai-beta">BETA</span></div>
          {mode === "dock" ? <button type="button" className="ai-icon" aria-label="Close assistant" title="Close assistant" onClick={() => setOpen(false)}><X size={18} /></button> : <button className="ai-icon" aria-label="Back to Marketly" onClick={() => window.opener ? window.close() : window.location.assign("/")}><ArrowLeft size={18} /></button>}
        </header>
        <nav className="ai-tabs" aria-label="Assistant views">
          <button type="button" className={!historyVisible ? "selected" : ""} aria-pressed={!historyVisible} onClick={() => setHistoryVisible(false)}><MessageSquare size={16} />Chat</button>
          <button type="button" className={historyVisible ? "selected" : ""} aria-pressed={historyVisible} onClick={() => setHistoryVisible(true)}><History size={16} />History</button>
          <button type="button" className="ai-icon ai-new" aria-label="New conversation" title="New conversation" disabled={busy} onClick={startNewConversation}><Plus size={18} /></button>
          <div className="ai-menu-anchor" ref={optionsMenu}>
            <button type="button" className="ai-icon" aria-label="Conversation options" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><MoreHorizontal size={19} /></button>
            {menuOpen && <div className="ai-menu" onKeyDown={event => { if (event.key === "Escape") { setMenuOpen(false); } }}>
              {mode === "dock" && <button type="button" disabled={busy} onClick={() => { setMenuOpen(false); openWorkspace(false); }}><Maximize2 size={15} />Full workspace</button>}
              <button type="button" disabled={busy} onClick={() => { setMenuOpen(false); openWorkspace(true); }}><ExternalLink size={15} />Open separate window</button>
            </div>}
          </div>
        </nav>
        {historyVisible ? <div className="ai-history"><ChatHistory activeId={activeConversationId} mode="rail" onOpen={openConversation} onNew={startNewConversation} /></div> : <div className={`ai-body ${!messages.length ? "is-empty" : ""}`}>
          {!messages.length ? <>
            <p className="ai-welcome">Ask about the market,<br />challenge a thesis, or compare companies that matter.</p>
            <div className="ai-suggestions">{suggestions.map(({ icon: Icon, text }) => <button key={text} type="button" onClick={() => { setQuestion(text); composerInput.current?.focus(); }}><Icon size={17} /><span>{text}</span></button>)}</div>
          </> : <div className="ai-messages" role="log" aria-live="polite">{messages.map((message, index) => <article className={`ai-message ${message.role}`} key={`${message.role}-${index}`}>
            <small>{message.role === "user" ? "YOU" : "MARKETLY"}</small>
            {message.role === "assistant" ? <RichChatMessage message={message} /> : <p>{message.content}</p>}
            {message.sources?.map(source => { const url = safeUrl(source.url); return url ? <a key={url} href={url} target="_blank" rel="noreferrer">{source.title || "Source"} ↗</a> : null; })}
          </article>)}</div>}
          {busy && <div className="ai-status" role="status"><LoaderCircle size={14} className="spin" />Researching your question…</div>}
          {error && <p role="alert" className="ai-error">{error}</p>}
          <div ref={bottom} />
        </div>}
        <form className="ai-composer" onSubmit={event => { setHistoryVisible(false); void submit(event); }}>
          <div className="ai-context" aria-label="Included research context"><span><span className="ai-context-dot" />{activeScope === "MARKET" ? "Market context" : activeScope}</span>{Array.isArray(activeContext.current.watchlist) && activeContext.current.watchlist.length > 0 && <span>My watchlist · {activeContext.current.watchlist.length}</span>}</div>
          <div className="ai-input">
            <textarea ref={composerInput} aria-label="Ask Marketly" rows={2} maxLength={2000} value={question} onChange={event => setQuestion(event.target.value)} placeholder={activeScope === "MARKET" ? "Ask anything about the markets…" : `Ask about ${activeScope}…`} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
            <button type="submit" aria-label="Send message" disabled={!question.trim() || busy}>{busy ? <LoaderCircle size={16} className="spin" /> : <ArrowUp size={19} />}</button>
          </div>
          <div className="ai-settings">
            <select aria-label="Investor strategy" value={strategy} onChange={event => { setStrategy(event.target.value); try { userStorage.setItem("marketly.strategy", event.target.value); } catch { /* Session only. */ } }}>
              {["Conservative", "Balanced", "Aggressive growth"].map(value => <option key={value}>{value}</option>)}
            </select>
            <select aria-label="Investment horizon" value={horizon} onChange={event => { setHorizon(event.target.value); try { userStorage.setItem("marketly.horizon", event.target.value); } catch { /* Session only. */ } }}>
              {["Under 1 year", "1–3 years", "3–5 years", "5+ years"].map(value => <option key={value}>{value}</option>)}
            </select>
            <button className="ai-web" type="button" aria-pressed={research} onClick={() => setResearch(!research)}><Globe2 size={14} />Search web</button>
          </div>
          <p className="ai-disclaimer">AI can make mistakes. Verify key information.</p>
        </form>
      </>}
    </section>
  );
  if (mode === "dock" && mobile) return <Drawer.Root open={open} onOpenChange={setOpen}>
    <Drawer.Trigger className="mobile-ask-ai"><Sparkles size={21} /> Ask AI</Drawer.Trigger>
    <Drawer.Portal><Drawer.Overlay className="mobile-sheet-overlay" /><Drawer.Content className="mobile-assistant-sheet research-app" aria-describedby={undefined}>
      <div className="sheet-grip" /><Drawer.Title className="sr-only">Marketly assistant</Drawer.Title>
      {panel}
    </Drawer.Content></Drawer.Portal>
  </Drawer.Root>;
  return mode === "workspace" ? (
    <div className={`chat-workspace-shell ${historyVisible ? "with-history" : "history-hidden"}`}>

      <main className="chat-workspace-main">{panel}</main>
    </div>
  ) : panel;
}
