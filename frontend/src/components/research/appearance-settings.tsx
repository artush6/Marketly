"use client";
import { useEffect, useState } from "react";
import { userStorage } from "@/lib/user-storage";
export function restoreAppearance() { try { const saved=JSON.parse(userStorage.getItem("marketly.appearance")||"{}");document.documentElement.dataset.density=saved.density==="compact"?"compact":"comfortable";document.documentElement.dataset.textSize=saved.textSize==="large"?"large":"default"; } catch { /* Defaults remain readable. */ } }
export function AppearanceSettings() {const [density,setDensity]=useState("comfortable");const [textSize,setTextSize]=useState("default");useEffect(()=>{try{const v=JSON.parse(userStorage.getItem("marketly.appearance")||"{}");setDensity(v.density==="compact"?"compact":"comfortable");setTextSize(v.textSize==="large"?"large":"default");}catch{}},[]);
 function update(d:string,t:string){setDensity(d);setTextSize(t);userStorage.setItem("marketly.appearance",JSON.stringify({density:d,textSize:t}));restoreAppearance();}
 return <section className="appearance-panel" id="appearance"><h2>Appearance</h2><p className="disclosure">Graphite theme · mint accents. Adjust readability across your research workspace.</p><div><span>Table density</span><div className="ui-toolbar">{["comfortable","compact"].map(v=><button key={v} aria-pressed={density===v} onClick={()=>update(v,textSize)}>{v}</button>)}</div></div><div><span>Text size</span><div className="ui-toolbar">{["default","large"].map(v=><button key={v} aria-pressed={textSize===v} onClick={()=>update(density,v)}>{v}</button>)}</div></div></section>;
}
