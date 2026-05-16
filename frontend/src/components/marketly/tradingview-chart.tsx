"use client";

import {memo, useEffect, useMemo, useRef} from "react";

type TradingViewChartProps = {
  symbol: string;
  exchange: string;
  companyName?: string;
  variant?: "card" | "bare";
};

const WIDGET_SRC =
  "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js";

function normalizeExchange(exchange: string) {
  const normalized = exchange.trim().toUpperCase();

  if (!normalized || normalized === "NASDAQ STOCK MARKET") {
    return "NASDAQ";
  }

  return normalized.replace(/\s+/g, "");
}

function TradingViewChartComponent({
  symbol,
  exchange,
  companyName,
  variant = "card",
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const marketSymbol = `${normalizeExchange(exchange)}:${symbol.toUpperCase()}`;
  const displayName = companyName?.trim() || symbol.toUpperCase();

  const widgetConfig = useMemo(
    () => ({
      lineWidth: 2,
      lineType: 0,
      chartType: "area",
      fontColor: "rgba(209, 213, 219, 0.72)",
      gridLineColor: "rgba(148, 163, 184, 0.08)",
      volumeUpColor: "rgba(61, 217, 179, 0.34)",
      volumeDownColor: "rgba(248, 113, 113, 0.34)",
      backgroundColor: "#0A0F16",
      widgetFontColor: "#E7EEF5",
      upColor: "#3DD9B3",
      downColor: "#F87171",
      borderUpColor: "#3DD9B3",
      borderDownColor: "#F87171",
      wickUpColor: "#3DD9B3",
      wickDownColor: "#F87171",
      colorTheme: "dark",
      isTransparent: true,
      locale: "en",
      chartOnly: false,
      scalePosition: "right",
      scaleMode: "Normal",
      fontFamily:
        "IBM Plex Mono, JetBrains Mono, SFMono-Regular, Cascadia Code, Roboto Mono, monospace",
      valuesTracking: "1",
      changeMode: "price-and-percent",
      symbols: [[displayName, `${marketSymbol}|1D`]],
      dateRanges: ["1d|1", "1m|30", "3m|60", "12m|1D", "60m|1W", "all|1M"],
      fontSize: "11",
      headerFontSize: "medium",
      autosize: true,
      width: "100%",
      height: "100%",
      noTimeScale: false,
      hideDateRanges: false,
      hideMarketStatus: false,
      hideSymbolLogo: false,
    }),
    [displayName, marketSymbol],
  );

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    container.innerHTML = "";

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget h-full w-full";
    container.appendChild(widget);

    const script = document.createElement("script");
    script.src = WIDGET_SRC;
    script.type = "text/javascript";
    script.async = true;
    script.textContent = JSON.stringify(widgetConfig);
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [widgetConfig]);

  const chart = (
    <div className="marketly-symbol-overview h-[420px] w-full overflow-hidden rounded-lg border border-border bg-[#0A0F16]/85">
      <div ref={containerRef} className="tradingview-widget-container h-full w-full" />
    </div>
  );

  if (variant === "bare") {
    return chart;
  }

  return (
    <div className="border border-white/8 bg-[#0F141C] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#9CA3AF]">
            Live Market Chart
          </p>
          <p className="mt-2 text-sm text-[#D1D5DB]">
            TradingView Symbol Overview for {marketSymbol}
          </p>
        </div>
        <span className="rounded-full border border-white/8 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-[#6B7280]">
          live
        </span>
      </div>
      {chart}
    </div>
  );
}

export const TradingViewChart = memo(TradingViewChartComponent);
