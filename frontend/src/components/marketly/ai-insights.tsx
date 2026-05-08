import type { InsightData } from "./types";

type AIInsightsProps = {
  insights: InsightData;
};

export function AIInsights({ insights }: AIInsightsProps) {
  return (
    <div className="border border-white/8 bg-[#0F141C] p-5">
      <div className="max-w-[860px]">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#9CA3AF]">AI Insights</p>
          <span className="text-[10px] uppercase tracking-[0.22em] text-[#6B7280]">
            {insights.sourceLabel}
          </span>
        </div>
        <p className="mt-3 text-sm leading-7 text-[#E5E7EB]/90">{insights.summary}</p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h4 className="text-[11px] uppercase tracking-[0.24em] text-[#22C55E]">Core Strengths</h4>
          {insights.strengths.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {insights.strengths.map((strength) => (
                <li key={strength} className="flex gap-3 text-sm leading-6 text-[#D1D5DB]">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#22C55E]" />
                  <span>{strength}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm leading-6 text-[#6B7280]">Data is missing.</p>
          )}
        </div>

        <div>
          <h4 className="text-[11px] uppercase tracking-[0.24em] text-[#EF4444]">Risks</h4>
          {insights.risks.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {insights.risks.map((risk) => (
                <li key={risk} className="flex gap-3 text-sm leading-6 text-[#D1D5DB]">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#EF4444]" />
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm leading-6 text-[#6B7280]">Data is missing.</p>
          )}
        </div>
      </div>

      {insights.evidence && insights.evidence.length > 0 ? (
        <div className="mt-6 border-t border-white/6 pt-5">
          <h4 className="text-[11px] uppercase tracking-[0.24em] text-[#9FB3C8]">Evidence</h4>
          <ul className="mt-4 space-y-3">
            {insights.evidence.map((item) => (
              <li key={item} className="text-sm leading-6 text-[#D1D5DB]">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {insights.criticalUnknowns && insights.criticalUnknowns.length > 0 ? (
        <div className="mt-6 border-t border-white/6 pt-5">
          <h4 className="text-[11px] uppercase tracking-[0.24em] text-[#F59E0B]">Critical Unknowns</h4>
          <ul className="mt-4 space-y-3">
            {insights.criticalUnknowns.map((item) => (
              <li key={item} className="text-sm leading-6 text-[#D1D5DB]">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
