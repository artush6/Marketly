type BullBearProps = {
  bullPoints: string[];
  bearPoints: string[];
};

function PointsColumn({
  title,
  accentClass,
  points,
  emptyLabel,
}: {
  title: string;
  accentClass: string;
  points: string[];
  emptyLabel?: string;
}) {
  return (
    <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(12,19,29,0.96),rgba(8,12,18,0.96))] p-5">
      <h3 className={`text-[11px] uppercase tracking-[0.24em] ${accentClass}`}>{title}</h3>
      {points.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {points.map((point) => (
            <li key={point} className="text-sm leading-6 text-[#DDE7F0]">
              {point}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm leading-6 text-[#6B7280]">{emptyLabel ?? "Data is missing."}</p>
      )}
    </div>
  );
}

export function BullBear({ bullPoints, bearPoints }: BullBearProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <PointsColumn title="Bull Case" accentClass="text-[#22C55E]" points={bullPoints} emptyLabel="No explicit upside case was generated." />
      <PointsColumn title="Bear Case" accentClass="text-[#EF4444]" points={bearPoints} emptyLabel="No explicit downside case was generated." />
    </div>
  );
}
