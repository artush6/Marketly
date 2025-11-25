import React from "react";

interface StockNewsCardProps {
    logoUrl?: string;
    ticker: string;
    change: number; // e.g. -2.60 or +1.44
    news: string;
    timeAgo: string; // "1h ago"
    className?: string;
}

export function StockNewsCard({
                              logoUrl,
                              ticker,
                              change,
                              news,
                              timeAgo,
                              className = "",
                          }: StockNewsCardProps) {

    const isNegative = change < 0;

    return (
        <div
            className={`
        w-full rounded-xl bg-[#111] p-4 flex flex-col gap-2
        border border-white/5 ${className}
        `}
        >
            <div className="flex items-center gap-2">
                {logoUrl && (
                    <img
                        src={logoUrl}
                        alt={ticker}
                        className="w-6 h-6 rounded-full object-contain"
                    />
                )}

                <span className="text-sm font-semibold text-white/90">{ticker}</span>

                <span
                    className={`
            text-xs px-2 py-0.5 rounded-md font-medium
            ${isNegative ? "bg-red-600/20 text-red-400" : "bg-green-600/20 text-green-400"}
            `}
                >
                    {change > 0 ? `+${change}%` : `${change}%`}
        </span>

                <span className="text-xs text-white/40 ml-auto">{timeAgo}</span>
            </div>

            <p className="text-white/80 text-sm leading-snug">
                {news}
            </p>
        </div>
    );
}
