"use client";
import { SelectControl } from "@/components/research/select-control";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { browserAuth } from "@/lib/supabase/client";
import {
  accountId,
  flushStorage,
  hasPendingChanges,
  userStorage,
} from "@/lib/user-storage";
const defaults = {
  name: "",
  occupation: "",
  experience: "Learning",
  strategy: "Balanced",
  horizon: "3–5 years",
  currency: "USD",
  investableAssets: "",
  monthlyContribution: "",
  goals: "",
  useProfile: false,
  useHoldings: false,
  onboardingComplete: false,
};
export type InvestorProfile = typeof defaults;
export default function Settings() {
  const router = useRouter();
  const [profile, setProfile] = useState(defaults);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    try {
      setProfile({
        ...defaults,
        ...JSON.parse(userStorage.getItem("marketly.profile") || "{}"),
      });
    } catch {
      /* Start with optional fields empty. */
    }
  }, []);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      userStorage.setItem(
        "marketly.profile",
        JSON.stringify({ ...profile, onboardingComplete: true }),
      );
      userStorage.setItem("marketly.strategy", profile.strategy);
      userStorage.setItem("marketly.horizon", profile.horizon);
      await flushStorage();
      if (hasPendingChanges()) {
        setMessage("Preferences were saved locally, but cloud sync is still pending. Retry before leaving this page.");
        return;
      }
      if (new URLSearchParams(window.location.search).get("onboarding") === "1") {
        router.replace("/");
        return;
      }
      setMessage(accountId() ? "Profile synchronized." : "Profile saved on this device.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Preferences could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }
  async function signout() {
    await flushStorage();
    if (hasPendingChanges()) {
      setMessage("Resolve unsynchronized changes before signing out.");
      return;
    }
    const { error } = await browserAuth().auth.signOut();
    if (error) setMessage(error.message);
    else location.assign("/login");
  }
  async function recoverChanges() {
    const prefix = `marketly.recovery.${accountId()}.`;
    const keys = Object.keys(localStorage).filter((key) =>
      key.startsWith(prefix),
    );
    for (const key of keys) {
      const value = localStorage.getItem(key);
      if (value !== null) userStorage.setItem(key.slice(prefix.length), value);
    }
    await flushStorage();
    setMessage(
      hasPendingChanges()
        ? "Recovery still needs synchronization; your local copies are retained."
        : `${keys.length} pending records recovered. Reload to use them.`,
    );
  }
  function importLegacy() {
    let count = 0;
    for (const key of [
      "marketly.research.v1",
      "marketly.conversations.v1",
      "marketly.strategy",
      "marketly.horizon",
      "marketly-earnings-dismissed",
    ]) {
      const value = localStorage.getItem(key);
      if (value && !userStorage.getItem(key)) {
        userStorage.setItem(key, value);
        count++;
      }
    }
    setMessage(
      `${count} device records imported into this account. Existing account records were preserved.`,
    );
  }
  return (
    <main className="account-page">
      <nav>
        <Link href="/">← Research</Link>
        <Link href="/portfolio">Portfolio</Link>
      </nav>
      <div className="eyebrow">YOUR WORKSPACE</div>
      <h1>Profile & preferences</h1>
      <p>
        All financial profile fields are optional. You can update them at any
        time.
      </p>
      <form className="account-form" onSubmit={save}>
        <div className="account-grid">
          {(
            [
              ["name", "Name"],
              ["occupation", "Occupation"],
              ["investableAssets", "Investable assets (optional)"],
              ["monthlyContribution", "Monthly contribution (optional)"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                maxLength={120}
                value={profile[key]}
                onChange={(e) =>
                  setProfile({ ...profile, [key]: e.target.value })
                }
              />
            </label>
          ))}
          {(
            [
              ["experience", ["Learning", "Some experience", "Experienced"]],
              ["strategy", ["Conservative", "Balanced", "Aggressive growth"]],
              [
                "horizon",
                ["Under 1 year", "1–3 years", "3–5 years", "5+ years"],
              ],
              ["currency", ["USD", "EUR", "GBP", "CHF", "CAD", "JPY"]],
            ] as const
          ).map(([key, options]) => (
            <label key={key}>
              {key}
              <SelectControl
                value={profile[key]}
                onChange={(e) =>
                  setProfile({ ...profile, [key]: e.target.value })
                }
              >
                {options.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </SelectControl>
            </label>
          ))}
        </div>
        <label>
          Goals
          <textarea
            maxLength={2000}
            value={profile.goals}
            onChange={(e) => setProfile({ ...profile, goals: e.target.value })}
          />
        </label>
        <label className="account-check">
          <input
            type="checkbox"
            checked={profile.useProfile}
            onChange={(e) =>
              setProfile({ ...profile, useProfile: e.target.checked })
            }
          />
          Use this profile as context for AI research
        </label>
        <label className="account-check">
          <input
            type="checkbox"
            checked={profile.useHoldings}
            onChange={(e) =>
              setProfile({ ...profile, useHoldings: e.target.checked })
            }
          />
          Include my holdings when I ask for portfolio analysis
        </label>
        <button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save preferences"}</button>
      </form>
      <p role="status">{message}</p>
      {accountId() && (
        <div className="account-actions">
          <button
            className="secondary-button"
            onClick={() => void recoverChanges()}
          >
            Recover unsynchronized changes
          </button>
          <button className="secondary-button" onClick={importLegacy}>
            Import research from this device
          </button>
          <button className="secondary-button" onClick={() => void signout()}>
            Sign out
          </button>
        </div>
      )}
    </main>
  );
}
