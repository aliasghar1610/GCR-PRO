"use client";

import { useEffect, useRef, useState } from "react";

type SearchResults = {
  courses: { id: string; name: string }[];
  assignments: { id: string; title: string; courseName: string }[];
  announcements: { id: string; text: string | null; courseName: string }[];
};

const EMPTY: SearchResults = { courses: [], assignments: [], announcements: [] };

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) return;

    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        setResults(await res.json());
        setOpen(true);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const hasResults =
    results.courses.length > 0 ||
    results.assignments.length > 0 ||
    results.announcements.length > 0;

  return (
    <div className="relative w-64">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.trim() && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search courses, assignments..."
        className="border rounded px-3 py-1.5 text-sm w-full bg-[var(--background)] text-[var(--foreground)]"
      />
      {open && query.trim() && (
        <div className="absolute right-0 mt-1 w-80 border rounded bg-[var(--background)] text-[var(--foreground)] shadow-lg text-sm max-h-96 overflow-y-auto z-10">
          {!hasResults ? (
            <div className="p-3 text-gray-500">No results.</div>
          ) : (
            <>
              {results.courses.length > 0 && (
                <div className="p-2">
                  <div className="text-xs font-medium text-gray-400 px-1">Courses</div>
                  {results.courses.map((c) => (
                    <div key={c.id} className="px-1 py-1">{c.name}</div>
                  ))}
                </div>
              )}
              {results.assignments.length > 0 && (
                <div className="p-2 border-t">
                  <div className="text-xs font-medium text-gray-400 px-1">Assignments</div>
                  {results.assignments.map((a) => (
                    <div key={a.id} className="px-1 py-1">
                      {a.title} <span className="text-gray-400">— {a.courseName}</span>
                    </div>
                  ))}
                </div>
              )}
              {results.announcements.length > 0 && (
                <div className="p-2 border-t">
                  <div className="text-xs font-medium text-gray-400 px-1">Announcements</div>
                  {results.announcements.map((a) => (
                    <div key={a.id} className="px-1 py-1">
                      {(a.text ?? "").slice(0, 60)} <span className="text-gray-400">— {a.courseName}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
