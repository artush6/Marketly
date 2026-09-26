"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type SelectOption = { value: string; label: string };

export function StyledSelect({ value, options, onChange, ariaLabel }: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const current = options.find((option) => option.value === value) ?? options[0];
  const move = (offset: number) => {
    const index = Math.max(0, options.findIndex((option) => option.value === value));
    onChange(options[(index + offset + options.length) % options.length].value);
  };
  return <div className={`styled-select ${open ? "open" : ""}`} ref={root}>
    <button type="button" className="styled-select-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open}
      onClick={() => setOpen((value) => !value)}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); move(event.key === "ArrowDown" ? 1 : -1); }
        if (event.key === "Escape") setOpen(false);
      }}>
      <span>{current?.label}</span><ChevronDown size={13} />
    </button>
    {open && <div className="styled-select-menu" role="listbox" aria-label={ariaLabel}>
      {options.map((option) => <button type="button" role="option" aria-selected={option.value === value} key={option.value}
        onClick={() => { onChange(option.value); setOpen(false); }}>
        <span>{option.label}</span>{option.value === value && <Check size={12} />}
      </button>)}
    </div>}
  </div>;
}
