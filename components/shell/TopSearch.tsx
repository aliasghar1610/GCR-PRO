"use client";

import { Search } from "lucide-react";
import { useCommandPalette } from "./CommandPaletteProvider";

// The inline field is a trigger for the ⌘K command palette (§11), not a
// separate search surface — actual results only ever render inside the modal.
export function TopSearch() {
  const { open } = useCommandPalette();

  return (
    <button
      onClick={open}
      className="flex w-full max-w-[520px] items-center gap-2 rounded-md border border-border bg-bg-subtle px-3 py-2 text-sm text-text-muted hover:bg-bg-card transition-colors focus-visible:outline-2 focus-visible:outline-accent"
    >
      <Search className="size-4 shrink-0" />
      <span className="flex-1 text-left">Search courses, assignments…</span>
      <kbd className="hidden sm:inline-flex items-center rounded border border-border-strong bg-bg-card px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
        ⌘K
      </kbd>
    </button>
  );
}
