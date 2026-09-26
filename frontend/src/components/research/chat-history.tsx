"use client";

import { useEffect, useState } from "react";
import { MessageSquareText, Plus, Trash2 } from "lucide-react";
import { readConversations, writeConversations, type Conversation } from "./saved-conversations";

export function ChatHistory({ activeId, mode, onOpen, onNew }: {
  activeId?: string;
  mode: "strip" | "rail";
  onOpen: (conversation: Conversation) => void;
  onNew: () => void;
}) {
  const [items, setItems] = useState<Conversation[]>([]);

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

  function remove(event: React.MouseEvent, id: string) {
    event.stopPropagation();
    const next = readConversations().filter((conversation) => conversation.id !== id);
    writeConversations(next);
    setItems(next);
  }

  return (
    <nav className={`chat-history ${mode}`} aria-label="Conversation history">
      <div className="chat-history-heading">
        <span><MessageSquareText size={14} /> History</span>
        <button type="button" onClick={onNew} aria-label="New conversation"><Plus size={15} /></button>
      </div>
      <div className="chat-history-list">
        {items.length === 0 && <p>No conversations yet.</p>}
        {items.slice(0, mode === "rail" ? 30 : 8).map((conversation) => (
          <div className={`chat-history-row ${conversation.id === activeId ? "active" : ""}`} key={conversation.id}>
            <button type="button" className="chat-history-open" onClick={() => onOpen(conversation)}>
              <span>{conversation.title}</span>
              <small>{conversation.scope} · {new Date(conversation.updatedAt).toLocaleDateString()}</small>
            </button>
            {mode === "rail" && <button type="button" className="chat-history-delete" aria-label={`Delete ${conversation.title}`} onClick={(event) => remove(event, conversation.id)}><Trash2 size={12} /></button>}
          </div>
        ))}
      </div>
    </nav>
  );
}
