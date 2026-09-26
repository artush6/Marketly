import type { Metadata } from "next";
import "./globals.css";
import "../components/research/terminal.css";
import { MarketTickerTape } from "@/components/research/market-ticker-tape";

export const metadata: Metadata = {
  title: {
    default: "Marketly",
    template: "%s | Marketly",
  },
  description:
    "A premium market intelligence workspace for company analysis, news flow, and financial drill-downs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Browser extensions (including One Sec) inject attributes on this element.
    <html lang="en" data-marketly-theme="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.dataset.marketlyTheme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'`,
          }}
        />
      </head>
      <body className="font-sans">
        <MarketTickerTape />
        {children}
      </body>
    </html>
  );
}
