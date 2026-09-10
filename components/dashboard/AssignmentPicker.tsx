"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { CourseBadge } from "@/components/ui/CourseBadge";
import { cn } from "@/lib/cn";

export type AssignmentOption = { id: string; title: string; courseId: string; courseName: string };

export function AssignmentPicker({
  assignments,
  value,
  onChange,
}: {
  assignments: AssignmentOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = assignments.find((a) => a.id === value);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? assignments.filter(
          (a) => a.title.toLowerCase().includes(q) || a.courseName.toLowerCase().includes(q)
        )
      : assignments;
    const byCoure = new Map<string, AssignmentOption[]>();
    for (const a of matches) {
      const list = byCoure.get(a.courseName) ?? [];
      list.push(a);
      byCoure.set(a.courseName, list);
    }
    return Array.from(byCoure.entries());
  }, [assignments, query]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-bg-card px-3 py-2.5 text-sm hover:bg-bg-subtle transition-colors"
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0">
            <CourseBadge courseId={selected.courseId} name={selected.courseName} size={22} />
            <span className="truncate text-text-primary">{selected.title}</span>
          </span>
        ) : (
          <span className="text-text-muted">Select an assignment…</span>
        )}
        <ChevronDown className="size-4 text-text-muted shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={close} />
          <div className="absolute left-0 right-0 mt-1.5 rounded-lg bg-bg-card border border-border shadow-pop z-30 max-h-80 flex flex-col overflow-hidden">
            <div className="relative border-b border-border shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-muted" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search assignments…"
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-transparent focus:outline-none"
              />
            </div>
            <div className="overflow-y-auto">
              {grouped.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-text-muted">No assignments found.</p>
              ) : (
                grouped.map(([courseName, items]) => (
                  <div key={courseName} className="py-1.5">
                    <p className="micro-label text-text-muted px-3 pb-1">{courseName}</p>
                    {items.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          onChange(a.id);
                          close();
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-bg-subtle truncate",
                          a.id === value ? "text-accent font-medium" : "text-text-body"
                        )}
                      >
                        {a.title}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
