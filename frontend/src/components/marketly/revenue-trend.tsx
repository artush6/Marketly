import Link from "next/link";
import { FinancialMiniChart } from "./financial-mini-chart";
import type { RevenueTrendData } from "./types";

type RevenueTrendProps = RevenueTrendData;

function formatBillions(value: number) {
  return `$${value.toFixed(1)}B`;
}

export function RevenueTrend({
  series,
  description,
  sourceLabel,
  sourceSummary,
  miniCharts,
  href,
}: RevenueTrendProps) {
  const maxValue = Math.max(...series.map((point) => point.value), 0.1);
  const latestValue = series[series.length - 1]?.value ?? 0;
  const previousValue = series[series.length - 2]?.value ?? latestValue;
  const delta = latestValue - previousValue;
  const deltaColor = delta >= 0 ? "text-[#22C55E]" : "text-[#EF4444]";

  return (
    <div className="border border-white/8 bg-[#0F141C] p-5">
      <div className="flex flex-col gap-4 border-b border-white/8 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#9CA3AF]">
            Financial History
          </p>
          <p className="mt-2 max-w-[680px] text-sm leading-6 text-[#D1D5DB]">
            {description}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#6B7280]">
              Latest Revenue
            </p>
            <p className="mt-2 tabular-nums text-2xl font-medium text-[#E5E7EB]">
              {series.length > 0 ? formatBillions(latestValue) : "Data missing"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#6B7280]">
              Seq. Change
            </p>
            <p className={`mt-2 tabular-nums text-sm ${deltaColor}`}>
              {series.length > 1 ? (
                <>
                  {delta >= 0 ? "+" : ""}
                  {formatBillions(delta)}
                </>
              ) : (
                "Data missing"
              )}
            </p>
          </div>
          <Link
            href={href}
            className="rounded-full border border-white/10 px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-[#E5E7EB] transition-colors hover:bg-white/[0.04]"
          >
            Open Financials
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        {series.length > 0 ? (
          <div className="grid h-[220px] grid-cols-4 items-end gap-3">
            {series.map((point) => (
              <div key={point.label} className="flex h-full flex-col justify-end gap-3">
                <div className="flex-1 rounded-t-[14px] border border-white/8 bg-[#121821] px-2 pt-2">
                  <div
                    className="w-full rounded-t-[10px] bg-[#22C55E]/80 transition-[height] duration-700"
                    style={{
                      height: `${Math.max((point.value / maxValue) * 100, 12)}%`,
                      marginTop: `${100 - Math.max((point.value / maxValue) * 100, 12)}%`,
                    }}
                  />
                </div>
                <div>
                  <p className="text-xs tabular-nums text-[#E5E7EB]">
                    {formatBillions(point.value)}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#6B7280]">
                    {point.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[220px] items-center justify-center border border-dashed border-white/8 bg-[#121821] px-6 text-sm text-[#6B7280]">
            Data is missing.
          </div>
        )}

        <div className="border border-white/8 bg-[#121821] p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#9CA3AF]">
            Data Source
          </p>
          <p className="mt-3 text-sm leading-6 text-[#D1D5DB]">{sourceLabel}</p>
          <p className="mt-4 text-xs leading-6 text-[#6B7280]">{sourceSummary}</p>
        </div>
      </div>

      {miniCharts.length > 0 ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {miniCharts.map((chart) => (
            <FinancialMiniChart key={chart.title} chart={chart} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
