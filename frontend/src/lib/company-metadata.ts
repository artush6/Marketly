"use client";
import { getCompanyMetadata, type CompanyMetadata } from "./api";

const cache = new Map<string, { value: CompanyMetadata; expiresAt: number }>();
const listeners = new Set<() => void>();
const pending = new Set<string>();
const queue: string[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let active = 0;

export const subscribeMetadata = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const readMetadata = (symbol: string) => cache.get(symbol)?.value;
export const serverMetadata = () => undefined;

function drain() {
  timer = undefined;
  while (active < 2 && queue.length) {
    const symbols = queue.splice(0, 12);
    active += 1;
    void getCompanyMetadata(symbols).then(({ companies }) => {
      for (const company of companies) {
        if (cache.size >= 512) cache.delete(cache.keys().next().value!);
        cache.set(company.symbol, { value: company,
          expiresAt: Date.now() + (company.status === "available" ? 6 * 3600_000 : 300_000) });
      }
    }).catch(() => {
      for (const symbol of symbols) cache.set(symbol, { value: {
        symbol, name: symbol, logoUrl: null, status: "unavailable",
      }, expiresAt: Date.now() + 60_000 });
    }).finally(() => {
      active -= 1;
      symbols.forEach((symbol) => pending.delete(symbol));
      listeners.forEach((listener) => listener());
      if (queue.length) drain();
    });
  }
}

export function ensureCompanyMetadata(symbol: string) {
  if (!/^[A-Z0-9][A-Z0-9.:-]{0,19}$/.test(symbol)) return;
  if (pending.has(symbol) || (cache.get(symbol)?.expiresAt ?? 0) > Date.now()) return;
  if (queue.length >= 50) return;
  pending.add(symbol);
  queue.push(symbol);
  if (!timer) timer = setTimeout(drain, 20);
}
