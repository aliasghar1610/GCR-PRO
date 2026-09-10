import { gradePercent } from "./grade";

type AssignmentLike = {
  dueDate: Date | null;
  maxPoints: number | null;
  title: string;
  submissions: { assignedGrade: number | null }[];
};

export type GradePoint = { x: number; y: number; title: string };
export type CourseGradeSeries = {
  courseId: string;
  courseName: string;
  points: GradePoint[];
  average: number | null;
  gradedCount: number;
  ungradedCount: number;
};

export function buildCourseGradeSeries(
  courseId: string,
  courseName: string,
  assignments: AssignmentLike[]
): CourseGradeSeries {
  const points: GradePoint[] = [];
  let ungradedCount = 0;

  for (const a of assignments) {
    const percent = gradePercent(a.submissions[0]?.assignedGrade, a.maxPoints);
    if (percent == null) {
      ungradedCount++;
      continue;
    }
    if (!a.dueDate) continue;
    points.push({ x: a.dueDate.getTime(), y: percent, title: a.title });
  }

  points.sort((a, b) => a.x - b.x);
  const average =
    points.length === 0 ? null : Math.round(points.reduce((sum, p) => sum + p.y, 0) / points.length);

  return { courseId, courseName, points, average, gradedCount: points.length, ungradedCount };
}
