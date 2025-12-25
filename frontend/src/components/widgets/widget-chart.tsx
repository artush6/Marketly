"use client"

import { Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

const data = [
  { time: "09:30", value: 4200 },
  { time: "10:00", value: 4250 },
  { time: "10:30", value: 4180 },
  { time: "11:00", value: 4320 },
  { time: "11:30", value: 4280 },
  { time: "12:00", value: 4350 },
  { time: "12:30", value: 4400 },
  { time: "13:00", value: 4380 },
  { time: "13:30", value: 4420 },
  { time: "14:00", value: 4450 },
]

export function WidgetChart() {
  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">Market Performance</h3>
        <p className="text-sm text-muted-foreground">Real-time data visualization</p>
      </div>
      <ChartContainer
        config={{
          value: {
            label: "Value",
            color: "hsl(var(--primary))",
          },
        }}
        className="h-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" />
            <YAxis stroke="hsl(var(--muted-foreground))" />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  )
}
