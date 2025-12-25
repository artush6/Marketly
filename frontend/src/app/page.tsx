"use client";

import { useState, useRef } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DashboardWindow } from "@/components/dashboard-window";
import { TickerTape } from "@/components/widgets/ticker-tape";
import { PortfolioPanel } from "@/components/widgets/portfolio-panel";
import { MarketIndicesPanel } from "@/components/widgets/market-indices-panel";
import { SectorList } from "@/components/widgets/sector-list";
import { ChatPanel } from "@/components/widgets/chat-panel";
import { MarketChart } from "@/components/widgets/market-chart";
import { DailyRecap } from "@/components/widgets/daily-recap";

export type WindowType = {
  id: string;
  type:
    | "portfolio"
    | "market-indices"
    | "sectors"
    | "chat"
    | "market-chart"
    | "recap";
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
};

const WIDGET_TYPES = [
  { type: "portfolio" as const, label: "Portfolio", icon: "💼" },
  { type: "market-indices" as const, label: "Market Indices", icon: "📊" },
  { type: "market-chart" as const, label: "Market Chart", icon: "📈" },
  { type: "sectors" as const, label: "Sectors", icon: "🏢" },
  { type: "recap" as const, label: "Daily Recap", icon: "📰" },
  { type: "chat" as const, label: "AI Assistant", icon: "💬" },
];

export default function TerminalDashboard() {
  const [windows, setWindows] = useState<WindowType[]>([]);
  const [maxZIndex, setMaxZIndex] = useState(1);

  // camera offset (the infinite plane)
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  const addWindow = (type: WindowType["type"]) => {
    const id = `window-${Date.now()}`;

    const defaultSizes: Record<string, { width: number; height: number }> = {
      portfolio: { width: 420, height: 600 },
      "market-indices": { width: 500, height: 700 },
      "market-chart": { width: 600, height: 450 },
      sectors: { width: 400, height: 600 },
      recap: { width: 450, height: 650 },
      chat: { width: 400, height: 550 },
    };

    const size = defaultSizes[type];

    const newWindow: WindowType = {
      id,
      type,
      title: `${WIDGET_TYPES.find((w) => w.type === type)?.label} ${
        windows.filter((w) => w.type === type).length + 1
      }`,
      x: -offset.x + 200,
      y: -offset.y + 200,
      width: size.width,
      height: size.height,
      zIndex: maxZIndex + 1,
    };

    setWindows((prev) => [...prev, newWindow]);
    setMaxZIndex((z) => z + 1);
  };

  const updateWindow = (id: string, updates: Partial<WindowType>) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...updates } : w))
    );
  };

  const bringToFront = (id: string) => {
    const z = maxZIndex + 1;
    updateWindow(id, { zIndex: z });
    setMaxZIndex(z);
  };

  const closeWindow = (id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
  };

  const renderWidgetContent = (type: WindowType["type"]) => {
    switch (type) {
      case "portfolio":
        return <PortfolioPanel />;
      case "market-indices":
        return <MarketIndicesPanel />;
      case "market-chart":
        return <MarketChart />;
      case "sectors":
        return <SectorList />;
      case "recap":
        return <DailyRecap />;
      case "chat":
        return <ChatPanel />;
      default:
        return null;
    }
  };

  /* =======================
     PANNING (INFINITE CANVAS)
     ======================= */

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 1 && !e.altKey) return;
    isPanning.current = true;
    panStart.current = {
      x: e.clientX - offset.x,
      y: e.clientY - offset.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning.current) return;
    setOffset({
      x: e.clientX - panStart.current.x,
      y: e.clientY - panStart.current.y,
    });
  };

  const stopPan = () => {
    isPanning.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    setOffset((prev) => ({
      x: prev.x - e.deltaX,
      y: prev.y - e.deltaY,
    }));
  };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      {/* Ticker */}
      <div className="absolute top-0 left-0 right-0 z-50">
        <TickerTape />
      </div>

      {/* Header */}
      <div className="absolute top-[41px] left-0 right-0 h-14 border-b border-border bg-card/50 backdrop-blur-sm flex items-center px-4 z-40">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-9 w-9">
              <Plus className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {WIDGET_TYPES.map((widget) => (
              <DropdownMenuItem
                key={widget.type}
                onClick={() => addWindow(widget.type)}
                className="flex items-center gap-3 cursor-pointer"
              >
                <span className="text-lg">{widget.icon}</span>
                <span>{widget.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-4 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm text-muted-foreground font-mono">
            Terminal Dashboard
          </span>
        </div>
      </div>

      {/* CANVAS */}
      <div
        className="absolute inset-0 top-[96px] overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopPan}
        onMouseLeave={stopPan}
        onWheel={handleWheel}
      >
        {/* Infinite grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(to right, currentColor 1px, transparent 1px),
              linear-gradient(to bottom, currentColor 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
            backgroundPosition: `${offset.x}px ${offset.y}px`,
          }}
        />

        {/* World */}
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px)`,
          }}
        >
          {windows.map((window) => (
            <DashboardWindow
              key={window.id}
              window={window}
              onUpdate={updateWindow}
              onClose={closeWindow}
              onFocus={bringToFront}
            >
              {renderWidgetContent(window.type)}
            </DashboardWindow>
          ))}
        </div>
      </div>
    </div>
  );
}
