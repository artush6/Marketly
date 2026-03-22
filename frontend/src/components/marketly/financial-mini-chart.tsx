import type { FinancialMiniChartData } from "./types";

type FinancialMiniChartProps = {
  chart: FinancialMiniChartData;
};

export function FinancialMiniChart({ chart }: FinancialMiniChartProps) {
  const maxValue = Math.max(...chart.series.map((point) => point.value), 0.0001);
  const toneClass =
    chart.deltaTone === "positive"
      ? "text-[#22C55E]"
      : chart.deltaTone === "negative"
        ? "text-[#EF4444]"
        : "text-[#9CA3AF]";

  return (
    <div className="border border-white/8 bg-[#121821] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#9CA3AF]">{chart.title}</p>
          <p className="mt-3 tabular-nums text-xl font-medium tracking-[-0.03em] text-[#E5E7EB]">
            {chart.value}
          </p>
        </div>
        <span className={`text-xs tabular-nums ${toneClass}`}>{chart.delta}</span>
      </div>

      <div className="mt-5 grid h-24 grid-cols-4 items-end gap-2">
        {chart.series.map((point) => {
          const height = Math.max((point.value / maxValue) * 100, 10);

          return (
            <div key={point.label} className="flex h-full flex-col justify-end gap-2">
              <div className="flex-1 rounded-t-[10px] border border-white/8 bg-[#0F141C] px-1.5 pt-1.5">
                <div
                  className="w-full rounded-t-[8px] bg-white/70 transition-[height] duration-500"
                  style={{
                    height: `${height}%`,
                    marginTop: `${100 - height}%`,
                  }}
                />
              </div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-[#6B7280]">{point.label}</p>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs leading-5 text-[#6B7280]">{chart.context}</p>
    </div>
  );
}
