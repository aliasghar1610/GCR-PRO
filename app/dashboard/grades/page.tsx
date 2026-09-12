import { Circle, GraduationCap } from "lucide-react";
import { requireSessionUser } from "@/lib/sessionUser";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { CourseBadge } from "@/components/ui/CourseBadge";
import { GradeLineChart } from "@/components/grades/GradeLineChart";
import { buildCourseGradeSeries } from "@/lib/gradeSeries";

export default async function GradesPage() {
  const userId = (await requireSessionUser()).id;

  const courses = await prisma.course.findMany({
    where: { userId },
    include: {
      assignments: { include: { submissions: { where: { userId } } } },
    },
    orderBy: { name: "asc" },
  });

  const series = courses.map((c) => buildCourseGradeSeries(c.id, c.name, c.assignments));
  const hasAnyGrades = series.some((s) => s.points.length > 0);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Grades</h1>
        <p className="text-sm text-text-muted mt-0.5">Your performance across every course.</p>
      </div>

      {courses.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={GraduationCap}
            title="No courses synced yet"
            description="Sync your Classroom to see your grades here."
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {series.map((s) => (
              <Card key={s.courseId} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <CourseBadge courseId={s.courseId} name={s.courseName} size={32} />
                  <p className="text-sm font-medium text-text-primary truncate">{s.courseName}</p>
                </div>

                <p className="text-3xl font-semibold tabular-nums text-text-primary">
                  {s.average == null ? <span className="text-text-muted text-2xl">—</span> : `${s.average}%`}
                </p>

                {s.average != null ? (
                  <div className="h-2 rounded-full bg-bg-subtle overflow-hidden">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${s.average}%` }} />
                  </div>
                ) : (
                  <p className="text-xs text-text-muted">No grades yet</p>
                )}

                <div className="flex items-center gap-3 text-xs text-text-muted">
                  <span>{s.gradedCount} graded</span>
                  {s.ungradedCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Circle className="size-2.5" strokeWidth={2.5} />
                      {s.ungradedCount} ungraded
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>

          <Card>
            <p className="text-sm font-semibold text-text-primary mb-4">Performance Over Time</p>
            {hasAnyGrades ? (
              <GradeLineChart series={series} />
            ) : (
              <EmptyState
                icon={GraduationCap}
                title="No graded assignments yet"
                description="Once your instructors grade your work, your trend line will show up here."
                className="py-8"
              />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
