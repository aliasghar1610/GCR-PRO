"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, RefreshCw, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/ToastProvider";
import { relativeTime } from "@/lib/relativeTime";

// Mirrors the SCOPES list in lib/auth.ts — plain-language, not raw scope
// strings (§12). openid/email/profile are basic sign-in, not listed as a
// separate "permission".
const SCOPES = [
  "View your courses",
  "Read your coursework and assignments",
  "Read course announcements",
  "View class rosters",
  "Read instructor email addresses and photos",
  "Create draft emails in Gmail (never sends automatically)",
];

export function ConnectedAccountTab({
  connected,
  lastSyncedAt,
}: {
  connected: boolean;
  lastSyncedAt: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleResync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      toast("Synced successfully");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Sync failed", "error");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/account/disconnect", { method: "POST" });
      if (!res.ok) throw new Error();
      setConfirmOpen(false);
      router.refresh();
    } catch {
      toast("Failed to disconnect", "error");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 max-w-md">
      <h2 className="text-base font-semibold text-text-primary">Connected Account</h2>

      <div className="flex items-center gap-2.5 rounded-md bg-bg-subtle px-3.5 py-2.5">
        {connected ? (
          <>
            <CheckCircle2 className="size-4 text-success shrink-0" />
            <span className="text-sm text-text-body">Connected to Google</span>
          </>
        ) : (
          <>
            <XCircle className="size-4 text-danger shrink-0" />
            <span className="text-sm text-text-body">Not connected — sign in again to reconnect</span>
          </>
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-text-body mb-2">Granted permissions</p>
        <ul className="flex flex-col gap-1.5">
          {SCOPES.map((scope) => (
            <li key={scope} className="text-sm text-text-muted">
              · {scope}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-sm text-text-muted">
        {lastSyncedAt ? `Last synced ${relativeTime(lastSyncedAt)}` : "Never synced yet"}
      </p>

      <div className="flex gap-2">
        <button
          onClick={handleResync}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-text-body hover:bg-bg-subtle transition-colors disabled:opacity-60"
        >
          {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Re-sync now
        </button>
        <button
          onClick={() => setConfirmOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-danger/30 px-4 py-2 text-sm font-medium text-danger hover:bg-danger-soft transition-colors"
        >
          Disconnect
        </button>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Disconnect Google account?"
        footer={
          <>
            <button
              onClick={() => setConfirmOpen(false)}
              className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-text-body hover:bg-bg-subtle transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          </>
        }
      >
        <p className="text-sm text-text-body">
          Classroom sync, the AI Solver, and the Email Writer will stop working until you sign in
          again. Your synced data stays put — this doesn&rsquo;t delete anything.
        </p>
      </Modal>
    </div>
  );
}
