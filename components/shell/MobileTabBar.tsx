"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { NAV_ITEMS, MOBILE_TAB_HREFS } from "./navConfig";

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

export function MobileTabBar() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = NAV_ITEMS.filter((item) => MOBILE_TAB_HREFS.includes(item.href));
  const overflow = NAV_ITEMS.filter((item) => !MOBILE_TAB_HREFS.includes(item.href));

  return (
    <>
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-[rgba(15,31,61,.35)]"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute bottom-16 left-3 right-3 rounded-lg bg-bg-card border border-border shadow-pop py-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            {overflow.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-body hover:bg-bg-subtle"
                >
                  <Icon className="size-[18px]" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 flex items-stretch bg-bg-card border-t border-border h-16">
        {primary.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px]",
                active ? "text-accent" : "text-text-muted"
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen((o) => !o)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] text-text-muted"
        >
          {moreOpen ? <X className="size-5" /> : <MoreHorizontal className="size-5" />}
          More
        </button>
      </nav>
    </>
  );
}
