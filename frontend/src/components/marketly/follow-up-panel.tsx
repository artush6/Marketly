import type { FollowUpAnswer } from "./types";

type FollowUpPanelProps = {
  item: FollowUpAnswer;
};

export function FollowUpPanel({ item }: FollowUpPanelProps) {
  return (
    <section className="animate-enter rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,24,35,0.92),rgba(8,12,18,0.96))] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.01)] backdrop-blur-sm sm:p-6 lg:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/6 pb-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#9FB3C8]">
            Follow-up
          </p>
          <h2 className="mt-2 text-base font-medium text-[#F3F7FB]">{item.question}</h2>
        </div>
        <span className="text-[11px] uppercase tracking-[0.24em] text-[#6F8197]">
          {item.symbol}
        </span>
      </div>

      <div className="mt-5 rounded-[24px] border border-white/8 bg-[#0F141C] p-5">
        <p className="text-[11px] uppercase tracking-[0.24em] text-[#9FB3C8]">Backend AI Reply</p>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#DDE7F0]">
          {item.status === "loading"
            ? "Thinking through the structured score, business model, catalysts, and scenarios."
            : item.status === "error"
              ? "Follow-up data is missing."
              : item.answer}
        </p>
      </div>
    </section>
  );
}
