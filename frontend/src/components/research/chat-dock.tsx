"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronDown, LoaderCircle, MessageSquare, Sparkles, X } from "lucide-react";
import { BackendRequestError, getFinancials, postFollowUp, type BackendFinancialsResponse } from "@/lib/api";
import { metrics, safeUrl, STARTER_COMPANIES } from "@/lib/research";
import {
  readConversations,
  writeConversations,
  type ChatMessage as Message,
  type Conversation,
} from "./saved-conversations";

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

function comparisonSymbols(question: string, scope: string) {
  if (!/\b(compare|comparison|versus|vs\.?|choose between|better)\b/i.test(question)) return [];
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

export function ChatDock({ scope, context }: { scope: string; context: Record<string, unknown> }) {
  const [pinned, setPinned] = useState(false);
  const [strategy, setStrategy] = useState("Balanced");
  const [horizon, setHorizon] = useState("3–5 years");
  const [research, setResearch] = useState(false);
  const [activeScope, setActiveScope] = useState(scope);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const conversationId = useRef("");
  const activeContext = useRef(context);
  const activeScopeRef = useRef(scope);
  const resumed = useRef(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  const bottom = useRef<HTMLDivElement>(null);

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
      setPinned(localStorage.getItem("marketly.chat.pinned") === "true");
    } catch { /* Defaults remain usable. */ }

    const resumeConversation = (event: Event) => {
      if (pending.current) return;
      const conversation = (event as CustomEvent<Conversation>).detail;
      if (!conversation?.id || !Array.isArray(conversation.messages)) return;
      conversationId.current = conversation.id;
      activeScopeRef.current = conversation.scope;
      activeContext.current = conversation.context || { scope: conversation.scope, contextNote: "Saved context was unavailable; current data may differ." };
      resumed.current = true;
      setActiveScope(conversation.scope);
      setMessages(conversation.messages);
      setStrategy(conversation.strategy || "Balanced");
      setHorizon(conversation.horizon || "3–5 years");
      setResearch(Boolean(conversation.research));
      setError("");
      setOpen(true);
    };
    const askResearchQuestion = (event: Event) => {
      setQuestion((event as CustomEvent<string>).detail);
      setResearch(true);
      setOpen(true);
    };
    window.addEventListener("marketly-resume-chat", resumeConversation);
    window.addEventListener("marketly-research-question", askResearchQuestion);
    return () => {
      window.removeEventListener("marketly-resume-chat", resumeConversation);
      window.removeEventListener("marketly-research-question", askResearchQuestion);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("marketly-chat-pinned", pinned);
    try { localStorage.setItem("marketly.chat.pinned", String(pinned)); } catch { /* Session only. */ }
    return () => document.body.classList.remove("marketly-chat-pinned");
  }, [pinned]);

  useEffect(() => {
    if (!messages.some((message) => message.role === "assistant") || busy) return;
    try {
      conversationId.current ||= crypto.randomUUID();
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
    const symbols = comparisonSymbols(text, activeScopeRef.current);
    if (!symbols.length) return nextContext;
    const results = await Promise.allSettled(symbols.map((symbol) => getFinancials(symbol)));
    nextContext.comparisonCompanies = results.flatMap((result) => result.status === "fulfilled" ? [comparisonCompany(result.value)] : []);
    nextContext.comparisonDataFailures = results.flatMap((result, index) => result.status === "rejected" ? [symbols[index]] : []);
    return nextContext;
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
      const requestContext = await assistantContext(text);
      const response = await postFollowUp(activeScopeRef.current, text, requestContext, history, research);
      if (mounted.current) {
        setMessages((items) => [...items, { role: "assistant", content: response.answer, sources: response.sources }]);
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

  return (
    <section className={`chat-dock ${open ? "expanded" : ""} ${pinned ? "pinned" : ""}`} aria-label="Research assistant">
      {open && (
        <div className="chat-thread">
          <div className="chat-thread-heading">
            <span><Sparkles size={14} /> Marketly assistant <small>{activeScope === "MARKET" ? "US MARKETS" : activeScope}</small></span>
            <div>
              <button aria-label="Start new conversation" disabled={busy} onClick={startNewConversation}><X size={15} /></button>
              <button aria-label="Minimize chat" onClick={() => setOpen(false)}><ChevronDown size={17} /></button>
            </div>
          </div>
          <div className="chat-messages" role="log" aria-live="polite">
            {!messages.length && <p className="chat-empty">Ask about the market, challenge a thesis, or compare the companies that matter.</p>}
            {messages.map((message, index) => (
              <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
                <small>{message.role === "user" ? "YOU" : "MARKETLY"}</small>
                <p>{message.content}</p>
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
        </div>
      )}
      <form onSubmit={submit}>
        <div className="chat-preferences">
          <label>Strategy <select aria-label="Investor strategy" value={strategy} onChange={(event) => { setStrategy(event.target.value); try { localStorage.setItem("marketly.strategy", event.target.value); } catch { /* Session only. */ } }}>{["Conservative", "Balanced", "Aggressive growth"].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Horizon <select aria-label="Investment horizon" value={horizon} onChange={(event) => { setHorizon(event.target.value); try { localStorage.setItem("marketly.horizon", event.target.value); } catch { /* Session only. */ } }}>{["Under 1 year", "1–3 years", "3–5 years", "5+ years"].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="chat-checkbox"><input type="checkbox" checked={research} onChange={(event) => setResearch(event.target.checked)} /> Search web</label>
          <button className="text-button" type="button" onClick={() => { setPinned(!pinned); setOpen(true); }}>{pinned ? "Unpin" : "Pin to side"}</button>
        </div>
        <div className="chat-input-row">
          <Sparkles size={18} />
          <input aria-label="Ask Marketly" maxLength={2000} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={activeScope === "MARKET" ? "Ask anything about the markets…" : `Ask about ${activeScope}, its competitors, or the risks…`} />
          <button className="chat-send" type="submit" aria-label="Send message" disabled={!question.trim() || busy}>{busy ? <LoaderCircle size={17} className="spin" /> : <ArrowUp size={19} />}</button>
        </div>
        <div className="chat-toolbar">
          <span className="chat-context"><span className="device-dot" />{activeScope === "MARKET" ? "Market & watchlist context" : `${activeScope} research context`}</span>
          <span>AI answers · verify key claims</span>
          <button type="button" onClick={() => setOpen(!open)} aria-label={open ? "Minimize conversation" : "Open conversation"}><MessageSquare size={13} />{messages.length ? `${messages.length} messages` : "Chat"}</button>
        </div>
      </form>
    </section>
  );
}
