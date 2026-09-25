"use client";
import { CompanyLogo } from "./company-logo";
import { useEffect, useRef, useState } from "react";
import { Search, ArrowUpRight, LoaderCircle } from "lucide-react";
import { preloadFinancials } from "@/lib/api";
import { Company, discovery, STARTER_COMPANIES } from "@/lib/research";

export function CompanySearch({
  onSelect,
  compact = false,
}: {
  onSelect: (company: Company) => void;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Company[]>(
    STARTER_COMPANIES.slice(0, 5),
  );
  const [status, setStatus] = useState("Popular companies");
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setActive(0);
    if (!query.trim()) {
      setResults(STARTER_COMPANIES.slice(0, 5));
      setStatus("Popular companies");
      setLoading(false);
      return;
    }
    setLoading(true);
    setResults([]);
    const timer = setTimeout(async () => {
      try {
        const response = await discovery<{ results: Company[] }>(
          `search?q=${encodeURIComponent(query.trim())}`,
          controller.signal,
        );
        if (!controller.signal.aborted) {
          setResults(response.results);
          setStatus(
            response.results.length
              ? "Company search · Finnhub"
              : "No companies found. Try a ticker.",
          );
        }
      } catch {
        if (!controller.signal.aborted) {
          const matches = STARTER_COMPANIES.filter((c) =>
            `${c.name} ${c.symbol}`.toLowerCase().includes(query.toLowerCase()),
          );
          if (
            !matches.length &&
            /^[A-Za-z][A-Za-z0-9.:-]{0,19}$/.test(query.trim())
          )
            matches.push({
              symbol: query.trim().toUpperCase(),
              name: "Look up ticker · not yet verified",
            });
          setResults(matches);
          setStatus("Live search unavailable · local matches / direct ticker");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 280);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);
  const visibleSymbols = results.slice(0, 5).map((company) => company.symbol).join(",");
  useEffect(() => {
    if (!open || loading || !visibleSymbols) return;
    const timer = setTimeout(() => preloadFinancials(visibleSymbols.split(","), true), 400);
    return () => clearTimeout(timer);
  }, [open, loading, visibleSymbols]);
  function select(company: Company) {
    onSelect(company);
    setOpen(false);
    setQuery("");
  }
  return (
    <div className={`company-search ${compact ? "compact" : ""}`} ref={root}>
      <Search size={17} />
      <input
        aria-label={
          compact ? "Add comparison company" : "Search companies or tickers"
        }
        role="combobox"
        aria-expanded={open}
        aria-controls={compact ? "compare-results" : "search-results"}
        aria-autocomplete="list"
        aria-activedescendant={
          open && results[active]
            ? `${compact ? "compare" : "search"}-option-${active}`
            : undefined
        }
        placeholder={
          compact ? "Add a company to compare…" : "Search companies or tickers"
        }
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.max(0, Math.min(i + 1, results.length - 1)));
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          }
          if (e.key === "Enter" && open && results[active]) {
            e.preventDefault();
            select(results[active]);
          }
        }}
      />
      {loading ? <LoaderCircle size={15} className="spin" /> : <kbd>↵</kbd>}
      {open && (
        <div className="search-menu">
          <small>{loading ? "Searching companies…" : status}</small>
          <div
            role="listbox"
            id={compact ? "compare-results" : "search-results"}
          >
            {results.map((c, i) => (
              <button
                key={c.symbol}
                id={`${compact ? "compare" : "search"}-option-${i}`}
                role="option"
                aria-selected={active === i}
                className={active === i ? "highlighted" : ""}
                onClick={() => select(c)}
              >
                <CompanyLogo symbol={c.symbol} />
                <b>{c.symbol}</b>
                <span>{c.name}</span>
                <ArrowUpRight size={14} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
