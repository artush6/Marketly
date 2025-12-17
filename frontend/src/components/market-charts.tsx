"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, LineSeries } from "lightweight-charts";

export function MarketChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [marketStatus, setMarketStatus] = useState<
    "neutral" | "positive" | "negative"
  >("neutral");
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const chartInstanceRef = useRef<any>(null);
  const portfolioSeriesRef = useRef<any>(null);
  const sp500SeriesRef = useRef<any>(null);
  const goldSeriesRef = useRef<any>(null);
  const chartDataRef = useRef<any>(null);

  const getCurrentDate = () => {
    const now = new Date();
    return now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const getMarketStatusText = () => {
    const statusText = {
      neutral: {
        text: "neutral",
        className: "text-slate-400 dark:text-slate-400",
      },
      positive: {
        text: "positive",
        className: "text-green-600 dark:text-green-500",
      },
      negative: {
        text: "negative",
        className: "text-red-600 dark:text-red-500",
      },
    };
    return statusText[marketStatus];
  };

  useEffect(() => {
    if (!chartDataRef.current) {
      const data = [];
      let portfolioValue = 4500;
      let sp500Value = 5000;
      let goldValue = 2000;

      for (let i = 0; i < 50; i++) {
        const timestamp = Math.floor(Date.now() / 1000) - (50 - i) * 3600;
        portfolioValue += Math.random() * 200 - 75;
        sp500Value += Math.random() * 150 - 60;
        goldValue += Math.random() * 50 - 20;

        data.push({
          time: timestamp,
          portfolio: Math.round(portfolioValue),
          sp500: Math.round(sp500Value),
          gold: Math.round(goldValue),
        });
      }

      chartDataRef.current = data;
    }
  }, []);

  useEffect(() => {
    const updateTheme = () => {
      const isDark = document.documentElement.classList.contains("dark");
      setTheme(isDark ? "dark" : "light");
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (
      chartInstanceRef.current &&
      portfolioSeriesRef.current &&
      sp500SeriesRef.current &&
      goldSeriesRef.current
    ) {
      const backgroundColor = theme === "dark" ? "#000000" : "#ffffff";
      const textColor = theme === "dark" ? "#f1f5f9" : "#1e293b";
      const gridColor = theme === "dark" ? "#1e293b" : "#e2e8f0";

      chartInstanceRef.current.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: backgroundColor },
          textColor: textColor,
        },
        grid: {
          vertLines: { color: gridColor },
          horzLines: { color: gridColor },
        },
      });
    }
  }, [theme]);

  useEffect(() => {
    if (portfolioSeriesRef.current) {
      const portfolioColor = "#77B05A"; // light green for portfolio

      portfolioSeriesRef.current.applyOptions({
        color: portfolioColor,
      });
    }
  }, [marketStatus]);

  useEffect(() => {
    if (!containerRef.current || !chartDataRef.current) {
      return;
    }

    const width = containerRef.current.clientWidth;
    const height = 300;

    if (width === 0) {
      return;
    }

    try {
      const backgroundColor = theme === "dark" ? "#000000" : "#ffffff";
      const textColor = theme === "dark" ? "#f1f5f9" : "#1e293b";
      const gridColor = theme === "dark" ? "#1e293b" : "#e2e8f0";

      const chart = createChart(containerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: backgroundColor },
          textColor: textColor,
        },
        grid: {
          vertLines: { color: gridColor },
          horzLines: { color: gridColor },
        },
        width: width,
        height: height,
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
        },
      });

      chartInstanceRef.current = chart;

      const portfolioColor = "#77B05A"; // light green
      const sp500Color = "#ef4444"; // red
      const goldColor = "#fbbf24"; // gold

      const portfolioSeries = chart.addSeries(LineSeries, {
        color: portfolioColor,
        lineWidth: 2,
        title: "Portfolio",
      });

      const sp500Series = chart.addSeries(LineSeries, {
        color: sp500Color,
        lineWidth: 2,
        title: "S&P 500",
      });

      const goldSeries = chart.addSeries(LineSeries, {
        color: goldColor,
        lineWidth: 2,
        title: "GOLD",
      });

      portfolioSeriesRef.current = portfolioSeries;
      sp500SeriesRef.current = sp500Series;
      goldSeriesRef.current = goldSeries;

      portfolioSeries.setData(
        chartDataRef.current.map((d: any) => ({
          time: d.time,
          value: d.portfolio,
        }))
      );

      sp500Series.setData(
        chartDataRef.current.map((d: any) => ({
          time: d.time,
          value: d.sp500,
        }))
      );

      goldSeries.setData(
        chartDataRef.current.map((d: any) => ({
          time: d.time,
          value: d.gold,
        }))
      );

      chart.timeScale().fitContent();
      setIsLoading(false);

      const handleResize = () => {
        if (containerRef.current && chartInstanceRef.current) {
          chartInstanceRef.current.applyOptions({
            width: containerRef.current.clientWidth,
          });
        }
      };

      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
        if (chartInstanceRef.current) {
          chartInstanceRef.current.remove();
        }
      };
    } catch (error) {
      console.error("[v0] Error creating chart:", error);
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="w-full space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-slate-500 dark:text-slate-500">
          {getCurrentDate()}
        </p>
        <h2 className="text-xl font-medium text-slate-900 dark:text-white">
          The markets are{" "}
          <span className={getMarketStatusText().className}>
            {getMarketStatusText().text}
          </span>
        </h2>
      </div>

      <div
        ref={containerRef}
        className="w-full rounded bg-white dark:bg-black"
        style={{ height: "300px" }}
      />
      <div className="flex items-center justify-center gap-6 text-sm"></div>
    </div>
  );
}
