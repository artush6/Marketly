"use client";

import Link from "next/link";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="terminal-grid pointer-events-none absolute inset-0 opacity-40" />
      <main className="relative mx-auto flex min-h-screen w-full max-w-[980px] items-center px-4 py-24 sm:px-6 lg:px-10">
        <section className="w-full rounded-[34px] border border-[#F36A6A]/16 bg-[linear-gradient(145deg,rgba(23,12,15,0.98),rgba(9,12,18,0.96))] p-8">
          <div className="inline-flex items-center rounded-full border border-[#F36A6A]/18 bg-[#F36A6A]/10 px-4 py-1.5 text-[10px] uppercase tracking-[0.3em] text-[#FFC9C9]">
            Workspace error
          </div>
          <h1 className="mt-5 text-4xl font-medium tracking-[-0.05em] text-[#F3F7FB]">
            Something broke in the frontend flow
          </h1>
          <p className="mt-4 max-w-[620px] text-sm leading-7 text-[#C6A5A5]">
            The route failed to render cleanly. You can retry the current state or go back to the analysis workspace.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-white/10 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-[#F3F7FB] transition-colors hover:bg-white/[0.04]"
            >
              Try again
            </button>
            <Link
              href="/"
              className="rounded-full border border-white/10 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-[#F3F7FB] transition-colors hover:bg-white/[0.04]"
            >
              Go home
            </Link>
          </div>
          {error.message ? (
            <pre className="mt-6 overflow-x-auto rounded-[24px] border border-white/8 bg-black/20 p-4 text-xs leading-6 text-[#D9B2B2]">
              {error.message}
            </pre>
          ) : null}
        </section>
      </main>
    </div>
  );
}
