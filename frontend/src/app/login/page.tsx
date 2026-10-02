"use client";

import Link from "next/link";
import { useState } from "react";
import { browserAuth } from "@/lib/supabase/client";
import { authConfig } from "@/lib/supabase/config";

type Mode = "login" | "signup" | "verify" | "forgot";
type VerificationKind = "signup" | "login";

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "/";
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<Mode>("login");
  const [verificationKind, setVerificationKind] = useState<VerificationKind>("signup");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function changeMode(next: Mode) {
    setMode(next);
    setMessage("");
    setCode("");
  }

  async function submitPassword(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const client = browserAuth();
      if (mode === "signup") {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${location.origin}/auth/callback` },
        });
        if (error) throw error;
        if (data.session) {
          location.assign("/settings?onboarding=1");
          return;
        }
        setVerificationKind("signup");
        setMode("verify");
        setMessage("We sent a verification code to your email. Enter it below to activate your account.");
      } else {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        location.assign(safeNext(new URLSearchParams(location.search).get("next")));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We couldn’t complete that request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function beginLoginCode() {
    setBusy(true);
    setMessage("");
    try {
      const { error } = await browserAuth().auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      if (error) throw error;
      setVerificationKind("login");
      setMode("verify");
      setMessage("If an account exists for this email, we’ve sent a sign-in code.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We couldn’t send a sign-in code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const { error } = await browserAuth().auth.verifyOtp({ email, token: code.trim(), type: "email" });
      if (error) throw error;
      if (verificationKind === "signup") location.assign("/settings?onboarding=1");
      else location.assign(safeNext(new URLSearchParams(location.search).get("next")));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That code could not be verified. Check it and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    setBusy(true);
    setMessage("");
    try {
      const client = browserAuth();
      const result = verificationKind === "signup"
        ? await client.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${location.origin}/auth/callback` } })
        : await client.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      if (result.error) throw result.error;
      setMessage("A new code has been sent if the address is eligible.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We couldn’t resend the code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function requestPasswordReset(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const redirectTo = `${location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`;
      const { error } = await browserAuth().auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      setMessage("If an account exists for this email, we’ve sent a secure password-reset link.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We couldn’t request a reset. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function oauth(provider: "google" | "apple") {
    setBusy(true);
    setMessage("");
    try {
      const { error } = await browserAuth().auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Provider unavailable.");
      setBusy(false);
    }
  }

  const title = mode === "signup" ? "Create your workspace"
    : mode === "verify" ? "Enter your code"
      : mode === "forgot" ? "Reset your password" : "Welcome back";

  return (
    <main className="account-page login-page">
      <section className="login-intro">
        <Link href="/" className="login-brand">marketly<span>.</span></Link>
        <div className="eyebrow">YOUR RESEARCH WORKSPACE</div>
        <h1>See the business.<br />Understand the price.</h1>
        <p>Financials, expectations, company networks and market news. One place to form your own view.</p>
        <div className="login-features"><span>01 / Compare companies</span><span>02 / Follow the evidence</span><span>03 / Keep your research</span></div>
      </section>
      <section className="login-access" aria-label="Account access">
        <h2>{title}</h2>
        <p>{mode === "verify" ? `Enter the code sent to ${email}.` : "Keep your research, preferences and portfolio together."}</p>
        {!authConfig() ? <p role="alert">Account access is not available yet. Your workspace will be ready to sign in once setup is complete.</p> : <>
          {mode === "login" && <>
            <form onSubmit={submitPassword} className="account-form">
              <label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
              <label>Password<input type="password" minLength={8} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
              <button className="primary-button" disabled={busy}>{busy ? "Please wait…" : "Sign in"}</button>
            </form>
            <div className="login-shortcuts"><button type="button" className="text-button" onClick={() => changeMode("forgot")}>Forgot password?</button><button type="button" className="text-button" onClick={() => changeMode("signup")}>Create an account</button></div>
            <form onSubmit={beginLoginCode} className="account-form login-code-form">
              <label>Email code sign-in<input aria-label="Email for sign-in code" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
              <button type="submit" className="secondary-button" disabled={busy}>{busy ? "Please wait…" : "Send sign-in code"}</button>
            </form>
          </>}
          {mode === "signup" && <>
            <form onSubmit={submitPassword} className="account-form">
              <label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
              <label>Password<input type="password" minLength={8} autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
              <button className="primary-button" disabled={busy}>{busy ? "Please wait…" : "Create account"}</button>
            </form>
            <button type="button" className="text-button" onClick={() => changeMode("login")}>Already have an account? Sign in</button>
          </>}
          {mode === "verify" && <>
            <form onSubmit={verifyCode} className="account-form">
              <label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
              <label>Six-digit code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} /></label>
              <button className="primary-button" disabled={busy || code.length !== 6}>{busy ? "Please wait…" : verificationKind === "signup" ? "Verify email" : "Verify and sign in"}</button>
            </form>
            <button type="button" className="secondary-button" disabled={busy} onClick={() => void resendCode()}>Resend code</button>
            <button type="button" className="text-button" onClick={() => changeMode("login")}>Back to sign in</button>
          </>}
          {mode === "forgot" && <>
            <form onSubmit={requestPasswordReset} className="account-form">
              <label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
              <button className="primary-button" disabled={busy}>{busy ? "Please wait…" : "Send reset link"}</button>
            </form>
            <button type="button" className="text-button" onClick={() => changeMode("login")}>Back to sign in</button>
          </>}
          <div className="account-actions">
            {process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true" && <button disabled={busy} className="secondary-button" onClick={() => void oauth("google")}>Continue with Google</button>}
            {process.env.NEXT_PUBLIC_AUTH_APPLE_ENABLED === "true" && <button disabled={busy} className="secondary-button" onClick={() => void oauth("apple")}>Continue with Apple</button>}
          </div>
        </>}
        {message && <p role="status" aria-live="polite">{message}</p>}
      </section>
    </main>
  );
}
