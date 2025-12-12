"use client";

import { ChartComponent } from "@/components/Charts/ChartComponent";
import { StockNewsCard } from "@/components/StockNewsCard";
import { ArrowUpRight } from "lucide-react";

export default function Home() {
  const data = [
    { time: "2018-12-22", value: 32.51 },
    { time: "2018-12-23", value: 31.11 },
    { time: "2018-12-24", value: 27.02 },
    { time: "2018-12-25", value: 27.32 },
    { time: "2018-12-26", value: 25.17 },
    { time: "2018-12-27", value: 28.89 },
    { time: "2018-12-28", value: 25.46 },
    { time: "2018-12-29", value: 23.92 },
    { time: "2018-12-30", value: 22.68 },
    { time: "2018-12-31", value: 22.67 },
  ];

  const name = "Artush";

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-gray-100 flex justify-center">
      {/* FIXED WIDTH DASHBOARD */}
      <div className="w-full max-w-7xl px-10 py-10">
        {/* HEADER */}
        <header className="flex justify-between items-center mb-10">
          <h1 className="text-2xl font-medium">Hello, {name}</h1>
          <p className="text-gray-400">The markets are closed ⟳</p>
        </header>

        {/* GRID */}
        <main className="grid grid-cols-[2fr_1fr] gap-8">
          {/* LEFT COLUMN */}
          <div className="flex flex-col gap-8">
            {/* Chart Card */}
            <div className="bg-neutral-900 rounded-2xl p-6 shadow-lg">
              <p className="text-sm text-gray-400 mb-1">Tuesday, February 25</p>
              <h2 className="text-xl font-medium mb-4">
                The markets are neutral
              </h2>
              <ChartComponent data={data} />
            </div>

            {/* Sectors Card */}
            <div className="bg-neutral-900 rounded-2xl p-6 shadow-lg">
              <h3 className="text-lg font-medium mb-4">Sectors</h3>

              <div className="space-y-3">
                {[
                  {
                    name: "Healthcare",
                    value: "+0.88%",
                    color: "text-green-400",
                  },
                  {
                    name: "Financial",
                    value: "+0.65%",
                    color: "text-green-400",
                  },
                  {
                    name: "Technology",
                    value: "−1.02%",
                    color: "text-red-400",
                  },
                ].map((s, i) => (
                  <div key={i} className="flex justify-between text-gray-300">
                    <span>{s.name}</span>
                    <span className={s.color}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="flex flex-col gap-6">
            <div className="w-full rounded-xl bg-[#111] p-4 flex flex-col gap-2">
              {/* Top row */}
              <div className="relative z-10 flex justify-between items-start mb-4">
                {/* Tag */}
                <div
                  className="
                    inline-flex items-center gap-2
                    bg-neutral-800/60
                    text-gray-200
                    text-sm
                    px-3 py-1
                    rounded-full
                    backdrop-blur-md
                "
                >
                  <span className="inline-block w-2 h-2 rounded-full bg-gray-300" />
                  Daily recap
                </div>

                {/* Timestamp + Icon */}
                <div className="flex items-center gap-3 text-gray-400 text-sm">
                  <span>Summarized at 6:00 AM</span>
                  <ArrowUpRight size={16} className="opacity-70" />
                </div>
              </div>

              <div className="relative z-10">
                <p className="text-gray-200 text-md leading-relaxed">
                  Hedge funds retreat from tech and media as a potential market
                  correction looms, while Apple plans a major investment in AI
                  servers. Meanwhile, geopolitical factors influence economic
                  confidence, and New Zealand reports a retail sales rebound as
                  German business climate shows mild improvement.{" "}
                  <span className="text-gray-400 underline cursor-pointer">
                    Read more
                  </span>
                </p>
              </div>
            </div>

            {[1, 2, 3, 4].map((i) => (
              <StockNewsCard
                key={i}
                logoUrl="/logos/nvidia.png"
                ticker="NVDA"
                change={-2.6}
                timeAgo="1h ago"
                news="Chinese firms boost Nvidia's H20 chip orders due to rising demand for DeepSeek’s AI models."
              />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
