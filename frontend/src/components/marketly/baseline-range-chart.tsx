"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import {
  BaselineSeries,
  ColorType,
  CrosshairMode,
  createChart,
  type IChartApi,
  type LineData,
  type Time,
} from "lightweight-charts";
import {motion} from "framer-motion";
import {cn} from "@/lib/utils";

type RangeId = "1D" | "5D" | "1M" | "6M" | "YTD" | "1Y" | "5Y" | "ALL";

type RangeConfig = {
  id: RangeId;
  label: string;
  points: number;
  stepMs: number;
  trendScale: number;
  noise: number;
};

type RangeDataset = {
  config: RangeConfig;
  data: LineData<Time>[];
  baseValue: number;
  changePercent: number;
};

type BaselineRangeChartProps = {
  ticker: string;
  currentPrice: number;
  previousClose: number;
  sessionChangePercent: number;
};

const RANGE_CONFIGS: RangeConfig[] = [
  {id: "1D", label: "1 day", points: 78, stepMs: 5 * 60 * 1000, trendScale: 1, noise: 0.0018},
  {id: "5D", label: "5 days", points: 72, stepMs: 100 * 60 * 1000, trendScale: 1.8, noise: 0.003},
  {id: "1M", label: "1 month", points: 44, stepMs: 16 * 60 * 60 * 1000, trendScale: 3.4, noise: 0.005},
  {id: "6M", label: "6 months", points: 72, stepMs: 60 * 60 * 60 * 1000, trendScale: 6.6, noise: 0.008},
  {id: "YTD", label: "Year to date", points: 78, stepMs: 52 * 60 * 60 * 1000, trendScale: 5.2, noise: 0.007},
  {id: "1Y", label: "1 year", points: 86, stepMs: 102 * 60 * 60 * 1000, trendScale: 8.4, noise: 0.01},
  {id: "5Y", label: "5 years", points: 92, stepMs: 20 * 24 * 60 * 60 * 1000, trendScale: 16, noise: 0.016},
  {id: "ALL", label: "All time", points: 96, stepMs: 45 * 24 * 60 * 60 * 1000, trendScale: 24, noise: 0.02},
];

function seededRandom(seed: string) {
  let value = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }

  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function clampPrice(value: number) {
  return Math.max(0.01, Number(value.toFixed(2)));
}

function formatPercent(value: number) {
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

function buildRangeDataset({
  config,
  ticker,
  currentPrice,
  previousClose,
  sessionChangePercent,
}: {
  config: RangeConfig;
  ticker: string;
  currentPrice: number;
  previousClose: number;
  sessionChangePercent: number;
}): RangeDataset {
  const random = seededRandom(`${ticker}:${config.id}`);
  const safeCurrent = currentPrice > 0 ? currentPrice : 100;
  const now = Date.now();
  const sessionTrend = sessionChangePercent / 100;
  const directionalBias = sessionTrend === 0 ? (random() - 0.5) * 0.04 : sessionTrend * config.trendScale;
  const totalChange = config.id === "1D"
    ? sessionTrend
    : Math.max(-0.72, Math.min(1.4, directionalBias + (random() - 0.48) * config.noise * config.points));
  const baseValue = config.id === "1D" && previousClose > 0
    ? previousClose
    : safeCurrent / Math.max(0.2, 1 + totalChange);
  const data: LineData<Time>[] = [];

  let price = baseValue;
  for (let index = 0; index < config.points; index += 1) {
    const progress = index / Math.max(1, config.points - 1);
    const drift = baseValue + (safeCurrent - baseValue) * progress;
    const wave =
      Math.sin(progress * Math.PI * (2 + random() * 2)) * baseValue * config.noise * 2 +
      Math.cos(progress * Math.PI * (3 + random() * 2)) * baseValue * config.noise;
    const impulse = (random() - 0.5) * baseValue * config.noise * 1.8;
    price = clampPrice(drift + wave + impulse);

    if (index === config.points - 1) {
      price = clampPrice(safeCurrent);
    }

    data.push({
      time: Math.floor((now - (config.points - 1 - index) * config.stepMs) / 1000) as Time,
      value: price,
    });
  }

  const firstValue = data[0]?.value ?? baseValue;
  const lastValue = data[data.length - 1]?.value ?? safeCurrent;
  const changePercent = firstValue ? ((lastValue - firstValue) / firstValue) * 100 : 0;

  return {
    config,
    data,
    baseValue: clampPrice(config.id === "1D" && previousClose > 0 ? previousClose : firstValue),
    changePercent,
  };
}

export function BaselineRangeChart({
  ticker,
  currentPrice,
  previousClose,
  sessionChangePercent,
}: BaselineRangeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ReturnType<IChartApi["addSeries"]> | null>(null);
  const [selectedRange, setSelectedRange] = useState<RangeId>("1D");

  const datasets = useMemo(
    () =>
      RANGE_CONFIGS.map((config) =>
        buildRangeDataset({
          config,
          ticker,
          currentPrice,
          previousClose,
          sessionChangePercent,
        }),
      ),
    [currentPrice, previousClose, sessionChangePercent, ticker],
  );

  const activeDataset =
    datasets.find((dataset) => dataset.config.id === selectedRange) ?? datasets[0];
  const isPositive = activeDataset.changePercent >= 0;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const chart = createChart(container, {
      autoSize: true,
      height: 360,
      layout: {
        background: {type: ColorType.Solid, color: "transparent"},
        textColor: "rgba(226, 232, 240, 0.56)",
        fontFamily:
          "IBM Plex Mono, JetBrains Mono, SFMono-Regular, Cascadia Code, Roboto Mono, monospace",
      },
      grid: {
        vertLines: {color: "rgba(148, 163, 184, 0.055)"},
        horzLines: {color: "rgba(148, 163, 184, 0.055)"},
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(111, 255, 176, 0.3)",
          labelBackgroundColor: "rgba(15, 23, 42, 0.95)",
        },
        horzLine: {
          color: "rgba(111, 255, 176, 0.18)",
          labelBackgroundColor: "rgba(15, 23, 42, 0.95)",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(148, 163, 184, 0.1)",
        scaleMargins: {
          top: 0.12,
          bottom: 0.12,
        },
      },
      timeScale: {
        borderColor: "rgba(148, 163, 184, 0.1)",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    const series = chart.addSeries(BaselineSeries, {
      baseValue: {type: "price", price: 0},
      topLineColor: "rgba(52, 211, 153, 1)",
      topFillColor1: "rgba(52, 211, 153, 0.34)",
      topFillColor2: "rgba(52, 211, 153, 0.03)",
      bottomLineColor: "rgba(248, 113, 113, 1)",
      bottomFillColor1: "rgba(248, 113, 113, 0.03)",
      bottomFillColor2: "rgba(248, 113, 113, 0.28)",
      lineWidth: 2,
      priceLineColor: "rgba(52, 211, 153, 0.7)",
      lastValueVisible: true,
      priceLineVisible: true,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const resizeObserver = new ResizeObserver(() => {
      chart.timeScale().fitContent();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;

    if (!chart || !series || !activeDataset) {
      return;
    }

    series.setData(activeDataset.data);
    series.applyOptions({
      baseValue: {type: "price", price: activeDataset.baseValue},
      priceLineColor: isPositive ? "rgba(52, 211, 153, 0.75)" : "rgba(248, 113, 113, 0.75)",
    });
    chart.timeScale().fitContent();
  }, [activeDataset, isPositive]);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card/50">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-sm font-semibold text-foreground">{ticker}</span>
            <span className={cn("font-mono text-xs", isPositive ? "text-positive" : "text-negative")}>
              {formatPercent(activeDataset.changePercent)}
            </span>
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            Quote-derived baseline
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {datasets.map((dataset) => {
            const selected = selectedRange === dataset.config.id;
            const rangePositive = dataset.changePercent >= 0;

            return (
              <button
                key={dataset.config.id}
                onClick={() => setSelectedRange(dataset.config.id)}
                className={cn(
                  "relative rounded-md px-2.5 py-1.5 text-xs transition-colors",
                  selected ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                )}
                type="button"
              >
                <span className="font-medium">{dataset.config.id}</span>
                <span className={cn("ml-1 font-mono", rangePositive ? "text-positive" : "text-negative")}>
                  {formatPercent(dataset.changePercent)}
                </span>
                {selected && (
                  <motion.span
                    layoutId="baselineRange"
                    className="absolute inset-0 rounded-md border border-primary/45"
                    transition={{type: "spring", stiffness: 500, damping: 35}}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div ref={containerRef} className="h-[360px] w-full" />
    </div>
  );
}
