"use client";

import { useState } from "react";

type AssignmentOption = { id: string; title: string; courseName: string };

export function SolverForm({ assignments }: { assignments: AssignmentOption[] }) {
  const [assignmentId, setAssignmentId] = useState(assignments[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    if (!result) return;
    const assignment = assignments.find((a) => a.id === assignmentId);
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch("/api/format", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName,
          rollNumber,
          subject: assignment?.courseName ?? "",
          courseName: assignment?.courseName ?? "",
          title: assignment?.title ?? "Assignment",
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
      a.download = `${(assignment?.title ?? "assignment").replace(/[^a-z0-9]+/gi, "_")}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Failed to generate document");
    } finally {
      setDownloading(false);
    }
  }

  if (assignments.length === 0) {
    return <p className="text-sm text-gray-500">No synced assignments yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex gap-2 items-center flex-wrap">
        <select
          value={assignmentId}
          onChange={(e) => setAssignmentId(e.target.value)}
          className="border rounded px-2 py-1.5 text-sm bg-[var(--background)] text-[var(--foreground)]"
        >
          {assignments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.courseName} — {a.title}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading}
          className="border rounded px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {loading ? "Thinking..." : "Get study aid"}
        </button>
      </form>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {result && (
        <div className="flex flex-col gap-3">
          <div className="border rounded p-4 whitespace-pre-wrap text-sm">{result}</div>
          <div className="flex gap-2 items-center flex-wrap">
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Your name (for the cover page)"
              className="border rounded px-2 py-1.5 text-sm bg-[var(--background)] text-[var(--foreground)]"
            />
            <input
              type="text"
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              placeholder="Roll number"
              className="border rounded px-2 py-1.5 text-sm bg-[var(--background)] text-[var(--foreground)]"
            />
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="border rounded px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {downloading ? "Preparing..." : "Download formatted document"}
            </button>
          </div>
          {downloadError && <p className="text-red-600 text-sm">{downloadError}</p>}
        </div>
      )}
    </div>
  );
}
