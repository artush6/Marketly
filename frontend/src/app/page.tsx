"use client";

import { Header } from "@/components/header";
import { MarketChart } from "@/components/market-charts";
import { SectorList } from "@/components/sector-list";
import { DailyRecap } from "@/components/daily-recap";

export default function Home() {
  return (
    <div className="h-screen bg-background text-foreground flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full flex flex-col lg:flex-row gap-6 p-4 md:p-6 overflow-hidden">
        {/* Left Panel - takes full height and scrollable */}
        <div className="flex-1 flex flex-col gap-6 overflow-y-auto">
          <MarketChart />
          <SectorList />
        </div>

        {/* Right Panel - takes full height and scrollable */}
        <div className="flex-1 lg:max-w-2xl flex flex-col overflow-hidden">
          <DailyRecap />
        </div>
      </main>
    </div>
  );
}
