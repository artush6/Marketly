"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, LoaderCircle, RefreshCw } from "lucide-react";
import { CompanyLogo } from "./company-logo";

type EarningsEvent = {
  id: string; symbol: string; date: string; hour?: string | null;
  quarter?: number | null; year?: number | null; source: string; estimated: boolean;
};
type CalendarResponse = { events: EarningsEvent[]; pendingSymbols: string[]; note: string };

function dateKey(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}
function eventDateLabel(value: string) {
  return new Date(value + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });
}

export function ResearchCalendar({ symbols, onSelectSymbol }: { symbols: string[]; onSelectSymbol: (symbol: string) => void }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [symbolFilter, setSymbolFilter] = useState("all");
  const [data, setData] = useState<CalendarResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const symbolKey = symbols.slice(0, 100).join(",");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void fetch("/api/backend/market/earnings?symbols=" + encodeURIComponent(symbolKey), {
      cache: "no-store",
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]),
    }).then(async (response) => {
      if (!response.ok) throw new Error("Earnings calendar is temporarily unavailable.");
      const result = await response.json() as CalendarResponse;
      if (!controller.signal.aborted) setData(result);
    }).catch((reason) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Earnings calendar is temporarily unavailable.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [symbolKey, refresh]);

  const events = useMemo(() => (data?.events || [])
    .filter((event) => symbolFilter === "all" || event.symbol === symbolFilter)
    .sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol)), [data, symbolFilter]);
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, EarningsEvent[]>();
    for (const event of events) grouped.set(event.date, [...(grouped.get(event.date) || []), event]);
    return grouped;
  }, [events]);
  const firstCell = new Date(month.getFullYear(), month.getMonth(), 1);
  firstCell.setDate(firstCell.getDate() - firstCell.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCell);
    date.setDate(firstCell.getDate() + index);
    return date;
  });
  const selectedEvents = eventsByDate.get(selectedDate) || [];
  const monthPrefix = [month.getFullYear(), String(month.getMonth() + 1).padStart(2, "0")].join("-");
  const monthEvents = events.filter((event) => event.date.startsWith(monthPrefix));
  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const today = dateKey(new Date());

  return (
    <section className="library-view calendar-view" aria-labelledby="calendar-title">
      <div className="section-heading calendar-page-heading">
        <div><div className="eyebrow">MARKET CALENDAR</div><h1 id="calendar-title">Calendar</h1>
          <p>Earnings dates for companies on your watchlist. Provider dates are estimates and may change.</p></div>
        <button className="secondary-button calendar-refresh" onClick={() => setRefresh((value) => value + 1)} disabled={loading}>
          {loading ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />} Refresh
        </button>
      </div>
      <div className="calendar-toolbar">
        <div className="calendar-month-control">
          <button className="icon-button" aria-label="Previous month" onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))}><ChevronLeft size={17} /></button>
          <h2>{monthLabel}</h2>
          <button className="icon-button" aria-label="Next month" onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))}><ChevronRight size={17} /></button>
          <button className="text-button calendar-today" onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(dateKey(now)); }}>Today</button>
        </div>
        <label className="calendar-symbol-filter">Company
          <select value={symbolFilter} onChange={(event) => setSymbolFilter(event.target.value)}>
            <option value="all">Entire watchlist</option>
            {symbols.map((symbol) => <option value={symbol} key={symbol}>{symbol}</option>)}
          </select>
        </label>
      </div>
      {error && <div className="inline-error" role="alert">{error} <button className="text-button" onClick={() => setRefresh((value) => value + 1)}>Try again</button></div>}
      {data?.pendingSymbols.length ? <p className="calendar-feed-note" role="status">Calendar data is still being collected for {data.pendingSymbols.join(", ")}. Refresh in a little while.</p> : null}
      <div className="calendar-layout">
        <div className="calendar-grid-wrap">
          <div className="calendar-weekdays" aria-hidden="true">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-grid" aria-label={monthLabel + " earnings dates"}>
            {days.map((day) => {
              const key = dateKey(day);
              const dayEvents = eventsByDate.get(key) || [];
              const insideMonth = day.getMonth() === month.getMonth();
              const classes = ["calendar-day", insideMonth ? "" : "outside", key === selectedDate ? "selected" : "", key === today ? "today" : ""].filter(Boolean).join(" ");
              return <button className={classes} key={key}
                aria-label={day.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) + (dayEvents.length ? ", " + dayEvents.length + " earnings events" : "")}
                aria-pressed={key === selectedDate}
                onClick={() => { setSelectedDate(key); if (!insideMonth) setMonth(new Date(day.getFullYear(), day.getMonth(), 1)); }}>
                <span className="calendar-day-number">{day.getDate()}</span>
                {dayEvents.length > 0 && <span className="calendar-day-count">{dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}</span>}
                {dayEvents.length > 0 && <span className="calendar-day-dots" aria-hidden="true">{dayEvents.slice(0, 4).map((event) => <i key={event.id} />)}</span>}
              </button>;
            })}
          </div>
          <div className="calendar-grid-footer"><span><i /> Earnings date</span><span>{monthEvents.length} event{monthEvents.length === 1 ? "" : "s"} this month</span></div>
        </div>
        <aside className="calendar-agenda" aria-live="polite">
          <div className="calendar-agenda-heading"><div><span>SELECTED DATE</span><h2>{eventDateLabel(selectedDate)}</h2></div><CalendarDays size={18} /></div>
          {loading && !data ? <p className="calendar-empty"><LoaderCircle className="spin" size={16} /> Loading watchlist events…</p> : selectedEvents.length ? <div className="calendar-event-list">
            {selectedEvents.map((event) => <article className="calendar-event" key={event.id}>
              <CompanyLogo symbol={event.symbol} />
              <div className="calendar-event-main"><button onClick={() => onSelectSymbol(event.symbol)}>{event.symbol}</button><strong>Quarterly earnings</strong><small>{event.quarter ? "Q" + event.quarter + " " + (event.year || "") + " · " : ""}{event.hour || "Time not supplied"}</small></div>
              <span className="calendar-estimate">EST.</span>
            </article>)}
          </div> : <div className="calendar-empty"><CalendarDays size={20} /><p>No watchlist earnings on this date.</p><small>Provider coverage is limited to announced or estimated earnings dates.</small></div>}
          <div className="calendar-agenda-footer">{data?.note || "Source: Finnhub · estimated dates"}</div>
        </aside>
      </div>
      <div className="calendar-feed-disclosure">Only earnings dates from the configured provider are shown. Macro, dividend, FDA, IPO, and product events are not connected yet.</div>
    </section>
  );
}
