"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CinematicWorkspace,
  type AnalysisBlock,
  type CinematicPendingBlock,
  type FollowUpAnswer,
} from "@/components/marketly";
import { postFollowUp } from "@/lib/api";
import {
  buildAnalysisBlockFromBackendProgressive,
  buildMissingAnalysisBlock,
  type ProgressiveAnalysisPreview,
  resolveQuerySymbol,
  shouldRunFullAnalysis,
} from "@/lib/marketly-analysis";

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

const ANALYSIS_STATE_STORAGE_KEY = "marketly.analysis-state.v2";
const RECENT_QUERIES_STORAGE_KEY = "marketly.recent-queries";
const MAX_RECENT_QUERIES = 6;
const ANALYSIS_REVEAL_MIN_MS = 6500;

const STAGE_TO_STEP_INDEX = {
  financials: 1,
  news: 2,
  score: 3,
} as const;

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
  const [pendingBlocks, setPendingBlocks] = useState<CinematicPendingBlock[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpAnswer[]>([]);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [isRestoringState, setIsRestoringState] = useState(true);
  const isMountedRef = useRef(true);
  const hasRestoredStateRef = useRef(false);
  const hasBootstrappedUrlQueryRef = useRef(false);

  const hasContent =
    analysisBlocks.length > 0 || pendingBlocks.length > 0 || followUps.length > 0;
  const currentSymbol =
    analysisBlocks[analysisBlocks.length - 1]?.resolution.symbol ?? null;
  const queryFromUrl = searchParams.get("q")?.trim() ?? "";

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

  const updatePendingPreview = (
    id: string,
    stepIndex: number,
    preview: ProgressiveAnalysisPreview,
  ) => {
    setPendingBlocks((current) =>
      current.map((block) =>
        block.id === id ? { ...block, stepIndex, preview } : block,
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
      const startedAt = Date.now();

      setPendingBlocks((current) => [
        ...current,
        { id, query: normalizedQuery, symbol: resolved.symbol, stepIndex: 0 },
      ]);

      void (async () => {
        try {
          await sleep(180);
          updatePendingStep(id, 1);

          const block = await buildAnalysisBlockFromBackendProgressive(
            normalizedQuery,
            id,
            (update) => {
              updatePendingPreview(id, STAGE_TO_STEP_INDEX[update.stage], update.preview);
            },
          );

          await sleep(240);
          updatePendingStep(id, 4);
          await sleep(Math.max(180, ANALYSIS_REVEAL_MIN_MS - (Date.now() - startedAt)));

          completePendingBlock(id, block);
        } catch {
          await sleep(Math.max(180, ANALYSIS_REVEAL_MIN_MS - (Date.now() - startedAt)));
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

  const handleReset = useCallback(() => {
    setAnalysisBlocks([]);
    setPendingBlocks([]);
    setFollowUps([]);
    startTransition(() => {
      router.replace("/", { scroll: false });
    });

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(ANALYSIS_STATE_STORAGE_KEY);
    }
  }, [router]);

  return (
    <CinematicWorkspace
      analysisBlocks={analysisBlocks}
      pendingBlocks={pendingBlocks}
      followUps={followUps}
      recentQueries={recentQueries}
      quickPrompts={QUICK_PROMPTS}
      isRestoringState={isRestoringState}
      currentSymbol={currentSymbol}
      onSubmit={handleSubmit}
      onReset={handleReset}
    />
  );
}
