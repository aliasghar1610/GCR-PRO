"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ExternalLink, Sparkles, FileQuestion, ClipboardList, ChevronDown, Check } from "lucide-react";
import { CourseBadge } from "@/components/ui/CourseBadge";
import { StatusPill, type PillStatus } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { SlideOver } from "@/components/ui/SlideOver";
import { dueBucket, isCompleted } from "@/lib/assignmentStatus";
import { gradePercent } from "@/lib/grade";
import { safeExternalUrl } from "@/lib/safeUrl";
import { cn } from "@/lib/cn";

export type AssignmentRow = {
  id: string;
  title: string;
  description: string | null;
  dueDateISO: string | null;
  maxPoints: number | null;
  alternateLink: string | null;
  driveFileIds: string[];
  courseId: string;
  courseName: string;
  submission: { state: string | null; assignedGrade: number | null; late: boolean | null } | null;
};

type FilterKey = "all" | "due-soon" | "overdue" | "completed";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "due-soon", label: "Due Soon" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
];

function rowStatus(row: AssignmentRow): PillStatus {
  if (isCompleted(row.submission)) return "completed";
  const due = row.dueDateISO ? new Date(row.dueDateISO) : null;
  return dueBucket(due, row.submission) ?? "upcoming";
}

function rowFilterBucket(row: AssignmentRow): FilterKey {
  const status = rowStatus(row);
  if (status === "completed") return "completed";
  if (status === "overdue") return "overdue";
  return "due-soon";
}

export function AssignmentsClient({
  rows,
  courses,
}: {
  rows: AssignmentRow[];
  courses: { id: string; name: string }[];
}) {
  return (
    <Suspense fallback={null}>
      <AssignmentsClientInner rows={rows} courses={courses} />
    </Suspense>
  );
}

function AssignmentsClientInner({
  rows,
  courses,
}: {
  rows: AssignmentRow[];
  courses: { id: string; name: string }[];
}) {
  const searchParams = useSearchParams();
  const initialFilter = (searchParams.get("filter") as FilterKey | null) ?? "all";
  const [filter, setFilter] = useState<FilterKey>(
    FILTERS.some((f) => f.key === initialFilter) ? initialFilter : "all"
  );
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [courseMenuOpen, setCourseMenuOpen] = useState(false);
  const [activeRow, setActiveRow] = useState<AssignmentRow | null>(null);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter !== "all" && rowFilterBucket(r) !== filter) return false;
      if (selectedCourses.size > 0 && !selectedCourses.has(r.courseId)) return false;
      return true;
    });
  }, [rows, filter, selectedCourses]);

  function toggleCourse(id: string) {
    setSelectedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Assignments</h1>
        <p className="text-sm text-text-muted mt-0.5">
          {rows.length} assignment{rows.length === 1 ? "" : "s"} across all courses
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 rounded-full bg-bg-subtle p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                filter === f.key
                  ? "bg-bg-card text-accent shadow-card"
                  : "text-text-muted hover:text-text-body"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <button
            onClick={() => setCourseMenuOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-md border border-border bg-bg-card px-3 py-1.5 text-sm text-text-body hover:bg-bg-subtle transition-colors"
          >
            {selectedCourses.size === 0 ? "All courses" : `${selectedCourses.size} course${selectedCourses.size === 1 ? "" : "s"}`}
            <ChevronDown className="size-4 text-text-muted" />
          </button>
          {courseMenuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setCourseMenuOpen(false)} />
              <div className="absolute left-0 mt-1.5 w-64 rounded-lg bg-bg-card border border-border shadow-pop py-1.5 z-30 max-h-80 overflow-y-auto">
                {courses.map((c) => {
                  const checked = selectedCourses.has(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleCourse(c.id)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-bg-subtle"
                    >
                      <span
                        className={cn(
                          "flex items-center justify-center size-4 rounded border shrink-0",
                          checked ? "bg-accent border-accent text-white" : "border-border-strong"
                        )}
                      >
                        {checked && <Check className="size-3" />}
                      </span>
                      <span className="truncate text-text-body">{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg bg-bg-card border border-border shadow-card">
          <EmptyState
            icon={ClipboardList}
            title={rows.length === 0 ? "No assignments yet" : "No assignments match these filters"}
            description={
              rows.length === 0
                ? "Coursework from your synced courses will show up here."
                : "Try a different filter or course selection."
            }
          />
        </div>
      ) : (
        <div className="rounded-lg bg-bg-card border border-border shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-bg-subtle text-left">
                <tr>
                  <th className="px-5 py-3 font-medium text-text-muted micro-label">Course</th>
                  <th className="px-5 py-3 font-medium text-text-muted micro-label">Title</th>
                  <th className="px-5 py-3 font-medium text-text-muted micro-label">Due</th>
                  <th className="px-5 py-3 font-medium text-text-muted micro-label">Status</th>
                  <th className="px-5 py-3 font-medium text-text-muted micro-label text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setActiveRow(r)}
                    className="border-t border-border hover:bg-bg-subtle cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3">
                      <CourseBadge courseId={r.courseId} name={r.courseName} size={28} />
                    </td>
                    <td className="px-5 py-3 max-w-xs">
                      <p className="text-text-primary font-medium truncate">{r.title}</p>
                      <p className="text-xs text-text-muted truncate">{r.courseName}</p>
                    </td>
                    <td className="px-5 py-3 text-text-body tabular-nums whitespace-nowrap">
                      {r.dueDateISO
                        ? new Date(r.dueDateISO).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill status={rowStatus(r)} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/dashboard/solver?assignmentId=${r.id}`}
                          title="Solve with AI"
                          className="flex items-center justify-center size-8 rounded-md text-text-muted hover:bg-accent-soft hover:text-accent transition-colors"
                        >
                          <Sparkles className="size-4" />
                        </Link>
                        <Link
                          href={`/dashboard/quiz?assignmentId=${r.id}`}
                          title="Generate Quiz"
                          className="flex items-center justify-center size-8 rounded-md text-text-muted hover:bg-accent-soft hover:text-accent transition-colors"
                        >
                          <FileQuestion className="size-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <SlideOver
        open={activeRow != null}
        onClose={() => setActiveRow(null)}
        title={activeRow?.title ?? ""}
        footer={
          activeRow && (
            <div className="flex gap-2">
              <Link
                href={`/dashboard/solver?assignmentId=${activeRow.id}`}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
              >
                <Sparkles className="size-4" /> Solve with AI
              </Link>
              <Link
                href={`/dashboard/quiz?assignmentId=${activeRow.id}`}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-text-body hover:bg-bg-subtle transition-colors"
              >
                <FileQuestion className="size-4" /> Generate Quiz
              </Link>
            </div>
          )
        }
      >
        {activeRow && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <CourseBadge courseId={activeRow.courseId} name={activeRow.courseName} size={36} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{activeRow.courseName}</p>
                <p className="text-xs text-text-muted">
                  {activeRow.dueDateISO
                    ? `Due ${new Date(activeRow.dueDateISO).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                    : "No due date"}
                </p>
              </div>
            </div>

            <StatusPill status={rowStatus(activeRow)} className="self-start" />

            {gradePercent(activeRow.submission?.assignedGrade, activeRow.maxPoints) != null && (
              <p className="text-sm text-text-body">
                Grade: {activeRow.submission?.assignedGrade}/{activeRow.maxPoints} (
                {gradePercent(activeRow.submission?.assignedGrade, activeRow.maxPoints)}%)
              </p>
            )}

            {activeRow.description && (
              <div>
                <p className="micro-label text-text-muted mb-1.5">Description</p>
                <p className="text-sm text-text-body whitespace-pre-wrap">{activeRow.description}</p>
              </div>
            )}

            {activeRow.driveFileIds.length > 0 && (
              <div>
                <p className="micro-label text-text-muted mb-1.5">Attachments</p>
                <div className="flex flex-col gap-1.5">
                  {activeRow.driveFileIds.map((fileId) => (
                    <a
                      key={fileId}
                      href={`https://drive.google.com/file/d/${fileId}/view`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-accent hover:underline"
                    >
                      Attachment
                    </a>
                  ))}
                </div>
              </div>
            )}

            {safeExternalUrl(activeRow.alternateLink) && (
              <a
                href={safeExternalUrl(activeRow.alternateLink)!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
              >
                Open in Classroom <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        )}
      </SlideOver>
    </div>
  );
}
