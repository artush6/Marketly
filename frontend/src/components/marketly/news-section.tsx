import type { NewsItem } from "./types";

type NewsSectionProps = {
  news: NewsItem[];
};

export function NewsSection({ news }: NewsSectionProps) {
  return (
    <div className="border border-white/8 bg-[#0F141C] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[11px] uppercase tracking-[0.24em] text-[#9CA3AF]">News Flow</h3>
        <span className="text-[11px] uppercase tracking-[0.24em] text-[#6B7280]">Latest</span>
      </div>

      {news.length === 0 ? (
        <p className="text-sm leading-6 text-[#6B7280]">News data is missing.</p>
      ) : (
        <div className="divide-y divide-white/6">
          {news.map((item) => {
          const content = (
            <>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {item.category ? (
                    <span className="rounded-full border border-white/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[#9CA3AF]">
                      {item.category}
                    </span>
                  ) : null}
                  {item.source ? (
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[#6B7280]">
                      {item.source}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm leading-6 text-[#D1D5DB]">{item.title}</p>
                {item.summary ? (
                  <p className="mt-2 max-w-[780px] text-sm leading-6 text-[#9CA3AF]">{item.summary}</p>
                ) : null}
              </div>
              <span className="shrink-0 text-xs tabular-nums text-[#6B7280]">{item.timestamp}</span>
            </>
          );

          return item.url ? (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-start justify-between gap-4 py-4 transition-colors hover:text-white"
            >
              {content}
            </a>
          ) : (
            <div key={item.id} className="flex items-start justify-between gap-4 py-4">
              {content}
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
}
