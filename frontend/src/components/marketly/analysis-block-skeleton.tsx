import { Skeleton } from "@/components/ui/skeleton";
import { ANALYSIS_LOADING_STEPS } from "./mock-data";

type AnalysisBlockSkeletonProps = {
  query: string;
  stepIndex: number;
};

const SECTION_TITLES = [
  "Market Snapshot",
  "Financial Metrics",
  "AI Insights",
  "News Flow",
  "Scenario Framing",
  "Verdict Draft",
];

export function AnalysisBlockSkeleton({
  query,
  stepIndex,
}: AnalysisBlockSkeletonProps) {
  return (
    <section className="rounded-[24px] border border-white/8 bg-[#121821]/70 p-5 backdrop-blur-sm sm:p-6 lg:p-7">
      <div className="mb-6 flex items-center justify-between border-b border-white/6 pb-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#9CA3AF]">
            Analysis Query
          </p>
          <h2 className="mt-2 text-base font-medium text-[#E5E7EB]">{query}</h2>
        </div>
        <span className="hidden text-[11px] uppercase tracking-[0.24em] text-[#6B7280] sm:block">
          Generating
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="border border-white/8 bg-[#0F141C] p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#9CA3AF]">
            Agent Activity
          </p>
          <div className="mt-4 space-y-4">
            {ANALYSIS_LOADING_STEPS.map((step, index) => {
              const isComplete = index < stepIndex;
              const isActive = index === stepIndex;

              return (
                <div key={step.label} className="flex gap-3">
                  <div className="pt-1.5">
                    <span
                      className={`block h-2 w-2 rounded-full ${
                        isComplete
                          ? "bg-[#22C55E]"
                          : isActive
                            ? "animate-pulse bg-[#E5E7EB]"
                            : "bg-white/10"
                      }`}
                    />
                  </div>
                  <div>
                    <p
                      className={`text-xs uppercase tracking-[0.22em] ${
                        isComplete || isActive ? "text-[#E5E7EB]" : "text-[#6B7280]"
                      }`}
                    >
                      {step.label}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#9CA3AF]">{step.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          {SECTION_TITLES.map((title, index) => {
            const isVisible = index <= stepIndex + 1;

            return (
              <div
                key={title}
                className={`transition-all duration-500 ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-20 translate-y-2"
                }`}
              >
                <div className="mb-2 text-[11px] uppercase tracking-[0.24em] text-[#6B7280]">
                  {title}
                </div>
                <Skeleton
                  className={`rounded-none bg-white/[0.05] ${
                    index === 0
                      ? "h-28"
                      : index === 1
                        ? "h-24"
                        : index === 2
                          ? "h-40"
                          : index === 3
                            ? "h-28"
                            : "h-32"
                  }`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
