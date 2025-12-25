export function WidgetStats() {
  const stats = [
    { label: "Market Cap", value: "$2.4T", change: "+2.4%" },
    { label: "Volume", value: "$124B", change: "+5.1%" },
    { label: "24h High", value: "$4,450", change: "+3.2%" },
    { label: "24h Low", value: "$4,180", change: "-1.8%" },
  ]

  return (
    <div className="h-full">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">Key Statistics</h3>
        <p className="text-sm text-muted-foreground">Market overview</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-secondary/50 rounded-lg p-4 border border-border">
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-foreground mb-1">{stat.value}</p>
            <p className={`text-sm font-medium ${stat.change.startsWith("+") ? "text-accent" : "text-destructive"}`}>
              {stat.change}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
