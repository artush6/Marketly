import type { FollowUpAnswer } from "./types";

type FollowUpPanelProps = {
  item: FollowUpAnswer;
};

export function FollowUpPanel({ item }: FollowUpPanelProps) {
  return (
    <section className="animate-enter rounded-[24px] border border-white/8 bg-[#121821]/88 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.01)] backdrop-blur-sm sm:p-6 lg:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/6 pb-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#9CA3AF]">
            Follow-up
          </p>
          <h2 className="mt-2 text-base font-medium text-[#E5E7EB]">{item.question}</h2>
        </div>
        <span className="text-[11px] uppercase tracking-[0.24em] text-[#6B7280]">
          {item.symbol}
        </span>
      </div>

      <div className="mt-5 border border-white/8 bg-[#0F141C] p-5">
        <p className="text-[11px] uppercase tracking-[0.24em] text-[#9CA3AF]">Backend AI Reply</p>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#D1D5DB]">
          {item.status === "loading"
            ? "Thinking through the existing scoring output, financials, and news."
            : item.status === "error"
              ? "Follow-up data is missing."
              : item.answer}
        </p>
      </div>
    </section>
  );
}
