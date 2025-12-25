interface Sector {
  name: string
  change: number
  isPositive: boolean
}

const sectors: Sector[] = [
  { name: "Healtcare", change: 0.88, isPositive: true },
  { name: "Financial", change: 0.65, isPositive: true },
  { name: "Real Estate", change: 0.52, isPositive: true },
  { name: "Consumer Defensive", change: 0.39, isPositive: true },
  { name: "Energy", change: 0.23, isPositive: true },
  { name: "Communication Services", change: 0.19, isPositive: true },
  { name: "Basic Materials", change: 0.02, isPositive: true },
  { name: "Industrials", change: -0.32, isPositive: false },
  { name: "Utilities", change: -0.37, isPositive: false },
  { name: "Consumer Cyclical", change: -0.6, isPositive: false },
  { name: "Technology", change: -1.29, isPositive: false },
]

export function SectorList() {
  return (
    <div className="bg-card rounded-lg border border-border p-6 space-y-4">
      {sectors.map((sector) => (
        <div key={sector.name} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-sm">{sector.name}</span>
          </div>
          <span className={`text-sm font-semibold ${sector.isPositive ? "text-green-500" : "text-red-500"}`}>
            {sector.isPositive ? "+" : ""}
            {sector.change.toFixed(2)}%
          </span>
          <div className="w-20 h-6 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
            ▓▓▓░░
          </div>
        </div>
      ))}
    </div>
  )
}
