"use client";
import { useEffect } from "react";
import { restoreAppearance } from "./appearance-settings";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, Telescope, Newspaper, Building2, Star, Bookmark, CalendarDays, Bell, Columns3, Wallet, Settings } from "lucide-react";
import type { Company } from "@/lib/research";
import { CompanySearch } from "./company-search";
import { AlertBell } from "./alert-bell";
import { MobileNavigation } from "./mobile-navigation";
export type WorkspaceView = "Markets" | "Small CAP" | "News" | "Company" | "Watchlist" | "Saved research" | "Calendar" | "Alerts";
const destinations = [{label:"Markets",icon:BarChart3}, {label:"Small CAP",icon:Telescope}, {label:"News",icon:Newspaper}, {label:"Company",icon:Building2}, {label:"Watchlist",icon:Star}, {label:"Calendar",icon:CalendarDays}, {label:"Alerts",icon:Bell}, {label:"Saved research",icon:Bookmark}] as const;
export function WorkspaceChrome({ active, onNavigate, onSelect }: { active: string; onNavigate?: (view:WorkspaceView)=>void; onSelect?:(company:Company)=>void }) {
 useEffect(()=>{restoreAppearance();},[]);
 const router=useRouter();
 const navigate=(view:WorkspaceView)=>{if(onNavigate)onNavigate(view);else router.push(`/?view=${encodeURIComponent(view)}`);};
 return <><header className="research-header"><button className="research-brand" onClick={()=>navigate("Markets")} aria-label="Marketly markets"><span className="brand-mark"><i/><i/><i/></span>marketly<span className="brand-period">.</span></button><CompanySearch onSelect={company=>onSelect?onSelect(company):router.push(`/?symbol=${encodeURIComponent(company.symbol)}`)}/><AlertBell onOpen={()=>navigate("Alerts")}/><div className="header-context"><Link href="/settings">Profile & settings</Link><Link href="/portfolio">Portfolio</Link><Link href="/compare">Compare</Link></div></header>
 <nav className="research-nav" aria-label="Primary navigation"><div>{destinations.map(({label,icon:Icon})=><button key={label} className={active===label?"active":""} aria-current={active===label?"page":undefined} onClick={()=>navigate(label)}><Icon size={16}/>{label}</button>)}{([{label:"Compare",href:"/compare",icon:Columns3},{label:"Portfolio",href:"/portfolio",icon:Wallet},{label:"Settings",href:"/settings",icon:Settings}] as const).map(({label,href,icon:Icon})=><Link key={href} href={href} className={`research-nav-link ${active===label?"active":""}`} aria-current={active===label?"page":undefined}><Icon size={16}/>{label}</Link>)}</div><span><span className="device-dot"/>Research workspace<br/>US equities</span></nav><MobileNavigation view={active} onNavigate={navigate}/></>;
}
export function WorkspaceShell({active,children}:{active:string;children:ReactNode}) { return <div className="research-app unified-workspace"><WorkspaceChrome active={active}/><div className="research-main">{children}</div></div>; }
