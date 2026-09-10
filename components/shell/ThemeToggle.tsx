"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Server can't know the client's resolved (system) theme — avoid a
  // hydration mismatch by rendering a neutral placeholder until mounted.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="flex items-center justify-center size-9 rounded-md text-text-muted hover:bg-bg-subtle hover:text-text-body transition-colors focus-visible:outline-2 focus-visible:outline-accent"
      aria-label="Toggle theme"
    >
      {!mounted ? (
        <span className="size-[18px]" />
      ) : resolvedTheme === "dark" ? (
        <Sun className="size-[18px]" />
      ) : (
        <Moon className="size-[18px]" />
      )}
    </button>
  );
}
