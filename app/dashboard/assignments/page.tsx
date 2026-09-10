import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AssignmentsClient, type AssignmentRow } from "./AssignmentsClient";

export default async function AssignmentsPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const assignments = await prisma.assignment.findMany({
    where: { course: { userId } },
    include: { course: true, submissions: true },
    orderBy: { dueDate: "asc" },
  });

  const rows: AssignmentRow[] = assignments.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    dueDateISO: a.dueDate ? a.dueDate.toISOString() : null,
    maxPoints: a.maxPoints,
    alternateLink: a.alternateLink,
    driveFileIds: a.driveFileIds,
    courseId: a.course.id,
    courseName: a.course.name,
    submission: a.submissions[0]
      ? {
          state: a.submissions[0].state,
          assignedGrade: a.submissions[0].assignedGrade,
          late: a.submissions[0].late,
        }
      : null,
  }));

  const courses = Array.from(new Map(assignments.map((a) => [a.course.id, a.course.name])).entries()).map(
    ([id, name]) => ({ id, name })
  );

  return <AssignmentsClient rows={rows} courses={courses} />;
}
