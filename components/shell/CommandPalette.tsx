"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, BookOpen, ClipboardList, Megaphone } from "lucide-react";
import { courseColorClasses, courseInitials } from "@/lib/courseColor";
import { cn } from "@/lib/cn";

type SearchResults = {
  courses: { id: string; name: string }[];
  assignments: { id: string; title: string; courseName: string; courseId: string }[];
  announcements: { id: string; text: string | null; courseName: string; courseId: string }[];
};

const EMPTY: SearchResults = { courses: [], assignments: [], announcements: [] };
const RECENTS_KEY = "gcrpro-recent-searches";
const MAX_RECENTS = 5;

type FlatItem = {
  key: string;
  type: "course" | "assignment" | "announcement";
  primary: string;
  secondary?: string;
  courseId: string;
  href: string;
};

function toGroups(results: SearchResults): { label: string; items: FlatItem[] }[] {
  return [
    {
      label: "Courses",
      items: results.courses.map((c) => ({
        key: `course-${c.id}`,
        type: "course" as const,
        primary: c.name,
        courseId: c.id,
        href: `/dashboard/courses/${c.id}`,
      })),
    },
    {
      label: "Assignments",
      items: results.assignments.map((a) => ({
        key: `assignment-${a.id}`,
        type: "assignment" as const,
        primary: a.title,
        secondary: a.courseName,
        courseId: a.courseId,
        href: `/dashboard/assignments`,
      })),
    },
    {
      label: "Announcements",
      items: results.announcements.map((a) => ({
        key: `announcement-${a.id}`,
        type: "announcement" as const,
        primary: (a.text ?? "").slice(0, 80) || "(no text)",
        secondary: a.courseName,
        courseId: a.courseId,
        href: `/dashboard/courses/${a.courseId}?tab=announcements`,
      })),
    },
  ];
}

function loadRecents(): FlatItem[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecent(item: FlatItem) {
  try {
    const existing = loadRecents().filter((r) => r.key !== item.key);
    const next = [item, ...existing].slice(0, MAX_RECENTS);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // Storage disabled — recents just won't persist this session.
  }
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  // A fresh mount (see CommandPaletteProvider's key) means this initializer
  // runs exactly when the palette opens — no reset-on-open effect needed.
  const [recents] = useState<FlatItem[]>(() => loadRecents());
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 10);
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = "";
    };
  }, [open]);

  function handleQueryChange(value: string) {
    setQuery(value);
    setActiveIndex(0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`);
        if (res.ok) setResults(await res.json());
      } finally {
        setLoading(false);
      }
    }, 200);
  }

  const groups = query.trim() ? toGroups(results) : [{ label: "Recent", items: recents }];
  const flatItems = groups.flatMap((g) => g.items);

  function select(item: FlatItem) {
    saveRecent(item);
    onClose();
    router.push(item.href);
  }

  function onKeydown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flatItems[activeIndex]) select(flatItems[activeIndex]);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  if (!open) return null;

  let runningIndex = -1;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center px-4"
      style={{ paddingTop: "15vh" }}
    >
      <div className="absolute inset-0 bg-[rgba(15,31,61,.35)] backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={onKeydown}
        className="relative w-full max-w-[640px] rounded-lg bg-bg-card shadow-pop flex flex-col max-h-[70vh] overflow-hidden"
      >
        <div className="relative border-b border-border shrink-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search courses, assignments, announcements…"
            className="w-full pl-11 pr-11 py-4 text-sm bg-transparent focus:outline-none text-text-primary placeholder:text-text-muted"
          />
          {loading && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 size-4 animate-spin text-text-muted" />
          )}
        </div>

        <div className="overflow-y-auto flex-1">
          {!query.trim() && recents.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-text-muted">
              Start typing to search courses, assignments, and announcements.
            </p>
          )}
          {query.trim() && flatItems.length === 0 && !loading && (
            <p className="px-4 py-10 text-center text-sm text-text-muted">
              No results for &ldquo;{query}&rdquo;.
            </p>
          )}
          {groups.map((group) => {
            if (group.items.length === 0) return null;
            return (
              <div key={group.label} className="py-1.5">
                <p className="micro-label text-text-muted px-4 pb-1">{group.label}</p>
                {group.items.map((item) => {
                  runningIndex++;
                  return (
                    <ResultRow
                      key={item.key}
                      item={item}
                      active={runningIndex === activeIndex}
                      onSelect={() => select(item)}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 border-t border-border px-4 py-2.5 text-xs text-text-muted shrink-0">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border-strong bg-bg-subtle px-1.5 py-0.5">↑↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border-strong bg-bg-subtle px-1.5 py-0.5">↵</kbd> open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border-strong bg-bg-subtle px-1.5 py-0.5">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}

function ResultRow({
  item,
  active,
  onSelect,
}: {
  item: FlatItem;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = item.type === "course" ? BookOpen : item.type === "assignment" ? ClipboardList : Megaphone;
  const tag = courseColorClasses(item.courseId);
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-2.5 text-left border-l-2",
        active ? "bg-accent-soft border-accent" : "border-transparent hover:bg-bg-subtle"
      )}
    >
      <Icon className="size-4 text-text-muted shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-text-body">{item.primary}</span>
        {item.secondary && <span className="block truncate text-xs text-text-muted">{item.secondary}</span>}
      </span>
      <span
        className={`flex items-center justify-center size-6 rounded text-[10px] font-semibold shrink-0 ${tag.bg} ${tag.text}`}
      >
        {courseInitials(item.secondary ?? item.primary)}
      </span>
    </button>
  );
}
