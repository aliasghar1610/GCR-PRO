"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  Upload,
  FileText,
  Sparkles,
  FileQuestion,
  Trash2,
  Eye,
  Loader2,
  FolderOpen,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SlideOver } from "@/components/ui/SlideOver";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/ToastProvider";
import { formatBytes } from "@/lib/formatBytes";
import { MAX_REQUEST_BODY_BYTES } from "@/lib/pdfLimits";
import { cn } from "@/lib/cn";

export type DocStatus = "QUEUED" | "PARSING" | "READY" | "UNSUPPORTED" | "FAILED";
type DocRow = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  status: DocStatus;
  wordCount: number | null;
  pageCount: number | null;
  createdAt: string;
};

const ACCEPTED = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/**
 * Upload deadline. Generous on purpose — the route parses the file and writes
 * to the database, and both can be slow on a poor connection — but finite, so
 * a request that will never answer surfaces as an error instead of a
 * permanent "Parsing" chip.
 */
const UPLOAD_TIMEOUT_MS = 60_000;

/** Response body as JSON, or null when it isn't JSON at all (an HTML error page). */
async function readJson(res: Response): Promise<{ error?: string; document?: DocRow } | null> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

const STATUS_STYLE: Record<DocStatus, { label: string; className: string }> = {
  QUEUED: { label: "Queued", className: "bg-bg-subtle text-text-muted" },
  PARSING: { label: "Parsing", className: "bg-accent-soft text-accent" },
  READY: { label: "Ready", className: "bg-success-soft text-success" },
  UNSUPPORTED: { label: "Unsupported", className: "bg-warning-soft text-warning" },
  FAILED: { label: "Failed to parse", className: "bg-danger-soft text-danger" },
};

export function DocumentsClient({ initialDocuments }: { initialDocuments: DocRow[] }) {
  const toast = useToast();
  const [documents, setDocuments] = useState<DocRow[]>(initialDocuments);
  const [dragOver, setDragOver] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DocRow | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    // Checked before the request, not after: this upload sends the file bytes
    // to a serverless route, and a body over the platform's payload cap is
    // rejected at the edge with a bare 413 that no handler of ours ever sees.
    // Left to the server, the user got an unexplained failure.
    if (file.size > MAX_REQUEST_BODY_BYTES) {
      toast(
        `"${file.name}" is ${formatBytes(file.size)} — uploads are limited to ` +
          `${formatBytes(MAX_REQUEST_BODY_BYTES)}. Attach it from Drive instead, ` +
          `which has no size limit.`,
        "error"
      );
      return;
    }

    const tempId = `temp-${crypto.randomUUID()}`;
    setDocuments((prev) => [
      {
        id: tempId,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        status: "QUEUED",
        wordCount: null,
        pageCount: null,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);

    setDocuments((prev) =>
      prev.map((d) => (d.id === tempId ? { ...d, status: "PARSING" as const } : d))
    );

    try {
      const form = new FormData();
      form.append("file", file);
      // Bounded so a request that never comes back cannot leave the row
      // spinning on "Parsing" forever. A platform that kills the function
      // mid-flight closes the socket without a response, and an unbounded
      // fetch simply waits — which is what a stuck upload looked like.
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
      });
      const data = await readJson(res);
      if (!res.ok) {
        // A body that isn't JSON didn't come from this route — it's a
        // gateway timeout or payload rejection from the platform in front
        // of it. Saying "upload failed" there blames the file for an
        // infrastructure failure.
        throw new Error(
          data?.error ??
            (res.status === 413
              ? `"${file.name}" was rejected as too large by the server.`
              : `The server couldn't process the upload (HTTP ${res.status}). ` +
                `If this keeps happening, attach the file from Drive instead.`)
        );
      }
      if (!data?.document) throw new Error("The server returned an unreadable response.");
      const saved = data.document;
      setDocuments((prev) => prev.map((d) => (d.id === tempId ? saved : d)));
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === "TimeoutError";
      toast(
        timedOut
          ? `"${file.name}" timed out before the server answered. Try again, or ` +
            `attach it from Drive, which parses in your browser.`
          : err instanceof Error
            ? err.message
            : "Upload failed",
        "error"
      );
      setDocuments((prev) => prev.filter((d) => d.id !== tempId));
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach(uploadFile);
  }

  async function openPreview(doc: DocRow) {
    setPreviewId(doc.id);
    setPreviewText(null);
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load preview");
      setPreviewText(data.document.extractedText ?? "(no text extracted)");
    } catch (err) {
      setPreviewText(err instanceof Error ? err.message : "Could not load preview");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      toast("Document deleted");
    } catch {
      toast("Failed to delete document", "error");
    }
  }

  const previewDoc = documents.find((d) => d.id === previewId) ?? null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Documents</h1>
        <p className="text-sm text-text-muted mt-0.5">
          Upload a PDF or DOCX to use with the AI Solver or Quiz Generator.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-bg-subtle px-6 py-10 text-center cursor-pointer transition-colors",
          dragOver ? "border-accent bg-accent-soft" : "border-border-strong hover:border-text-muted"
        )}
      >
        <Upload className="size-6 text-text-muted" />
        <p className="text-sm font-medium text-text-primary">
          Drag a file here, or click to browse
        </p>
        <p className="text-xs text-text-muted">
          PDF or DOCX · up to {formatBytes(MAX_REQUEST_BODY_BYTES)}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {documents.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={FolderOpen}
            title="No documents yet"
            description="Uploaded files will show up here, ready to use with the Solver or Quiz Generator."
          />
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ul>
            {documents.map((d) => {
              const style = STATUS_STYLE[d.status];
              const busy = d.status === "QUEUED" || d.status === "PARSING";
              return (
                <li
                  key={d.id}
                  className="flex items-center gap-3 px-5 py-3 border-t border-border first:border-t-0"
                >
                  <FileText className="size-5 text-text-muted shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">{d.filename}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {formatBytes(d.size)}
                      {d.pageCount != null && ` · ${d.pageCount} page${d.pageCount === 1 ? "" : "s"}`}
                      {d.wordCount != null && ` · ${d.wordCount.toLocaleString()} words`}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0",
                      style.className
                    )}
                  >
                    {busy && <Loader2 className="size-3 animate-spin" />}
                    {style.label}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {d.status === "READY" && (
                      <>
                        <button
                          onClick={() => openPreview(d)}
                          title="Preview"
                          className="flex items-center justify-center size-8 rounded-md text-text-muted hover:bg-bg-subtle hover:text-text-body transition-colors"
                        >
                          <Eye className="size-4" />
                        </button>
                        <Link
                          href={`/dashboard/solver?documentId=${d.id}`}
                          title="Solve with AI"
                          className="flex items-center justify-center size-8 rounded-md text-text-muted hover:bg-accent-soft hover:text-accent transition-colors"
                        >
                          <Sparkles className="size-4" />
                        </Link>
                        <Link
                          href={`/dashboard/quiz?documentId=${d.id}`}
                          title="Generate Quiz"
                          className="flex items-center justify-center size-8 rounded-md text-text-muted hover:bg-accent-soft hover:text-accent transition-colors"
                        >
                          <FileQuestion className="size-4" />
                        </Link>
                      </>
                    )}
                    <button
                      onClick={() => setDeleteTarget(d)}
                      title="Delete"
                      className="flex items-center justify-center size-8 rounded-md text-text-muted hover:bg-danger-soft hover:text-danger transition-colors"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <SlideOver
        open={previewId != null}
        onClose={() => setPreviewId(null)}
        title={previewDoc?.filename ?? "Preview"}
      >
        {previewLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-text-muted" />
          </div>
        ) : (
          <p className="text-sm text-text-body whitespace-pre-wrap leading-relaxed">{previewText}</p>
        )}
      </SlideOver>

      <Modal
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        title="Delete document?"
        footer={
          <>
            <button
              onClick={() => setDeleteTarget(null)}
              className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-text-body hover:bg-bg-subtle transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              Delete
            </button>
          </>
        }
      >
        <p className="text-sm text-text-body">
          This permanently deletes <span className="font-medium">{deleteTarget?.filename}</span> and
          its extracted text. This can&rsquo;t be undone.
        </p>
      </Modal>
    </div>
  );
}
