import { ChartWidget } from "./chart-widget";
export function PriceChart({ symbol }: { symbol: string }) {
  return (
    <div className="research-chart">
      <ChartWidget kind="price" symbol={symbol} />
      <a
        href={`https://www.tradingview.com/symbols/${encodeURIComponent(symbol)}/`}
        target="_blank"
        rel="noreferrer"
      >
        Chart by TradingView · Open chart ↗
      </a>
    </div>
  );
}
