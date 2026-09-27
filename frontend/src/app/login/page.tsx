"use client";
import Link from "next/link";
import { useState } from "react";
import { browserAuth } from "@/lib/supabase/client";
import { authConfig } from "@/lib/supabase/config";
export default function Login() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [signup, setSignup] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const client = browserAuth();
      const result = signup ? await client.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/auth/callback` } }) : await client.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (result.data.session) {
        const next = new URLSearchParams(location.search).get("next") || "/";
        location.assign(signup ? "/settings?onboarding=1" : next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/");
      } else setMessage("Check your email to confirm your account, then sign in.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Sign-in failed. Please try again."); }
    finally { setBusy(false); }
  }
  async function oauth(provider: "google" | "apple") {
    setBusy(true); setMessage("");
    try { const { error } = await browserAuth().auth.signInWithOAuth({ provider, options: { redirectTo: `${location.origin}/auth/callback` } }); if (error) throw error; }
    catch (error) { setMessage(error instanceof Error ? error.message : "Provider unavailable."); setBusy(false); }
  }
  return <main className="account-page login-page"><Link href="/" className="eyebrow">MARKETLY</Link><h1>{signup ? "Create your workspace" : "Welcome back"}</h1><p>Keep your research, preferences and portfolio together.</p>
    {!authConfig() ? <p role="alert">Sign-in is not configured for this deployment. Set the Supabase project URL and publishable key before continuing.</p> : <>
      <form onSubmit={submit} className="account-form"><label>Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>Password<input type="password" minLength={8} autoComplete={signup ? "new-password" : "current-password"} required value={password} onChange={(e) => setPassword(e.target.value)} /></label><button className="primary-button" disabled={busy}>{busy ? "Please wait…" : signup ? "Create account" : "Sign in"}</button></form>
      <button className="text-button" onClick={() => setSignup(!signup)}>{signup ? "Already have an account? Sign in" : "Create an account"}</button>
      <div className="account-actions">{process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true" && <button disabled={busy} className="secondary-button" onClick={() => void oauth("google")}>Continue with Google</button>}{process.env.NEXT_PUBLIC_AUTH_APPLE_ENABLED === "true" && <button disabled={busy} className="secondary-button" onClick={() => void oauth("apple")}>Continue with Apple</button>}</div>
    </>}{message && <p role="status">{message}</p>}</main>;
}
