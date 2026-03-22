type BullBearProps = {
  bullPoints: string[];
  bearPoints: string[];
};

function PointsColumn({
  title,
  accentClass,
  points,
}: {
  title: string;
  accentClass: string;
  points: string[];
}) {
  return (
    <div className="border border-white/8 bg-[#0F141C] p-5">
      <h3 className={`text-[11px] uppercase tracking-[0.24em] ${accentClass}`}>{title}</h3>
      {points.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {points.map((point) => (
            <li key={point} className="text-sm leading-6 text-[#D1D5DB]">
              {point}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm leading-6 text-[#6B7280]">Data is missing.</p>
      )}
    </div>
  );
}

export function BullBear({ bullPoints, bearPoints }: BullBearProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <PointsColumn title="Bull Case" accentClass="text-[#22C55E]" points={bullPoints} />
      <PointsColumn title="Bear Case" accentClass="text-[#EF4444]" points={bearPoints} />
    </div>
  );
}
