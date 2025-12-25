import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function WidgetTable() {
  const data = [
    { symbol: "AAPL", price: "$178.45", change: "+2.4%", volume: "45.2M" },
    { symbol: "MSFT", price: "$389.12", change: "+1.8%", volume: "32.1M" },
    { symbol: "GOOGL", price: "$142.68", change: "-0.5%", volume: "28.5M" },
    { symbol: "AMZN", price: "$178.32", change: "+3.1%", volume: "52.3M" },
    { symbol: "META", price: "$512.45", change: "+1.2%", volume: "18.9M" },
  ]

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">Top Stocks</h3>
        <p className="text-sm text-muted-foreground">Market leaders</p>
      </div>
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-foreground">Symbol</TableHead>
              <TableHead className="text-foreground">Price</TableHead>
              <TableHead className="text-foreground">Change</TableHead>
              <TableHead className="text-foreground">Volume</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.symbol}>
                <TableCell className="font-mono font-semibold">{row.symbol}</TableCell>
                <TableCell>{row.price}</TableCell>
                <TableCell className={`font-medium ${row.change.startsWith("+") ? "text-accent" : "text-destructive"}`}>
                  {row.change}
                </TableCell>
                <TableCell className="text-muted-foreground">{row.volume}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
