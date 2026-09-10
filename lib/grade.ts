export function gradePercent(
  assignedGrade: number | null | undefined,
  maxPoints: number | null | undefined
): number | null {
  if (assignedGrade == null || !maxPoints) return null;
  return Math.round((assignedGrade / maxPoints) * 100);
}

export function courseAveragePercent(
  assignments: { submissions: { assignedGrade: number | null }[]; maxPoints: number | null }[]
): number | null {
  const graded = assignments
    .map((a) => gradePercent(a.submissions[0]?.assignedGrade, a.maxPoints))
    .filter((p): p is number => p != null);
  if (graded.length === 0) return null;
  return Math.round(graded.reduce((sum, p) => sum + p, 0) / graded.length);
}
