"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AIInsights,
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
import { ANALYSIS_LOADING_STEPS, MARKET_TICKERS } from "@/components/marketly/mock-data";
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

export type WindowType = {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default function Page() {
  const [analysisBlocks, setAnalysisBlocks] = useState<AnalysisBlock[]>([]);
  const [pendingBlocks, setPendingBlocks] = useState<PendingBlock[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpAnswer[]>([]);
  const canvasEndRef = useRef<HTMLDivElement | null>(null);
  const isMountedRef = useRef(true);

  const hasContent =
    analysisBlocks.length > 0 || pendingBlocks.length > 0 || followUps.length > 0;
  const currentSymbol = analysisBlocks[analysisBlocks.length - 1]?.resolution.symbol ?? null;

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

  const updatePendingStep = (id: string, stepIndex: number) => {
    setPendingBlocks((current) =>
      current.map((block) =>
        block.id === id ? { ...block, stepIndex } : block,
      ),
    );
  };

  const completePendingBlock = (id: string, block: AnalysisBlock) => {
    if (!isMountedRef.current) {
      return;
    }

    setPendingBlocks((current) => current.filter((item) => item.id !== id));
    setAnalysisBlocks((current) => [...current, block]);
  };

  const handleFullAnalysis = (normalizedQuery: string) => {
    const resolved = resolveQuerySymbol(normalizedQuery);
    const id = `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    setPendingBlocks((current) => [...current, { id, query: normalizedQuery, stepIndex: 0 }]);

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
        completePendingBlock(id, buildMissingAnalysisBlock(normalizedQuery, id, resolved));
      }
    })();
  };

  const handleFollowUp = (normalizedQuery: string, symbol: string) => {
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
  };

  const handleSubmit = (query: string) => {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return;
    }

    if (shouldRunFullAnalysis(normalizedQuery, currentSymbol)) {
      handleFullAnalysis(normalizedQuery);
      return;
    }

    if (currentSymbol) {
      handleFollowUp(normalizedQuery, currentSymbol);
      return;
    }

    handleFullAnalysis(normalizedQuery);
  };

  const renderedTickerBar = useMemo(
    () => (
      <div className="flex flex-wrap items-center justify-center gap-3 md:justify-start">
        {MARKET_TICKERS.map((ticker) => (
          <div
            key={ticker.symbol}
            className="flex min-w-[122px] items-center justify-between rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] tracking-[0.18em] text-[#9CA3AF] uppercase"
          >
            <span>{ticker.symbol}</span>
            <span className={ticker.change.startsWith("-") ? "text-[#EF4444]" : "text-[#22C55E]"}>
              {ticker.change}
            </span>
          </div>
        ))}
      </div>
    ),
    [],
  );

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_38%),linear-gradient(180deg,rgba(12,16,22,0.92),rgba(11,15,20,1))]" />
      <div className="terminal-grid pointer-events-none absolute inset-0 opacity-40" />

      <MarketlyNavbar />

      <main className="relative mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 pb-44 pt-[84px] sm:px-6 lg:px-10">
        {!hasContent ? (
          <EmptyState onSubmit={handleSubmit} tickerBar={renderedTickerBar} />
        ) : (
          <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 pb-8">
            {analysisBlocks.map((block, index) => (
              <section
                key={block.id}
                className="animate-enter rounded-[24px] border border-white/8 bg-[#121821]/88 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.01)] backdrop-blur-sm sm:p-6 lg:p-7"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="mb-6 flex items-center justify-between border-b border-white/6 pb-3">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#9CA3AF]">
                      Analysis Query
                    </p>
                    <h2 className="mt-2 text-base font-medium text-[#E5E7EB]">
                      {block.query}
                    </h2>
                  </div>
                  <div className="hidden text-right sm:block">
                    <span className="text-[11px] uppercase tracking-[0.24em] text-[#6B7280]">
                      {block.dataStatus.analysis === "backend"
                        ? "Scoring Engine + GPT"
                        : "Analysis Missing"}
                    </span>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">
                      {block.resolution.symbol} via {block.resolution.matchedBy}
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  {[
                    <StockHeader key="stock" stock={block.stock} />,
                    <TradingViewChart
                      key="live-chart"
                      symbol={block.stock.ticker}
                      exchange={block.stock.exchange}
                    />,
                    <MetricsGrid key="metrics" metrics={block.metrics} />,
                    <RevenueTrend key="revenue" {...block.revenue} />,
                    <AIInsights key="insights" insights={block.insights} />,
                    <NewsSection key="news" news={block.news} />,
                    <BullBear
                      key="bullbear"
                      bullPoints={block.bullPoints}
                      bearPoints={block.bearPoints}
                    />,
                    <FinalVerdict key="verdict" verdict={block.verdict} />,
                  ].map((section, sectionIndex) => (
                    <div
                      key={sectionIndex}
                      className="animate-enter"
                      style={{ animationDelay: `${140 + sectionIndex * 90}ms` }}
                    >
                      {section}
                    </div>
                  ))}
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
        )}
      </main>

      {hasContent ? <ChatInput onSubmit={handleSubmit} compact /> : null}
    </div>
  );
}
