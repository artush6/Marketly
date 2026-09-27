import type { ChatVisual } from "@/components/research/saved-conversations";
export type ChatBlock = { type: "text"; text: string } | { type: "visual"; visual: ChatVisual };
export function chatBlocks(content: string, visuals: ChatVisual[] = []): ChatBlock[] {
  const remaining = visuals.flatMap((visual): ChatVisual[] => visual.type === "comparison" && !visual.metric ? (["revenue","marketCap","pe","margin"] as const).filter((key)=>visual.companies.some((c)=>c[key]!=null)).map((metric)=>({...visual,metric})) : [visual]);
  const paragraphs = content.split(/\n\s*\n/);
  const blocks: ChatBlock[] = [];
  for (const text of paragraphs) {
    blocks.push({type:"text",text});
    for (let index=0;index<remaining.length;index++) {
      const v=remaining[index];
      const expression = v.type === "comparison" ? ({revenue:/revenue|sales/i,marketCap:/market cap|company size/i,pe:/P\/E|valuation|earnings multiple/i,margin:/margin|profitability/i}[v.metric || "revenue"]) : /news|article|headline/i;
      if (expression.test(text) && !/^\s*#{1,6}[^\n]*$/.test(text)) { blocks.push({type:"visual",visual:v});remaining.splice(index,1);break; }
    }
  }
  // Unreferenced visuals remain individually labelled, preserving old saved answers.
  remaining.forEach((visual)=>blocks.push({type:"visual",visual}));
  return blocks;
}
