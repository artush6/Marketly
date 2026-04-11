import type { StockHeaderData } from "./types";

type StockHeaderProps = {
  stock: StockHeaderData;
};

function MiniChart({ points }: { points: number[] }) {
  if (points.length < 2) {
    return (
      <div className="flex h-[72px] items-center justify-center rounded-2xl border border-dashed border-white/8 text-[11px] uppercase tracking-[0.18em] text-[#6B7280]">
        Data missing
      </div>
    );
  }

  const max = Math.max(...points);
  const min = Math.min(...points);
  const width = 240;
  const height = 72;

  const path = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((point - min) / (max - min || 1)) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[72px] w-full">
      <path
        d={path}
        fill="none"
        stroke="#22C55E"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StockHeader({ stock }: StockHeaderProps) {
  const changeIsNegative = stock.change.trim().startsWith("-");
  const accentClass = changeIsNegative ? "text-[#EF4444]" : "text-[#22C55E]";
  const badgeClass = changeIsNegative
    ? "border-[#EF4444]/20 bg-[#EF4444]/10 text-[#EF4444]"
    : "border-[#22C55E]/20 bg-[#22C55E]/10 text-[#22C55E]";
  const monogram = stock.company
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  return (
    <div className="grid gap-5 rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(12,19,29,0.96),rgba(8,12,18,0.96))] p-4 sm:grid-cols-[minmax(0,1fr)_260px] sm:p-5">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#3DD9B3]/18 bg-[#3DD9B3]/10 text-lg font-medium text-[#E9FFF8]">
          {monogram}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h3 className="text-xl font-medium tracking-[-0.02em] text-[#F3F7FB]">
              {stock.company}
            </h3>
            <span className="text-[11px] uppercase tracking-[0.24em] text-[#9FB3C8]">
              {stock.ticker} / {stock.exchange}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
            <span className="tabular-nums text-3xl font-medium tracking-[-0.03em] text-[#F3F7FB]">
              {stock.price}
            </span>
            <div className="flex items-center gap-2">
              <span className={`tabular-nums text-sm ${accentClass}`}>{stock.change}</span>
              <span className={`rounded-full border px-2 py-0.5 text-xs tabular-nums ${badgeClass}`}>
                {stock.changePercent}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/8 pt-4 sm:border-t-0 sm:border-l sm:pl-5 sm:pt-0">
        <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-[#6F8197]">
          <span>Signal Trace</span>
          <span>4P</span>
        </div>
        <MiniChart points={stock.chartPoints} />
      </div>
    </div>
  );
}
