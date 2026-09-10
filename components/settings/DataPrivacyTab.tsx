"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { ExternalLink } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

export function DataPrivacyTab({ email }: { email: string }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typedEmail, setTypedEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = typedEmail.trim().toLowerCase() === email.toLowerCase();

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete account");
      }
      await signOut({ callbackUrl: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account");
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <div>
        <h2 className="text-base font-semibold text-text-primary mb-2">Data &amp; Privacy</h2>
        <Link
          href="/privacy"
          className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
        >
          Read our privacy policy <ExternalLink className="size-3.5" />
        </Link>
      </div>

      <div className="border-t border-border pt-5">
        <p className="text-sm font-medium text-text-primary">Delete account</p>
        <p className="text-sm text-text-muted mt-1 mb-3">
          Permanently deletes all your synced data and revokes Google access. This can&rsquo;t be
          undone.
        </p>
        <button
          onClick={() => setConfirmOpen(true)}
          className="inline-flex items-center rounded-md border border-danger/30 px-4 py-2 text-sm font-medium text-danger hover:bg-danger-soft transition-colors"
        >
          Delete my account
        </button>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setTypedEmail("");
          setError(null);
        }}
        title="Delete your account?"
        footer={
          <>
            <button
              onClick={() => setConfirmOpen(false)}
              className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-text-body hover:bg-bg-subtle transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={!canDelete || deleting}
              className="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Permanently delete"}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-body">
            This permanently deletes all your courses, assignments, grades, documents, and quizzes,
            and revokes GCR PRO&rsquo;s access to your Google account. This can&rsquo;t be undone.
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-body">
              Type <span className="font-mono">{email}</span> to confirm
            </label>
            <input
              value={typedEmail}
              onChange={(e) => setTypedEmail(e.target.value)}
              className="rounded-md border border-border bg-bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-danger"
              autoComplete="off"
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      </Modal>
    </div>
  );
}
