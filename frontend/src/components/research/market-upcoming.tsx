"use client";

import { useEffect, useState } from "react";
import { CompanyLogo } from "./company-logo";

type Reminder = { id: string; symbol: string; date: string; message: string; daysUntil: number };

export function MarketUpcoming({ symbols }: { symbols: string[] }) {
  const [events, setEvents] = useState<Reminder[]>([]);
  const [pending, setPending] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/backend/market/earnings?symbols=${encodeURIComponent(symbols.slice(0, 12).join(","))}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) })
      .then(async (response) => { if (!response.ok) throw new Error(); const result = await response.json(); setEvents(result.notifications ?? []); })
      .catch(() => setEvents([])).finally(() => setPending(false));
    return () => controller.abort();
  }, [symbols]);
  return <section className="market-panel upcoming-card">
    <div className="terminal-heading"><h2>Upcoming</h2><span>7 DAYS</span></div>
    <div className="upcoming-group"><h3>Watchlist events</h3>{pending ? <p>Checking calendars…</p> : events.length ? events.slice(0, 6).map((event) => <div key={event.id}><CompanyLogo symbol={event.symbol} /><span><b>{event.daysUntil === 0 ? "Today" : new Date(`${event.date}T12:00:00`).toLocaleDateString([], { weekday: "short" })}</b><small>{event.symbol} earnings · estimated</small></span></div>) : <p>No verified watchlist events in the next seven days.</p>}</div>
    <div className="upcoming-group"><h3>Macro</h3><p>Macro calendar connection pending. No unverified events are shown.</p></div>
  </section>;
}
