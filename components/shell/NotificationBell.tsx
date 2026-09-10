"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";

// No notifications feed exists in the backend yet (AlertLog only drives
// email alerts) — this is honest empty-state chrome, not a stub for data
// that's coming. Wire it up if/when an in-app notifications endpoint ships.
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-center size-9 rounded-md text-text-muted hover:bg-bg-subtle hover:text-text-body transition-colors focus-visible:outline-2 focus-visible:outline-accent"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="size-[18px]" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 w-72 rounded-lg bg-bg-card border border-border shadow-pop text-sm z-30">
          <div className="px-3 py-2 border-b border-border font-medium text-text-primary">
            Notifications
          </div>
          <div className="px-4 py-8 text-center text-text-muted">
            No notifications yet.
          </div>
        </div>
      )}
    </div>
  );
}
