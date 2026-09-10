"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { ChevronUp, Settings, Shield, LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";

export function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { data: session } = useSession();
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

  const name = session?.user?.name ?? "Student";

  return (
    <div ref={ref} className="relative border-t border-white/10 p-3">
      {open && (
        <div className="absolute bottom-full left-3 right-3 mb-2 rounded-lg bg-bg-card border border-border shadow-pop py-1.5 text-sm">
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-2 px-3 py-2 text-text-body hover:bg-bg-subtle"
            onClick={() => setOpen(false)}
          >
            <Settings className="size-4" /> Settings
          </Link>
          <Link
            href="/privacy"
            className="flex items-center gap-2 px-3 py-2 text-text-body hover:bg-bg-subtle"
            onClick={() => setOpen(false)}
          >
            <Shield className="size-4" /> Privacy
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex w-full items-center gap-2 px-3 py-2 text-danger hover:bg-bg-subtle text-left"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-bg-sidebar-hover transition-colors",
          collapsed && "justify-center"
        )}
        aria-label="Account menu"
        aria-expanded={open}
      >
        <Avatar name={name} image={session?.user?.image} size={32} />
        {!collapsed && (
          <>
            <span className="flex flex-col items-start min-w-0 flex-1">
              <span className="text-sm font-medium text-text-inverse truncate w-full text-left">
                {name}
              </span>
              <span className="text-xs text-text-sidebar truncate w-full text-left">
                Student
              </span>
            </span>
            <ChevronUp
              className={cn(
                "size-4 text-text-sidebar transition-transform shrink-0",
                open && "rotate-180"
              )}
            />
          </>
        )}
      </button>
    </div>
  );
}
