import type { VerdictData } from "./types";

type FinalVerdictProps = {
  verdict: VerdictData;
};

export function FinalVerdict({ verdict }: FinalVerdictProps) {
  const labelClass =
    verdict.label === "Bullish"
      ? "text-[#22C55E]"
      : verdict.label === "Cautious"
        ? "text-[#EF4444]"
        : "text-[#9CA3AF]";

  return (
    <div className="grid gap-4 rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(12,19,29,0.96),rgba(8,12,18,0.96))] p-5 lg:grid-cols-[minmax(0,1fr)_180px]">
      <div>
        <h3 className="text-[11px] uppercase tracking-[0.24em] text-[#9FB3C8]">AI Verdict</h3>
        <p className="mt-4 max-w-[760px] text-sm leading-7 text-[#DDE7F0]">{verdict.summary}</p>
      </div>

      <div className="flex flex-col justify-between border-t border-white/8 pt-4 lg:border-t-0 lg:border-l lg:pl-5 lg:pt-0">
        <div className="text-[11px] uppercase tracking-[0.24em] text-[#6F8197]">Score</div>
        <div className="mt-3 lg:mt-0">
          <p className="tabular-nums text-4xl font-medium tracking-[-0.04em] text-[#F3F7FB]">
            {verdict.score}
          </p>
          <p className={`mt-2 text-sm ${labelClass}`}>{verdict.label}</p>
        </div>
      </div>
    </div>
  );
}
