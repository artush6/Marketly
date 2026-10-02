"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { browserAuth } from "@/lib/supabase/client";
import { authConfig } from "@/lib/supabase/config";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    let active = true;
    async function checkSession() {
      try {
        const { data, error } = await browserAuth().auth.getUser();
        if (!active) return;
        setValidSession(!error && !!data.user);
      } catch {
        if (active) setValidSession(false);
      } finally {
        if (active) setReady(true);
      }
    }
    void checkSession();
    return () => { active = false; };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      setMessage("The passwords don’t match.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const { error } = await browserAuth().auth.updateUser({ password });
      if (error) throw error;
      setUpdated(true);
      setMessage("Your password has been updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We couldn’t update your password. Request a new reset link and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="account-page login-page">
      <section className="login-intro">
        <Link href="/" className="login-brand">marketly<span>.</span></Link>
        <div className="eyebrow">ACCOUNT SECURITY</div>
        <h1>Choose a new password.</h1>
        <p>Use a password you haven’t used for another service.</p>
      </section>
      <section className="login-access" aria-label="Reset password">
        <h2>Reset your password</h2>
        {!authConfig() ? <p role="alert">Account access is not configured.</p>
          : !ready ? <p role="status">Checking your reset link…</p>
          : updated ? <p>Password changed. <Link href="/">Return to your workspace</Link>.</p>
              : !validSession ? <p role="alert">This reset link is invalid or expired. <Link href="/login">Request another reset link</Link>.</p>
                : <form onSubmit={submit} className="account-form">
                  <label>New password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
                  <label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
                  <button className="primary-button" disabled={busy}>{busy ? "Updating…" : "Save new password"}</button>
                </form>}
        {message && <p role="status" aria-live="polite">{message}</p>}
      </section>
    </main>
  );
}
