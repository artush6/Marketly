"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, Telescope, Newspaper, Star, Menu, X } from "lucide-react";
import { Drawer } from "vaul";

type View = "Markets" | "Small CAP" | "News" | "Company" | "Watchlist" | "Saved research" | "Calendar" | "Alerts";
export function MobileNavigation({ view, onNavigate }: { view: string; onNavigate: (view: View) => void }) {
  const [open, setOpen] = useState(false);
  return <>
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      {([{ label: "Markets", icon: BarChart3 }, { label: "Small CAP", icon: Telescope }, { label: "News", icon: Newspaper }, { label: "Watchlist", icon: Star }, { label: "More", icon: Menu }] as const).map(({ label, icon: Icon }) => <button key={label} aria-current={view === label ? "page" : undefined} onClick={() => {
        if (label === "More") setOpen(true);
        else { onNavigate(label); window.scrollTo({ top: 0, behavior: "instant" }); }
      }}><Icon size={22} /><span>{label}</span></button>)}
    </nav>
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Portal><Drawer.Overlay className="mobile-sheet-overlay" /><Drawer.Content className="mobile-more-sheet">
        <div className="sheet-grip" /><header><Drawer.Title>Research workspace</Drawer.Title><Drawer.Close aria-label="Close navigation"><X size={20} /></Drawer.Close></header>
        <Drawer.Description>Explore your markets, research, and account.</Drawer.Description>
        {(["Company", "Calendar", "Alerts", "Saved research"] as const).map(item => <button key={item} onClick={() => { onNavigate(item); setOpen(false); }}>{item}</button>)}
        <Link href="/settings">Profile & settings</Link><Link href="/portfolio">Portfolio</Link><Link href="/compare">Compare companies</Link>
      </Drawer.Content></Drawer.Portal>
    </Drawer.Root>
  </>;
}
