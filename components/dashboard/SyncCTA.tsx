"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/ToastProvider";

export function SyncCTA() {
  const router = useRouter();
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      toast("Synced successfully");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      setError(message);
      toast(message, "error");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Card className="flex flex-col items-center text-center gap-3 py-12">
      <div className="flex items-center justify-center size-12 rounded-full bg-accent-soft text-accent">
        <RefreshCw className={syncing ? "size-6 animate-spin" : "size-6"} />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Sync your Classroom</h2>
        <p className="mt-1 text-sm text-text-muted max-w-sm">
          Pull in your courses, assignments, grades, and instructor contacts from Google
          Classroom to get started.
        </p>
      </div>
      <button
        onClick={handleSync}
        disabled={syncing}
        className="mt-2 inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
      >
        {syncing && <Loader2 className="size-4 animate-spin" />}
        {syncing ? "Syncing…" : "Sync now"}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </Card>
  );
}
