"use client";

import { useState } from "react";
import { Mail, Send, RotateCcw, Copy, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ProfessorPicker } from "@/components/email/ProfessorPicker";
import { useToast } from "@/components/ui/ToastProvider";
import type { Professor } from "@/lib/professors";

const TONES = {
  formal: "formal and professional",
  polite: "polite and professional",
  concise: "concise and to the point",
  apologetic: "apologetic and understanding",
} as const;
type ToneKey = keyof typeof TONES;

export function EmailWriterClient({
  professors,
  initialGoogleId,
}: {
  professors: Professor[];
  initialGoogleId?: string;
}) {
  const toast = useToast();
  const [googleId, setGoogleId] = useState(initialGoogleId ?? professors[0]?.googleId ?? "");
  const [topic, setTopic] = useState("");
  const [context, setContext] = useState("");
  const [tone, setTone] = useState<ToneKey>("polite");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const professor = professors.find((p) => p.googleId === googleId) ?? null;

  async function handleGenerate() {
    if (!professor?.email) return;
    setLoading(true);
    setError(null);
    setSaveError(null);
    setDraft(null);
    setSaved(false);
    try {
      const res = await fetch("/api/email/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName: professor.name,
          recipientEmail: professor.email,
          topic: context.trim() ? `${topic}\n\nAdditional context: ${context}` : topic,
          tone: TONES[tone],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setDraft(data.draft);
      if (data.gmailDraftId) {
        setSaved(true);
        toast("Saved to Gmail Drafts");
      } else if (data.error) {
        setSaveError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!draft) return;
    await navigator.clipboard.writeText(draft);
    toast("Copied to clipboard");
  }

  if (professors.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Card className="p-0">
          <EmptyState
            icon={Mail}
            title="No professor emails synced yet"
            description="Visit the Professors page, or grant the classroom.profile.emails permission and re-sync."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Email Writer</h1>
        <p className="text-sm text-text-muted mt-0.5">
          Draft a message to an instructor and save it straight to Gmail Drafts.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <Card className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <p className="micro-label text-text-muted">Recipient</p>
            <ProfessorPicker professors={professors} value={googleId} onChange={setGoogleId} />
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="micro-label text-text-muted">Topic</p>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Requesting a short extension"
              className="rounded-md border border-border bg-bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="micro-label text-text-muted">Context (optional)</p>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={4}
              placeholder="Any details worth mentioning…"
              className="rounded-md border border-border bg-bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="micro-label text-text-muted">Tone</p>
            <SegmentedControl
              options={[
                { value: "formal" as const, label: "Formal" },
                { value: "polite" as const, label: "Polite" },
                { value: "concise" as const, label: "Concise" },
                { value: "apologetic" as const, label: "Apologetic" },
              ]}
              value={tone}
              onChange={setTone}
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={!professor || !topic.trim() || loading}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-60"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {loading ? "Drafting…" : draft ? "Regenerate & Save to Gmail Drafts" : "Save to Gmail Drafts"}
          </button>
          {error && <p className="text-sm text-danger">{error}</p>}
        </Card>

        <div className="flex flex-col gap-3">
          <Card className="p-0 overflow-hidden">
            <div className="border-b border-border bg-bg-subtle px-5 py-3 flex flex-col gap-1">
              <p className="text-xs text-text-muted">
                <span className="font-medium text-text-body">To:</span> {professor?.email ?? "—"}
              </p>
              <p className="text-xs text-text-muted">
                <span className="font-medium text-text-body">Subject:</span>{" "}
                {topic.trim() ? `Re: ${topic}` : "—"}
              </p>
            </div>
            <div className="p-5 min-h-[16rem]">
              {draft ? (
                <p className="text-sm text-text-body whitespace-pre-wrap leading-relaxed">{draft}</p>
              ) : (
                <p className="text-sm text-text-muted">
                  Your drafted email will appear here once generated.
                </p>
              )}
            </div>
          </Card>

          {draft && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerate}
                className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-2 text-sm font-medium text-text-body hover:bg-bg-subtle transition-colors"
              >
                <RotateCcw className="size-4" /> Regenerate
              </button>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-2 text-sm font-medium text-text-body hover:bg-bg-subtle transition-colors"
              >
                <Copy className="size-4" /> Copy
              </button>
            </div>
          )}

          {saved && (
            <div className="flex items-center gap-2.5 rounded-md bg-success-soft px-3.5 py-2.5 text-sm text-success">
              <CheckCircle2 className="size-4 shrink-0" />
              Saved to Gmail Drafts — review and send it yourself.
              <a
                href="https://mail.google.com/mail/u/0/#drafts"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 font-medium hover:underline shrink-0"
              >
                Open Gmail <ExternalLink className="size-3.5" />
              </a>
            </div>
          )}
          {saveError && (
            <div className="rounded-md bg-warning-soft px-3.5 py-2.5 text-sm text-warning">
              {saveError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
