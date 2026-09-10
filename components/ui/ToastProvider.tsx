"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, XCircle, Info } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastStatus = "success" | "error" | "info";
type Toast = { id: number; message: string; status: ToastStatus };

const ToastContext = createContext<((message: string, status?: ToastStatus) => void) | null>(null);

const ICONS: Record<ToastStatus, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const RAIL: Record<ToastStatus, string> = {
  success: "border-l-success",
  error: "border-l-danger",
  info: "border-l-accent",
};

const ICON_COLOR: Record<ToastStatus, string> = {
  success: "text-success",
  error: "text-danger",
  info: "text-accent",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((message: string, status: ToastStatus = "success") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, status }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]"
      >
        {toasts.map((t) => {
          const Icon = ICONS[t.status];
          return (
            <div
              key={t.id}
              className={cn(
                "flex items-center gap-2.5 rounded-lg bg-bg-card border border-border shadow-pop pl-3 pr-4 py-3 border-l-[3px] text-sm text-text-body",
                RAIL[t.status]
              )}
            >
              <Icon className={cn("size-4 shrink-0", ICON_COLOR[t.status])} />
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
