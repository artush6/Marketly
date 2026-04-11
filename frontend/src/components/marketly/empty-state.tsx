import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { ChatInput } from "./chat-input";

type QuickPrompt = {
  label: string;
  prompt: string;
  detail: string;
};

type EmptyStateProps = {
  onSubmit: (value: string) => void;
  tickerBar: ReactNode;
  recentQueries: string[];
  quickPrompts: QuickPrompt[];
};

export function EmptyState({
  onSubmit,
  tickerBar,
  recentQueries,
  quickPrompts,
}: EmptyStateProps) {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-168px)] w-full max-w-[920px] items-center justify-center">
      <div className="w-full">
        <div className="overflow-hidden rounded-[36px] border border-white/8 bg-[linear-gradient(140deg,rgba(13,22,33,0.98),rgba(8,12,18,0.96))] px-6 py-8 sm:px-8 sm:py-10">
          <div className="mx-auto max-w-[720px] text-center">
            <div className="inline-flex items-center rounded-full border border-[#3DD9B3]/18 bg-[#3DD9B3]/10 px-4 py-1.5 text-[10px] uppercase tracking-[0.3em] text-[#9CEBD8]">
              AI stock summaries
            </div>
            <h1 className="mt-5 text-balance text-5xl font-medium tracking-[-0.06em] text-[#F3F7FB] sm:text-6xl">
              Ask about a stock.
              <br />
              Get the read fast.
            </h1>
            <p className="mx-auto mt-4 max-w-[540px] text-base leading-7 text-[#94A7BB]">
              Type a ticker or company name and Marketly returns a simple summary with signals, news, and the final verdict.
            </p>

            <div className="mt-8">
              <ChatInput
                onSubmit={onSubmit}
                floating={false}
                placeholder="AAPL, NVIDIA, Tesla..."
                contextLabel="Start with a stock"
                hint="Ticker, company name, or one short question."
              />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {quickPrompts.map((item) => (
                <button
                  key={item.prompt}
                  type="button"
                  onClick={() => onSubmit(item.prompt)}
                  className="group inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.02] px-4 py-2 text-sm text-[#DDE7F0] transition-colors hover:border-white/14 hover:bg-white/[0.04]"
                >
                  <span className="text-[11px] uppercase tracking-[0.22em] text-[#6F8197]">
                    {item.label}
                  </span>
                  <span>{item.prompt}</span>
                  <ArrowRight className="h-4 w-4 text-[#6F8197] transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>

            <div className="mt-8">{tickerBar}</div>
          </div>
        </div>

        {recentQueries.length > 0 ? (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {recentQueries.map((query) => (
              <button
                key={query}
                type="button"
                onClick={() => onSubmit(query)}
                className="rounded-full border border-white/8 px-4 py-2 text-sm text-[#DDE7F0] transition-colors hover:border-white/14 hover:bg-white/[0.03]"
              >
                {query}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
