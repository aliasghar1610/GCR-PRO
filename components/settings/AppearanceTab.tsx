"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Check, Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/cn";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function AppearanceTab() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex flex-col gap-5 max-w-md">
      <h2 className="text-base font-semibold text-text-primary">Appearance</h2>
      <div className="grid grid-cols-3 gap-3">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = mounted && theme === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={cn(
                "relative flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors",
                active ? "border-accent bg-accent-soft" : "border-border hover:bg-bg-subtle"
              )}
            >
              {active && (
                <span className="absolute top-2 right-2 flex items-center justify-center size-4 rounded-full bg-accent text-white">
                  <Check className="size-2.5" />
                </span>
              )}
              <Icon className="size-5 text-text-body" />
              <span className="text-sm font-medium text-text-body">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
