"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { authConfig } from "@/lib/supabase/config";
import { browserAuth } from "@/lib/supabase/client";
import { accountId, flushStorage, hasPendingChanges, initializeStorage, storageStatus } from "@/lib/user-storage";

type WorkspaceRecord = { key: string; value: string | null; revision: number };

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function AccountProvider({ children, localMode }: { children: React.ReactNode; localMode: boolean }) {
  const path = usePathname();
  const publicPage = path === "/login" || path === "/reset-password" || path.startsWith("/auth/");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState({ pending: 0, error: "" });
  const [loadVersion, setLoadVersion] = useState(0);

  useEffect(() => {
    if (publicPage) return;
    let alive = true;

    if (!authConfig() && localMode) {
      initializeStorage(null);
      setError("");
      setReady(true);
      return;
    }

    setReady(false);
    setError("");

    const client = authConfig() ? browserAuth() : null;
    const subscription = client?.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session && session.user.id !== accountId()) {
        setReady(false);
        setLoadVersion((value) => value + 1);
      }
      if (event === "SIGNED_OUT") {
        setReady(false);
        initializeStorage(null);
        location.assign("/login");
      }
    }).data.subscription;

    async function loadWorkspace() {
      try {
        // Let the browser client finish restoring the session cookie before asking
        // the server to hydrate private records. The server still verifies it.
        if (client) await client.auth.getSession();

        let response: Response | undefined;
        let payload: { userId?: string; records?: WorkspaceRecord[]; error?: string } = {};
        for (let attempt = 0; attempt < 3; attempt += 1) {
          response = await fetch("/api/account/state", { cache: "no-store" });
          payload = await response.json().catch(() => ({}));
          if (response.ok) break;
          if (response.status !== 401 || attempt === 2) {
            throw new Error(payload.error || `Workspace request failed (${response.status}).`);
          }
          await wait(250 * (attempt + 1));
        }

        if (!response?.ok || !payload.userId) throw new Error("Your account session could not be restored. Sign in again and retry.");
        if (alive) {
          initializeStorage(payload.userId, payload.records || []);
          setReady(true);
          setError("");
        }
      } catch (reason) {
        if (alive) {
          setError(reason instanceof Error ? reason.message : "Your private workspace could not be loaded. Retry before making changes.");
        }
      }
    }

    void loadWorkspace();
    const sync = () => setStatus(storageStatus());
    const unload = (event: BeforeUnloadEvent) => {
      if (hasPendingChanges()) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const online = () => void flushStorage();
    window.addEventListener("marketly-sync-status", sync);
    window.addEventListener("beforeunload", unload);
    window.addEventListener("online", online);

    return () => {
      alive = false;
      subscription?.unsubscribe();
      window.removeEventListener("marketly-sync-status", sync);
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("online", online);
    };
  }, [publicPage, localMode, loadVersion]);

  if (publicPage) return children;
  if (!ready) return <main className="account-page">
    <h1>Marketly</h1>
    <p role={error ? "alert" : "status"}>{error || "Loading your private workspace…"}</p>
    {error && <button className="secondary-button" onClick={() => setLoadVersion((value) => value + 1)}>Retry</button>}
  </main>;

  return <>
    {(status.pending > 0 || status.error) && <div className="sync-status" role="status">{status.error || `Saving ${status.pending} change${status.pending === 1 ? "" : "s"}…`}{status.error && <button onClick={() => void flushStorage()}>Retry sync</button>}</div>}
    {children}
  </>;
}
