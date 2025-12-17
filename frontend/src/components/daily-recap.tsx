interface NewsItem {
  id: string;
  timestamp: string;
  title: string;
  company?: string;
  logo?: string;
  change?: number;
}

const newsItems: NewsItem[] = [
  {
    id: "1",
    timestamp: "Summarized at 6:00 AM",
    title:
      "Hedge funds retreat from tech and media as a potential market correction looms, while Apple plans a major investment in AI servers. Meanwhile, geopolitical factors influence economic confidence, and New Zealand reports a retail sales rebound as german business climate shows mild improvement.",
  },
  {
    id: "2",
    timestamp: "Today • 10m ago",
    title:
      "Oil prices climb for the 2nd day as US sanctions on Iran heighten fears of supply constraints.",
  },
  {
    id: "3",
    timestamp: "Today • 1h ago",
    company: "NVDA",
    change: -2.6,
    title:
      "Chinese firms boost Nvidia's H20 chip orders, driven by the rising demand for DeepSeek's AI models, according to sources.",
  },
  {
    id: "4",
    timestamp: "Today • 2h ago",
    company: "TSLA",
    title:
      "China software update plans add city navigation, enhancing car's driving-assistance for urban street navigation, per company notification and sources.",
  },
  {
    id: "5",
    timestamp: "Today • 4h ago",
    company: "JNJ",
    title:
      "Johnson & Johnson sues Samsung Bioepis, claiming breach of contract on Stelara's",
  },
  {
    id: "6",
    timestamp: "Today • 5h ago",
    company: "AAPL",
    change: 1.8,
    title:
      "Apple announces breakthrough in M4 chip architecture with 40% performance improvement, targeting AI workload optimization for enterprise customers.",
  },
  {
    id: "7",
    timestamp: "Today • 6h ago",
    company: "MSFT",
    change: 0.9,
    title:
      "Microsoft Cloud revenue exceeds analyst expectations by 12%, driven by Azure AI services adoption across Fortune 500 companies.",
  },
  {
    id: "8",
    timestamp: "Today • 7h ago",
    title:
      "Federal Reserve signals potential rate cuts in Q2 2025 as inflation shows sustained downward trend for fourth consecutive month.",
  },
  {
    id: "9",
    timestamp: "Today • 8h ago",
    company: "GOOGL",
    change: -1.2,
    title:
      "Google faces antitrust probe in EU over Gemini AI integration with Search, regulatory decision expected within 90 days.",
  },
  {
    id: "10",
    timestamp: "Today • 9h ago",
    company: "AMZN",
    change: 2.3,
    title:
      "Amazon Web Services launches new quantum computing platform, positioning company as leader in next-generation cloud infrastructure.",
  },
  {
    id: "11",
    timestamp: "Today • 10h ago",
    company: "META",
    change: -0.5,
    title:
      "Meta's Reality Labs division reports reduced losses as Quest 3 headset sales surpass 5 million units globally.",
  },
  {
    id: "12",
    timestamp: "Today • 11h ago",
    title:
      "Cryptocurrency markets rally as Bitcoin surges past $95k threshold on institutional adoption news from major banks.",
  },
  {
    id: "13",
    timestamp: "Today • 12h ago",
    company: "NFLX",
    change: 3.1,
    title:
      "Netflix subscriber growth accelerates in Asia-Pacific region, adding 8.2 million new members in Q4 2024.",
  },
  {
    id: "14",
    timestamp: "Yesterday • 1h ago",
    company: "BA",
    change: -2.1,
    title:
      "Boeing delays 777X delivery timeline again, pushing first commercial delivery to late 2026 amid certification challenges.",
  },
  {
    id: "15",
    timestamp: "Yesterday • 3h ago",
    company: "DIS",
    change: 1.5,
    title:
      "Disney+ streaming service crosses 200 million subscribers worldwide, CEO announces plans for ad-tier expansion.",
  },
];

export function DailyRecap() {
  return (
    <div className="bg-card rounded-lg border border-border h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-6 pb-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          <h3 className="font-semibold">Daily recap</h3>
        </div>
        <svg
          className="w-4 h-4 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </div>

      <div className="space-y-6 p-6 pt-4 overflow-y-auto flex-1">
        {newsItems.map((item) => (
          <div key={item.id} className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              {item.company ? (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                    {item.company[0]}
                  </div>
                  <span className="font-semibold">{item.company}</span>
                  {item.change && (
                    <span className="text-red-500">{item.change}%</span>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground">{item.timestamp}</span>
              )}
              {item.timestamp && !item.company && (
                <svg
                  className="w-3 h-3 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 5l7 7-7 7M5 5l7 7-7 7"
                  />
                </svg>
              )}
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">
              {item.title}
              {!item.company && item.id === "1" && (
                <span className="text-accent hover:underline cursor-pointer">
                  {" "}
                  Read more
                </span>
              )}
            </p>
            {item.company && (
              <span className="text-xs text-muted-foreground">
                {item.timestamp}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
