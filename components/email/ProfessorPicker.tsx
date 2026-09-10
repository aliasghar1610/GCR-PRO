"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import type { Professor } from "@/lib/professors";
import { cn } from "@/lib/cn";

export function ProfessorPicker({
  professors,
  value,
  onChange,
}: {
  professors: Professor[];
  value: string;
  onChange: (googleId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = professors.find((p) => p.googleId === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-bg-card px-3 py-2.5 text-sm hover:bg-bg-subtle transition-colors"
      >
        {selected ? (
          <span className="flex items-center gap-2.5 min-w-0">
            <Avatar name={selected.name} image={selected.photoUrl} size={24} />
            <span className="truncate text-text-primary">{selected.name}</span>
            <span className="text-text-muted truncate text-xs">{selected.courses[0]?.name}</span>
          </span>
        ) : (
          <span className="text-text-muted">Select a professor…</span>
        )}
        <ChevronDown className="size-4 text-text-muted shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 mt-1.5 rounded-lg bg-bg-card border border-border shadow-pop z-30 max-h-72 overflow-y-auto py-1.5">
            {professors.map((p) => (
              <button
                key={p.googleId}
                type="button"
                onClick={() => {
                  onChange(p.googleId);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-bg-subtle",
                  p.googleId === value && "bg-accent-soft"
                )}
              >
                <Avatar name={p.name} image={p.photoUrl} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-text-primary">{p.name}</span>
                  <span className="block truncate text-xs text-text-muted">
                    {p.courses.map((c) => c.name).join(", ")}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
