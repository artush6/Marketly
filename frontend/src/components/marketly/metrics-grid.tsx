import Link from "next/link";
import type { MetricCardData } from "./types";

type MetricsGridProps = {
  metrics: MetricCardData[];
};

export function MetricsGrid({ metrics }: MetricsGridProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <Link
          key={metric.label}
          href={metric.href ?? "#"}
          className="border border-white/8 bg-[#0F141C] p-4 transition-colors hover:border-white/16 hover:bg-[#121821]"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#9CA3AF]">
              {metric.label}
            </p>
            <span className="text-[10px] uppercase tracking-[0.22em] text-[#6B7280]">
              Open
            </span>
          </div>
          <p className="mt-3 tabular-nums text-2xl font-medium tracking-[-0.03em] text-[#E5E7EB]">
            {metric.value}
          </p>
          <p className="mt-3 text-sm leading-6 text-[#9CA3AF]">{metric.context}</p>
        </Link>
      ))}
    </div>
  );
}
