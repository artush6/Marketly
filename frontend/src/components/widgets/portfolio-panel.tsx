"use client"

import { useEffect, useRef, useState } from "react"
import { createChart, ColorType, LineSeries } from "lightweight-charts"
import { TrendingUp, TrendingDown } from "lucide-react"

const PORTFOLIO_DATA = [
  { symbol: "HMNI", price: 183.86, change: 3.65, changePercent: 0.35, trend: "up" },
  { symbol: "AJGL", price: 309.17, change: 40.92, changePercent: 18.11, trend: "up" },
  { symbol: "EAIT", price: 189.18, change: -0.2, changePercent: -0.23, trend: "down" },
  { symbol: "WUH", price: 263.74, change: 16.63, changePercent: 4.22, trend: "up" },
  { symbol: "TISM", price: 15.03, change: -0.08, changePercent: -0.03, trend: "down" },
  { symbol: "LISC", price: 13.16, change: -1.07, changePercent: -9.16, trend: "down" },
  { symbol: "ICME", price: 491.14, change: 96.02, changePercent: 4.38, trend: "up" },
]

export function PortfolioPanel() {
  const chartRef = useRef<HTMLDivElement>(null)
  const [theme, setTheme] = useState<"light" | "dark">("dark")
  const chartInstanceRef = useRef<any>(null)
  const chartDataRef = useRef<any>(null)

  useEffect(() => {
    const updateTheme = () => {
      const isDark = document.documentElement.classList.contains("dark")
      setTheme(isDark ? "dark" : "light")
    }
    updateTheme()
    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!chartDataRef.current) {
      const data = []
      let value = 26000
      for (let i = 0; i < 30; i++) {
        const timestamp = Math.floor(Date.now() / 1000) - (30 - i) * 86400
        value += Math.random() * 1000 - 200
        data.push({ time: timestamp, value: Math.round(value) })
      }
      chartDataRef.current = data
    }
  }, [])

  useEffect(() => {
    if (!chartRef.current || !chartDataRef.current) return

    const backgroundColor = theme === "dark" ? "#000000" : "#ffffff"
    const textColor = theme === "dark" ? "#94a3b8" : "#64748b"
    const gridColor = theme === "dark" ? "#1e293b" : "#e2e8f0"

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
      height: 180,
      timeScale: {
        timeVisible: false,
        borderVisible: false,
      },
      rightPriceScale: {
        borderVisible: false,
      },
    })

    chartInstanceRef.current = chart

    const lineSeries = chart.addSeries(LineSeries, {
      color: "#77B05A",
      lineWidth: 2,
    })

    lineSeries.setData(chartDataRef.current)
    chart.timeScale().fitContent()

    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0] && chartInstanceRef.current) {
        const { width } = entries[0].contentRect
        if (width > 0) {
          chartInstanceRef.current.applyOptions({ width })
        }
      }
    })

    if (chartRef.current) {
      resizeObserver.observe(chartRef.current)
    }

    return () => {
      resizeObserver.disconnect()
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove()
      }
    }
  }, [theme])

  return (
    <div className="p-6 space-y-6">
      {/* Account Overview */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm text-muted-foreground">Individual</h2>
          <button className="text-xs px-3 py-1 bg-accent rounded hover:bg-accent/80 transition">Deposit</button>
        </div>
        <div className="text-3xl font-semibold">$26,523.12</div>
        <div className="flex items-center gap-1 text-sm text-green-500">
          <TrendingUp className="w-4 h-4" />
          <span>$201.82 (0.14%) today</span>
        </div>
      </div>

      {/* Portfolio Chart */}
      <div ref={chartRef} className="w-full rounded" />

      {/* Overview Stats */}
      <div className="space-y-3 pt-2">
        <h3 className="text-sm font-medium">Overview</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Buying power</span>
            <span>$13,320.36</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Options buying power</span>
            <span>$9,283.10</span>
          </div>
        </div>
      </div>

      {/* Market Movers */}
      <div className="space-y-3 pt-4 border-t border-border">
        <h3 className="text-sm font-medium">Market movers</h3>
        <div className="space-y-2">
          {PORTFOLIO_DATA.map((stock, index) => (
            <div
              key={stock.symbol}
              className="flex items-center justify-between text-sm hover:bg-accent/30 p-2 rounded cursor-pointer transition"
            >
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground w-4">{index + 1}</span>
                <span className="font-medium">{stock.symbol}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono">${stock.price}</span>
                <div className={`flex items-center gap-1 ${stock.trend === "up" ? "text-green-500" : "text-red-500"}`}>
                  {stock.trend === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  <span className="text-xs">{stock.changePercent}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
