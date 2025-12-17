"use client";

import {
  Moon,
  Sun,
  Home,
  DollarSign,
  BarChart3,
  Smartphone,
  Mail,
  Search,
} from "lucide-react";
import { useEffect, useState } from "react";

export function Header() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  return (
    <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
        {/* Left side - Logo and greeting */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
            <span className="text-primary-foreground text-sm font-bold">M</span>
          </div>
          <h1 className="text-lg font-semibold">Hello, Sam</h1>
        </div>

        {/* Center - Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          <button className="px-4 py-2 hover:bg-accent/50 rounded-md transition flex items-center gap-2 text-sm">
            <Home className="w-4 h-4" />
            <span>Home</span>
          </button>
          <button className="px-4 py-2 hover:bg-accent/50 rounded-md transition flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4" />
            <span>Markets</span>
          </button>
          <button className="px-4 py-2 hover:bg-accent/50 rounded-md transition flex items-center gap-2 text-sm">
            <BarChart3 className="w-4 h-4" />
            <span>Portfolio</span>
          </button>
          <button className="px-4 py-2 hover:bg-accent/50 rounded-md transition flex items-center gap-2 text-sm">
            <Smartphone className="w-4 h-4" />
            <span>Activity</span>
          </button>
        </nav>

        {/* Right side - Actions */}
        <div className="flex items-center gap-3">
          <button className="p-2 hover:bg-accent/50 rounded-md transition hidden sm:flex">
            <Search className="w-5 h-5" />
          </button>
          <button className="p-2 hover:bg-accent/50 rounded-md transition hidden sm:flex">
            <Mail className="w-5 h-5" />
          </button>

          <div className="w-px h-6 bg-border hidden sm:block" />

          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-accent/50 rounded-md transition"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Moon className="w-5 h-5" />
            ) : (
              <Sun className="w-5 h-5" />
            )}
          </button>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="hidden lg:inline">The markets are</span>
            <span className="font-medium">closed</span>
          </div>
        </div>
      </div>
    </header>
  );
}
