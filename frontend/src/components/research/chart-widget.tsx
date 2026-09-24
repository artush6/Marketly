"use client";
import { useEffect, useRef, useState } from "react";

export function ChartWidget({
  kind,
  symbol = "AAPL",
}: {
  kind: "price" | "heatmap";
  symbol?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const root = host.current;
    if (!root) return;
    let active = true;
    setFailed(false);
    const mount = document.createElement("div");
    mount.className = "tradingview-widget-container";
    mount.style.cssText = "height:100%;width:100%";
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.height = "100%";
    mount.appendChild(widget);
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://s3.tradingview.com/external-embedding/embed-widget-${kind === "heatmap" ? "stock-heatmap" : "symbol-overview"}.js`;
    const common = {
      width: "100%",
      height: "100%",
      locale: "en",
      colorTheme: "dark",
    };
    script.textContent = JSON.stringify(
      kind === "heatmap"
        ? {
            ...common,
            exchanges: [],
            dataSource: "SPX500",
            grouping: "sector",
            blockSize: "market_cap_basic",
            blockColor: "change",
            hasTopBar: true,
            isDataSetEnabled: true,
            isZoomEnabled: true,
            hasSymbolTooltip: true,
            isMonoSize: false,
          }
        : {
            ...common,
            symbols: [[symbol, `${symbol}|1D`]],
            chartOnly: true,
            autosize: true,
            showVolume: false,
            hideDateRanges: false,
            hideSymbolLogo: true,
            scalePosition: "right",
            scaleMode: "Normal",
            fontFamily: "Arial, sans-serif",
            fontSize: "11",
            chartType: "area",
            lineColor: "#b4e45d",
            topColor: "rgba(180,228,93,0.12)",
            bottomColor: "rgba(180,228,93,0)",
            backgroundColor: "#141814",
            dateRanges: [
              "1d|1",
              "1m|30",
              "3m|60",
              "12m|1D",
              "60m|1W",
              "all|1M",
            ],
          },
    );
    script.onerror = () => {
      if (active) setFailed(true);
    };
    mount.appendChild(script);
    root.appendChild(mount);
    // Keep the script's parent intact if it finishes loading after navigation.
    // Clearing innerHTML here causes the vendor's currentScript lookup to fail.
    return () => {
      active = false;
      mount.remove();
    };
  }, [kind, symbol]);
  return (
    <div ref={host} className="chart-widget-host">
      {failed && (
        <div className="empty-state">
          Chart provider unavailable. Use the TradingView link below.
        </div>
      )}
    </div>
  );
}
