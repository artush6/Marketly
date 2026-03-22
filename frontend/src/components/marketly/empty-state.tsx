import type { ReactNode } from "react";
import { ChatInput } from "./chat-input";

type EmptyStateProps = {
  onSubmit: (value: string) => void;
  tickerBar: ReactNode;
};

export function EmptyState({ onSubmit, tickerBar }: EmptyStateProps) {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-144px)] w-full max-w-[1180px] items-center justify-center">
      <div className="flex w-full max-w-[760px] flex-col items-center text-center">
        <div className="mb-5 inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-[10px] uppercase tracking-[0.28em] text-[#9CA3AF]">
          Chat-first stock analysis terminal
        </div>
        <h1 className="max-w-[10ch] text-balance text-4xl font-medium tracking-[-0.04em] text-[#E5E7EB] sm:text-5xl">
          Institutional Intelligence
        </h1>
        <p className="mt-4 max-w-[540px] text-sm leading-6 text-[#9CA3AF] sm:text-base">
          Analyze any company, market, or trend with AI
        </p>
        <div className="mt-8 w-full max-w-[760px]">
          <ChatInput onSubmit={onSubmit} floating={false} />
        </div>
        <div className="mt-6 w-full max-w-[700px]">{tickerBar}</div>
      </div>
    </section>
  );
}
