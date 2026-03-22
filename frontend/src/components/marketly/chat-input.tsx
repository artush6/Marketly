"use client";

import { useState } from "react";
import { ArrowUp } from "lucide-react";

type ChatInputProps = {
  onSubmit: (value: string) => void;
  compact?: boolean;
  floating?: boolean;
};

export function ChatInput({
  onSubmit,
  compact = false,
  floating = true,
}: ChatInputProps) {
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
        <div
          className={`mx-auto flex items-center gap-3 rounded-[22px] border border-white/10 bg-[#121821] px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.22)] transition-all ${
            compact ? "max-w-[1180px]" : "max-w-[760px]"
          }`}
        >
          <div className="hidden shrink-0 text-[10px] tracking-[0.24em] text-[#6B7280] uppercase sm:block">
            AI Terminal
          </div>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Ask about any company…"
            className="h-10 flex-1 bg-transparent text-sm text-[#E5E7EB] outline-none placeholder:text-[#6B7280]"
          />
          <button
            type="button"
            onClick={submit}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-[#E5E7EB] transition-colors hover:bg-white/[0.06]"
            aria-label="Submit query"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
