"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { authConfig } from "@/lib/supabase/config";
import { browserAuth } from "@/lib/supabase/client";
import { accountId, flushStorage, hasPendingChanges, initializeStorage, storageStatus } from "@/lib/user-storage";
export function AccountProvider({ children, localMode }: { children: React.ReactNode; localMode: boolean }) {
  const path = usePathname(); const publicPage = path === "/login" || path.startsWith("/auth/");
  const [ready, setReady] = useState(false); const [error, setError] = useState(""); const [status, setStatus] = useState({ pending: 0, error: "" });
  useEffect(() => {
    if (publicPage) return;
    let alive = true;
    if (!authConfig() && localMode) { initializeStorage(null); setReady(true); return; }
    void fetch("/api/account/state", { cache: "no-store" }).then(async (r) => {
      if (!r.ok) throw new Error("Your private workspace could not be loaded. Retry before making changes.");
      const data = await r.json(); if (alive) { initializeStorage(data.userId, data.records); setReady(true); }
    }).catch((e) => { if (alive) setError(e.message); });
    const subscription = authConfig() ? browserAuth().auth.onAuthStateChange((event, session) => { if (event === "SIGNED_IN" && accountId() && session?.user.id !== accountId()) { setReady(false); location.reload(); } if (event === "SIGNED_OUT") { setReady(false); initializeStorage(null); location.assign("/login"); } }).data.subscription : null;
    const sync = () => setStatus(storageStatus());
    const unload = (event: BeforeUnloadEvent) => { if (hasPendingChanges()) { event.preventDefault(); event.returnValue = ""; } };
    const online = () => void flushStorage();
    window.addEventListener("marketly-sync-status", sync); window.addEventListener("beforeunload", unload); window.addEventListener("online", online);
    return () => { alive = false; subscription?.unsubscribe(); window.removeEventListener("marketly-sync-status", sync); window.removeEventListener("beforeunload", unload); window.removeEventListener("online", online); };
  }, [publicPage, localMode]);
  if (publicPage) return children;
  if (!ready) return <main className="account-page"><h1>Marketly</h1><p role="status">{error || "Opening your workspace…"}</p>{error && <button className="secondary-button" onClick={() => location.reload()}>Retry</button>}</main>;
  return <>{(status.pending > 0 || status.error) && <div className="sync-status" role="status">{status.error || `Saving ${status.pending} change${status.pending === 1 ? "" : "s"}…`}{status.error && <button onClick={() => void flushStorage()}>Retry sync</button>}</div>}{children}</>;
}
