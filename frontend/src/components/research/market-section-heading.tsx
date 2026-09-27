export function MarketSectionHeading({ number, title, context }: { number?: string; title: string; context: string }) {
  return <header className="terminal-heading market-section-heading"><h2>{number && <span>{number}</span>}{title}</h2><span>{context}</span></header>;
}
