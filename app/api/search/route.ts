import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUserId } from "@/lib/extensionAuth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";

// Caps so a single query can't turn into an expensive scan or a huge payload.
const MAX_QUERY_CHARS = 100;
const MAX_RESULTS_PER_GROUP = 20;
const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60 * 1000;

export async function GET(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const limit = await checkRateLimit(userId, "search", RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    return rateLimitResponse("search", limit.resetAt);
  }

  const raw = req.nextUrl.searchParams.get("q")?.trim();
  if (!raw) {
    return NextResponse.json({ courses: [], assignments: [], announcements: [] });
  }
  if (raw.length > MAX_QUERY_CHARS) {
    return NextResponse.json({ error: "Search query is too long" }, { status: 400 });
  }
  const q = raw;

  const [courses, assignments, announcements] = await Promise.all([
    prisma.course.findMany({
      where: { userId, name: { contains: q, mode: "insensitive" } },
      take: MAX_RESULTS_PER_GROUP,
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
      take: MAX_RESULTS_PER_GROUP,
    }),
    prisma.announcement.findMany({
      where: {
        course: { userId },
        text: { contains: q, mode: "insensitive" },
      },
      include: { course: true },
      take: MAX_RESULTS_PER_GROUP,
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
