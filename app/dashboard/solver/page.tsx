import { requireSessionUser } from "@/lib/sessionUser";
import { prisma } from "@/lib/prisma";
import { SolverClient } from "./SolverClient";

export default async function SolverPage({
  searchParams,
}: {
  searchParams: Promise<{ assignmentId?: string; documentId?: string }>;
}) {
  const { assignmentId, documentId } = await searchParams;
  const userId = (await requireSessionUser()).id;

  const [assignments, documents, user] = await Promise.all([
    prisma.assignment.findMany({
      where: { course: { userId } },
      include: { course: true },
      orderBy: { title: "asc" },
    }),
    prisma.document.findMany({
      where: { userId, status: "READY" },
      orderBy: { createdAt: "desc" },
      select: { id: true, filename: true, wordCount: true, pageCount: true },
    }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, rollNumber: true } }),
  ]);

  return (
    <SolverClient
      profileName={user.name ?? ""}
      profileRollNumber={user.rollNumber ?? ""}
      assignments={assignments.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        dueDateISO: a.dueDate ? a.dueDate.toISOString() : null,
        courseId: a.course.id,
        courseName: a.course.name,
        driveFileIds: a.driveFileIds,
      }))}
      documents={documents}
      initialAssignmentId={assignmentId}
      initialDocumentId={documentId}
    />
  );
}
