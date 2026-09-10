"use client";

import { useState } from "react";
import { ChevronDown, Copy, Check } from "lucide-react";
import { cn } from "@/lib/cn";

export function CollapsibleSection({
  title,
  content,
  defaultOpen = true,
}: {
  title: string;
  content: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 bg-bg-subtle text-left"
      >
        <span className="text-sm font-semibold text-text-primary">{title}</span>
        <span className="flex items-center gap-1">
          <span
            onClick={handleCopy}
            role="button"
            tabIndex={0}
            title={`Copy ${title}`}
            className="flex items-center justify-center size-7 rounded-md text-text-muted hover:bg-bg-card hover:text-text-body transition-colors"
          >
            {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          </span>
          <ChevronDown
            className={cn("size-4 text-text-muted transition-transform", open && "rotate-180")}
          />
        </span>
      </button>
      {open && (
        <div className="px-4 py-3 text-sm text-text-body whitespace-pre-wrap leading-relaxed">
          {content}
        </div>
      )}
    </div>
  );
}
