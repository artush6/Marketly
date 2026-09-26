"use client";

import Image from "next/image";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { CompanyLogo } from "./company-logo";
import { safeUrl } from "@/lib/research";
import type { ChatMessage, ChatVisual } from "./saved-conversations";

function InlineText({ text }: { text: string }) {
  const tickerStopwords = new Set(["AI", "CEO", "CFO", "SEC", "ETF", "USD", "US", "UK", "EU", "IPO", "EPS", "EBIT", "EBITDA", "FCF", "GDP", "CPI", "PCE", "FED", "API", "JSON", "CSV"]);
  const parts = text.split(/(\*\*[^*]+\*\*|\b[A-Z]{2,5}\b|(?:\$|€|£)?\d[\d,.]*(?:%|×|x|B|M|T)?)/g);
  return parts.map((part, index) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (/^\b[A-Z]{2,5}\b$/.test(part) && !tickerStopwords.has(part)) return <span className="ticker-inline" key={index}><CompanyLogo symbol={part} />{part}</span>;
    if (/^(?:\$|€|£)?\d[\d,.]*(?:%|×|x|B|M|T)?$/.test(part)) return <span className="metric-inline" key={index}>{part}</span>;
    return part;
  });
}

function RichText({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flushBullets = () => {
    if (!bullets.length) return;
    blocks.push(<ul key={`list-${blocks.length}`}>{bullets.map((item, index) => <li key={index}><InlineText text={item} /></li>)}</ul>);
    bullets = [];
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) { flushBullets(); return; }
    if (/^[-•]\s+/.test(line)) { bullets.push(line.replace(/^[-•]\s+/, "")); return; }
    flushBullets();
    const cleaned = line.replace(/^#{1,4}\s*/, "");
    const standaloneSection = /^(view|why|main risks?|what would change(?: the view)?|bottom line|recommendation|strategic takeaway)$/i.test(cleaned.replace(/:$/, ""));
    if (/^#{1,4}\s/.test(line) || standaloneSection || (/^[A-Z][^.!?]{2,70}:$/.test(line) && cleaned.split(" ").length < 10)) {
      blocks.push(<h4 key={`heading-${blocks.length}`}><InlineText text={cleaned.replace(/:$/, "")} /></h4>);
      return;
    }
    const callout = /^(recommendation|bottom line|strategic takeaway|my view|main risk|what would change)/i.test(cleaned);
    blocks.push(<p className={callout ? "answer-callout" : ""} key={`paragraph-${blocks.length}`}><InlineText text={cleaned} /></p>);
  });
  flushBullets();
  return <div className="rich-answer-text">{blocks}</div>;
}

function ComparisonVisual({ visual }: { visual: Extract<ChatVisual, { type: "comparison" }> }) {
  const charts = [
    { key: "revenue", title: "Revenue", color: "#f5a24b", formatter: (value: number) => `$${(value / 1e9).toFixed(1)}B` },
    { key: "marketCap", title: "Market cap", color: "#64b5f6", formatter: (value: number) => `$${(value / 1e9).toFixed(1)}B` },
    { key: "pe", title: "Trailing P/E", color: "#b59af5", formatter: (value: number) => `${value.toFixed(1)}×` },
    { key: "margin", title: "Net margin", color: "#58c7c2", formatter: (value: number) => `${value.toFixed(1)}%` },
  ].map((chart) => ({ ...chart, data: visual.companies.filter((company) => company[chart.key as keyof typeof company] != null).map((company) => ({ symbol: company.symbol, value: Number(company[chart.key as keyof typeof company]) })) })).filter((chart) => chart.data.length);
  return (
    <figure className="chat-comparison-visual">
      <figcaption>
        <span>{visual.title}</span>
        <small>Latest available company context</small>
      </figcaption>
      <div className="comparison-company-key">
        {visual.companies.map((company) => <span key={company.symbol}><CompanyLogo symbol={company.symbol} /> <b>{company.symbol}</b>{company.name && <small>{company.name}</small>}</span>)}
      </div>
      <div className="comparison-mini-charts">
        {charts.map((chart) => <div key={chart.key}><strong>{chart.title}</strong><ResponsiveContainer width="100%" height={128}><BarChart data={chart.data} layout="vertical" margin={{ left: 0, right: 12 }}><XAxis type="number" hide /><YAxis type="category" dataKey="symbol" width={46} tick={{ fill: "#969da6", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => [chart.formatter(Number(value)), chart.title]} /><Bar dataKey="value" fill={chart.color} radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div>)}
      </div>
    </figure>
  );
}

export function RichChatMessage({ message }: { message: ChatMessage }) {
  return (
    <>
      <RichText content={message.content} />
      {message.visuals?.map((visual, index) => {
        if (visual.type === "comparison") return <ComparisonVisual visual={visual} key={`comparison-${index}`} />;
        const imageUrl = safeUrl(visual.url);
        const sourceUrl = safeUrl(visual.sourceUrl);
        return imageUrl ? (
          <figure className="chat-source-image" key={`image-${index}`}>
            <Image src={imageUrl} alt={visual.alt} fill sizes="(max-width: 700px) 92vw, 620px" unoptimized />
            {visual.caption && <figcaption>{sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer">{visual.caption} ↗</a> : visual.caption}</figcaption>}
          </figure>
        ) : null;
      })}
    </>
  );
}
