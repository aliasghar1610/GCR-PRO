import Link from "next/link";
import { BookOpen } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CourseBadge } from "@/components/ui/CourseBadge";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { EmptyState } from "@/components/ui/EmptyState";
import { courseColorClasses } from "@/lib/courseColor";
import { courseAveragePercent } from "@/lib/grade";

export default async function CoursesPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const courses = await prisma.course.findMany({
    where: { userId },
    include: {
      assignments: { include: { submissions: true } },
      teachers: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Courses</h1>
        <p className="text-sm text-text-muted mt-0.5">
          {courses.length} synced course{courses.length === 1 ? "" : "s"}
        </p>
      </div>

      {courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses synced yet"
          description="Sync your Classroom from the dashboard to see your courses here."
          action={
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
            >
              Go to Dashboard
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c) => {
            const tag = courseColorClasses(c.id);
            const avg = courseAveragePercent(c.assignments);
            return (
              <Link
                key={c.id}
                href={`/dashboard/courses/${c.id}`}
                className="flex flex-col rounded-lg bg-bg-card border border-border shadow-card overflow-hidden transition-transform hover:-translate-y-0.5 hover:shadow-pop focus-visible:outline-2 focus-visible:outline-accent"
              >
                <div className={`h-1.5 ${tag.bar}`} />
                <div className="flex flex-col gap-3 p-5 flex-1">
                  <div className="flex items-start gap-3">
                    <CourseBadge courseId={c.id} name={c.name} size={40} />
                    <div className="min-w-0">
                      <p className="font-semibold text-text-primary truncate">{c.name}</p>
                      {c.section && (
                        <p className="text-xs text-text-muted truncate">{c.section}</p>
                      )}
                    </div>
                  </div>
                  <AvatarStack
                    people={c.teachers.map((t) => ({ name: t.name, image: t.photoUrl }))}
                  />
                </div>
                <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-text-muted">
                  <span>
                    {c.assignments.length} assignment{c.assignments.length === 1 ? "" : "s"}
                  </span>
                  <span className="tabular-nums">
                    {avg == null ? "No grades yet" : `${avg}% avg`}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
