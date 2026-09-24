"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  IChartApi,
  LineData,
  Time,
  LineSeries,
} from "lightweight-charts";
import { ChevronLeft } from "lucide-react";

const NEWS_ITEMS = [
  {
    time: "Today • 10m ago",
    title:
      "Oil prices climb for the 2nd day as US sanctions on Iran heighten fears of supply constraints.",
    icon: "🛢️",
  },
  {
    time: "Today • 1h ago",
    ticker: "NVDA",
    change: "-2.6%",
    title:
      "Chinese firms boost Nvidia's H20 chip orders, driven by the rising demand for DeepSeek's AI models, according to sources.",
    icon: "N",
    color: "bg-blue-600",
  },
  {
    time: "Today • 2h ago",
    ticker: "TSLA",
    title:
      "China software update plans add city navigation, enhancing car's driving-assistance for urban street navigation, per company notification and sources.",
    icon: "T",
    color: "bg-red-600",
  },
  {
    time: "Today • 4h ago",
    ticker: "JNJ",
    title:
      "Johnson & Johnson sues Samsung Bioepis, claiming breach of contract on Stelara's manufacturing rights.",
    icon: "J",
    color: "bg-red-600",
  },
  {
    time: "Today • 5h ago",
    ticker: "AAPL",
    change: "-1.8%",
    title:
      "Apple announces breakthrough in M4 chip architecture with 40% performance improvement, targeting AI workload optimization for enterprise customers.",
    icon: "A",
    color: "bg-slate-600",
  },
];

type ChartData = {
  oil: LineData[];
  gold: LineData[];
  sp500: LineData[];
};

export function MarketIndicesPanel() {
  const chartRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const chartDataRef = useRef<ChartData | null>(null);

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
    if (!chartDataRef.current) {
      const data: ChartData = {
        oil: [],
        gold: [],
        sp500: [],
      };
      let oilValue = 75;
      let goldValue = 2000;
      let sp500Value = 5000;

      for (let i = 0; i < 50; i++) {
        const timestamp = (Math.floor(Date.now() / 1000) -
          (50 - i) * 3600) as Time;
        oilValue += Math.random() * 4 - 2;
        goldValue += Math.random() * 40 - 20;
        sp500Value += Math.random() * 100 - 50;

        data.oil.push({
          time: timestamp,
          value: Math.round(oilValue * 100) / 100,
        });
        data.gold.push({ time: timestamp, value: Math.round(goldValue) });
        data.sp500.push({ time: timestamp, value: Math.round(sp500Value) });
      }

      chartDataRef.current = data;
    }
  }, []);

  useEffect(() => {
    if (!chartRef.current || !chartDataRef.current) return;

    const backgroundColor = theme === "dark" ? "#000000" : "#ffffff";
    const textColor = theme === "dark" ? "#94a3b8" : "#64748b";
    const gridColor = theme === "dark" ? "#1e293b" : "#e2e8f0";

    const chart = createChart(chartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: backgroundColor },
        textColor: textColor,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      width: chartRef.current.clientWidth,
      height: 400,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartInstanceRef.current = chart;

    const oilSeries = chart.addSeries(LineSeries, {
      color: "#64748b",
      lineWidth: 2,
      title: "OIL",
    });

    const goldSeries = chart.addSeries(LineSeries, {
      color: "#fbbf24",
      lineWidth: 2,
      title: "GOLD",
    });

    const sp500Series = chart.addSeries(LineSeries, {
      color: "#ef4444",
      lineWidth: 2,
      title: "S&P 500",
    });

    oilSeries.setData(chartDataRef.current.oil);
    goldSeries.setData(chartDataRef.current.gold);
    sp500Series.setData(chartDataRef.current.sp500);

    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0] && chartInstanceRef.current) {
        const { width } = entries[0].contentRect;
        if (width > 0) {
          chartInstanceRef.current.applyOptions({ width });
        }
      }
    });

    if (chartRef.current) {
      resizeObserver.observe(chartRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
      }
    };
  }, [theme]);

  return (
    <div className="flex flex-col h-full">
      {/* Chart Section */}
      <div className="p-6 border-b border-border">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Market Indices</h2>
          <div ref={chartRef} className="w-full rounded" />
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#64748b]" />
              <span className="text-muted-foreground">OIL</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#fbbf24]" />
              <span className="text-muted-foreground">GOLD</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
              <span className="text-muted-foreground">S&P 500</span>
            </div>
          </div>
        </div>
      </div>

      {/* News Section */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ChevronLeft className="w-5 h-5" />
            <h3 className="text-lg font-semibold">Daily recap</h3>
          </div>
          <p className="text-sm text-muted-foreground">Summarized at 6:00 AM</p>
          <p className="text-sm leading-relaxed">
            Hedge funds retreat from tech and media as a potential market
            correction looms, while Apple plans a major investment in AI
            servers. Meanwhile, geopolitical factors influence economic
            confidence, and New Zealand reports a retail sales rebound as german
            business climate shows mild improvement.
          </p>

          <div className="space-y-6 pt-4">
            {NEWS_ITEMS.map((item, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{item.time}</span>
                </div>
                <div className="flex gap-3">
                  <div
                    className={`w-10 h-10 rounded-full ${
                      item.color || "bg-slate-700"
                    } flex items-center justify-center text-white font-semibold flex-shrink-0`}
                  >
                    {item.icon}
                  </div>
                  <div className="flex-1 space-y-1">
                    {item.ticker && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.ticker}</span>
                        {item.change && (
                          <span
                            className={`text-xs ${
                              item.change.startsWith("-")
                                ? "text-red-500"
                                : "text-green-500"
                            }`}
                          >
                            {item.change}
                          </span>
                        )}
                      </div>
                    )}
                    <p className="text-sm leading-relaxed">{item.title}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
