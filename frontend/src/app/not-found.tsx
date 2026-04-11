import Link from "next/link";

export default function NotFound() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="terminal-grid pointer-events-none absolute inset-0 opacity-40" />
      <main className="relative mx-auto flex min-h-screen w-full max-w-[980px] items-center px-4 py-24 sm:px-6 lg:px-10">
        <section className="w-full rounded-[34px] border border-white/8 bg-[linear-gradient(145deg,rgba(13,22,33,0.98),rgba(8,12,18,0.96))] p-8 text-center">
          <div className="inline-flex items-center rounded-full border border-[#76A7FF]/18 bg-[#76A7FF]/10 px-4 py-1.5 text-[10px] uppercase tracking-[0.3em] text-[#CFE0FF]">
            Route not found
          </div>
          <h1 className="mt-5 text-4xl font-medium tracking-[-0.05em] text-[#F3F7FB]">
            This market route does not exist
          </h1>
          <p className="mx-auto mt-4 max-w-[560px] text-sm leading-7 text-[#8EA0B8]">
            The page you requested is missing or the symbol format is invalid. Head back to the workspace and start with a supported ticker.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="rounded-full border border-white/10 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-[#F3F7FB] transition-colors hover:bg-white/[0.04]"
            >
              Open workspace
            </Link>
            <Link
              href="/financials/AAPL"
              className="rounded-full border border-white/10 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-[#F3F7FB] transition-colors hover:bg-white/[0.04]"
            >
              View AAPL financials
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
