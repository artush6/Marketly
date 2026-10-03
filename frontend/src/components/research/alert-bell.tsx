"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

export function AlertBell({ onOpen }: { onOpen: () => void }) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let fetching = false;
    const load = async () => {
      if (document.hidden || fetching) return;
      fetching = true;
      try {
        const response = await fetch("/api/backend/notifications/summary", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!controller.signal.aborted) setCount(Number.isInteger(data.unreadCritical) && data.unreadCritical >= 0 ? data.unreadCritical : null);
      } catch { if (!controller.signal.aborted) setCount(null); }
      finally { fetching = false; }
    };
    void load();
    const timer = window.setInterval(load, 60000);
    window.addEventListener("marketly-alerts-updated", load);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", load);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("marketly-alerts-updated", load); window.removeEventListener("focus", load); document.removeEventListener("visibilitychange", load); };
  }, []);
  return <button type="button" className="header-alert-bell" onClick={onOpen} aria-label={`Open alerts${count ? `, ${count} unread critical alerts` : ""}`} title="Alerts · badge counts unread critical alerts only">
    <Bell size={21} />{count !== null && count > 0 && <span>{count > 99 ? "99+" : count}</span>}
  </button>;
}
