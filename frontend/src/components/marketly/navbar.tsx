"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";

type MarketlyNavbarProps = {
  currentSymbol?: string | null;
};

export function MarketlyNavbar({ currentSymbol }: MarketlyNavbarProps) {
  const pathname = usePathname();
  const financialsHref = `/financials/${currentSymbol ?? "AAPL"}`;
  const navItems = [
    { label: "Analysis", href: "/" },
    { label: "Financials", href: financialsHref },
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/8 bg-[rgba(8,12,18,0.86)] backdrop-blur-2xl">
      <div className="mx-auto flex h-[68px] w-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-[11px] font-semibold tracking-[0.28em] text-[#E5E7EB]">
            M
          </div>
          <span className="text-sm font-medium tracking-[0.22em] text-[#F3F7FB] uppercase">
            Marketly
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`text-xs tracking-[0.24em] uppercase transition-colors ${
                  active ? "text-[#F3F7FB]" : "text-[#8EA0B8] hover:text-[#F3F7FB]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {currentSymbol ? (
            <Link
              href={financialsHref}
              className="hidden items-center gap-2 rounded-full border border-white/8 px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-[#DDE7F0] transition-colors hover:bg-white/[0.04] sm:flex"
            >
              {currentSymbol}
              <ArrowUpRight className="h-3.5 w-3.5 text-[#6F8197]" />
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
