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
          className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(12,19,29,0.96),rgba(9,15,22,0.96))] p-4 transition-colors hover:border-white/16 hover:bg-[#121821]"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#9FB3C8]">
              {metric.label}
            </p>
            <span className="text-[10px] uppercase tracking-[0.22em] text-[#6F8197]">
              Open
            </span>
          </div>
          <p className="mt-3 tabular-nums text-2xl font-medium tracking-[-0.03em] text-[#F3F7FB]">
            {metric.value}
          </p>
          <p className="mt-3 text-sm leading-6 text-[#8EA0B8]">{metric.context}</p>
        </Link>
      ))}
    </div>
  );
}
