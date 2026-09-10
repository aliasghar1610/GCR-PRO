"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { Settings, Shield, LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

export function TopBarAccountMenu() {
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
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
        aria-label="Account menu"
        aria-expanded={open}
      >
        <Avatar name={name} image={session?.user?.image} size={32} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 w-52 rounded-lg bg-bg-card border border-border shadow-pop py-1.5 text-sm z-30">
          <div className="px-3 py-2 border-b border-border">
            <p className="font-medium text-text-primary truncate">{name}</p>
            <p className="text-xs text-text-muted truncate">{session?.user?.email}</p>
          </div>
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
    </div>
  );
}
