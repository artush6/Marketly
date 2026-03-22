"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CircleUserRound, Settings2 } from "lucide-react";

const NAV_ITEMS = [
  { label: "Analysis", href: "/" },
  { label: "Financials", href: "/financials/AAPL" },
];

export function MarketlyNavbar() {
  const pathname = usePathname();

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/8 bg-[#0B0F14]/94 backdrop-blur-md">
      <div className="mx-auto flex h-[60px] w-full max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-[11px] font-semibold tracking-[0.28em] text-[#E5E7EB]">
            M
          </div>
          <span className="text-sm font-medium tracking-[0.18em] text-[#E5E7EB] uppercase">
            Marketly
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`text-xs tracking-[0.22em] uppercase transition-colors ${
                  active ? "text-[#E5E7EB]" : "text-[#9CA3AF] hover:text-[#E5E7EB]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {[Bell, Settings2, CircleUserRound].map((Icon, index) => (
            <button
              key={index}
              type="button"
              aria-label="Terminal control"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/8 bg-white/[0.02] text-[#9CA3AF] transition-colors hover:text-[#E5E7EB]"
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
