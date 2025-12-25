"use client"

import { useState } from "react"
import { TrendingUp, TrendingDown } from "lucide-react"

interface TickerItem {
  symbol: string
  price: number
  change: number
  changePercent: number
}

export function TickerTape() {
  const [items] = useState<TickerItem[]>([
    { symbol: "S&P 500", price: 5968.0, change: 12.5, changePercent: 0.21 },
    { symbol: "NASDAQ", price: 19345.77, change: -45.32, changePercent: -0.23 },
    { symbol: "DOW", price: 42863.86, change: 201.36, changePercent: 0.47 },
    { symbol: "GOLD", price: 2645.3, change: 8.9, changePercent: 0.34 },
    { symbol: "OIL", price: 70.58, change: -1.42, changePercent: -1.97 },
    { symbol: "AAPL", price: 196.94, change: 2.15, changePercent: 1.1 },
    { symbol: "MSFT", price: 425.67, change: -3.21, changePercent: -0.75 },
    { symbol: "GOOGL", price: 178.35, change: 1.89, changePercent: 1.07 },
    { symbol: "AMZN", price: 215.49, change: 4.67, changePercent: 2.21 },
    { symbol: "TSLA", price: 345.18, change: -12.35, changePercent: -3.45 },
    { symbol: "NVDA", price: 505.48, change: 15.92, changePercent: 3.25 },
    { symbol: "META", price: 638.24, change: 8.43, changePercent: 1.34 },
  ])

  return (
    <div className="bg-accent/30 border-b border-border overflow-hidden">
      <div className="flex animate-scroll whitespace-nowrap">
        {/* Duplicate items for seamless loop */}
        {[...items, ...items].map((item, index) => (
          <div
            key={`${item.symbol}-${index}`}
            className="inline-flex items-center gap-2 px-6 py-2 border-r border-border/50"
          >
            <span className="font-semibold text-sm">{item.symbol}</span>
            <span className="text-sm">${item.price.toLocaleString()}</span>
            <span className={`text-xs flex items-center gap-1 ${item.change >= 0 ? "text-green-500" : "text-red-500"}`}>
              {item.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {item.change >= 0 ? "+" : ""}
              {item.changePercent.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
