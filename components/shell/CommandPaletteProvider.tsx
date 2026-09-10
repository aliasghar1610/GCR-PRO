"use client";

import { createContext, Fragment, useContext, useEffect, useState } from "react";
import { CommandPalette } from "./CommandPalette";

const CommandPaletteContext = createContext<{ open: () => void } | null>(null);

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  // Bumped on every open — used as a key so the palette remounts fresh each
  // time instead of needing an effect to reset its internal state.
  const [instanceKey, setInstanceKey] = useState(0);

  function openPalette() {
    setInstanceKey((k) => k + 1);
    setOpen(true);
  }

  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => {
          if (o) return false;
          setInstanceKey((k) => k + 1);
          return true;
        });
      }
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, []);

  return (
    <CommandPaletteContext.Provider value={{ open: openPalette }}>
      {children}
      <Fragment key={instanceKey}>
        <CommandPalette open={open} onClose={() => setOpen(false)} />
      </Fragment>
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error("useCommandPalette must be used within CommandPaletteProvider");
  return ctx;
}
