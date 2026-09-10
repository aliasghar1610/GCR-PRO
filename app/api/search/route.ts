import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/extensionAuth";

export async function GET(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ courses: [], assignments: [], announcements: [] });
  }

  const [courses, assignments, announcements] = await Promise.all([
    prisma.course.findMany({
      where: { userId, name: { contains: q, mode: "insensitive" } },
    }),
    prisma.assignment.findMany({
      where: {
        course: { userId },
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { course: true },
    }),
    prisma.announcement.findMany({
      where: {
        course: { userId },
        text: { contains: q, mode: "insensitive" },
      },
      include: { course: true },
    }),
  ]);

  return NextResponse.json({
    courses: courses.map((c) => ({ id: c.id, name: c.name })),
    assignments: assignments.map((a) => ({
      id: a.id,
      title: a.title,
      courseName: a.course.name,
      courseId: a.course.id,
    })),
    announcements: announcements.map((a) => ({
      id: a.id,
      text: a.text,
      courseName: a.course.name,
      courseId: a.course.id,
    })),
  });
}
