"use client";
import {useEffect,useRef,useState} from "react";
export function DeferredSection({id,title,children}:{id:string;title:string;children:React.ReactNode}) {
  const root=useRef<HTMLElement>(null);const [visible,setVisible]=useState(false);
  useEffect(()=>{const observer=new IntersectionObserver(([entry])=>{if(entry.isIntersecting){setVisible(true);observer.disconnect();}},{rootMargin:"350px"});if(root.current)observer.observe(root.current);return()=>observer.disconnect();},[]);
  return <section ref={root} id={id} className="ticker-anchor-section">{visible?children:<div className="research-section"><h2>{title}</h2><p className="disclosure">Loads when you reach this section.</p></div>}</section>;
}
