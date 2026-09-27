"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { chatBlocks } from "@/lib/chat-blocks";

import Image from "next/image";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { CompanyLogo } from "./company-logo";
import { safeUrl } from "@/lib/research";
import type { ChatMessage, ChatVisual } from "./saved-conversations";

function RichText({ content }: { content: string }) {
  return <div className="rich-answer-text"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
    a: ({href,children}) => { const url = safeUrl(href); return url ? <a href={url} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>; },
    table: ({children}) => <div className="chat-table-scroll"><table>{children}</table></div>,
    img: () => null,
  }}>{content}</ReactMarkdown></div>;
}

function ComparisonVisual({ visual }: { visual: Extract<ChatVisual, { type: "comparison" }> }) {
  const currency = visual.companies[0]?.currency;
  const charts = [
    { key: "revenue", title: "Revenue", color: "#00c805", formatter: (value: number) => new Intl.NumberFormat("en-US", {style:"currency",currency:currency || "USD",notation:"compact",maximumFractionDigits:2}).format(value) },
    { key: "marketCap", title: "Market cap", color: "#64b5f6", formatter: (value: number) => new Intl.NumberFormat("en-US", {style:"currency",currency:currency || "USD",notation:"compact",maximumFractionDigits:2}).format(value) },
    { key: "pe", title: "Trailing P/E", color: "#b59af5", formatter: (value: number) => `${value.toFixed(1)}×` },
    { key: "margin", title: "Net margin", color: "#58c7c2", formatter: (value: number) => `${value.toFixed(1)}%` },
  ].filter((chart) => !visual.metric || chart.key === visual.metric).map((chart) => ({ ...chart, data: visual.companies.filter((company) => company[chart.key as keyof typeof company] != null && (!["revenue","marketCap"].includes(chart.key) || (!!currency && company.currency === currency))).map((company) => ({ symbol: company.symbol, value: Number(company[chart.key as keyof typeof company]) })) })).filter((chart) => chart.data.length);
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
  return <>{chatBlocks(message.content, message.visuals).map((block,index) => {
    if(block.type === "text") return <RichText key={index} content={block.text} />;
    const visual=block.visual;
    if(visual.type === "comparison") return <ComparisonVisual key={index} visual={visual} />;
    const url=safeUrl(visual.url); const source=safeUrl(visual.sourceUrl);
    return url ? <figure className="chat-source-image" key={index}><Image src={url} alt={visual.alt} fill sizes="(max-width:700px) 92vw,620px" unoptimized />{visual.caption&&<figcaption>{source?<a href={source} target="_blank" rel="noopener noreferrer">{visual.caption} ↗</a>:visual.caption}</figcaption>}</figure>:null;
  })}</>;
}
