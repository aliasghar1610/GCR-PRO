import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { CourseBadge } from "@/components/ui/CourseBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { QuizGeneratorCard } from "@/components/quiz/QuizGeneratorCard";

export default async function QuizGeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ assignmentId?: string; documentId?: string }>;
}) {
  const { assignmentId, documentId } = await searchParams;
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const [courses, assignments, quizzes, documents] = await Promise.all([
    prisma.course.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    prisma.assignment.findMany({
      where: { course: { userId } },
      include: { course: true },
      orderBy: { title: "asc" },
    }),
    prisma.quiz.findMany({
      where: { userId },
      include: { questions: { select: { id: true } }, attempts: { select: { score: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.document.findMany({
      where: { userId, status: "READY" },
      orderBy: { createdAt: "desc" },
      select: { id: true, filename: true },
    }),
  ]);

  const courseNames = new Map(courses.map((c) => [c.id, c.name]));

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Quizzes</h1>
        <p className="text-sm text-text-muted mt-0.5">
          Turn any assignment or course into a practice quiz.
        </p>
      </div>

      <QuizGeneratorCard
        courses={courses.map((c) => ({ id: c.id, name: c.name }))}
        assignments={assignments.map((a) => ({
          id: a.id,
          title: a.title,
          courseId: a.course.id,
          courseName: a.course.name,
        }))}
        documents={documents}
        initialAssignmentId={assignmentId}
        initialDocumentId={documentId}
      />

      <div>
        <h2 className="text-base font-semibold text-text-primary mb-3">Past Quizzes</h2>
        {quizzes.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              icon={FileQuestion}
              title="No quizzes yet"
              description="Generate your first quiz above to see it here."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quizzes.map((q) => {
              const total = q.questions.length;
              const best = q.attempts.reduce((max, a) => Math.max(max, a.score), 0);
              const attempted = q.attempts.length > 0;
              const courseName = q.courseId ? courseNames.get(q.courseId) : undefined;
              return (
                <Card key={q.id} className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    {q.courseId && courseName ? (
                      <CourseBadge courseId={q.courseId} name={courseName} size={32} />
                    ) : (
                      <span className="flex items-center justify-center size-8 rounded-md bg-bg-subtle text-text-muted shrink-0">
                        <FileQuestion className="size-4" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{q.title}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {total} question{total === 1 ? "" : "s"}
                      {attempted && (
                        <>
                          {" · "}Best: {best}/{total}
                        </>
                      )}
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/quiz/${q.id}`}
                    className="mt-auto inline-flex items-center justify-center rounded-md border border-border-strong px-3 py-1.5 text-sm font-medium text-text-body hover:bg-bg-subtle transition-colors"
                  >
                    {attempted ? "Retake" : "Start"}
                  </Link>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
