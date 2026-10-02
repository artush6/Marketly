import type { Metadata } from "next";
import "./globals.css";
import "../components/research/research.css";
import "../components/research/terminal.css";
import "../components/research/amber.css";
import "../components/research/workspace-theme.css";
import { AccountProvider } from "@/components/account/account-provider";
import { localWorkspaceAllowed } from "@/lib/supabase/config";
import { MarketTickerTape } from "@/components/research/market-ticker-tape";

export const metadata: Metadata = {
  title: {
    default: "Marketly",
    template: "%s | Marketly",
  },
  description:
    "A premium market intelligence workspace for company analysis, news flow, and financial drill-downs.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Marketly" },
  icons: { icon: "/marketly-icon.svg", apple: "/apple-touch-icon.png" },
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
            __html: `document.documentElement.dataset.marketlyTheme='dark'`,
          }}
        />
      </head>
      <body className="font-sans">
        <AccountProvider localMode={localWorkspaceAllowed()}><MarketTickerTape />
        {children}</AccountProvider>
      </body>
    </html>
  );
}
