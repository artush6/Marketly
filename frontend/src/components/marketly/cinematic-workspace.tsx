"use client";

import type {FormEvent, ReactNode} from "react";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {AnimatePresence, motion} from "framer-motion";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Database,
  Globe,
  HelpCircle,
  Minus,
  Search,
  Sparkles,
  Terminal,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  Bar,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {cn} from "@/lib/utils";
import type {
  AnalysisBlock,
  FinancialMiniChartData,
  FollowUpAnswer,
  NewsItem,
} from "./types";
import {TradingViewChart} from "./tradingview-chart";

export type CinematicPendingBlock = {
  id: string;
  query: string;
  symbol: string;
  stepIndex: number;
  preview?: {
    company?: string;
    price?: string;
    changePercent?: string;
    marketCap?: string;
    revenue?: string;
    netIncome?: string;
    newsCount?: number;
    score?: string;
    verdict?: string;
    completedStages: Array<"financials" | "news" | "score">;
  };
};

type PromptCard = {
  label: string;
  prompt: string;
  detail: string;
};

type CinematicWorkspaceProps = {
  analysisBlocks: AnalysisBlock[];
  pendingBlocks: CinematicPendingBlock[];
  followUps: FollowUpAnswer[];
  recentQueries: string[];
  quickPrompts: PromptCard[];
  isRestoringState: boolean;
  currentSymbol: string | null;
  onSubmit: (query: string) => void;
  onReset: () => void;
};

type AppPhase = "idle" | "analyzing" | "dashboard";
type TabType = "overview" | "financials" | "news" | "analysis" | "technical";

type StockData = {
  ticker: string;
  companyName: string;
  exchange: string;
  sector: string;
  logoUrl?: string;
  price: number;
  priceLabel: string;
  change: number;
  changeLabel: string;
  changePercent: number;
  changePercentLabel: string;
  previousClose: number;
};

type MetricRowItem = {
  label: string;
  value: string;
  subValue?: string;
  trend?: "up" | "down" | "neutral";
};

type GraphData = {
  revenue: string;
  netIncome: string;
  margin: string;
  pe: string;
  marketCap: string;
  rsi: string;
  sentiment: string;
  holdings: string;
  filings: string;
  score: string;
  headlines: string[];
};

const SEARCH_SUGGESTIONS = [
  {ticker: "AAPL", name: "Apple Inc."},
  {ticker: "MSFT", name: "Microsoft"},
  {ticker: "NVDA", name: "NVIDIA"},
  {ticker: "GOOGL", name: "Alphabet"},
  {ticker: "TSLA", name: "Tesla"},
];

const TABS: {id: TabType; label: string}[] = [
  {id: "overview", label: "Overview"},
  {id: "financials", label: "Financials"},
  {id: "news", label: "News"},
  {id: "analysis", label: "Analysis"},
  {id: "technical", label: "Technical"},
];

function parseDisplayNumber(value: string | null | undefined) {
  if (!value || /missing|--/i.test(value)) {
    return null;
  }

  const normalized = value.replace(/,/g, "").trim();
  const match = normalized.match(/[-+]?\d*\.?\d+/);
  if (!match) {
    return null;
  }

  const suffix = normalized.slice(match.index! + match[0].length).toUpperCase();
  const multiplier = suffix.includes("T")
    ? 1_000_000_000_000
    : suffix.includes("B")
      ? 1_000_000_000
      : suffix.includes("M")
        ? 1_000_000
        : suffix.includes("K")
          ? 1_000
          : 1;

  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed * multiplier : null;
}

function parsePercent(value: string | null | undefined) {
  const parsed = parseDisplayNumber(value);
  return parsed == null ? null : parsed;
}

function parseScore(value: string | null | undefined) {
  const parsed = parseDisplayNumber(value);
  if (parsed == null) {
    return null;
  }

  return parsed <= 10 ? parsed * 10 : parsed;
}

function formatCompactCurrency(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "Data missing";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: value >= 1_000_000_000 ? 1 : 2,
  }).format(value);
}

function shortContext(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return value.length > 46 ? `${value.slice(0, 43)}...` : value;
}

function getMetric(block: AnalysisBlock | undefined, label: string) {
  return block?.metrics.find((metric) =>
    metric.label.toLowerCase().includes(label.toLowerCase()),
  );
}

function normalizeVerdict(label: string | undefined): "Bullish" | "Bearish" | "Neutral" {
  const normalized = (label ?? "").toLowerCase();

  if (normalized.includes("bull") || normalized.includes("buy")) {
    return "Bullish";
  }

  if (
    normalized.includes("bear") ||
    normalized.includes("sell") ||
    normalized.includes("cautious")
  ) {
    return "Bearish";
  }

  return "Neutral";
}

function capitalizeFirst(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : trimmed;
}

function buildStockData(block: AnalysisBlock): StockData {
  const price = parseDisplayNumber(block.stock.price) ?? 0;
  const change = parseDisplayNumber(block.stock.change) ?? 0;
  const changePercent = parsePercent(block.stock.changePercent) ?? 0;
  const previousClose = price && change ? price - change : price;

  return {
    ticker: block.stock.ticker,
    companyName: block.stock.company,
    exchange: block.stock.exchange,
    sector: block.marketContext.sector ?? block.lens.businessModel,
    logoUrl: block.stock.logoUrl,
    price,
    priceLabel: block.stock.price,
    change,
    changeLabel: block.stock.change,
    changePercent,
    changePercentLabel: block.stock.changePercent,
    previousClose,
  };
}

function buildMetricRows(block: AnalysisBlock): MetricRowItem[] {
  const marketCap =
    getMetric(block, "Market Cap")?.value ??
    getMetric(block, "Revenue Growth")?.value ??
    "Data missing";
  const revenue = getMetric(block, "Revenue");
  const netIncome = getMetric(block, "Net Income");
  const operatingMargin = getMetric(block, "Operating Margin");
  const score = parseScore(block.verdict.score);

  return [
    {
      label: "Market Cap",
      value: marketCap,
      subValue: block.marketContext.sector ?? "Backend valuation",
      trend: "neutral",
    },
    {
      label: revenue?.label ?? "Revenue",
      value: revenue?.value ?? "Data missing",
      subValue: shortContext(revenue?.context),
      trend: "up",
    },
    {
      label: netIncome?.label ?? "Net Income",
      value: netIncome?.value ?? "Data missing",
      subValue: shortContext(netIncome?.context),
      trend: "up",
    },
    {
      label: operatingMargin?.label ?? "Operating Margin",
      value: operatingMargin?.value ?? "Data missing",
      subValue: shortContext(operatingMargin?.context),
      trend: "neutral",
    },
    {
      label: "AI Score",
      value: score == null ? block.verdict.score : `${Math.round(score)}/100`,
      subValue: block.verdict.label,
      trend: score == null ? "neutral" : score >= 60 ? "up" : "down",
    },
    {
      label: "Confidence",
      value: block.metadata.confidenceLevel
        ? block.metadata.confidenceLevel.toUpperCase()
        : block.verdict.confidence ?? "Data missing",
      subValue: block.metadata.dataQualityScore
        ? `Quality ${block.metadata.dataQualityScore}`
        : block.verdict.source,
      trend: "neutral",
    },
  ];
}

function buildGraphData(
  pending: CinematicPendingBlock | undefined,
  block: AnalysisBlock | undefined,
): GraphData {
  const preview = pending?.preview;
  const operatingMargin = getMetric(block, "Operating Margin")?.value;
  const valuation = block?.lens.lenses.find((item) =>
    item.label.toLowerCase().includes("valuation"),
  );
  const sentiment = block?.marketContext.items.find((item) =>
    item.label.toLowerCase().includes("news"),
  );

  return {
    revenue: preview?.revenue ?? getMetric(block, "Revenue")?.value ?? "loading",
    netIncome: preview?.netIncome ?? getMetric(block, "Net Income")?.value ?? "loading",
    margin: operatingMargin ?? "loading",
    pe: valuation?.value ?? "modeling",
    marketCap: preview?.marketCap ?? getMetric(block, "Market Cap")?.value ?? "loading",
    rsi: block?.marketContext.riskOnScore ?? "scanning",
    sentiment: sentiment?.value ?? preview?.verdict ?? "neutral",
    holdings: block?.lens.businessConfidence ?? "loading",
    filings: block?.metadata.dataSource ?? "backend",
    score: preview?.score ?? block?.verdict.score ?? "--",
    headlines:
      block?.news.slice(0, 3).map((item) => item.title) ??
      (preview?.newsCount ? [`${preview.newsCount} headlines indexed`] : []),
  };
}

function buildPerformanceData(block: AnalysisBlock, period: "annual" | "quarterly" = "annual") {
  const revenue = block.revenue.series;
  const netIncome =
    block.revenue.miniCharts.find((chart) =>
      chart.title.toLowerCase().includes("net income"),
    )?.series ?? [];
  const margin =
    block.revenue.miniCharts.find((chart) =>
      chart.title.toLowerCase().includes("margin"),
    )?.series ?? [];

  const hasQuarterlyLabels = revenue.some((point) => /^Q[1-4]\b/i.test(point.label));
  const periodRevenue =
    period === "quarterly" && hasQuarterlyLabels
      ? revenue.filter((point) => /^Q[1-4]\b/i.test(point.label))
      : period === "annual" && hasQuarterlyLabels
        ? revenue.filter((point) => !/^Q[1-4]\b/i.test(point.label))
        : revenue;

  return periodRevenue.slice(period === "quarterly" ? -4 : -5).map((point) => {
    const revenueIndex = revenue.findIndex((entry) => entry.label === point.label);
    const fallbackIndex = revenueIndex >= 0 ? revenueIndex : 0;

    return {
    year: point.label,
    revenue: Number(point.value.toFixed(1)),
      netIncome: Number((netIncome[fallbackIndex]?.value ?? 0).toFixed(1)),
      margin: Number((margin[fallbackIndex]?.value ?? 0).toFixed(1)),
    };
  });
}

function latestMiniCharts(block: AnalysisBlock) {
  return block.revenue.miniCharts.length
    ? block.revenue.miniCharts
    : [
        {
          title: "Revenue",
          value: getMetric(block, "Revenue")?.value ?? "Data missing",
          delta: "Backend",
          deltaTone: "neutral" as const,
          series: block.revenue.series,
          format: "billions" as const,
          context: block.revenue.description,
        },
      ];
}

function confidenceValue(block: AnalysisBlock) {
  const confidence =
    parsePercent(block.verdict.confidence) ??
    parsePercent(block.lens.businessConfidence) ??
    parseScore(block.verdict.score);

  return Math.max(0, Math.min(100, Math.round(confidence ?? 50)));
}

function scenarioBars(block: AnalysisBlock, currentPrice: number) {
  const cases = block.scenarioCases.slice(0, 3);

  if (cases.length) {
    return cases.map((item, index) => {
      const probability = Math.round(
        item.probability <= 1 ? item.probability * 100 : item.probability,
      );
      const targetMultiplier = index === 0 ? 1.18 : index === 1 ? 1 : 0.82;

      return {
        name: index === 0 ? "Bull" : index === 1 ? "Base" : "Bear",
        probability: Math.max(0, Math.min(100, probability)),
        target: currentPrice ? `$${(currentPrice * targetMultiplier).toFixed(0)}` : `${probability}%`,
      };
    });
  }

  return [
    {name: "Bull", probability: 35, target: currentPrice ? `$${(currentPrice * 1.18).toFixed(0)}` : "35%"},
    {name: "Base", probability: 45, target: currentPrice ? `$${currentPrice.toFixed(0)}` : "45%"},
    {name: "Bear", probability: 20, target: currentPrice ? `$${(currentPrice * 0.82).toFixed(0)}` : "20%"},
  ];
}

function buildIssues(block: AnalysisBlock) {
  const issueTitle =
    block.scenarioCases[0]?.name ??
    block.lens.lenses[0]?.label ??
    "Core thesis tension";

  const secondTitle =
    block.scenarioCases[1]?.name ??
    block.lens.lenses[1]?.label ??
    "Valuation and execution setup";

  const thirdTitle =
    block.scenarioCases[2]?.name ??
    block.lens.lenses[2]?.label ??
    "Market context and catalyst path";

  return [
    {
      id: "core",
      title: capitalizeFirst(issueTitle),
      bullish: {
        content:
          block.bullPoints[0] ??
          block.insights.strengths[0] ??
          "The bullish view depends on durable execution and improving market acceptance.",
        sources: ["Score", "Financials"],
      },
      bearish: {
        content:
          block.bearPoints[0] ??
          block.insights.risks[0] ??
          "The bearish view centers on valuation compression and weaker execution signals.",
        sources: ["Score", "News"],
      },
    },
    {
      id: "valuation",
      title: capitalizeFirst(secondTitle),
      bullish: {
        content:
          block.bullPoints[1] ??
          block.scenarioCases[1]?.thesis ??
          block.lens.lenses[1]?.detail ??
          "The setup improves if margins, growth, and catalysts keep reinforcing each other.",
        sources: ["Scenarios"],
      },
      bearish: {
        content:
          block.bearPoints[1] ??
          block.scoreBreakdown.penalties[0] ??
          "Multiple sensitivity remains the practical downside if expectations reset.",
        sources: ["Score"],
      },
    },
    {
      id: "market",
      title: capitalizeFirst(thirdTitle),
      bullish: {
        content:
          block.lens.catalysts[0]?.rationale ??
          block.lens.upcomingDrivers[0] ??
          "Catalyst follow-through can improve narrative quality and signal strength.",
        sources: ["Catalysts"],
      },
      bearish: {
        content:
          block.marketContext.items.find((item) => item.tone === "negative")?.detail ??
          block.insights.criticalUnknowns?.[0] ??
          "The open questions are where the thesis still needs fresh evidence.",
        sources: ["Market"],
      },
    },
  ];
}

function SearchInterface({
  onSubmit,
  recentQueries,
}: Pick<CinematicWorkspaceProps, "onSubmit" | "recentQueries">) {
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 500);
    return () => window.clearTimeout(timer);
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = value.trim();

    if (query) {
      onSubmit(query);
    }
  };

  return (
    <motion.div
      className="flex flex-col items-center gap-12 px-4"
      initial={{opacity: 0, y: 20}}
      animate={{opacity: 1, y: 0}}
      exit={{opacity: 0, scale: 0.95, y: -20}}
      transition={{duration: 0.6, ease: "easeOut"}}
    >
      <motion.div
        className="flex flex-col items-center gap-4"
        initial={{opacity: 0, y: 10}}
        animate={{opacity: 1, y: 0}}
        transition={{delay: 0.2, duration: 0.5}}
      >
        <div className="flex items-center gap-3">
          <motion.div
            className="relative"
            animate={{rotate: [0, 360]}}
            transition={{duration: 20, repeat: Infinity, ease: "linear"}}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/80 to-accent/60">
              <TrendingUp className="h-5 w-5 text-primary-foreground" />
            </div>
          </motion.div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Marketly
          </h1>
        </div>
        <p className="terminal-text text-sm tracking-wide text-muted-foreground">
          AI-powered financial intelligence
        </p>
      </motion.div>

      <motion.form
        onSubmit={handleSubmit}
        className="w-full max-w-xl"
        initial={{opacity: 0, y: 10}}
        animate={{opacity: 1, y: 0}}
        transition={{delay: 0.4, duration: 0.5}}
      >
        <div
          className={cn(
            "group relative rounded-xl transition-all duration-300",
            isFocused && "glow-primary",
          )}
        >
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/20 via-accent/10 to-primary/20 opacity-0 blur-xl transition-opacity group-hover:opacity-100" />

          <div className="glass relative flex items-center overflow-hidden rounded-xl">
            <div className="pl-5 pr-2">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>

            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Enter a ticker symbol..."
              className="flex-1 bg-transparent px-3 py-5 text-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              autoComplete="off"
              spellCheck={false}
            />

            <motion.button
              type="submit"
              className="m-2 flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              disabled={!value.trim()}
              whileHover={{scale: 1.02}}
              whileTap={{scale: 0.98}}
            >
              <Sparkles className="h-4 w-4" />
              <span>Analyze</span>
            </motion.button>
          </div>
        </div>
      </motion.form>

      <motion.div
        className="flex flex-wrap justify-center gap-3"
        initial={{opacity: 0}}
        animate={{opacity: 1}}
        transition={{delay: 0.6, duration: 0.5}}
      >
        <span className="mr-2 text-sm text-muted-foreground/60">Try:</span>
        {SEARCH_SUGGESTIONS.map((suggestion, index) => (
          <motion.button
            key={suggestion.ticker}
            onClick={() => onSubmit(suggestion.ticker)}
            className="rounded-lg bg-secondary/50 px-4 py-2 font-mono text-sm text-secondary-foreground transition-all hover:scale-105 hover:bg-secondary"
            initial={{opacity: 0, y: 10}}
            animate={{opacity: 1, y: 0}}
            transition={{delay: 0.7 + index * 0.05}}
            whileHover={{y: -2}}
            type="button"
            title={suggestion.name}
          >
            {suggestion.ticker}
          </motion.button>
        ))}
      </motion.div>

      {recentQueries.length > 0 && (
        <motion.div
          className="flex max-w-3xl flex-wrap justify-center gap-2"
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          transition={{delay: 0.8, duration: 0.5}}
        >
          {recentQueries.slice(0, 4).map((query) => (
            <button
              key={query}
              type="button"
              onClick={() => onSubmit(query)}
              className="rounded-full border border-border bg-card/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {query}
            </button>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

function GridBackground({
  intensity = "medium",
  showScanlines = false,
}: {
  intensity?: "low" | "medium" | "high";
  showScanlines?: boolean;
}) {
  const opacityMap = {
    low: 0.15,
    medium: 0.35,
    high: 0.5,
  };

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div
        className="grid-pattern absolute inset-0"
        style={{
          opacity: opacityMap[intensity],
          maskImage: "radial-gradient(ellipse 80% 70% at center, black 0%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 70% at center, black 0%, transparent 100%)",
        }}
      />

      <div
        className="grid-pattern-fine absolute inset-0"
        style={{
          opacity: opacityMap[intensity] * 0.4,
          maskImage: "radial-gradient(ellipse 60% 50% at center, black 0%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 50% at center, black 0%, transparent 100%)",
        }}
      />

      {showScanlines && <div className="scanlines absolute inset-0 opacity-30" />}

      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at center, transparent 0%, oklch(0.05 0.005 260 / 0.5) 60%, oklch(0.05 0.005 260) 100%)",
        }}
      />

      <motion.div
        className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, oklch(0.78 0.20 145 / 0.04) 0%, transparent 60%)",
        }}
        animate={{scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6]}}
        transition={{duration: 6, repeat: Infinity, ease: "easeInOut"}}
      />

      <motion.div
        className="absolute right-1/4 top-1/4 h-[500px] w-[500px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, oklch(0.72 0.15 195 / 0.03) 0%, transparent 60%)",
        }}
        animate={{scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4]}}
        transition={{duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1}}
      />

      <motion.div
        className="absolute bottom-1/4 left-1/4 h-[400px] w-[400px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, oklch(0.75 0.18 145 / 0.025) 0%, transparent 60%)",
        }}
        animate={{scale: [1, 1.25, 1], opacity: [0.3, 0.5, 0.3]}}
        transition={{duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2}}
      />

      <div className="noise-overlay absolute inset-0" />
    </div>
  );
}

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  hue: number;
};

function ParticleCanvas({phase}: {phase: "idle" | "signal" | "data" | "formation" | "reveal"}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number | undefined>(undefined);

  const getParticleCount = useCallback(() => {
    switch (phase) {
      case "idle":
        return 40;
      case "signal":
        return 100;
      case "data":
        return 150;
      case "formation":
        return 80;
      case "reveal":
        return 50;
      default:
        return 40;
    }
  }, [phase]);

  const getSpeed = useCallback(() => {
    switch (phase) {
      case "idle":
        return 0.4;
      case "signal":
        return 1.0;
      case "data":
        return 1.5;
      case "formation":
        return 0.6;
      case "reveal":
        return 0.3;
      default:
        return 0.4;
    }
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener("resize", resize);

    const targetCount = getParticleCount();
    while (particlesRef.current.length < targetCount) {
      particlesRef.current.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.5 + 0.2,
        hue: Math.random() > 0.6 ? 145 : 195,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const speed = getSpeed();
      const count = getParticleCount();

      while (particlesRef.current.length < count) {
        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          size: Math.random() * 2 + 0.5,
          opacity: Math.random() * 0.5 + 0.2,
          hue: Math.random() > 0.6 ? 145 : 195,
        });
      }

      while (particlesRef.current.length > count) {
        particlesRef.current.pop();
      }

      particlesRef.current.forEach((particle, index) => {
        particle.x += particle.vx * speed;
        particle.y += particle.vy * speed;

        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = `oklch(0.65 0.15 ${particle.hue} / ${particle.opacity})`;
        ctx.fill();

        if (phase === "signal" || phase === "data") {
          for (let nextIndex = index + 1; nextIndex < particlesRef.current.length; nextIndex += 1) {
            const next = particlesRef.current[nextIndex];
            const dx = particle.x - next.x;
            const dy = particle.y - next.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 120) {
              ctx.beginPath();
              ctx.moveTo(particle.x, particle.y);
              ctx.lineTo(next.x, next.y);
              ctx.strokeStyle = `oklch(0.55 0.12 145 / ${0.2 * (1 - distance / 120)})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        }
      });

      animationRef.current = window.requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      if (animationRef.current) {
        window.cancelAnimationFrame(animationRef.current);
      }
    };
  }, [phase, getParticleCount, getSpeed]);

  return (
    <AnimatePresence>
      <motion.canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-0"
        initial={{opacity: 0}}
        animate={{opacity: 1}}
        transition={{duration: 1}}
      />
    </AnimatePresence>
  );
}

type DataNode = {
  id: string;
  label: string;
  value?: string;
  type: "ticker" | "branch" | "data" | "news" | "indicator";
  branch: "center" | "financials" | "news" | "technical" | "institutional" | "synthesis";
  x: number;
  y: number;
  delay: number;
  color: string;
};

type Connection = {
  from: string;
  to: string;
  delay: number;
};

function DynamicNodeGraph({
  ticker,
  companyName,
  graphData,
}: {
  ticker: string;
  companyName: string;
  graphData: GraphData;
}) {
  const [phase, setPhase] = useState(0);
  const [showSynthesis, setShowSynthesis] = useState(false);

  useEffect(() => {
    setPhase(0);
    setShowSynthesis(false);

    const timings = [0, 500, 1500, 2500, 3500, 4500, 5500, 6500];
    const timers = timings.map((timing, index) =>
      window.setTimeout(() => {
        setPhase(index);
        if (index === 5) {
          setShowSynthesis(true);
        }
      }, timing),
    );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [ticker]);

  const nodes: DataNode[] = useMemo(
    () => [
      {id: "ticker", label: ticker, type: "ticker", branch: "center", x: 50, y: 50, delay: 0, color: "primary"},
      {id: "fin-branch", label: "FINANCIALS", type: "branch", branch: "financials", x: 75, y: 35, delay: 0.5, color: "primary"},
      {id: "revenue", label: "Revenue", value: graphData.revenue, type: "data", branch: "financials", x: 88, y: 20, delay: 0.7, color: "primary"},
      {id: "income", label: "Net Income", value: graphData.netIncome, type: "data", branch: "financials", x: 92, y: 35, delay: 0.9, color: "primary"},
      {id: "margin", label: "Margin", value: graphData.margin, type: "data", branch: "financials", x: 88, y: 50, delay: 1.1, color: "primary"},
      {id: "news-branch", label: "NEWS", type: "branch", branch: "news", x: 70, y: 70, delay: 1.5, color: "accent"},
      {id: "news-1", label: graphData.headlines[0] ?? "News stream acquiring", type: "news", branch: "news", x: 85, y: 65, delay: 1.7, color: "accent"},
      {id: "news-2", label: graphData.headlines[1] ?? "Provider cache warming", type: "news", branch: "news", x: 88, y: 78, delay: 1.9, color: "accent"},
      {id: "sentiment", label: "Sentiment", value: graphData.sentiment, type: "indicator", branch: "news", x: 80, y: 88, delay: 2.1, color: "positive"},
      {id: "tech-branch", label: "TECHNICAL", type: "branch", branch: "technical", x: 25, y: 35, delay: 2.5, color: "accent"},
      {id: "rsi", label: "Risk Tape", value: graphData.rsi, type: "indicator", branch: "technical", x: 10, y: 25, delay: 2.7, color: "accent"},
      {id: "pe", label: "Valuation", value: graphData.pe, type: "data", branch: "technical", x: 8, y: 42, delay: 2.9, color: "accent"},
      {id: "mcap", label: "Mkt Cap", value: graphData.marketCap, type: "data", branch: "technical", x: 12, y: 55, delay: 3.1, color: "primary"},
      {id: "inst-branch", label: "QUALITY", type: "branch", branch: "institutional", x: 30, y: 70, delay: 3.5, color: "primary"},
      {id: "holdings", label: "Confidence", value: graphData.holdings, type: "data", branch: "institutional", x: 12, y: 72, delay: 3.7, color: "primary"},
      {id: "filings", label: "Source", value: graphData.filings, type: "data", branch: "institutional", x: 15, y: 85, delay: 3.9, color: "primary"},
      {id: "ai-core", label: "AI SYNTHESIS", type: "branch", branch: "synthesis", x: 50, y: 50, delay: 4.5, color: "primary"},
    ],
    [graphData, ticker],
  );

  const connections: Connection[] = useMemo(
    () => [
      {from: "ticker", to: "fin-branch", delay: 0.5},
      {from: "ticker", to: "news-branch", delay: 1.5},
      {from: "ticker", to: "tech-branch", delay: 2.5},
      {from: "ticker", to: "inst-branch", delay: 3.5},
      {from: "fin-branch", to: "revenue", delay: 0.7},
      {from: "fin-branch", to: "income", delay: 0.9},
      {from: "fin-branch", to: "margin", delay: 1.1},
      {from: "news-branch", to: "news-1", delay: 1.7},
      {from: "news-branch", to: "news-2", delay: 1.9},
      {from: "news-branch", to: "sentiment", delay: 2.1},
      {from: "tech-branch", to: "rsi", delay: 2.7},
      {from: "tech-branch", to: "pe", delay: 2.9},
      {from: "tech-branch", to: "mcap", delay: 3.1},
      {from: "inst-branch", to: "holdings", delay: 3.7},
      {from: "inst-branch", to: "filings", delay: 3.9},
      {from: "ai-core", to: "fin-branch", delay: 4.7},
      {from: "ai-core", to: "news-branch", delay: 4.8},
      {from: "ai-core", to: "tech-branch", delay: 4.9},
      {from: "ai-core", to: "inst-branch", delay: 5.0},
    ],
    [],
  );

  const getColorClass = (color: string) => {
    switch (color) {
      case "primary":
        return "border-primary/50 bg-primary/10 text-primary";
      case "accent":
        return "border-accent/50 bg-accent/10 text-accent";
      case "positive":
        return "border-positive/50 bg-positive/10 text-positive";
      default:
        return "border-primary/50 bg-primary/10 text-primary";
    }
  };

  const getGlowClass = (color: string) => {
    switch (color) {
      case "primary":
        return "shadow-[0_0_20px_oklch(0.78_0.20_145_/_0.4)]";
      case "accent":
        return "shadow-[0_0_20px_oklch(0.72_0.15_195_/_0.4)]";
      case "positive":
        return "shadow-[0_0_20px_oklch(0.75_0.22_145_/_0.4)]";
      default:
        return "shadow-[0_0_20px_oklch(0.78_0.20_145_/_0.4)]";
    }
  };

  return (
    <div className="relative h-full min-h-[600px] w-full">
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="oklch(0.78 0.20 145 / 0.8)" />
            <stop offset="100%" stopColor="oklch(0.72 0.15 195 / 0.5)" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {connections.map((connection, index) => {
          const fromNode = nodes.find((node) => node.id === connection.from);
          const toNode = nodes.find((node) => node.id === connection.to);
          if (!fromNode || !toNode) {
            return null;
          }

          return (
            <motion.line
              key={`connection-${index}`}
              x1={`${fromNode.x}%`}
              y1={`${fromNode.y}%`}
              x2={`${toNode.x}%`}
              y2={`${toNode.y}%`}
              stroke="url(#connectionGradient)"
              strokeWidth="1.5"
              strokeDasharray="5 5"
              filter="url(#glow)"
              initial={{pathLength: 0, opacity: 0}}
              animate={{pathLength: 1, opacity: 0.6}}
              transition={{duration: 0.4, delay: connection.delay, ease: "easeOut"}}
            />
          );
        })}
      </svg>

      <AnimatePresence>
        {nodes.map((node) => {
          const shouldShow =
            (node.branch === "center" && phase >= 0) ||
            (node.branch === "financials" && phase >= 1) ||
            (node.branch === "news" && phase >= 2) ||
            (node.branch === "technical" && phase >= 3) ||
            (node.branch === "institutional" && phase >= 4) ||
            (node.branch === "synthesis" && phase >= 5);

          if (!shouldShow) {
            return null;
          }

          return (
            <motion.div
              key={node.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{left: `${node.x}%`, top: `${node.y}%`}}
              initial={{scale: 0, opacity: 0}}
              animate={{scale: 1, opacity: 1}}
              exit={{scale: 0, opacity: 0}}
              transition={{
                duration: 0.4,
                delay: node.delay,
                type: "spring",
                stiffness: 200,
                damping: 15,
              }}
            >
              {node.type === "ticker" ? (
                <div className="relative">
                  <motion.div
                    className={cn(
                      "flex h-24 w-24 items-center justify-center rounded-full border-2 font-mono text-xl font-bold",
                      getColorClass(node.color),
                      getGlowClass(node.color),
                    )}
                    animate={
                      showSynthesis
                        ? {
                            scale: [1, 1.1, 1],
                            boxShadow: [
                              "0 0 20px oklch(0.78 0.20 145 / 0.4)",
                              "0 0 40px oklch(0.78 0.20 145 / 0.6)",
                              "0 0 20px oklch(0.78 0.20 145 / 0.4)",
                            ],
                          }
                        : {}
                    }
                    transition={{duration: 1, repeat: showSynthesis ? Infinity : 0}}
                  >
                    {node.label}
                  </motion.div>

                  <motion.div
                    className="absolute inset-0 rounded-full border border-primary/30"
                    animate={{scale: [1, 2], opacity: [0.5, 0]}}
                    transition={{duration: 2, repeat: Infinity, ease: "easeOut"}}
                  />
                </div>
              ) : node.type === "branch" ? (
                <motion.div
                  className={cn(
                    "rounded-md border px-3 py-1.5 font-mono text-xs font-semibold tracking-wider",
                    getColorClass(node.color),
                  )}
                  animate={
                    node.branch === "synthesis"
                      ? {
                          boxShadow: [
                            "0 0 10px oklch(0.78 0.20 145 / 0.3)",
                            "0 0 30px oklch(0.78 0.20 145 / 0.6)",
                            "0 0 10px oklch(0.78 0.20 145 / 0.3)",
                          ],
                        }
                      : {}
                  }
                  transition={{
                    duration: 1.5,
                    repeat: node.branch === "synthesis" ? Infinity : 0,
                  }}
                >
                  {node.label}
                </motion.div>
              ) : node.type === "news" ? (
                <motion.div
                  className={cn(
                    "max-w-[160px] truncate rounded border px-2 py-1 text-xs",
                    getColorClass(node.color),
                  )}
                  initial={{x: 20, opacity: 0}}
                  animate={{x: 0, opacity: 1}}
                  transition={{delay: node.delay}}
                >
                  {node.label}
                </motion.div>
              ) : (
                <motion.div
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-md border px-2 py-1.5",
                    getColorClass(node.color),
                  )}
                  whileHover={{scale: 1.05}}
                >
                  <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                    {node.label}
                  </span>
                  <span className="font-mono text-sm font-semibold">{node.value}</span>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2">
        {["Ticker", "Financials", "News", "Technical", "Quality", "AI Synthesis", "Processing"].map(
          (label, index) => (
            <div key={label} className="flex items-center gap-1.5">
              <motion.div
                className={cn("h-2 w-2 rounded-full", phase >= index ? "bg-primary" : "bg-muted")}
                animate={phase === index ? {scale: [1, 1.3, 1]} : {}}
                transition={{duration: 0.5, repeat: phase === index ? Infinity : 0}}
              />
              {phase === index && (
                <motion.span
                  className="font-mono text-xs text-muted-foreground"
                  initial={{opacity: 0}}
                  animate={{opacity: 1}}
                >
                  {label}
                </motion.span>
              )}
            </div>
          ),
        )}
      </div>

      <AnimatePresence>
        {showSynthesis && phase >= 6 && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
          >
            <motion.div
              className="text-center"
              initial={{scale: 0.8, opacity: 0}}
              animate={{scale: 1, opacity: 1}}
              transition={{delay: 0.3}}
            >
              <div className="mb-2 font-mono text-sm text-primary">ANALYSIS COMPLETE</div>
              <div className="text-2xl font-semibold text-foreground">{companyName}</div>
              <motion.div
                className="mx-auto mt-4 h-1 w-48 overflow-hidden rounded-full bg-primary/30"
                initial={{opacity: 0}}
                animate={{opacity: 1}}
              >
                <motion.div
                  className="h-full bg-primary"
                  initial={{width: "0%"}}
                  animate={{width: "100%"}}
                  transition={{duration: 1, ease: "easeInOut"}}
                />
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TabNavigation({activeTab, onTabChange}: {activeTab: TabType; onTabChange: (tab: TabType) => void}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-border">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "relative px-4 py-3 text-sm font-medium transition-colors",
            activeTab === tab.id
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          type="button"
        >
          {tab.label}
          {activeTab === tab.id && (
            <motion.div
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
              transition={{type: "spring", stiffness: 500, damping: 35}}
            />
          )}
        </button>
      ))}
    </div>
  );
}

function StockHeader({stockData}: {stockData: StockData}) {
  const isPositive = stockData.change >= 0;

  return (
    <motion.div
      className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between"
      initial={{opacity: 0, y: -10}}
      animate={{opacity: 1, y: 0}}
      transition={{duration: 0.4}}
    >
      <div className="flex items-center gap-4">
        <motion.div
          className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-border bg-card font-mono text-xl font-bold text-primary"
          initial={{scale: 0}}
          animate={{scale: 1}}
          transition={{type: "spring", stiffness: 300, damping: 20}}
        >
          {stockData.logoUrl ? (
            // Provider logos arrive as absolute URLs; if absent, we keep the ticker monogram.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={stockData.logoUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            stockData.ticker.charAt(0)
          )}
        </motion.div>

        <div>
          <h1 className="text-2xl font-semibold text-foreground">{stockData.companyName}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono font-medium">{stockData.ticker}</span>
            <span className="text-border">|</span>
            <span>{stockData.exchange}</span>
            <span className="text-border">|</span>
            <span>{stockData.sector}</span>
          </div>
        </div>
      </div>

      <div className="flex items-end gap-4">
        <div className="text-right">
          <motion.div
            className="font-mono text-3xl font-semibold"
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            key={stockData.priceLabel}
          >
            {stockData.priceLabel}
          </motion.div>
          <div className="text-sm text-muted-foreground">As of today</div>
        </div>

        <motion.div
          className={cn(
            "flex items-center gap-1 rounded-lg px-3 py-1.5",
            isPositive ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative",
          )}
          initial={{scale: 0.8, opacity: 0}}
          animate={{scale: 1, opacity: 1}}
          transition={{delay: 0.2}}
        >
          {isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
          <span className="font-mono font-medium">{stockData.changeLabel}</span>
          <span className="font-mono">({stockData.changePercentLabel})</span>
        </motion.div>
      </div>
    </motion.div>
  );
}

function MetricCard({
  label,
  value,
  subValue,
  trend,
  icon,
  size = "md",
}: MetricRowItem & {icon?: ReactNode; size?: "sm" | "md" | "lg"}) {
  const sizeClasses = {
    sm: "px-3 py-2",
    md: "px-4 py-3",
    lg: "px-5 py-4",
  };
  const valueSizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  };
  const trendColors = {
    up: "text-positive",
    down: "text-negative",
    neutral: "text-muted-foreground",
  };

  return (
    <motion.div
      className={cn("glass-card rounded-lg", sizeClasses[size])}
      initial={{opacity: 0, y: 10}}
      animate={{opacity: 1, y: 0}}
      whileHover={{scale: 1.02}}
      transition={{duration: 0.2}}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className={cn("font-mono font-semibold", valueSizeClasses[size])}>{value}</p>
          {subValue && (
            <p className={cn("mt-0.5 text-xs", trend ? trendColors[trend] : "text-muted-foreground")}>
              {subValue}
            </p>
          )}
        </div>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
    </motion.div>
  );
}

function MetricRow({metrics}: {metrics: MetricRowItem[]}) {
  return (
    <motion.div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
      initial={{opacity: 0}}
      animate={{opacity: 1}}
      transition={{staggerChildren: 0.05}}
    >
      {metrics.map((metric, index) => (
        <motion.div
          key={`${metric.label}-${index}`}
          initial={{opacity: 0, y: 10}}
          animate={{opacity: 1, y: 0}}
          transition={{delay: index * 0.05}}
        >
          <MetricCard {...metric} size="sm" />
        </motion.div>
      ))}
    </motion.div>
  );
}

function MarketChart({stockData}: {stockData: StockData}) {
  return (
    <motion.div
      className="glass-card rounded-xl p-4"
      initial={{opacity: 0, y: 20}}
      animate={{opacity: 1, y: 0}}
      transition={{duration: 0.4}}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Live Market Chart</span>
        </div>
        <span className="rounded-md border border-border px-2 py-1 font-mono text-xs text-muted-foreground">
          Symbol Overview
        </span>
      </div>

      <TradingViewChart
        symbol={stockData.ticker}
        exchange={stockData.exchange}
        companyName={stockData.companyName}
        priceLabel={stockData.priceLabel}
        changeLabel={stockData.changeLabel}
        changePercentLabel={stockData.changePercentLabel}
        changePercent={stockData.changePercent}
        variant="bare"
      />
    </motion.div>
  );
}

function AIVerdict({block, stockData}: {block: AnalysisBlock; stockData: StockData}) {
  const verdict = normalizeVerdict(block.verdict.label);
  const confidence = confidenceValue(block);
  const scenarios = scenarioBars(block, stockData.price);

  const verdictConfig = {
    Bullish: {
      color: "text-positive",
      bgColor: "bg-positive/10",
      borderColor: "border-positive/30",
      icon: TrendingUp,
      glow: "shadow-[0_0_20px_oklch(0.75_0.22_145_/_0.2)]",
    },
    Bearish: {
      color: "text-negative",
      bgColor: "bg-negative/10",
      borderColor: "border-negative/30",
      icon: TrendingDown,
      glow: "shadow-[0_0_20px_oklch(0.65_0.22_25_/_0.2)]",
    },
    Neutral: {
      color: "text-muted-foreground",
      bgColor: "bg-muted/30",
      borderColor: "border-muted-foreground/30",
      icon: Minus,
      glow: "",
    },
  };

  const config = verdictConfig[verdict];
  const VerdictIcon = config.icon;

  return (
    <motion.div
      className={cn("glass-card rounded-xl border p-5", config.borderColor, config.glow)}
      initial={{opacity: 0, y: 20}}
      animate={{opacity: 1, y: 0}}
      transition={{duration: 0.4, delay: 0.1}}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">AI Verdict</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Confidence</span>
          <span className="font-mono font-semibold text-primary">{confidence}/100</span>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <motion.div
          className={cn("rounded-lg p-2", config.bgColor)}
          animate={{scale: [1, 1.05, 1]}}
          transition={{duration: 2, repeat: Infinity}}
        >
          <VerdictIcon className={cn("h-6 w-6", config.color)} />
        </motion.div>
        <div>
          <div className={cn("text-2xl font-semibold", config.color)}>{verdict}</div>
          <div className="text-xs text-muted-foreground">for {stockData.ticker}</div>
        </div>
      </div>

      <p className="mb-5 text-sm leading-relaxed text-foreground/80">
        {block.verdict.summary}
      </p>

      <div className="border-t border-border pt-4">
        <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Scenario Engine
        </div>
        <div className="grid grid-cols-3 gap-3">
          {scenarios.map((scenario, index) => {
            const colorClass =
              index === 0
                ? "text-positive"
                : index === 1
                  ? "text-accent"
                  : "text-negative";
            const barClass =
              index === 0 ? "bg-positive" : index === 1 ? "bg-accent" : "bg-negative";

            return (
              <div key={scenario.name} className="text-center">
                <div className="mb-1 text-xs text-muted-foreground">{scenario.name}</div>
                <div className={cn("font-mono font-semibold", colorClass)}>
                  {scenario.target}
                </div>
                <div className="text-xs text-muted-foreground">{scenario.probability}%</div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className={cn("h-full", barClass)}
                    initial={{width: 0}}
                    animate={{width: `${scenario.probability}%`}}
                    transition={{duration: 0.8, delay: 0.5 + index * 0.1}}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

function MiniMetric({
  chart,
  index,
}: {
  chart: FinancialMiniChartData;
  index: number;
}) {
  return (
    <motion.div
      className="rounded-lg border border-border bg-secondary/20 p-3"
      initial={{opacity: 0, y: 10}}
      animate={{opacity: 1, y: 0}}
      transition={{delay: index * 0.05}}
    >
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {chart.title}
      </div>
      <div className="font-mono text-xl font-semibold">{chart.value}</div>
      <div
        className={cn(
          "mt-1 text-xs",
          chart.deltaTone === "positive"
            ? "text-positive"
            : chart.deltaTone === "negative"
              ? "text-negative"
              : "text-muted-foreground",
        )}
      >
        {chart.delta}
      </div>
    </motion.div>
  );
}

function FinancialsPreview({
  block,
  onViewAll,
}: {
  block: AnalysisBlock;
  onViewAll?: () => void;
}) {
  const [activeChart, setActiveChart] = useState<"annual" | "quarterly">("annual");
  const performanceData = buildPerformanceData(block, activeChart);
  const charts = latestMiniCharts(block);
  const periodNote =
    activeChart === "quarterly"
      ? "Latest reported periods"
      : "Fiscal-year view";

  return (
    <motion.div
      className="glass-card rounded-xl p-5"
      initial={{opacity: 0, y: 20}}
      animate={{opacity: 1, y: 0}}
      transition={{duration: 0.4, delay: 0.2}}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Financials</h3>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-sm text-primary transition-colors hover:text-primary/80"
            type="button"
          >
            View All
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium">Performance</span>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex gap-1">
              {(["annual", "quarterly"] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setActiveChart(period)}
                  className={cn(
                    "rounded px-2 py-1 text-xs capitalize",
                    activeChart === period
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground",
                  )}
                  type="button"
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {periodNote}
          </div>

          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={performanceData} margin={{top: 10, right: 10, left: 0, bottom: 0}}>
                <XAxis
                  dataKey="year"
                  axisLine={false}
                  tickLine={false}
                  tick={{fill: "oklch(0.55 0 0)", fontSize: 10}}
                />
                <YAxis
                  yAxisId="left"
                  axisLine={false}
                  tickLine={false}
                  tick={{fill: "oklch(0.55 0 0)", fontSize: 10}}
                  tickFormatter={(value) => `$${value}B`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tick={{fill: "oklch(0.55 0 0)", fontSize: 10}}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  content={({active, payload}) => {
                    if (active && payload?.length) {
                      return (
                        <div className="glass rounded-lg px-3 py-2 text-xs">
                          <div>Revenue: ${payload[0]?.value}B</div>
                          <div>Net Income: ${payload[1]?.value}B</div>
                          <div>Margin: {payload[2]?.value}%</div>
                        </div>
                      );
                    }

                    return null;
                  }}
                />
                <Bar yAxisId="left" dataKey="revenue" fill="oklch(0.72 0.15 195)" radius={[2, 2, 0, 0]} />
                <Bar yAxisId="left" dataKey="netIncome" fill="oklch(0.72 0.15 195 / 0.5)" radius={[2, 2, 0, 0]} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="margin"
                  stroke="oklch(0.72 0.18 55)"
                  strokeWidth={2}
                  dot={{fill: "oklch(0.72 0.18 55)", r: 3}}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-sm bg-accent" />
              <span>Revenue</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-sm bg-accent/50" />
              <span>Net income</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-full bg-destructive" />
              <span>Net margin %</span>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium">Backend Snapshot</span>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="text-xs text-muted-foreground">
              {block.metadata.dataSource ?? "fresh"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {charts.slice(0, 4).map((chart, index) => (
              <MiniMetric key={chart.title} chart={chart} index={index} />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StoryCard({story, ticker}: {story: NewsItem; ticker: string}) {
  const sourceLabel = story.source?.slice(0, 2).toUpperCase() || ticker.slice(0, 2);
  const content = (
    <div className="flex gap-3">
      <div className="min-w-0 flex-1">
        <h4 className="mb-2 line-clamp-2 text-sm font-medium leading-snug text-foreground transition-colors group-hover:text-primary">
          {story.title}
        </h4>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">{story.source ?? "Market feed"}</span>
          <span>|</span>
          <span>{story.timestamp}</span>
        </div>
      </div>
      {story.imageUrl ? (
        <div
          className="h-16 w-24 flex-shrink-0 rounded-md bg-cover bg-center"
          style={{backgroundImage: `url(${story.imageUrl})`}}
          aria-hidden="true"
        />
      ) : (
        <div className="flex h-16 w-24 flex-shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 font-mono text-sm font-semibold text-primary">
          {sourceLabel}
        </div>
      )}
    </div>
  );

  if (!story.url) {
    return (
      <motion.div className="group block rounded-lg border border-border p-3" whileHover={{scale: 1.01}}>
        {content}
      </motion.div>
    );
  }

  return (
    <motion.a
      href={story.url}
      target="_blank"
      rel="noreferrer"
      className="group block rounded-lg border border-border p-3 transition-all hover:border-primary/30 hover:bg-secondary/30"
      whileHover={{scale: 1.01}}
    >
      {content}
    </motion.a>
  );
}

function OpinionItem({item}: {item: NewsItem}) {
  const content = (
    <>
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium">{item.source ?? "Market feed"}</span>
        <span>|</span>
        <span>{item.timestamp}</span>
      </div>
      <h4 className="line-clamp-2 text-sm leading-snug text-foreground transition-colors group-hover:text-primary">
        {item.title}
      </h4>
    </>
  );

  const className =
    "group block rounded px-2 py-3 -mx-2 border-b border-border transition-colors last:border-b-0 hover:bg-secondary/20";

  if (!item.url) {
    return (
      <motion.div className={className} whileHover={{x: 2}}>
        {content}
      </motion.div>
    );
  }

  return (
    <motion.a href={item.url} target="_blank" rel="noreferrer" className={className} whileHover={{x: 2}}>
      {content}
    </motion.a>
  );
}

function NewsSection({block, onViewAll}: {block: AnalysisBlock; onViewAll?: () => void}) {
  const stories = block.news.slice(0, 6);
  const modelOpinions = [
    ...block.lens.lenses
      .filter((item) => item.value !== "Data missing")
      .slice(0, 4)
      .map((item, index) => ({
        id: `lens-${index}-${item.label}`,
        title: `${item.label}: ${item.value}`,
        timestamp: "Model view",
        source: block.lens.analysisSource,
        summary: item.detail,
      })),
    ...block.lens.catalysts.slice(0, 4).map((item, index) => ({
      id: `catalyst-${index}-${item.title}`,
      title: item.title,
      timestamp: item.importance,
      source: item.type,
      summary: item.rationale,
    })),
  ];

  return (
    <motion.div
      className="glass-card rounded-xl p-5"
      initial={{opacity: 0, y: 20}}
      animate={{opacity: 1, y: 0}}
      transition={{duration: 0.4, delay: 0.4}}
    >
      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Stories & Analysis</h3>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {(stories.length ? stories : block.news).slice(0, 6).map((story) => (
            <StoryCard key={story.id} story={story} ticker={block.stock.ticker} />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-muted-foreground">Analyst & Model Opinions</h4>
          {onViewAll && (
            <button
              onClick={onViewAll}
              className="flex items-center gap-1 text-xs text-primary transition-colors hover:text-primary/80"
              type="button"
            >
              View all
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
          {modelOpinions.slice(0, 8).map((item) => (
            <OpinionItem key={item.id} item={item} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function KeyIssueItem({
  issue,
}: {
  issue: ReturnType<typeof buildIssues>[number];
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      className="overflow-hidden rounded-lg border border-border"
      initial={{opacity: 0, y: 10}}
      animate={{opacity: 1, y: 0}}
    >
      <button
        onClick={() => setIsExpanded((current) => !current)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-secondary/30"
        type="button"
      >
        <span className="pr-4 text-sm font-medium">{issue.title}</span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{height: 0, opacity: 0}}
            animate={{height: "auto", opacity: 1}}
            exit={{height: 0, opacity: 0}}
            transition={{duration: 0.2}}
          >
            <div className="grid grid-cols-1 border-t border-border md:grid-cols-2">
              <div className="border-b border-border p-4 md:border-b-0 md:border-r">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex items-center gap-1 rounded bg-positive/10 px-2 py-0.5 text-xs font-medium text-positive">
                    Bullish view
                    <TrendingUp className="h-3 w-3" />
                  </span>
                </div>
                <p className="mb-3 text-sm leading-relaxed text-foreground/80">
                  {issue.bullish.content}
                </p>
                <div className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 w-fit">
                  <Globe className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {issue.bullish.sources.length} sources
                  </span>
                </div>
              </div>

              <div className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex items-center gap-1 rounded bg-negative/10 px-2 py-0.5 text-xs font-medium text-negative">
                    Bearish view
                    <TrendingDown className="h-3 w-3" />
                  </span>
                </div>
                <p className="mb-3 text-sm leading-relaxed text-foreground/80">
                  {issue.bearish.content}
                </p>
                <div className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 w-fit">
                  <Globe className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {issue.bearish.sources.length} sources
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function KeyIssues({block}: {block: AnalysisBlock}) {
  const issues = buildIssues(block);

  return (
    <motion.div
      className="glass-card rounded-xl p-5"
      initial={{opacity: 0, y: 20}}
      animate={{opacity: 1, y: 0}}
      transition={{duration: 0.4, delay: 0.3}}
    >
      <h3 className="mb-4 text-lg font-semibold">Key Issues</h3>

      <div className="space-y-3">
        {issues.map((issue) => (
          <KeyIssueItem key={issue.id} issue={issue} />
        ))}
      </div>
    </motion.div>
  );
}

function AnalysisStackCard({block}: {block: AnalysisBlock}) {
  return (
    <motion.div
      className="glass-card rounded-xl p-5"
      initial={{opacity: 0, y: 20}}
      animate={{opacity: 1, y: 0}}
      transition={{duration: 0.4, delay: 0.25}}
    >
      <div className="mb-3 flex items-center gap-2">
        <Database className="h-4 w-4 text-primary" />
        <h3 className="text-lg font-semibold">Analysis Stack</h3>
      </div>
      <p className="text-sm leading-relaxed text-foreground/80">
        {block.insights.summary}
      </p>
      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-positive">
            Strengths
          </h4>
          <div className="space-y-2">
            {block.insights.strengths.slice(0, 4).map((item) => (
              <div key={item} className="rounded-lg border border-positive/20 bg-positive/5 p-3 text-sm text-foreground/80">
                {item}
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-negative">
            Risks
          </h4>
          <div className="space-y-2">
            {block.insights.risks.slice(0, 4).map((item) => (
              <div key={item} className="rounded-lg border border-negative/20 bg-negative/5 p-3 text-sm text-foreground/80">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function FinancialDetail({block}: {block: AnalysisBlock}) {
  const charts = latestMiniCharts(block);
  const financialRows = [
    ...block.metrics.map((metric) => ({
      label: metric.label,
      value: metric.value,
      detail: metric.context,
    })),
    ...block.lens.lenses.map((lens) => ({
      label: lens.label,
      value: lens.value,
      detail: lens.detail ?? "Backend analytical lens.",
    })),
    ...block.scoreBreakdown.subscores.map((score) => ({
      label: score.label,
      value: score.value,
      detail: "Composite score subcomponent.",
    })),
  ];

  return (
    <div className="space-y-6">
      <FinancialsPreview block={block} />
      <div className="glass-card rounded-xl p-5">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Full Financial Data</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Statement summaries, score inputs, and model-derived lenses available in the current analysis payload.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {charts.map((chart, index) => (
            <MiniMetric key={chart.title} chart={chart} index={index} />
          ))}
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {financialRows.map((row, index) => (
            <div key={`${row.label}-${index}`} className="rounded-lg border border-border bg-secondary/20 p-3">
              <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                {row.label}
              </div>
              <div className="font-mono text-lg font-semibold text-foreground">{row.value}</div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {row.detail}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {block.revenue.sourceSummary}
        </p>
      </div>
    </div>
  );
}

function AnalysisDetail({
  block,
  followUps,
}: {
  block: AnalysisBlock;
  followUps: FollowUpAnswer[];
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <AnalysisStackCard block={block} />

        <KeyIssues block={block} />
      </div>

      <div className="space-y-6">
        <div className="glass-card rounded-xl p-5">
          <h3 className="mb-4 text-lg font-semibold">Model Metadata</h3>
          <div className="space-y-3">
            {[
              ["Business Model", block.lens.businessModel],
              ["Fact Coverage", block.lens.factCoverage],
              ["Analysis Source", block.lens.analysisSource],
              ["Data Quality", block.metadata.dataQualityScore ?? "Data missing"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between border-b border-border pb-2 last:border-b-0">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
                <span className="max-w-[55%] truncate text-right font-mono text-sm">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {followUps.length > 0 && (
          <div className="glass-card rounded-xl p-5">
            <h3 className="mb-4 text-lg font-semibold">Follow-ups</h3>
            <div className="space-y-3">
              {followUps.slice(-4).map((followUp) => (
                <div key={followUp.id} className="rounded-lg border border-border p-3">
                  <div className="mb-1 text-xs text-muted-foreground">{followUp.question}</div>
                  <div className="text-sm text-foreground/80">
                    {followUp.status === "loading" ? "Loading..." : followUp.answer}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TechnicalDetail({stockData}: {stockData: StockData}) {
  return (
    <div className="space-y-6">
      <MarketChart stockData={stockData} />
      <div className="glass-card rounded-xl p-5">
        <h3 className="mb-4 text-lg font-semibold">Technical Context</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <MetricCard label="Previous Close" value={formatCompactCurrency(stockData.previousClose)} trend="neutral" />
          <MetricCard label="Session Move" value={stockData.changePercentLabel} trend={stockData.change >= 0 ? "up" : "down"} />
          <MetricCard label="Ticker" value={stockData.ticker} trend="neutral" />
        </div>
      </div>
    </div>
  );
}

function FollowUpCommand({
  block,
  onSubmit,
}: {
  block: AnalysisBlock;
  onSubmit: (query: string) => void;
}) {
  const [value, setValue] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = value.trim();

    if (!query) {
      return;
    }

    onSubmit(query);
    setValue("");
  };

  return (
    <form onSubmit={submit} className="glass mt-6 flex items-center gap-2 rounded-xl px-3 py-2">
      <Terminal className="h-4 w-4 text-primary" />
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={`Ask about ${block.stock.ticker}...`}
        className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
      />
      <button
        className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        type="submit"
      >
        Ask
      </button>
    </form>
  );
}

function FollowUpPanel({
  block,
  followUps,
}: {
  block: AnalysisBlock;
  followUps: FollowUpAnswer[];
}) {
  const relevantFollowUps = followUps
    .filter((followUp) => followUp.symbol === block.stock.ticker)
    .slice(-4)
    .reverse();

  return (
    <div className="glass-card mt-3 rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Ask Workspace</h3>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {block.stock.ticker}
        </span>
      </div>

      {relevantFollowUps.length > 0 ? (
        <div className="space-y-3">
          {relevantFollowUps.map((followUp) => (
            <div key={followUp.id} className="rounded-lg border border-border bg-secondary/20 p-3">
              <div className="mb-1 text-xs text-muted-foreground">{followUp.question}</div>
              <div className="text-sm leading-6 text-foreground/80">
                {followUp.status === "loading"
                  ? "Working through the backend..."
                  : followUp.answer}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-6 text-muted-foreground">
          Ask a follow-up from the input above and the answer will stay here while you browse the dashboard.
        </p>
      )}
    </div>
  );
}

function DashboardLayout({
  block,
  followUps,
  onBack,
  onSubmit,
}: {
  block: AnalysisBlock;
  followUps: FollowUpAnswer[];
  onBack: () => void;
  onSubmit: (query: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const stockData = useMemo(() => buildStockData(block), [block]);
  const metrics = useMemo(() => buildMetricRows(block), [block]);

  return (
    <motion.div
      className="min-h-screen"
      initial={{opacity: 0}}
      animate={{opacity: 1}}
      transition={{duration: 0.5}}
    >
      <motion.button
        onClick={onBack}
        className="glass fixed left-4 top-4 z-50 flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-secondary/50"
        initial={{opacity: 0, x: -20}}
        animate={{opacity: 1, x: 0}}
        transition={{delay: 0.2}}
        type="button"
      >
        <ArrowLeft className="h-4 w-4" />
        New Search
      </motion.button>

      <div className="mx-auto max-w-7xl px-4 py-8 pt-16">
        <StockHeader stockData={stockData} />
        <FollowUpCommand block={block} onSubmit={onSubmit} />
        <FollowUpPanel block={block} followUps={followUps} />

        <div className="mt-6">
          <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        <div className="mt-6">
          {activeTab === "overview" && (
            <motion.div
              className="space-y-6"
              initial={{opacity: 0, y: 20}}
              animate={{opacity: 1, y: 0}}
              transition={{duration: 0.3}}
            >
              <MetricRow metrics={metrics} />

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <MarketChart stockData={stockData} />
                </div>
                <div>
                  <AIVerdict block={block} stockData={stockData} />
                </div>
              </div>

              <FinancialsPreview block={block} onViewAll={() => setActiveTab("financials")} />
              <AnalysisStackCard block={block} />
              <KeyIssues block={block} />
              <NewsSection block={block} onViewAll={() => setActiveTab("news")} />
            </motion.div>
          )}

          {activeTab === "financials" && (
            <motion.div
              initial={{opacity: 0, y: 20}}
              animate={{opacity: 1, y: 0}}
              transition={{duration: 0.3}}
            >
              <FinancialDetail block={block} />
            </motion.div>
          )}

          {activeTab === "news" && (
            <motion.div
              initial={{opacity: 0, y: 20}}
              animate={{opacity: 1, y: 0}}
              transition={{duration: 0.3}}
            >
              <NewsSection block={block} />
            </motion.div>
          )}

          {activeTab === "analysis" && (
            <motion.div
              initial={{opacity: 0, y: 20}}
              animate={{opacity: 1, y: 0}}
              transition={{duration: 0.3}}
            >
              <AnalysisDetail block={block} followUps={followUps} />
            </motion.div>
          )}

          {activeTab === "technical" && (
            <motion.div
              initial={{opacity: 0, y: 20}}
              animate={{opacity: 1, y: 0}}
              transition={{duration: 0.3}}
            >
              <TechnicalDetail stockData={stockData} />
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function RestoringState() {
  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center">
      <div className="glass flex items-center gap-3 rounded-full px-6 py-3">
        <motion.div
          className="h-2 w-2 rounded-full bg-primary"
          animate={{scale: [1, 1.25, 1], opacity: [1, 0.5, 1]}}
          transition={{duration: 1, repeat: Infinity}}
        />
        <span className="font-mono text-sm text-muted-foreground">Restoring session</span>
      </div>
    </div>
  );
}

export function CinematicWorkspace({
  analysisBlocks,
  pendingBlocks,
  followUps,
  recentQueries,
  isRestoringState,
  onSubmit,
  onReset,
}: CinematicWorkspaceProps) {
  const pending = pendingBlocks[pendingBlocks.length - 1];
  const latestBlock = analysisBlocks[analysisBlocks.length - 1];
  const phase: AppPhase = pending ? "analyzing" : latestBlock ? "dashboard" : "idle";
  const symbol = pending?.symbol ?? latestBlock?.stock.ticker ?? "";
  const companyName = pending?.preview?.company ?? latestBlock?.stock.company ?? symbol;
  const graphData = useMemo(
    () => buildGraphData(pending, latestBlock),
    [latestBlock, pending],
  );

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-background">
      <GridBackground
        intensity={phase === "analyzing" ? "high" : "medium"}
        showScanlines={phase === "analyzing"}
      />
      <ParticleCanvas phase={phase === "analyzing" ? "signal" : "idle"} />

      <AnimatePresence mode="wait">
        {isRestoringState && (
          <motion.div
            key="restoring"
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
          >
            <RestoringState />
          </motion.div>
        )}

        {!isRestoringState && phase === "idle" && (
          <motion.div
            key="search"
            className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4"
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0, scale: 0.95}}
            transition={{duration: 0.4}}
          >
            <SearchInterface onSubmit={onSubmit} recentQueries={recentQueries} />
          </motion.div>
        )}

        {!isRestoringState && phase === "analyzing" && (
          <motion.div
            key="analyzing"
            className="relative z-10 min-h-screen w-full"
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            transition={{duration: 0.5}}
          >
            <motion.div
              className="absolute left-1/2 top-6 z-20 -translate-x-1/2"
              initial={{opacity: 0, y: -20}}
              animate={{opacity: 1, y: 0}}
              transition={{delay: 0.3}}
            >
              <div className="glass rounded-full px-6 py-3">
                <div className="flex items-center gap-3">
                  <motion.div
                    className="h-2 w-2 rounded-full bg-primary"
                    animate={{scale: [1, 1.2, 1], opacity: [1, 0.5, 1]}}
                    transition={{duration: 1, repeat: Infinity}}
                  />
                  <span className="text-sm text-muted-foreground">
                    Analyzing{" "}
                    <span className="font-mono font-semibold text-primary">{symbol}</span>
                  </span>
                </div>
              </div>
            </motion.div>

            <div className="h-screen w-full p-8 pt-20">
              <DynamicNodeGraph ticker={symbol} companyName={companyName} graphData={graphData} />
            </div>
          </motion.div>
        )}

        {!isRestoringState && phase === "dashboard" && latestBlock && (
          <motion.div
            key="dashboard"
            className="relative z-10"
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            transition={{duration: 0.5}}
          >
            <DashboardLayout
              block={latestBlock}
              followUps={followUps.filter((item) => item.symbol === latestBlock.stock.ticker)}
              onBack={onReset}
              onSubmit={onSubmit}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
