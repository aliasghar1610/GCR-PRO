import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/extensionAuth";

const MAX_ITEMS = 10;

function daysLeft(due: Date): number {
  return Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export async function GET(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const assignments = await prisma.assignment.findMany({
    where: { course: { userId }, dueDate: { not: null } },
    include: { course: true },
    orderBy: { dueDate: "asc" },
    take: MAX_ITEMS,
  });

  return NextResponse.json({
    deadlines: assignments.map((a) => ({
      id: a.id,
      title: a.title,
      courseId: a.course.id,
      courseName: a.course.name,
      dueDate: a.dueDate,
      daysLeft: daysLeft(a.dueDate!),
      alternateLink: a.alternateLink,
    })),
  });
}
