export default function FinancialsLoading() {
  return (
    <section className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(12,19,29,0.96),rgba(8,12,18,0.96))] p-5">
      <div className="h-6 w-40 animate-pulse rounded-full bg-white/[0.05]" />
      <div className="mt-4 h-12 w-72 animate-pulse rounded-full bg-white/[0.05]" />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-[24px] border border-white/8 bg-white/[0.03]"
          />
        ))}
      </div>
    </section>
  );
}
