"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CourseOption = { id: string; name: string };
type AssignmentOption = { id: string; title: string; courseName: string };

export function QuizGeneratorForm({
  courses,
  assignments,
}: {
  courses: CourseOption[];
  assignments: AssignmentOption[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"assignment" | "course">("assignment");
  const [assignmentId, setAssignmentId] = useState(assignments[0]?.id ?? "");
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "assignment" ? { assignmentId } : { courseId }
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate quiz");
      router.push(`/dashboard/quiz/${data.quizId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate quiz");
      setLoading(false);
    }
  }

  if (assignments.length === 0 && courses.length === 0) {
    return <p className="text-sm text-gray-500">No synced courses or assignments yet.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-md">
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={mode === "assignment"}
            onChange={() => setMode("assignment")}
            disabled={assignments.length === 0}
          />
          From an assignment
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={mode === "course"}
            onChange={() => setMode("course")}
            disabled={courses.length === 0}
          />
          From a whole course
        </label>
      </div>

      {mode === "assignment" ? (
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
      ) : (
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="border rounded px-2 py-1.5 text-sm bg-[var(--background)] text-[var(--foreground)]"
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      <button
        type="submit"
        disabled={loading}
        className="border rounded px-3 py-1.5 text-sm w-fit disabled:opacity-50"
      >
        {loading ? "Generating..." : "Generate quiz"}
      </button>
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </form>
  );
}
