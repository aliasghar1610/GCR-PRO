"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RefreshCw, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/relativeTime";
import { useToast } from "@/components/ui/ToastProvider";

type SyncState = "idle" | "syncing" | "success" | "failed";

export function SyncIndicator({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState<SyncState>("idle");
  const [syncedAt, setSyncedAt] = useState(lastSyncedAt);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (fadeRef.current) clearTimeout(fadeRef.current);
  }, []);

  async function runSync() {
    if (state === "syncing") return;
    setState("syncing");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setState("success");
      setSyncedAt(new Date().toISOString());
      router.refresh();
      fadeRef.current = setTimeout(() => setState("idle"), 2500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      setState("failed");
      setErrorMessage(message);
      toast(message, "error");
    }
  }

  const label =
    state === "syncing"
      ? "Syncing…"
      : state === "success"
        ? "Synced"
        : state === "failed"
          ? `Sync failed — ${errorMessage ?? "click to retry"}`
          : syncedAt
            ? `Last synced ${relativeTime(syncedAt)}`
            : "Not synced yet — click to sync";

  return (
    <button
      onClick={runSync}
      title={label}
      aria-live="polite"
      aria-label={label}
      className={cn(
        "flex items-center justify-center size-9 rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-accent",
        state === "failed"
          ? "text-danger hover:bg-danger-soft"
          : "text-text-muted hover:bg-bg-subtle hover:text-text-body"
      )}
    >
      {state === "syncing" && <RefreshCw className="size-[18px] animate-spin [animation-duration:1.4s]" />}
      {state === "success" && <Check className="size-[18px]" />}
      {state === "failed" && (
        <span className="relative flex items-center justify-center">
          <AlertCircle className="size-[18px]" />
          <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-danger" />
        </span>
      )}
      {state === "idle" && <RefreshCw className="size-[18px]" />}
    </button>
  );
}
