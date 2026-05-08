"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, BarChart3 } from "lucide-react";
import {
  AIInsights,
  AnalysisLens,
  AnalysisBlockSkeleton,
  BullBear,
  ChatInput,
  EmptyState,
  FinalVerdict,
  FollowUpPanel,
  MarketlyNavbar,
  MetricsGrid,
  NewsSection,
  RevenueTrend,
  StockHeader,
  TradingViewChart,
  type AnalysisBlock,
  type FollowUpAnswer,
} from "@/components/marketly";
import {
  ANALYSIS_LOADING_STEPS,
  MARKET_TICKERS,
} from "@/components/marketly/mock-data";
import { postFollowUp } from "@/lib/api";
import {
  buildAnalysisBlockFromBackend,
  buildMissingAnalysisBlock,
  resolveQuerySymbol,
  shouldRunFullAnalysis,
} from "@/lib/marketly-analysis";

type PendingBlock = {
  id: string;
  query: string;
  stepIndex: number;
};

type PersistedAnalysisState = {
  analysisBlocks: AnalysisBlock[];
  followUps: FollowUpAnswer[];
  pendingQueries: string[];
};

type PromptCard = {
  label: string;
  prompt: string;
  detail: string;
};

const ANALYSIS_STATE_STORAGE_KEY = "marketly.analysis-state";
const RECENT_QUERIES_STORAGE_KEY = "marketly.recent-queries";
const MAX_RECENT_QUERIES = 6;

const QUICK_PROMPTS: PromptCard[] = [
  {
    label: "Quality",
    prompt: "Is Microsoft still a high-quality compounder at this valuation?",
    detail: "Best for management quality plus margin resilience.",
  },
  {
    label: "Momentum",
    prompt: "What is the real bull case for NVIDIA over the next 12 months?",
    detail: "Use when the market narrative feels hotter than fundamentals.",
  },
  {
    label: "Risk",
    prompt: "Stress test Tesla if deliveries and margins both soften from here.",
    detail: "Useful for scenario framing and downside debates.",
  },
];

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function pushRecentQuery(query: string, current: string[]) {
  const normalized = query.trim();
  if (!normalized) {
    return current;
  }

  return [normalized, ...current.filter((entry) => entry !== normalized)].slice(
    0,
    MAX_RECENT_QUERIES,
  );
}

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [analysisBlocks, setAnalysisBlocks] = useState<AnalysisBlock[]>([]);
  const [pendingBlocks, setPendingBlocks] = useState<PendingBlock[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpAnswer[]>([]);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [isRestoringState, setIsRestoringState] = useState(true);
  const canvasEndRef = useRef<HTMLDivElement | null>(null);
  const isMountedRef = useRef(true);
  const hasRestoredStateRef = useRef(false);
  const hasBootstrappedUrlQueryRef = useRef(false);

  const hasContent =
    analysisBlocks.length > 0 || pendingBlocks.length > 0 || followUps.length > 0;
  const currentSymbol =
    analysisBlocks[analysisBlocks.length - 1]?.resolution.symbol ?? null;
  const queryFromUrl = searchParams.get("q")?.trim() ?? "";

  useEffect(() => {
    canvasEndRef.current?.scrollIntoView({
      behavior: hasContent ? "smooth" : "auto",
      block: "end",
    });
  }, [analysisBlocks, pendingBlocks, followUps, hasContent]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const rememberQuery = useCallback((query: string) => {
    setRecentQueries((current) => {
      const next = pushRecentQuery(query, current);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          RECENT_QUERIES_STORAGE_KEY,
          JSON.stringify(next),
        );
      }

      return next;
    });
  }, []);

  const syncWorkspaceUrl = useCallback(
    (query: string, symbol?: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("q", query);

      if (symbol) {
        params.set("symbol", symbol);
      } else {
        params.delete("symbol");
      }

      startTransition(() => {
        router.replace(`/?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams],
  );

  const updatePendingStep = (id: string, stepIndex: number) => {
    setPendingBlocks((current) =>
      current.map((block) =>
        block.id === id ? { ...block, stepIndex } : block,
      ),
    );
  };

  const completePendingBlock = useCallback(
    (id: string, block: AnalysisBlock) => {
      if (!isMountedRef.current) {
        return;
      }

      setPendingBlocks((current) => current.filter((item) => item.id !== id));
      setAnalysisBlocks((current) => [...current, block]);
    },
    [],
  );

  const runFullAnalysis = useCallback(
    (normalizedQuery: string) => {
      const resolved = resolveQuerySymbol(normalizedQuery);
      const id = `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      setPendingBlocks((current) => [
        ...current,
        { id, query: normalizedQuery, stepIndex: 0 },
      ]);

      void (async () => {
        try {
          await sleep(250);
          updatePendingStep(id, 1);

          const blockPromise = buildAnalysisBlockFromBackend(normalizedQuery, id);

          await sleep(360);
          updatePendingStep(id, 2);

          await sleep(360);
          updatePendingStep(id, 3);

          const block = await blockPromise;

          await sleep(240);
          updatePendingStep(id, 4);
          await sleep(180);

          completePendingBlock(id, block);
        } catch {
          completePendingBlock(
            id,
            buildMissingAnalysisBlock(normalizedQuery, id, resolved),
          );
        }
      })();
    },
    [completePendingBlock],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      setIsRestoringState(false);
      hasRestoredStateRef.current = true;
      return;
    }

    try {
      const rawState = window.sessionStorage.getItem(ANALYSIS_STATE_STORAGE_KEY);
      if (rawState) {
        const parsed = JSON.parse(rawState) as Partial<PersistedAnalysisState>;
        const restoredAnalysisBlocks = Array.isArray(parsed.analysisBlocks)
          ? parsed.analysisBlocks
          : [];
        const restoredFollowUps = Array.isArray(parsed.followUps)
          ? parsed.followUps
          : [];
        const restoredPendingQueries = Array.isArray(parsed.pendingQueries)
          ? parsed.pendingQueries.filter(
              (query): query is string =>
                typeof query === "string" && query.trim().length > 0,
            )
          : [];

        if (restoredAnalysisBlocks.length > 0) {
          setAnalysisBlocks(restoredAnalysisBlocks);
        }

        if (restoredFollowUps.length > 0) {
          setFollowUps(restoredFollowUps);
        }

        restoredPendingQueries.forEach((query) => {
          runFullAnalysis(query);
        });
      }

      const rawRecentQueries = window.localStorage.getItem(
        RECENT_QUERIES_STORAGE_KEY,
      );
      if (rawRecentQueries) {
        const parsedRecentQueries = JSON.parse(rawRecentQueries) as unknown;
        if (Array.isArray(parsedRecentQueries)) {
          setRecentQueries(
            parsedRecentQueries.filter(
              (entry): entry is string =>
                typeof entry === "string" && entry.trim().length > 0,
            ),
          );
        }
      }
    } catch {
      window.sessionStorage.removeItem(ANALYSIS_STATE_STORAGE_KEY);
      window.localStorage.removeItem(RECENT_QUERIES_STORAGE_KEY);
    } finally {
      hasRestoredStateRef.current = true;
      setIsRestoringState(false);
    }
  }, [runFullAnalysis]);

  useEffect(() => {
    if (!hasRestoredStateRef.current || typeof window === "undefined") {
      return;
    }

    const stateToPersist: PersistedAnalysisState = {
      analysisBlocks,
      followUps,
      pendingQueries: pendingBlocks.map((block) => block.query),
    };

    window.sessionStorage.setItem(
      ANALYSIS_STATE_STORAGE_KEY,
      JSON.stringify(stateToPersist),
    );
  }, [analysisBlocks, followUps, pendingBlocks]);

  useEffect(() => {
    if (
      !hasRestoredStateRef.current ||
      hasBootstrappedUrlQueryRef.current ||
      !queryFromUrl ||
      hasContent
    ) {
      return;
    }

    hasBootstrappedUrlQueryRef.current = true;
    rememberQuery(queryFromUrl);
    runFullAnalysis(queryFromUrl);
  }, [hasContent, queryFromUrl, rememberQuery, runFullAnalysis]);

  const handleFollowUp = useCallback(
    (normalizedQuery: string, symbol: string) => {
      const id = `follow-up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setFollowUps((current) => [
        ...current,
        {
          id,
          question: normalizedQuery,
          symbol,
          answer: "",
          status: "loading",
        },
      ]);

      void (async () => {
        try {
          const response = await postFollowUp(symbol, normalizedQuery);
          if (!isMountedRef.current) {
            return;
          }

          setFollowUps((current) =>
            current.map((item) =>
              item.id === id
                ? {
                    ...item,
                    answer: response.answer,
                    status: "ready",
                  }
                : item,
            ),
          );
        } catch {
          if (!isMountedRef.current) {
            return;
          }

          setFollowUps((current) =>
            current.map((item) =>
              item.id === id
                ? {
                    ...item,
                    answer: "Follow-up data is missing.",
                    status: "error",
                  }
                : item,
            ),
          );
        }
      })();
    },
    [],
  );

  const handleSubmit = useCallback(
    (query: string) => {
      const normalizedQuery = query.trim();

      if (!normalizedQuery) {
        return;
      }

      rememberQuery(normalizedQuery);

      if (shouldRunFullAnalysis(normalizedQuery, currentSymbol)) {
        const resolved = resolveQuerySymbol(normalizedQuery);
        syncWorkspaceUrl(normalizedQuery, resolved.symbol);
        runFullAnalysis(normalizedQuery);
        return;
      }

      if (currentSymbol) {
        syncWorkspaceUrl(normalizedQuery, currentSymbol);
        handleFollowUp(normalizedQuery, currentSymbol);
        return;
      }

      const resolved = resolveQuerySymbol(normalizedQuery);
      syncWorkspaceUrl(normalizedQuery, resolved.symbol);
      runFullAnalysis(normalizedQuery);
    },
    [
      currentSymbol,
      handleFollowUp,
      rememberQuery,
      runFullAnalysis,
      syncWorkspaceUrl,
    ],
  );

  const renderedTickerBar = useMemo(
    () => (
      <div className="flex flex-wrap items-center gap-3">
        {MARKET_TICKERS.map((ticker) => (
          <div
            key={ticker.symbol}
            className="flex min-w-[138px] items-center justify-between rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-[11px] tracking-[0.18em] text-[#8EA0B8] uppercase"
          >
            <span>{ticker.symbol}</span>
            <span
              className={
                ticker.change.startsWith("-")
                  ? "text-[#F36A6A]"
                  : "text-[#3DD9B3]"
              }
            >
              {ticker.change}
            </span>
          </div>
        ))}
      </div>
    ),
    [],
  );

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(61,217,179,0.08),transparent_38%),linear-gradient(180deg,rgba(10,16,24,0.12),rgba(5,9,14,0.18))]" />
      <div className="terminal-grid pointer-events-none absolute inset-0 opacity-40" />

      <MarketlyNavbar currentSymbol={currentSymbol} />

      <main className="relative mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 pb-44 pt-[92px] sm:px-6 lg:px-10">
        <div className="mx-auto w-full max-w-[1080px] space-y-6">
            {!hasContent && !isRestoringState ? (
              <EmptyState
                onSubmit={handleSubmit}
                tickerBar={renderedTickerBar}
                recentQueries={recentQueries}
                quickPrompts={QUICK_PROMPTS}
              />
            ) : (
              <>
                {currentSymbol ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(12,19,29,0.94),rgba(8,12,18,0.96))] px-5 py-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.24em] text-[#6F8197]">
                        Active symbol
                      </p>
                      <p className="mt-1 text-xl font-medium tracking-[-0.03em] text-[#F3F7FB]">
                        {currentSymbol}
                      </p>
                    </div>
                    <Link
                      href={`/financials/${currentSymbol}`}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-[#E7EEF5] transition-colors hover:bg-white/[0.04]"
                    >
                      <BarChart3 className="h-4 w-4 text-[#3DD9B3]" />
                      Open financials
                      <ArrowRight className="h-4 w-4 text-[#6F8197]" />
                    </Link>
                  </div>
                ) : null}

                <div className="space-y-6">
                    {analysisBlocks.map((block, index) => (
                      <section
                        key={block.id}
                        className="animate-enter rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,24,35,0.92),rgba(8,12,18,0.96))] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.01)] backdrop-blur-sm sm:p-6 lg:p-7"
                        style={{ animationDelay: `${index * 80}ms` }}
                      >
                        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-white/6 pb-4">
                          <div>
                            <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#9FB3C8]">
                              Analysis query
                            </p>
                            <h2 className="mt-2 text-lg font-medium tracking-[-0.03em] text-[#F3F7FB]">
                              {block.query}
                            </h2>
                          </div>
                          <div className="flex flex-wrap gap-2 text-right">
                            <span className="rounded-full border border-white/8 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[#8EA0B8]">
                              {block.resolution.symbol} via {block.resolution.matchedBy}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-5">
                          <StockHeader stock={block.stock} />
                          <MetricsGrid metrics={block.metrics} />
                          <TradingViewChart
                            symbol={block.stock.ticker}
                            exchange={block.stock.exchange}
                          />
                          <RevenueTrend {...block.revenue} />
                          <AIInsights insights={block.insights} />
                          <AnalysisLens lens={block.lens} />
                          <NewsSection news={block.news} />
                          <BullBear
                            bullPoints={block.bullPoints}
                            bearPoints={block.bearPoints}
                          />
                          <FinalVerdict verdict={block.verdict} />
                        </div>
                      </section>
                    ))}

                    {followUps.map((item) => (
                      <FollowUpPanel key={item.id} item={item} />
                    ))}

                    {pendingBlocks.map((block) => (
                      <AnalysisBlockSkeleton
                        key={block.id}
                        query={block.query}
                        stepIndex={Math.min(
                          block.stepIndex,
                          ANALYSIS_LOADING_STEPS.length - 1,
                        )}
                      />
                    ))}
                    <div ref={canvasEndRef} />
                </div>
              </>
            )}
        </div>
      </main>

      {hasContent ? (
        <ChatInput
          onSubmit={handleSubmit}
          compact
          contextLabel={currentSymbol ? `${currentSymbol} follow-up` : "Ask another stock"}
          hint={
            currentSymbol
              ? "Ask one short follow-up or type a new stock to switch."
              : "Type a stock or company name."
          }
        />
      ) : null}
    </div>
  );
}
