"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ChevronDown,
  LoaderCircle,
  MessageSquare,
  Sparkles,
  X,
} from "lucide-react";
import { BackendRequestError, postFollowUp } from "@/lib/api";

type Message = { role: "user" | "assistant"; content: string };
export function ChatDock({
  scope,
  context,
}: {
  scope: string;
  context: Record<string, unknown>;
}) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const mounted = useRef(true);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (open) bottom.current?.scrollIntoView({ block: "nearest" });
  }, [messages, busy, open]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setOpen(true);
    setQuestion("");
    const history = messages
      .slice(-10)
      .map((message) => ({
        ...message,
        content: message.content.slice(0, 6000),
      }));
    setMessages((items) => [...items, { role: "user", content: text }]);
    try {
      const response = await postFollowUp(scope, text, context, history);
      if (mounted.current)
        setMessages((items) => [
          ...items,
          { role: "assistant", content: response.answer },
        ]);
    } catch (requestError) {
      if (mounted.current) {
        setError(
          requestError instanceof BackendRequestError
            ? `Assistant unavailable: ${requestError.message}`
            : "Could not reach the assistant. Your question is restored below—try again.",
        );
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
    <section
      className={`chat-dock ${open ? "expanded" : ""}`}
      aria-label="Research assistant"
    >
      {open && (
        <div className="chat-thread">
          <div className="chat-thread-heading">
            <span>
              <Sparkles size={14} /> Marketly assistant{" "}
              <small>{scope === "MARKET" ? "US MARKETS" : scope}</small>
            </span>
            <div>
              <button
                aria-label="Clear conversation"
                disabled={busy}
                onClick={() => {
                  setMessages([]);
                  setError("");
                }}
              >
                <X size={15} />
              </button>
              <button aria-label="Minimize chat" onClick={() => setOpen(false)}>
                <ChevronDown size={17} />
              </button>
            </div>
          </div>
          <div className="chat-messages" role="log" aria-live="polite">
            {!messages.length && (
              <p className="chat-empty">
                Ask about the market, challenge a thesis, or explore the numbers
                in this view.
              </p>
            )}
            {messages.map((message, i) => (
              <div className={`chat-message ${message.role}`} key={i}>
                <small>{message.role === "user" ? "YOU" : "MARKETLY"}</small>
                <p>{message.content}</p>
              </div>
            ))}
            {busy && (
              <div className="chat-thinking">
                <LoaderCircle size={13} className="spin" /> Reading the
                available context…
              </div>
            )}
            {error && (
              <p role="alert" className="chat-error">
                {error}
              </p>
            )}
            <div ref={bottom} />
          </div>
        </div>
      )}
      <form onSubmit={submit}>
        <div className="chat-input-row">
          <Sparkles size={18} />
          <input
            aria-label="Ask Marketly"
            maxLength={2000}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={
              scope === "MARKET"
                ? "Ask anything about the markets…"
                : `Ask about ${scope}, its competitors, or the risks…`
            }
          />
          <button
            className="chat-send"
            type="submit"
            aria-label="Send message"
            disabled={!question.trim() || busy}
          >
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <ArrowUp size={19} />
            )}
          </button>
        </div>
        <div className="chat-toolbar">
          <span className="chat-context">
            <span className="device-dot" />
            {scope === "MARKET"
              ? "Market & watchlist context"
              : `${scope} research context`}
          </span>
          <span>AI answers · verify key claims</span>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Minimize conversation" : "Open conversation"}
          >
            <MessageSquare size={13} />
            {messages.length ? `${messages.length} messages` : "Chat"}
          </button>
        </div>
      </form>
    </section>
  );
}
