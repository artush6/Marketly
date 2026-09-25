"use client";

import { useEffect, useState } from "react";

type Reminder = { id: string; symbol: string; date: string; message: string };

export function EarningsReminders({ symbols, ready }: { symbols: string[]; ready: boolean }) {
  const key = symbols.join(",");
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("marketly-earnings-dismissed") || "[]");
      if (Array.isArray(stored)) setDismissed(stored.filter((value): value is string => typeof value === "string"));
    }
    catch { /* Local storage is optional. */ }
  }, []);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const base = (process.env.NEXT_PUBLIC_API_URL || "/api/backend").replace(/\/$/, "");
    const load = async () => {
      try {
        const response = await fetch(`${base}/market/earnings?symbols=${encodeURIComponent(key)}`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
        });
        if (!response.ok) throw new Error("Calendar unavailable");
        const payload = await response.json();
        if (!controller.signal.aborted) {
          setReminders(payload.notifications || []);
          setUnavailable(false);
        }
      } catch {
        if (!controller.signal.aborted) setUnavailable(true);
      }
    };
    void load();
    const interval = setInterval(() => { if (!document.hidden) void load(); }, 60000);
    return () => { controller.abort(); clearInterval(interval); };
  }, [key, ready]);
  const visible = reminders.filter((r) => symbols.includes(r.symbol) && !dismissed.includes(r.id));
  return <section aria-label="Upcoming earnings" aria-live="polite">
    {visible.map((reminder) => <div className="inline-notice" key={reminder.id}>
      <span>{reminder.message} Calendar dates may change.</span>{" "}
      <button type="button" aria-label={`Dismiss ${reminder.symbol} earnings reminder`} onClick={() => {
        const next = [...dismissed, reminder.id].slice(-200);
        setDismissed(next);
        try { localStorage.setItem("marketly-earnings-dismissed", JSON.stringify(next)); } catch { /* optional */ }
      }}>Dismiss</button>
    </div>)}
    {unavailable && <p className="inline-notice">Earnings reminders are temporarily unavailable.</p>}
  </section>;
}
