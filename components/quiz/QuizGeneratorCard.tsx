"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileQuestion, Loader2, Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { AssignmentPicker, type AssignmentOption } from "@/components/dashboard/AssignmentPicker";
import { DriveAttachButton } from "@/components/DriveAttachButton";
import { cn } from "@/lib/cn";

type CourseOption = { id: string; name: string };
type DocumentOption = { id: string; filename: string };

const STEPS = ["Reading material", "Writing questions", "Checking answers"];

export function QuizGeneratorCard({
  courses,
  assignments,
  documents,
  initialAssignmentId,
  initialDocumentId,
}: {
  courses: CourseOption[];
  assignments: AssignmentOption[];
  documents: DocumentOption[];
  initialAssignmentId?: string;
  initialDocumentId?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"assignment" | "course" | "document">(
    initialDocumentId ? "document" : assignments.length > 0 ? "assignment" : "course"
  );
  const [assignmentId, setAssignmentId] = useState(
    initialAssignmentId && assignments.some((a) => a.id === initialAssignmentId)
      ? initialAssignmentId
      : (assignments[0]?.id ?? "")
  );
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [documentId, setDocumentId] = useState(
    initialDocumentId && documents.some((d) => d.id === initialDocumentId)
      ? initialDocumentId
      : (documents[0]?.id ?? "")
  );
  const [questionCount, setQuestionCount] = useState<"3" | "5" | "10">("5");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [attachmentText, setAttachmentText] = useState<string | null>(null);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setStep(0);
    const stepTimer = setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, 1400);
    try {
      const source =
        mode === "assignment"
          ? { assignmentId, attachmentText }
          : mode === "course"
            ? { courseId }
            : { documentId };
      const res = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...source, questionCount: Number(questionCount), difficulty }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate quiz");
      router.push(`/dashboard/quiz/${data.quizId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate quiz");
      setLoading(false);
    } finally {
      clearInterval(stepTimer);
    }
  }

  if (assignments.length === 0 && courses.length === 0 && documents.length === 0) {
    return (
      <Card className="p-0">
        <div className="flex flex-col items-center text-center gap-2 py-10 px-4">
          <FileQuestion className="size-8 text-text-muted" />
          <p className="text-sm font-medium text-text-primary">No synced courses yet</p>
          <p className="text-sm text-text-muted">Sync your Classroom to generate a quiz.</p>
        </div>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="flex flex-col items-center gap-5 py-10">
        <Loader2 className="size-8 text-accent animate-spin" />
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2.5 text-sm">
              <span
                className={cn(
                  "flex items-center justify-center size-5 rounded-full shrink-0",
                  i < step
                    ? "bg-success text-white"
                    : i === step
                      ? "bg-accent-soft text-accent"
                      : "bg-bg-subtle text-text-muted"
                )}
              >
                {i < step ? <Check className="size-3" /> : i + 1}
              </span>
              <span className={i <= step ? "text-text-primary" : "text-text-muted"}>{label}</span>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  const canGenerate =
    mode === "assignment" ? !!assignmentId : mode === "course" ? !!courseId : !!documentId;

  return (
    <Card className="flex flex-col gap-4 max-w-2xl mx-auto w-full">
      <SegmentedControl
        options={[
          { value: "assignment" as const, label: "From an assignment" },
          { value: "course" as const, label: "From a whole course" },
          { value: "document" as const, label: "Uploaded document" },
        ]}
        value={mode}
        onChange={setMode}
      />

      {mode === "assignment" && (
        <AssignmentPicker assignments={assignments} value={assignmentId} onChange={setAssignmentId} />
      )}

      {mode === "course" && (
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="rounded-md border border-border bg-bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      {mode === "document" &&
        (documents.length === 0 ? (
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
        ))}

      {mode === "assignment" && (
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
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="micro-label text-text-muted">Questions</span>
          <SegmentedControl
            options={[
              { value: "3" as const, label: "3" },
              { value: "5" as const, label: "5" },
              { value: "10" as const, label: "10" },
            ]}
            value={questionCount}
            onChange={setQuestionCount}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="micro-label text-text-muted">Difficulty</span>
          <SegmentedControl
            options={[
              { value: "easy" as const, label: "Easy" },
              { value: "medium" as const, label: "Medium" },
              { value: "hard" as const, label: "Hard" },
            ]}
            value={difficulty}
            onChange={setDifficulty}
          />
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={!canGenerate}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-60"
      >
        <FileQuestion className="size-4" /> Generate Quiz
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </Card>
  );
}
