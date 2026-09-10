"use client";

import { useMemo, useRef, useState } from "react";
import {
  Sparkles,
  Copy,
  Download,
  RotateCcw,
  X,
  FileText,
  Loader2,
  Clock,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { AssignmentPicker, type AssignmentOption } from "@/components/dashboard/AssignmentPicker";
import { DriveAttachButton } from "@/components/DriveAttachButton";
import { useToast } from "@/components/ui/ToastProvider";
import { parseStudyAid } from "@/lib/parseStudyAid";
import { cn } from "@/lib/cn";

type SolverAssignment = AssignmentOption & {
  description: string | null;
  dueDateISO: string | null;
  driveFileIds: string[];
};
type SolverDocument = { id: string; filename: string; wordCount: number | null; pageCount: number | null };

export function SolverClient({
  assignments,
  documents,
  initialAssignmentId,
  initialDocumentId,
  profileName,
  profileRollNumber,
}: {
  assignments: SolverAssignment[];
  documents: SolverDocument[];
  initialAssignmentId?: string;
  initialDocumentId?: string;
  profileName: string;
  profileRollNumber: string;
}) {
  const toast = useToast();
  const [source, setSource] = useState<"assignment" | "document">(
    initialDocumentId ? "document" : "assignment"
  );
  const [assignmentId, setAssignmentId] = useState(
    initialAssignmentId && assignments.some((a) => a.id === initialAssignmentId)
      ? initialAssignmentId
      : (assignments[0]?.id ?? "")
  );
  const [documentId, setDocumentId] = useState(
    initialDocumentId && documents.some((d) => d.id === initialDocumentId)
      ? initialDocumentId
      : (documents[0]?.id ?? "")
  );
  const [attachmentText, setAttachmentText] = useState<string | null>(null);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [studentName, setStudentName] = useState(profileName);
  const [rollNumber, setRollNumber] = useState(profileRollNumber);
  const [downloading, setDownloading] = useState(false);

  const selected = assignments.find((a) => a.id === assignmentId) ?? null;
  const selectedDoc = documents.find((d) => d.id === documentId) ?? null;
  const ready = source === "assignment" ? !!selected : !!selectedDoc;
  const sections = useMemo(() => (result ? parseStudyAid(result) : null), [result]);

  async function handleGenerate() {
    if (!ready) return;
    setLoading(true);
    setError(null);
    setRateLimitMessage(null);
    setResult(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          source === "assignment" ? { assignmentId, attachmentText } : { documentId }
        ),
        signal: controller.signal,
      });
      const data = await res.json();
      if (res.status === 429) {
        setRateLimitMessage(data.error ?? "You've hit the hourly limit — try again later.");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setResult(data.result);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
    setLoading(false);
  }

  async function handleCopyAll() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    toast("Copied to clipboard");
  }

  async function handleDownload() {
    if (!result || !ready) return;
    const title = source === "assignment" ? selected!.title : selectedDoc!.filename;
    const courseName = source === "assignment" ? selected!.courseName : "";
    setDownloading(true);
    try {
      const res = await fetch("/api/format", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName,
          rollNumber,
          subject: courseName,
          courseName,
          title,
          body: result,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to generate document");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/[^a-z0-9]+/gi, "_")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Document downloaded");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to generate document", "error");
    } finally {
      setDownloading(false);
    }
  }

  if (assignments.length === 0 && documents.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Card className="p-0">
          <EmptyState
            icon={Sparkles}
            title="Nothing to work with yet"
            description="Sync your Classroom, or upload a document, to start using the AI Solver."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">AI Solver</h1>
        <p className="text-sm text-text-muted mt-0.5">
          Get a structured study aid — not a final answer — for any assignment.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6 items-start">
        {/* Left — Context */}
        <div className="flex flex-col gap-4">
          {assignments.length > 0 && documents.length > 0 && (
            <SegmentedControl
              options={[
                { value: "assignment" as const, label: "From an assignment" },
                { value: "document" as const, label: "Uploaded document" },
              ]}
              value={source}
              onChange={setSource}
            />
          )}

          {source === "assignment" ? (
            <>
              <Card className="flex flex-col gap-3">
                <p className="micro-label text-text-muted">Assignment</p>
                <AssignmentPicker assignments={assignments} value={assignmentId} onChange={setAssignmentId} />
              </Card>

              {selected && (
                <Card className="flex flex-col gap-1.5">
                  <p className="text-xs text-text-muted">{selected.courseName}</p>
                  <p className="text-sm font-medium text-text-primary">{selected.title}</p>
                  {selected.dueDateISO && (
                    <p className="text-xs text-text-muted">
                      Due{" "}
                      {new Date(selected.dueDateISO).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  )}
                  {selected.description && (
                    <p className="text-sm text-text-body mt-2 line-clamp-4">{selected.description}</p>
                  )}
                </Card>
              )}

              <Card className="flex flex-col gap-3">
                <p className="micro-label text-text-muted">Attachments</p>

                {selected && selected.driveFileIds.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {selected.driveFileIds.map((fileId) => (
                      <div key={fileId} className="flex items-center gap-2 text-sm">
                        <FileText className="size-4 text-text-muted shrink-0" />
                        <a
                          href={`https://drive.google.com/file/d/${fileId}/view`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-text-body hover:text-accent truncate flex-1"
                        >
                          Classroom attachment
                        </a>
                        <span className="inline-flex items-center rounded-full bg-bg-subtle px-2 py-0.5 text-[11px] font-medium text-text-muted shrink-0">
                          Not read by AI
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {attachedFileName && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="size-4 text-success shrink-0" />
                    <span className="text-text-body truncate flex-1">{attachedFileName}</span>
                    <span className="inline-flex items-center rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success shrink-0">
                      Parsed
                    </span>
                  </div>
                )}

                <DriveAttachButton
                  attachedFileName={attachedFileName}
                  onAttached={(text, fileName) => {
                    setAttachmentText(text);
                    setAttachedFileName(fileName);
                  }}
                  onClear={() => {
                    setAttachmentText(null);
                    setAttachedFileName(null);
                  }}
                />
              </Card>
            </>
          ) : (
            <Card className="flex flex-col gap-3">
              <p className="micro-label text-text-muted">Document</p>
              {documents.length === 0 ? (
                <p className="text-sm text-text-muted">
                  No parsed documents yet — upload one from the Documents page.
                </p>
              ) : (
                <select
                  value={documentId}
                  onChange={(e) => setDocumentId(e.target.value)}
                  className="rounded-md border border-border bg-bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.filename}
                    </option>
                  ))}
                </select>
              )}
              {selectedDoc && (
                <p className="text-xs text-text-muted">
                  {selectedDoc.pageCount != null && `${selectedDoc.pageCount} pages · `}
                  {selectedDoc.wordCount != null && `${selectedDoc.wordCount.toLocaleString()} words`}
                </p>
              )}
            </Card>
          )}

          <button
            onClick={handleGenerate}
            disabled={!ready || loading}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-60"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {loading ? "Generating…" : "Get Study Aid"}
          </button>
        </div>

        {/* Right — Output */}
        <div className="flex flex-col gap-4">
          {rateLimitMessage && (
            <Card className="flex items-start gap-2.5 border-warning/30 bg-warning-soft">
              <Clock className="size-4 shrink-0 mt-0.5 text-warning" />
              <p className="text-sm text-warning">{rateLimitMessage}</p>
            </Card>
          )}

          {error && (
            <Card className="bg-danger-soft border-danger/20">
              <p className="text-sm text-danger">{error}</p>
            </Card>
          )}

          {loading && (
            <Card className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="h-4 w-24 rounded bg-bg-subtle animate-pulse" />
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-1 text-xs text-text-muted hover:text-danger"
                >
                  <X className="size-3.5" /> Cancel
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <div className="h-3 w-full rounded bg-bg-subtle animate-pulse" />
                <div className="h-3 w-5/6 rounded bg-bg-subtle animate-pulse" />
                <div className="h-3 w-2/3 rounded bg-bg-subtle animate-pulse" />
              </div>
              <span className="inline-block w-2 h-4 bg-accent/60 animate-pulse" />
            </Card>
          )}

          {!loading && !result && !error && !rateLimitMessage && (
            <Card className="p-0">
              <EmptyState
                icon={Sparkles}
                title="Ready when you are"
                description="Pick an assignment on the left and click Get Study Aid to see an outline, approach, and draft here."
              />
            </Card>
          )}

          {!loading && sections && (
            <>
              <div className="flex flex-col gap-3">
                <CollapsibleSection title="Outline" content={sections.Outline || "—"} />
                <CollapsibleSection title="Approach" content={sections.Approach || "—"} />
                <CollapsibleSection title="Draft" content={sections.Draft || "—"} />
              </div>

              <p className="text-xs text-text-muted">
                This is a study aid to help you understand and approach the assignment — review,
                rework, and cite it in your own words before submitting anything.
              </p>

              <div className="sticky bottom-4 flex flex-col gap-2 rounded-lg bg-bg-card border border-border shadow-pop p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="Your name"
                    className="min-w-0 flex-1 rounded-md border border-border bg-bg-subtle px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <input
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    placeholder="Roll number"
                    className="min-w-0 flex-1 rounded-md border border-border bg-bg-subtle px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleGenerate}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-2 text-sm font-medium text-text-body hover:bg-bg-subtle transition-colors"
                  >
                    <RotateCcw className="size-4" /> Regenerate
                  </button>
                  <button
                    onClick={handleCopyAll}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-2 text-sm font-medium text-text-body hover:bg-bg-subtle transition-colors"
                  >
                    <Copy className="size-4" /> Copy all
                  </button>
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className={cn(
                      "ml-auto inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors",
                      downloading && "opacity-60"
                    )}
                  >
                    {downloading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Download className="size-4" />
                    )}
                    Download .docx
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
