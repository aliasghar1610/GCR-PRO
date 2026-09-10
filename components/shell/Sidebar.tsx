"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/ui/Logo";
import { NAV_ITEMS } from "./navConfig";
import { UserMenu } from "./UserMenu";

const STORAGE_KEY = "gcrpro-sidebar-collapsed";

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      // Reading persisted client-only state on mount — same justified
      // pattern as ThemeToggle's hydration guard.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // Private browsing / storage disabled — default to expanded.
    }
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Ignore — collapse state just won't persist this session.
      }
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "hidden md:flex md:w-16 flex-col shrink-0 bg-bg-sidebar transition-[width] duration-200 ease-out",
        !collapsed && "lg:w-60"
      )}
    >
      <div className="flex items-center gap-2.5 px-4 h-16 shrink-0">
        <Logo size={32} />
        <div className={cn("min-w-0", collapsed ? "hidden" : "hidden lg:block")}>
          <p className="text-sm font-semibold text-text-inverse leading-tight truncate">
            GCR PRO
          </p>
          <p className="text-[11px] text-text-sidebar leading-tight truncate">
            Academic Portal
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-white"
                  : "text-text-sidebar hover:bg-bg-sidebar-hover hover:text-text-inverse"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="size-[18px] shrink-0" />
              <span className={cn("truncate", collapsed ? "hidden" : "hidden lg:inline")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <button
        onClick={toggle}
        className="hidden lg:flex items-center gap-2 mx-3 mb-2 px-3 py-2 rounded-lg text-text-sidebar hover:bg-bg-sidebar-hover hover:text-text-inverse text-sm transition-colors"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
        {!collapsed && <span>Collapse</span>}
      </button>

      <UserMenu collapsed={collapsed} />
    </aside>
  );
}
