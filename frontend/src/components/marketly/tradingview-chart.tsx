"use client";

import {memo, useEffect, useMemo, useRef, useState} from "react";

type TradingViewChartProps = {
    symbol: string;
    exchange: string;
    companyName?: string;
    priceLabel?: string;
    changeLabel?: string;
    changePercentLabel?: string;
    changePercent?: number;
    variant?: "card" | "bare";
};

const WIDGET_SRC =
    "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js";

const FALLBACK_POSITIVE = "#52D85E";
const FALLBACK_NEGATIVE = "#F94144";

type ChartTheme = {
    positive: string;
    negative: string;
    positiveVolume: string;
    negativeVolume: string;
    positiveAreaTop: string;
    positiveAreaBottom: string;
};

function normalizeExchange(exchange: string) {
    const normalized = exchange.trim().toUpperCase();

    if (!normalized || normalized === "NASDAQ STOCK MARKET") {
        return "NASDAQ";
    }

    return normalized.replace(/\s+/g, "");
}

function normalizeBrowserColor(color: string, fallback: string) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
        return fallback;
    }

    context.fillStyle = fallback;
    context.fillStyle = color;

    const normalized = context.fillStyle || fallback;
    return /^#|^rgba?\(/i.test(normalized) ? normalized : fallback;
}

function resolveCssVariableColor(variableName: string, fallback: string) {
    const probe = document.createElement("span");
    probe.style.color = `var(${variableName})`;
    document.body.appendChild(probe);

    const resolved = window.getComputedStyle(probe).color;
    probe.remove();

    return normalizeBrowserColor(resolved, fallback);
}

function withAlpha(color: string, alpha: number) {
    const hex = color.trim();

    if (/^#[0-9a-f]{6}$/i.test(hex)) {
        const red = Number.parseInt(hex.slice(1, 3), 16);
        const green = Number.parseInt(hex.slice(3, 5), 16);
        const blue = Number.parseInt(hex.slice(5, 7), 16);

        return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }

    const rgb = hex.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (rgb) {
        return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
    }

    return hex;
}

function TradingViewChartComponent({
                                       symbol,
                                       exchange,
                                       companyName,
                                       priceLabel,
                                       changeLabel,
                                       changePercentLabel,
                                       changePercent = 0,
                                   variant = "card",
                               }: TradingViewChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [chartTheme, setChartTheme] = useState<ChartTheme>(() => ({
        positive: FALLBACK_POSITIVE,
        negative: FALLBACK_NEGATIVE,
        positiveVolume: withAlpha(FALLBACK_POSITIVE, 0.28),
        negativeVolume: withAlpha(FALLBACK_NEGATIVE, 0.24),
        positiveAreaTop: withAlpha(FALLBACK_POSITIVE, 0.16),
        positiveAreaBottom: withAlpha(FALLBACK_POSITIVE, 0),
    }));
    const marketSymbol = `${normalizeExchange(exchange)}:${symbol.toUpperCase()}`;
    const displayName = companyName?.trim() || symbol.toUpperCase();

    useEffect(() => {
        const positive = resolveCssVariableColor("--positive", FALLBACK_POSITIVE);
        const negative = resolveCssVariableColor("--negative", FALLBACK_NEGATIVE);

        setChartTheme({
            positive,
            negative,
            positiveVolume: withAlpha(positive, 0.28),
            negativeVolume: withAlpha(negative, 0.24),
            positiveAreaTop: withAlpha(positive, 0.16),
            positiveAreaBottom: withAlpha(positive, 0),
        });
    }, []);

    const widgetConfig = useMemo(
        () => ({
            lineWidth: 2,
            lineType: 0,
            chartType: "area",
            fontColor: "rgba(186, 203, 220, 0.76)",
            gridLineColor: "rgba(255, 255, 255, 0.055)",
            volumeUpColor: chartTheme.positiveVolume,
            volumeDownColor: chartTheme.negativeVolume,
            backgroundColor: "#000000",
            widgetFontColor: "#EAF7F1",
            lineColor: chartTheme.positive,
            topColor: chartTheme.positiveAreaTop,
            bottomColor: chartTheme.positiveAreaBottom,
            upColor: chartTheme.positive,
            downColor: chartTheme.negative,
            borderUpColor: chartTheme.positive,
            borderDownColor: chartTheme.negative,
            wickUpColor: chartTheme.positive,
            wickDownColor: chartTheme.negative,
            colorTheme: "dark",
            isTransparent: true,
            locale: "en",
            chartOnly: true,
            scalePosition: "right",
            scaleMode: "Normal",
            fontFamily:
                "IBM Plex Mono, JetBrains Mono, SFMono-Regular, Cascadia Code, Roboto Mono, monospace",
            valuesTracking: "1",
            changeMode: "price-and-percent",
            symbols: [[displayName, `${marketSymbol}|1D`]],
            dateRanges: ["1d|1", "1m|30", "3m|60", "12m|1D", "60m|1W", "all|1M"],
            fontSize: "11",
            headerFontSize: "large",
            autosize: true,
            width: "100%",
            height: "100%",
            noTimeScale: false,
            hideDateRanges: false,
            hideMarketStatus: false,
            hideSymbolLogo: false,
        }),
        [chartTheme, displayName, marketSymbol],
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

    const isPositive = changePercent >= 0;
    const moveTone = isPositive ? "text-positive" : "text-negative";

    const chart = (
        <div className="marketly-symbol-overview relative h-[420px] w-full overflow-hidden rounded-lg border border-white/10 bg-black">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 px-4 py-4">
                <div className="min-w-0">
                    <div className="truncate font-mono text-sm font-semibold text-foreground">
                        {displayName}
                    </div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">
                        {marketSymbol}
                    </div>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-right font-mono">
                    {priceLabel && (
                        <span className="text-2xl font-semibold text-foreground">
                            {priceLabel}
                        </span>
                    )}
                    {changeLabel && (
                        <span className={`text-xl font-semibold ${moveTone}`}>
                            {changeLabel}
                        </span>
                    )}
                    {changePercentLabel && (
                        <span className={`text-xl font-semibold ${moveTone}`}>
                            {changePercentLabel}
                        </span>
                    )}
                    <span className={moveTone}>1 day</span>
                </div>
            </div>
            <div ref={containerRef} className="tradingview-widget-container h-[calc(100%-81px)] w-full"/>
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
                <span
                    className="rounded-full border border-white/8 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-[#6B7280]">
          live
        </span>
            </div>
            {chart}
        </div>
    );
}

export const TradingViewChart = memo(TradingViewChartComponent);
