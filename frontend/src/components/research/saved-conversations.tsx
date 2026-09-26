"use client";

import { useEffect, useState } from "react";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: { url: string; title: string }[];
  visuals?: ChatVisual[];
};

export type ChatVisual =
  | {
      type: "comparison";
      title: string;
      companies: Array<{
        symbol: string;
        name?: string;
        pe?: number | null;
        margin?: number | null;
        marketCap?: number | null;
        revenue?: number | null;
      }>;
    }
  | {
      type: "image";
      url: string;
      alt: string;
      caption?: string;
      sourceUrl?: string;
    };

export type Conversation = {
  id: string;
  scope: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
  strategy?: string;
  horizon?: string;
  research?: boolean;
  context?: Record<string, unknown>;
};

export const CHAT_STORAGE = "marketly.conversations.v1";

function validMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<ChatMessage>;
  return (
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string"
  );
}

function validConversation(value: unknown): value is Conversation {
  if (!value || typeof value !== "object") return false;
  const conversation = value as Partial<Conversation>;
  return (
    typeof conversation.id === "string" &&
    typeof conversation.scope === "string" &&
    typeof conversation.title === "string" &&
    typeof conversation.updatedAt === "string" &&
    Array.isArray(conversation.messages) &&
    conversation.messages.every(validMessage)
  );
}

export function readConversations(): Conversation[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CHAT_STORAGE) || "[]");
    return Array.isArray(value)
      ? value.filter(validConversation).slice(0, 50)
      : [];
  } catch {
    return [];
  }
}

export function writeConversations(items: Conversation[]) {
  localStorage.setItem(CHAT_STORAGE, JSON.stringify(items.slice(0, 50)));
  window.dispatchEvent(new Event("marketly-chat-saved"));
}

export function SavedConversations() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = () => setItems(readConversations());
    load();
    window.addEventListener("marketly-chat-saved", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("marketly-chat-saved", load);
      window.removeEventListener("storage", load);
    };
  }, []);

  function remove(id: string) {
    try {
      const next = readConversations().filter((conversation) => conversation.id !== id);
      writeConversations(next);
      setItems(next);
      setError("");
    } catch {
      setError("This conversation could not be deleted because browser storage is unavailable.");
    }
  }

  return (
    <section className="research-section saved-conversations">
      <div className="section-heading">
        <div>
          <h2>Conversations</h2>
          <p>Saved on this device with the strategy and research context used at the time.</p>
        </div>
      </div>
      {error && <p role="alert" className="inline-error">{error}</p>}
      {!items.length && <p className="disclosure">No saved conversations yet.</p>}
      <div className="conversation-list">
        {items.map((conversation) => (
          <div className="conversation-row" key={conversation.id}>
            <button
              className="conversation-open"
              onClick={() => window.dispatchEvent(new CustomEvent("marketly-resume-chat", { detail: conversation }))}
            >
              <b>{conversation.title}</b>
              <small>
                {conversation.scope} · {conversation.strategy || "Balanced"} ·{" "}
                {new Date(conversation.updatedAt).toLocaleDateString()}
              </small>
            </button>
            <button className="text-button" aria-label={`Delete ${conversation.title}`} onClick={() => remove(conversation.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
