"use client";

import { useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const overridden = useRef(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyDevice = () => {
      if (overridden.current) return;
      const next: Theme = media.matches ? "dark" : "light";
      setTheme(next);
      document.documentElement.dataset.marketlyTheme = next;
    };
    applyDevice();
    media.addEventListener("change", applyDevice);
    return () => media.removeEventListener("change", applyDevice);
  }, []);
  const toggle = () => {
    overridden.current = true;
    const active = document.documentElement.dataset.marketlyTheme === "light" ? "light" : "dark";
    const next = active === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.marketlyTheme = next;
  };
  return <button type="button" className="market-theme-toggle" onClick={toggle} aria-label={`Use ${theme === "dark" ? "light" : "dark"} theme`} title="Theme follows your device on each new page load">
    {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
  </button>;
}
