import type { AnalysisLensData } from "./types";

type AnalysisLensProps = {
  lens: AnalysisLensData;
};

function toneClass(tone: AnalysisLensData["lenses"][number]["tone"]) {
  if (tone === "positive") {
    return "text-[#22C55E]";
  }
  if (tone === "negative") {
    return "text-[#EF4444]";
  }
  return "text-[#DDE7F0]";
}

export function AnalysisLens({ lens }: AnalysisLensProps) {
  return (
    <section className="grid gap-4 rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(12,19,29,0.96),rgba(8,12,18,0.96))] p-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#9FB3C8]">Reasoning Lens</p>
          <span className="text-[10px] uppercase tracking-[0.22em] text-[#6F8197]">
            {lens.analysisSource}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[22px] border border-white/8 bg-[#0F141C] p-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#6F8197]">Business Model</p>
            <p className="mt-2 text-base font-medium text-[#F3F7FB]">{lens.businessModel}</p>
            <p className="mt-2 text-sm text-[#8EA0B8]">Confidence {lens.businessConfidence}</p>
          </div>
          <div className="rounded-[22px] border border-white/8 bg-[#0F141C] p-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#6F8197]">Asymmetry</p>
            <p className="mt-2 text-base font-medium text-[#F3F7FB]">{lens.asymmetry}</p>
            <p className="mt-2 text-sm text-[#8EA0B8]">Fact coverage {lens.factCoverage}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {lens.lenses.map((item) => (
            <div key={item.label} className="rounded-[22px] border border-white/8 bg-[#0F141C] p-4">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#6F8197]">{item.label}</p>
              <p className={`mt-2 text-base font-medium ${toneClass(item.tone)}`}>{item.value}</p>
              {item.detail ? <p className="mt-2 text-sm leading-6 text-[#8EA0B8]">{item.detail}</p> : null}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-[22px] border border-white/8 bg-[#0F141C] p-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[#6F8197]">Lifecycle View</p>
          <p className="mt-2 text-sm leading-6 text-[#F3F7FB]">
            {lens.lifecyclePattern ?? "No specialized lifecycle model attached."}
          </p>
          {lens.lifecycleFocus ? (
            <p className="mt-2 text-sm leading-6 text-[#8EA0B8]">{lens.lifecycleFocus}</p>
          ) : null}
        </div>

        <div className="rounded-[22px] border border-white/8 bg-[#0F141C] p-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[#6F8197]">Key Catalysts</p>
          {lens.catalysts.length > 0 ? (
            <ul className="mt-3 space-y-3">
              {lens.catalysts.map((item) => (
                <li key={item.title} className="text-sm leading-6 text-[#DDE7F0]">
                  <span className={toneClass(item.tone)}>{item.title}</span>
                  <span className="text-[#8EA0B8]"> • {item.importance} • {item.type.replace(/_/g, " ")}</span>
                  <p className="mt-1 text-sm leading-6 text-[#8EA0B8]">{item.rationale}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm leading-6 text-[#8EA0B8]">No material catalysts were extracted.</p>
          )}
        </div>

        {lens.historicalContext.length > 0 ? (
          <div className="rounded-[22px] border border-white/8 bg-[#0F141C] p-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#6F8197]">Historical Context Needed</p>
            <ul className="mt-3 space-y-2">
              {lens.historicalContext.map((item) => (
                <li key={item} className="text-sm leading-6 text-[#8EA0B8]">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {lens.pastDrivers.length > 0 || lens.upcomingDrivers.length > 0 ? (
          <div className="rounded-[22px] border border-white/8 bg-[#0F141C] p-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#6F8197]">Trajectory Drivers</p>
            {lens.pastDrivers.length > 0 ? (
              <>
                <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-[#8EA0B8]">What likely drove it before</p>
                <ul className="mt-2 space-y-2">
                  {lens.pastDrivers.map((item) => (
                    <li key={item} className="text-sm leading-6 text-[#DDE7F0]">
                      {item}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {lens.upcomingDrivers.length > 0 ? (
              <>
                <p className="mt-4 text-[10px] uppercase tracking-[0.2em] text-[#8EA0B8]">What could drive it next</p>
                <ul className="mt-2 space-y-2">
                  {lens.upcomingDrivers.map((item) => (
                    <li key={item} className="text-sm leading-6 text-[#DDE7F0]">
                      {item}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ) : null}

        {lens.horizons.length > 0 ? (
          <div className="rounded-[22px] border border-white/8 bg-[#0F141C] p-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#6F8197]">Multi-Horizon View</p>
            <div className="mt-3 space-y-4">
              {lens.horizons.map((item) => (
                <div key={item.horizon} className="border-t border-white/8 pt-4 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-[#F3F7FB]">{item.horizon}</p>
                    <span className="rounded-full border border-white/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[#8EA0B8]">
                      {item.outlook}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#8EA0B8]">{item.focus}</p>
                  {item.drivers.length > 0 ? (
                    <p className="mt-2 text-sm leading-6 text-[#DDE7F0]">
                      Drivers: {item.drivers.join(", ")}.
                    </p>
                  ) : null}
                  {item.risks.length > 0 ? (
                    <p className="mt-1 text-sm leading-6 text-[#DDE7F0]">
                      Risks: {item.risks.join(", ")}.
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
