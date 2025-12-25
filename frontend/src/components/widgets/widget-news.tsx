export function WidgetNews() {
  const news = [
    {
      title: "Markets reach new highs amid strong earnings",
      time: "2 minutes ago",
      source: "Financial Times",
    },
    {
      title: "Tech sector shows resilience in Q4 results",
      time: "15 minutes ago",
      source: "Bloomberg",
    },
    {
      title: "Fed signals potential rate adjustments",
      time: "1 hour ago",
      source: "Reuters",
    },
    {
      title: "Energy stocks surge on supply concerns",
      time: "2 hours ago",
      source: "WSJ",
    },
  ]

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">Market News</h3>
        <p className="text-sm text-muted-foreground">Latest updates</p>
      </div>
      <div className="space-y-3 overflow-auto flex-1">
        {news.map((item, index) => (
          <div
            key={index}
            className="bg-secondary/30 rounded-lg p-3 border border-border hover:bg-secondary/50 transition-colors cursor-pointer"
          >
            <h4 className="text-sm font-medium text-foreground mb-1 leading-relaxed">{item.title}</h4>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{item.source}</span>
              <span>•</span>
              <span>{item.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
