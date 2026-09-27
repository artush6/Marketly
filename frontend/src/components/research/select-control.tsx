"use client";
import { Children, isValidElement, type ReactNode } from "react";
import { StyledSelect } from "./styled-select";
/** Adapt declarative options to Marketly's single shared selector. */
export function SelectControl({value,onChange,children,ariaLabel="Select option"}:{value:string|number;onChange:(event:{target:{value:string}})=>void;children:ReactNode;ariaLabel?:string}) {
  const options=Children.toArray(children).flatMap((child)=>{
    if(!isValidElement<{value?:string|number;children:ReactNode}>(child))return[];
    const label=Children.toArray(child.props.children).join("");
    return [{value:String(child.props.value??label),label}];
  });
  return <StyledSelect ariaLabel={ariaLabel} value={String(value)} options={options} onChange={(next)=>onChange({target:{value:next}})}/>;
}
