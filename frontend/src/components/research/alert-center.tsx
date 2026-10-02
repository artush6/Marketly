"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Check, LoaderCircle, RefreshCw } from "lucide-react";
import type { Company } from "@/lib/research";

type AlertItem = {
  id: string; category: "price_move" | "important_news" | "discovery";
  symbol: string | null; severity: "notice" | "important" | "critical";
  title: string; body: string; target_url: string;
  explanation: Record<string, unknown>; created_at: string;
  sent_at: string | null; read_at: string | null;
};
type Preferences = {
  price_drop_thresholds: number[]; important_news_enabled: boolean;
  discovery_enabled: boolean; discovery_min_score: number;
};
type Inbox = {
  notifications: AlertItem[]; preferences: Preferences;
  followedSymbols: string[]; deviceCount: number; pushConfigured: boolean;
};
const DEFAULTS: Preferences = { price_drop_thresholds: [3, 5, 10], important_news_enabled: true, discovery_enabled: true, discovery_min_score: 70 };

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`/api/backend/notifications${path}`, {
    ...init, cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || payload.error || "Alert service unavailable.");
  return payload;
}

function applicationServerKey(value: string) {
  const padded = value + "=".repeat((4 - value.length % 4) % 4);
  const bytes = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bytes, (char) => char.charCodeAt(0));
}

function AlertContext({ item, expanded = false }: { item: AlertItem; expanded?: boolean }) {
  const evidence = item.explanation || {};
  const stories = Array.isArray(evidence.recentArticles) ? evidence.recentArticles as Record<string, unknown>[] : [];
  const reasons = Array.isArray(evidence.importanceReasons) ? evidence.importanceReasons : [];
  const positives = Array.isArray(evidence.positives) ? evidence.positives : [];
  const risks = Array.isArray(evidence.riskFlags) ? evidence.riskFlags : [];
  const company = evidence.company && typeof evidence.company === "object" ? evidence.company as Record<string, unknown> : {};
  return <details className="alert-explanation" open={expanded}><summary>Prepared context & evidence</summary>
    {item.category === "price_move" ? <div className="alert-context-body">
      <p>Quote provider reported a {typeof evidence.priceMovePercent === "number" ? `${evidence.priceMovePercent.toFixed(1)}%` : "large"} daily move{typeof evidence.price === "number" ? ` to ${evidence.price}` : ""}. This is measured against the prior close; it may be delayed.</p>
      <p className="disclosure">{String(evidence.causeAttribution || "A matching headline is context, not proof of cause.")}</p>
      {stories.length ? <ul>{stories.map((story, index) => <li key={`${String(story.url || story.headline)}-${index}`}>{typeof story.url === "string" && story.url.startsWith("https://") ? <a href={story.url} target="_blank" rel="noreferrer">{String(story.headline || "Read recent coverage")} ↗</a> : String(story.headline || "Recent coverage")}{story.source ? ` · ${String(story.source)}` : ""}</li>)}</ul> : <p>No matching recent company headlines were available when this alert was prepared.</p>}
    </div> : item.category === "important_news" ? <div className="alert-context-body">
      <p>{typeof evidence.headline === "string" ? evidence.headline : item.body}</p>
      {reasons.length ? <p>Importance signals: {reasons.map(String).join(" · ")}</p> : null}
      {typeof evidence.url === "string" && evidence.url.startsWith("https://") ? <a href={evidence.url} target="_blank" rel="noreferrer">Read source ↗</a> : null}
      {evidence.source ? <small>Source: {String(evidence.source)}</small> : null}
    </div> : <div className="alert-context-body">
      <p>{String(company.name || item.symbol || "Small-cap candidate")} · score {String(evidence.potentialScore ?? "—")}/100 · evidence coverage {typeof evidence.evidenceCoverage === "number" ? `${Math.round(evidence.evidenceCoverage * 100)}%` : "unknown"}</p>
      {positives.length ? <p>Positive signals: {positives.map(String).join(" · ")}</p> : null}
      {risks.length ? <p>Risks to review: {risks.map(String).join(" · ")}</p> : null}
      {typeof evidence.notice === "string" ? <p className="disclosure">{evidence.notice}</p> : null}
    </div>}
  </details>;
}

export function AlertCenter({ onSelectSymbol }: { onSelectSymbol: (company: Company) => void }) {
  const [inbox, setInbox] = useState<Inbox>();
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS);
  const [publicKey, setPublicKey] = useState<string>();
  const [pushState, setPushState] = useState<"unsupported" | "disabled" | "enabled" | "denied">("disabled");
  const [deviceSubscribed, setDeviceSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deepLinkSymbol, setDeepLinkSymbol] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [data, config] = await Promise.all([api(""), api("/config")]);
      setInbox(data as Inbox);
      setPreferences((data as Inbox).preferences);
      setPublicKey(config.publicKey || undefined);
      if (!window.isSecureContext || !("serviceWorker" in navigator) || !("PushManager" in window)) setPushState("unsupported");
      else if (Notification.permission === "denied") setPushState("denied");
      else setPushState("enabled");
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration("/");
        setDeviceSubscribed(Boolean(await registration?.pushManager.getSubscription()));
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load your alert inbox."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setDeepLinkSymbol(new URLSearchParams(window.location.search).get("symbol")?.toUpperCase() || ""); }, []);

  async function enableDevice() {
    setBusy(true); setError(""); setNotice("");
    try {
      if (!publicKey) throw new Error("Web push keys are not configured on the server yet.");
      if (!window.isSecureContext || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) throw new Error("This browser cannot receive web push. Try Safari on iPhone or a current desktop browser over HTTPS.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setPushState(permission === "denied" ? "denied" : "disabled"); return; }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const ready = await navigator.serviceWorker.ready;
      let subscription = await ready.pushManager.getSubscription();
      if (!subscription) subscription = await ready.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(publicKey) });
      const response = await api("/subscriptions", { method: "POST", body: JSON.stringify(subscription.toJSON()) });
      setPushState("enabled"); setDeviceSubscribed(true); setNotice(`This device is connected. ${response.deviceCount} device${response.deviceCount === 1 ? "" : "s"} enabled.`);
      await load();
      void registration;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not enable notifications on this device."); }
    finally { setBusy(false); }
  }

  async function disableDevice() {
    setBusy(true); setError(""); setNotice("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await api("/subscriptions", { method: "DELETE", body: JSON.stringify({ endpoint: subscription.endpoint }) });
        await subscription.unsubscribe();
      }
      setDeviceSubscribed(false);
      setNotice("This device has been disconnected from Marketly alerts.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not disconnect this device."); }
    finally { setBusy(false); }
  }

  async function savePreferences(next: Preferences) {
    setPreferences(next); setBusy(true); setError(""); setNotice("");
    try {
      await api("/preferences", { method: "PUT", body: JSON.stringify(next) });
      setNotice("Alert preferences saved.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Preferences could not be saved."); }
    finally { setBusy(false); }
  }

  async function sendTest() {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api("/test", { method: "POST", body: "{}" });
      setNotice(result.sent ? "Test alert sent. Check this device’s notifications." : "Test alert saved, but the push service did not confirm delivery.");
      await load();
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Test alert failed."); }
    finally { setBusy(false); }
  }

  async function openAlert(item: AlertItem) {
    if (!item.read_at) {
      setInbox((current) => current && ({ ...current, notifications: current.notifications.map((entry) => entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry) }));
      void api(`/${encodeURIComponent(item.id)}/read`, { method: "PATCH", body: "{}" }).catch(() => undefined);
    }
    if (item.symbol) onSelectSymbol({ symbol: item.symbol, name: item.symbol });
  }

  const toggleThreshold = (value: number) => {
    const thresholds = preferences.price_drop_thresholds.includes(value)
      ? preferences.price_drop_thresholds.filter((item) => item !== value)
      : [...preferences.price_drop_thresholds, value];
    if (!thresholds.length || thresholds.length > 3) return;
    void savePreferences({ ...preferences, price_drop_thresholds: thresholds.sort((a, b) => a - b) });
  };

  return <section className="library-view alert-center" aria-labelledby="alerts-title">
    <header className="section-heading alert-center-heading">
      <div><div className="eyebrow">BACKGROUND MARKET WATCH</div><h1 id="alerts-title">Alerts</h1><p>Marketly checks followed stocks in the background and saves context with every alert.</p></div>
      <button className="secondary-button" onClick={() => void load()} disabled={loading}><RefreshCw size={14} /> Refresh</button>
    </header>
    {error && <div className="inline-error" role="alert">{error}</div>}{notice && <p className="alert-status" role="status">{notice}</p>}
    <div className="alert-settings-grid">
      <section className="alert-settings-card">
        <span className="eyebrow">THIS DEVICE</span><h2>Push notifications</h2>
        <p>Enable each device you want to receive alerts on. Devices are linked to your signed-in account.</p>
        {pushState === "unsupported" ? <p className="disclosure">Push is unavailable here. Open Marketly in a secure browser. On iPhone, add it to your Home Screen first.</p>
          : pushState === "denied" ? <p className="disclosure">Notifications are blocked by this browser. Allow them in the site’s notification settings, then retry.</p>
          : <button className="primary-button alert-push-button" disabled={busy || !inbox?.pushConfigured} onClick={() => void (deviceSubscribed ? sendTest() : enableDevice())}>
            {busy ? <LoaderCircle className="spin" size={15} /> : deviceSubscribed ? <Check size={15} /> : <Bell size={15} />}
            {!inbox?.pushConfigured ? "Server setup needed" : deviceSubscribed ? "Send test notification" : "Enable this device"}
          </button>}
        {inbox?.deviceCount ? <div className="alert-device-row"><span>{inbox.deviceCount} device{inbox.deviceCount === 1 ? "" : "s"} connected to your account</span>{deviceSubscribed ? <button className="text-button" disabled={busy} onClick={() => void disableDevice()}><BellOff size={13} /> Remove this device</button> : null}</div> : null}
        <p className="disclosure ios-install-note">iPhone: open this site in Safari, choose Share → Add to Home Screen, open the new app icon, then enable notifications here.</p>
      </section>
      <section className="alert-settings-card">
        <span className="eyebrow">WHAT TO WATCH</span><h2>Alert preferences</h2>
        <p>Price change uses the quote provider’s daily move from the prior close. Notifications are sent once per session at each crossed level.</p>
        <div className="alert-thresholds" aria-label="Price drop thresholds">{[3, 5, 10].map((value) => <button key={value} aria-pressed={preferences.price_drop_thresholds.includes(value)} className={preferences.price_drop_thresholds.includes(value) ? "selected" : ""} onClick={() => toggleThreshold(value)}>{value}% drop</button>)}</div>
        <label className="alert-toggle"><input type="checkbox" checked={preferences.important_news_enabled} onChange={(event) => void savePreferences({ ...preferences, important_news_enabled: event.target.checked })} /><span><strong>Important ticker news</strong><small>Only high-importance provider stories for followed companies.</small></span></label>
        <label className="alert-toggle"><input type="checkbox" checked={preferences.discovery_enabled} onChange={(event) => void savePreferences({ ...preferences, discovery_enabled: event.target.checked })} /><span><strong>Small-cap candidates</strong><small>Research signals above your score threshold.</small></span></label>
        <label className="alert-score-threshold">Minimum potential score <select value={preferences.discovery_min_score} onChange={(event) => void savePreferences({ ...preferences, discovery_min_score: Number(event.target.value) })}>{[50, 60, 70, 80, 90, 95].map((score) => <option key={score} value={score}>{score}</option>)}</select></label>
      </section>
    </div>
    <div className="alert-inbox-heading"><div><h2>Recent alerts</h2><p>{inbox?.followedSymbols.length ? `Watching ${inbox.followedSymbols.join(", ")}` : "Your followed companies will appear here."}</p></div><span>{inbox?.notifications.filter((item) => !item.read_at).length || 0} unread</span></div>
    {loading && !inbox ? <p className="disclosure"><LoaderCircle className="spin" size={15} /> Loading alerts…</p> : inbox?.notifications.length ? <div className="alert-inbox-list">{inbox.notifications.map((item) => <article key={item.id} className={`alert-inbox-item ${item.read_at ? "read" : "unread"} ${item.severity}`}>
      <button className="alert-inbox-open" onClick={() => void openAlert(item)}><span className={`alert-category-dot ${item.category}`} /><span className="alert-inbox-copy"><strong>{item.title}</strong><small>{item.body}</small><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time></span><span className="alert-unread-mark" /></button>
      {Object.keys(item.explanation || {}).length ? <AlertContext item={item} expanded={Boolean(deepLinkSymbol && deepLinkSymbol === item.symbol)} /> : null}
    </article>)}</div> : <div className="empty-state alert-empty"><Bell size={19} /><strong>No alerts yet</strong><p>Once push is enabled, Marketly will check followed-stock moves, important news, and new high-scoring small-cap research.</p></div>}
    <p className="disclosure alert-method-note">Price moves and third-party calendars may be delayed. A nearby headline is not proof of a price move’s cause. Discovery scores and probabilities are heuristic, uncalibrated research signals—not forecasts.</p>
  </section>;
}
