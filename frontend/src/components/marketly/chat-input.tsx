"use client";

import { useId, useState } from "react";
import { ArrowUp } from "lucide-react";

type ChatInputProps = {
  onSubmit: (value: string) => void;
  compact?: boolean;
  floating?: boolean;
  placeholder?: string;
  contextLabel?: string;
  hint?: string;
};

export function ChatInput({
  onSubmit,
  compact = false,
  floating = true,
  placeholder = "Ask about any company, thesis, or catalyst...",
  contextLabel = "AI Workspace",
  hint = "Enter a ticker, a company name, or a follow-up question.",
}: ChatInputProps) {
  const inputId = useId();
  const [value, setValue] = useState("");

  const submit = () => {
    const normalized = value.trim();
    if (!normalized) {
      return;
    }

    onSubmit(normalized);
    setValue("");
  };

  return (
    <div
      className={
        floating
          ? "fixed inset-x-0 bottom-0 z-50 border-t border-white/8 bg-[#0B0F14]/94 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-10"
          : "w-full"
      }
    >
      <div className="mx-auto w-full max-w-[1180px]">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className={`mx-auto rounded-[22px] border border-white/10 bg-[#121821] p-3 shadow-[0_10px_30px_rgba(0,0,0,0.22)] transition-all ${
            compact ? "max-w-[1180px]" : "max-w-[820px]"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-2 pb-3">
            <div className="text-[10px] uppercase tracking-[0.24em] text-[#6B7280]">
              {contextLabel}
            </div>
            <p className="text-[11px] text-[#6B7280]">{hint}</p>
          </div>

          <div className="flex items-center gap-3 px-2 pt-3">
            <label htmlFor={inputId} className="sr-only">
              Stock analysis prompt
            </label>
            <input
              id={inputId}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder={placeholder}
              className="h-11 flex-1 bg-transparent text-sm text-[#E5E7EB] outline-none placeholder:text-[#6B7280]"
            />
            <button
              type="submit"
              disabled={value.trim().length === 0}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-[#E5E7EB] transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:border-white/8 disabled:bg-white/[0.03] disabled:text-[#6B7280]"
              aria-label="Submit analysis query"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
