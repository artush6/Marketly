"use client";

import { useEffect, useId } from "react";

type TradingViewChartProps = {
  symbol: string;
  exchange: string;
};

declare global {
  interface Window {
    TradingView?: {
      widget: new (config: Record<string, unknown>) => unknown;
    };
  }
}

export function TradingViewChart({
  symbol,
  exchange,
}: TradingViewChartProps) {
  const elementId = useId().replace(/:/g, "");
  const marketSymbol = `${exchange}:${symbol}`;

  useEffect(() => {
    const container = document.getElementById(elementId);

    if (!container) {
      return;
    }

    container.innerHTML = "";

    const renderWidget = () => {
      if (!window.TradingView || !container) {
        return;
      }

      // TradingView hosts the live market chart and handles real-time updates.
      new window.TradingView.widget({
        autosize: true,
        symbol: marketSymbol,
        interval: "30",
        timezone: "Etc/UTC",
        theme: "dark",
        style: "1",
        locale: "en",
        enable_publishing: false,
        hide_top_toolbar: true,
        hide_legend: false,
        save_image: false,
        container_id: elementId,
        withdateranges: true,
        backgroundColor: "#0F141C",
        gridColor: "rgba(255,255,255,0.04)",
        studies: [],
        toolbar_bg: "#0F141C",
        details: false,
        hotlist: false,
        calendar: false,
      });
    };

    if (window.TradingView) {
      renderWidget();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://s3.tradingview.com/tv.js"]',
    );

    if (existingScript) {
      existingScript.addEventListener("load", renderWidget, { once: true });
      return () => existingScript.removeEventListener("load", renderWidget);
    }

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = renderWidget;
    document.body.appendChild(script);

    return () => {
      script.onload = null;
    };
  }, [elementId, marketSymbol]);

  return (
    <div className="border border-white/8 bg-[#0F141C] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#9CA3AF]">
            Live Market Chart
          </p>
          <p className="mt-2 text-sm text-[#D1D5DB]">
            Real-time TradingView stream for {marketSymbol}
          </p>
        </div>
        <span className="rounded-full border border-white/8 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-[#6B7280]">
          30m
        </span>
      </div>
      <div id={elementId} className="h-[360px] w-full overflow-hidden" />
    </div>
  );
}
