export default function Loading() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="terminal-grid pointer-events-none absolute inset-0 opacity-40" />
      <main className="relative mx-auto flex min-h-screen w-full max-w-[1180px] items-center px-4 py-24 sm:px-6 lg:px-10">
        <section className="w-full rounded-[34px] border border-white/8 bg-[linear-gradient(145deg,rgba(13,22,33,0.98),rgba(8,12,18,0.96))] p-8">
          <div className="max-w-[720px]">
            <div className="inline-flex items-center rounded-full border border-[#3DD9B3]/18 bg-[#3DD9B3]/10 px-4 py-1.5 text-[10px] uppercase tracking-[0.3em] text-[#9CEBD8]">
              Loading workspace
            </div>
            <h1 className="mt-5 text-4xl font-medium tracking-[-0.05em] text-[#F3F7FB]">
              Building your market view
            </h1>
            <p className="mt-4 max-w-[560px] text-sm leading-7 text-[#8EA0B8]">
              Pulling the workspace shell, route state, and supporting financial context into place.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-36 animate-pulse rounded-[24px] border border-white/8 bg-white/[0.03]"
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
