"use client";

import { ChatDock } from "@/components/research/chat-dock";

export default function ResearchChatPage() {
  return (
    <ChatDock
      mode="workspace"
      scope="MARKET"
      context={{
        scope: "US markets",
        contextNote: "Start a new question or resume a saved conversation from history.",
      }}
    />
  );
}
