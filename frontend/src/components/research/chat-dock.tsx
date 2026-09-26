"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, ArrowUp, ChevronDown, ExternalLink, LoaderCircle, Maximize2, MessageSquare, PanelRight, Sparkles, X } from "lucide-react";
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
import { StyledSelect } from "./styled-select";

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
const CHAT_OPEN_KEY = "marketly.chat.open.v1";
const CHAT_PINNED_KEY = "marketly.chat.pinned.v3";

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
  const [pinned, setPinned] = useState(true);
  const [strategy, setStrategy] = useState("Balanced");
  const [horizon, setHorizon] = useState("3–5 years");
  const [research, setResearch] = useState(false);
  const [activeScope, setActiveScope] = useState(scope);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [open, setOpen] = useState(true);
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
      setStrategy(localStorage.getItem("marketly.strategy") || "Balanced");
      setHorizon(localStorage.getItem("marketly.horizon") || "3–5 years");
      setPinned(localStorage.getItem(CHAT_PINNED_KEY) !== "false");
      setOpen(localStorage.getItem(CHAT_OPEN_KEY) !== "false");
    } catch { /* Defaults remain usable. */ }

    const applyState = (value: { open?: boolean; pinned?: boolean }) => {
      if (typeof value.open === "boolean") setOpen(value.open);
      if (typeof value.pinned === "boolean") setPinned(value.pinned);
    };
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHAT_CHANNEL) : null;
    stateChannel.current = channel;
    if (channel) channel.onmessage = (event: MessageEvent<{ open?: boolean; pinned?: boolean }>) => applyState(event.data || {});
    const syncStorage = (event: StorageEvent) => {
      if (event.key === CHAT_OPEN_KEY) setOpen(event.newValue !== "false");
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
  }, [openConversation]);

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
      localStorage.setItem(CHAT_OPEN_KEY, String(open));
      if (mode === "dock") localStorage.setItem(CHAT_PINNED_KEY, String(pinned));
    } catch { /* Session only. */ }
    stateChannel.current?.postMessage(mode === "dock" ? { open, pinned } : { open });
    return () => document.body.classList.remove("marketly-chat-pinned");
  }, [mode, open, pinned]);

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
    const visuals: ChatVisual[] = [];
    const symbols = comparisonSymbols(text, activeScopeRef.current);
    if (symbols.length) {
      const results = await Promise.allSettled(symbols.map((symbol) => getFinancials(symbol)));
      nextContext.comparisonCompanies = results.flatMap((result) => result.status === "fulfilled" ? [comparisonCompany(result.value)] : []);
      nextContext.comparisonDataFailures = results.flatMap((result, index) => result.status === "rejected" ? [symbols[index]] : []);
    }
    const comparison = Array.isArray(nextContext.comparisonCompanies)
      ? nextContext.comparisonCompanies as Array<{ symbol: string; name?: string; metrics?: { pe?: number | null; margin?: number | null; marketCap?: number | null; revenue?: number | null } }>
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

  function openWorkspace(popout = false) {
    const id = saveForTransfer();
    const url = `/research-chat?conversation=${encodeURIComponent(id)}${popout ? "&popout=1" : ""}`;
    if (popout) {
      window.open(url, "marketly-research-chat", "popup,width=1120,height=820,resizable=yes,scrollbars=yes");
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
      const response = await postFollowUp(activeScopeRef.current, text, requestContext, history, research);
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

  const thread = (
    <div className="chat-thread">
      <div className="chat-thread-heading">
        <span>
          {mode === "workspace" && <button className="chat-back" aria-label="Back to Marketly" onClick={() => window.opener ? window.close() : window.location.assign("/")}><ArrowLeft size={16} /></button>}
          <Sparkles size={14} /> Marketly assistant <small>{activeScope === "MARKET" ? "US MARKETS" : activeScope}</small>
        </span>
        <div>
          {mode === "dock" && <button aria-label={pinned ? "Unpin conversation" : "Pin conversation to side"} onClick={() => { setPinned(!pinned); setOpen(true); }}><PanelRight size={16} /></button>}
          {mode === "dock" && <button aria-label="Open full chat workspace" disabled={busy} onClick={() => openWorkspace(false)}><Maximize2 size={16} /></button>}
          <button aria-label="Open chat in separate window" disabled={busy} onClick={() => openWorkspace(true)}><ExternalLink size={16} /></button>
          <button aria-label="Start new conversation" disabled={busy} onClick={startNewConversation}><X size={15} /></button>
          {mode === "dock" && <button aria-label={open ? "Minimize chat" : "Open conversation"} onClick={() => setOpen(!open)}><ChevronDown className={open ? "" : "chat-chevron-up"} size={17} /></button>}
        </div>
      </div>
      {open && (
        <>
          <div className="chat-messages" role="log" aria-live="polite">
            {!messages.length && <p className="chat-empty">Ask about the market, challenge a thesis, or compare the companies that matter.</p>}
            {messages.map((message, index) => (
              <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
                <small>{message.role === "user" ? "YOU" : "MARKETLY"}</small>
                {message.role === "assistant" ? <RichChatMessage message={message} /> : <p>{message.content}</p>}
                {message.sources?.map((source) => {
                  const url = safeUrl(source.url);
                  return url ? <a key={url} href={url} target="_blank" rel="noreferrer">{source.title || "Source"} ↗</a> : null;
                })}
              </div>
            ))}
            {busy && <div className="chat-thinking"><LoaderCircle size={13} className="spin" /> Reading the available context…</div>}
            {error && <p role="alert" className="chat-error">{error}</p>}
            <div ref={bottom} />
          </div>
        </>
      )}
    </div>
  );

  const composer = (
      <form onSubmit={submit}>
        <div className="chat-preferences">
          <label>Strategy <StyledSelect ariaLabel="Investor strategy" value={strategy} options={["Conservative", "Balanced", "Aggressive growth"].map((item) => ({ value: item, label: item }))} onChange={(value) => { setStrategy(value); try { localStorage.setItem("marketly.strategy", value); } catch { /* Session only. */ } }} /></label>
          <label>Horizon <StyledSelect ariaLabel="Investment horizon" value={horizon} options={["Under 1 year", "1–3 years", "3–5 years", "5+ years"].map((item) => ({ value: item, label: item }))} onChange={(value) => { setHorizon(value); try { localStorage.setItem("marketly.horizon", value); } catch { /* Session only. */ } }} /></label>
          <label className="chat-checkbox"><input type="checkbox" checked={research} onChange={(event) => setResearch(event.target.checked)} /> Search web</label>
          {mode === "dock" && <button className="text-button" type="button" onClick={() => { setPinned(!pinned); setOpen(true); }}>{pinned ? "Unpin" : "Pin to side"}</button>}
        </div>
        <div className="chat-input-row">
          <Sparkles size={18} />
          <input aria-label="Ask Marketly" maxLength={2000} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={activeScope === "MARKET" ? "Ask anything about the markets…" : `Ask about ${activeScope}, its competitors, or the risks…`} />
          <button className="chat-send" type="submit" aria-label="Send message" disabled={!question.trim() || busy}>{busy ? <LoaderCircle size={17} className="spin" /> : <ArrowUp size={19} />}</button>
        </div>
        <div className="chat-toolbar">
          <span className="chat-context"><span className="device-dot" />{activeScope === "MARKET" ? "Market & watchlist context" : `${activeScope} research context`}</span>
          <span>AI answers · verify key claims</span>
          {mode === "dock" && <button type="button" onClick={() => setOpen(!open)} aria-label={open ? "Minimize conversation" : "Open conversation"}><MessageSquare size={13} />{messages.length ? `${messages.length} messages` : "Chat"}</button>}
        </div>
      </form>
  );

  const panel = (
    <section className={`chat-dock ${open ? "expanded" : ""} ${mode === "dock" && pinned ? "pinned" : ""} ${mode === "workspace" ? "workspace" : ""}`} aria-label="Research assistant">
      <div className="chat-dock-layout">
        {mode === "dock" && open && <ChatHistory activeId={activeConversationId} mode="rail" onOpen={openConversation} onNew={startNewConversation} />}
        <div className="chat-conversation-column">
          {thread}
          {composer}
        </div>
      </div>
    </section>
  );
  return mode === "workspace" ? (
    <div className="chat-workspace-shell">
      <ChatHistory activeId={activeConversationId} mode="rail" onOpen={openConversation} onNew={startNewConversation} />
      <main className="chat-workspace-main">{panel}</main>
    </div>
  ) : panel;
}
