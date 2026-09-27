// Hydrated before private UI mounts. Values are cached under the verified user ID.
type RecordValue = { key: string; value: string | null; revision: number };
const values = new Map<string, string | null>();
const revisions = new Map<string, number>();
const pending = new Map<string, string | null>();
let owner: string | null = null;
let active = false;
let syncing = false;
let syncError = "";
let timer: ReturnType<typeof setTimeout> | undefined;
export function storageStatus() { return { pending: pending.size, error: syncError }; }
function notify() { window.dispatchEvent(new Event("marketly-sync-status")); }
export function initializeStorage(userId: string | null, records: RecordValue[] = []) {
  owner = userId; active = true; values.clear(); revisions.clear(); pending.clear(); syncError = "";
  records.forEach((r) => { values.set(r.key, r.value); revisions.set(r.key, r.revision); });
}
export const userStorage = {
  getItem(key: string): string | null {
    if (!active) return null;
    return owner ? values.get(key) ?? null : localStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    if (!active) throw new Error("Workspace is not ready.");
    if (!owner) { localStorage.setItem(key, value); return; }
    if (values.get(key) === value) return;
    values.set(key, value); pending.set(key, value);
    // A local recovery copy is never silently merged into a different user's account.
    localStorage.setItem(`marketly.recovery.${owner}.${key}`, value);
    clearTimeout(timer); timer = setTimeout(() => void flushStorage(), 500); notify();
  },
  removeItem(key: string) {
    if (!owner) { localStorage.removeItem(key); return; }
    values.set(key, null); pending.set(key, null); void flushStorage();
  },
};
export async function flushStorage() {
  if (!owner || syncing) return;
  syncing = true; syncError = "";
  try {
    while (pending.size) {
      const [key, value] = pending.entries().next().value!;
      const response = await fetch("/api/account/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value, revision: revisions.get(key) || 0 }), signal: AbortSignal.timeout(15000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Changes are waiting to synchronize.");
      revisions.set(key, result.revision);
      if (pending.get(key) === value) { pending.delete(key); localStorage.removeItem(`marketly.recovery.${owner}.${key}`); }
    }
  } catch (error) { syncError = error instanceof Error ? error.message : "Changes are waiting to synchronize."; }
  finally { syncing = false; notify(); }
}
export function hasPendingChanges() { return pending.size > 0; }
export function accountId() { return owner; }
