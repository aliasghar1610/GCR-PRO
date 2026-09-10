export type SubmissionLike = { state?: string | null; assignedGrade?: number | null; late?: boolean | null } | null | undefined;

export function isCompleted(submission: SubmissionLike): boolean {
  return submission?.state === "TURNED_IN" || submission?.state === "RETURNED";
}

export function isGraded(submission: SubmissionLike): boolean {
  return submission?.assignedGrade != null;
}

/** Deadline urgency for an incomplete assignment — null once it's done or has no due date. */
export function dueBucket(
  dueDate: Date | null | undefined,
  submission: SubmissionLike
): "overdue" | "due-soon" | "upcoming" | null {
  if (!dueDate || isCompleted(submission)) return null;
  const hoursUntil = (dueDate.getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntil < 0) return "overdue";
  if (hoursUntil <= 48) return "due-soon";
  return "upcoming";
}

/** Dense status chip for an assignment row (course detail / assignments table). */
export function assignmentChipStatus(
  dueDate: Date | null | undefined,
  submission: SubmissionLike
):
  | "graded"
  | "turned-in"
  | "late"
  | "missing"
  | "not-started" {
  if (isGraded(submission)) return "graded";
  if (isCompleted(submission)) return submission?.late ? "late" : "turned-in";
  if (dueDate && dueDate.getTime() < Date.now()) return "missing";
  return "not-started";
}
