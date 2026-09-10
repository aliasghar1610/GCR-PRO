import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { classroom_v1 } from "googleapis";
import { authOptions } from "@/lib/auth";
import { getClassroomClient } from "@/lib/classroom";
import { prisma } from "@/lib/prisma";
import { isReauthRequiredError, clearStoredGoogleTokens } from "@/lib/google-auth";
import { withRetry } from "@/lib/withRetry";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 10 * 60 * 1000;

function toDueDate(
  date?: classroom_v1.Schema$Date | null,
  time?: classroom_v1.Schema$TimeOfDay | null
): Date | null {
  if (!date?.year || !date.month || !date.day) return null;
  return new Date(
    Date.UTC(date.year, date.month - 1, date.day, time?.hours ?? 0, time?.minutes ?? 0)
  );
}

export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Classroom's API quota is project-wide, so one user hammering sync degrades
  // the app for everyone.
  const limit = await checkRateLimit(userId, "sync", RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    return rateLimitResponse("Classroom sync", limit.resetAt);
  }

  try {
    return await syncClassroom(userId);
  } catch (err) {
    if (isReauthRequiredError(err)) {
      await clearStoredGoogleTokens(userId);
      return NextResponse.json(
        {
          error: "Your Google access needs to be refreshed — please sign out and sign in again.",
          reauthRequired: true,
        },
        { status: 401 }
      );
    }
    // Logged in full server-side, but never returned: upstream Google errors
    // carry internal identifiers and quota details that clients shouldn't see.
    console.error("Classroom sync failed:", err);
    return NextResponse.json(
      { error: "Sync failed. Please try again in a moment." },
      { status: 500 }
    );
  }
}

type CourseCounts = { assignments: number; announcements: number; submissions: number; teachers: number };

// Everything below is independent per course (different courseId / no FK
// ordering constraints between assignments, announcements, submissions, and
// teachers once the parent Course row exists) — so both the four Classroom
// API list calls and all the resulting DB upserts run concurrently instead
// of one-at-a-time. That's the fix for slow syncs: this used to be a fully
// sequential chain of Google API calls and per-row `await`ed upserts, which
// meant a sync with a few courses and a few dozen items each could rack up
// hundreds of serial network round-trips.
async function syncCourse(
  classroom: classroom_v1.Classroom,
  userId: string,
  course: classroom_v1.Schema$Course
): Promise<CourseCounts> {
  const courseId = course.id;
  if (!courseId) return { assignments: 0, announcements: 0, submissions: 0, teachers: 0 };

  // Course.id is Google's courseId, which is the SAME value for every student
  // enrolled in that course. If a classmate who also uses GCR PRO synced first,
  // this row belongs to them — writing our coursework and submissions
  // underneath it would file our data inside their account. Skip instead.
  // (Proper fix is a per-user key: see SECURITY-AUDIT.md "Shared-course row
  // collision".)
  const existing = await prisma.course.findUnique({
    where: { id: courseId },
    select: { userId: true },
  });
  if (existing && existing.userId !== userId) {
    return { assignments: 0, announcements: 0, submissions: 0, teachers: 0 };
  }

  await prisma.course.upsert({
    where: { id: courseId },
    update: {
      name: course.name ?? "Untitled course",
      section: course.section ?? null,
      descriptionHeading: course.descriptionHeading ?? null,
      room: course.room ?? null,
      ownerName: course.ownerId ?? null,
      syncedAt: new Date(),
    },
    create: {
      id: courseId,
      userId,
      name: course.name ?? "Untitled course",
      section: course.section ?? null,
      descriptionHeading: course.descriptionHeading ?? null,
      room: course.room ?? null,
      ownerName: course.ownerId ?? null,
    },
  });

  const apiStart = Date.now();
  const [courseWorkRes, announcementsRes, submissionsRes, teachersRes] = await Promise.all([
    withRetry(() => classroom.courses.courseWork.list({ courseId })),
    withRetry(() => classroom.courses.announcements.list({ courseId })),
    // "-" requests submissions for every piece of coursework in the course
    // in one call instead of listing per-assignment.
    withRetry(() =>
      classroom.courses.courseWork.studentSubmissions.list({ courseId, courseWorkId: "-" })
    ),
    withRetry(() => classroom.courses.teachers.list({ courseId })),
  ]);
  console.log(`[sync] ${courseId} Google API calls: ${Date.now() - apiStart}ms`);

  const courseWork = (courseWorkRes.data.courseWork ?? []).filter((w) => w.id);
  const announcements = (announcementsRes.data.announcements ?? []).filter((a) => a.id);
  // studentSubmissions.list is scoped to the caller's own token, so every row
  // here belongs to `userId` — store our internal id, not Google's raw
  // submission.userId, to stay consistent with Course.userId etc.
  const submissions = (submissionsRes.data.studentSubmissions ?? []).filter(
    (s) => s.id && s.courseWorkId
  );
  const teachers = (teachersRes.data.teachers ?? []).filter(
    (t) => t.userId && t.profile?.name?.fullName
  );

  const dbStart = Date.now();
  await Promise.all([
    ...courseWork.map((work) => {
      const driveFileIds = (work.materials ?? [])
        .map((m) => m.driveFile?.driveFile?.id)
        .filter((id): id is string => !!id);

      return prisma.assignment.upsert({
        where: { id: work.id! },
        update: {
          title: work.title ?? "Untitled assignment",
          description: work.description ?? null,
          dueDate: toDueDate(work.dueDate, work.dueTime),
          maxPoints: work.maxPoints ?? null,
          state: work.state ?? null,
          alternateLink: work.alternateLink ?? null,
          driveFileIds,
          syncedAt: new Date(),
        },
        create: {
          id: work.id!,
          courseId,
          title: work.title ?? "Untitled assignment",
          description: work.description ?? null,
          dueDate: toDueDate(work.dueDate, work.dueTime),
          maxPoints: work.maxPoints ?? null,
          state: work.state ?? null,
          alternateLink: work.alternateLink ?? null,
          driveFileIds,
        },
      });
    }),
    ...announcements.map((announcement) =>
      prisma.announcement.upsert({
        where: { id: announcement.id! },
        update: {
          text: announcement.text ?? null,
          alternateLink: announcement.alternateLink ?? null,
          createdAt: announcement.creationTime ? new Date(announcement.creationTime) : null,
          syncedAt: new Date(),
        },
        create: {
          id: announcement.id!,
          courseId,
          text: announcement.text ?? null,
          alternateLink: announcement.alternateLink ?? null,
          createdAt: announcement.creationTime ? new Date(announcement.creationTime) : null,
        },
      })
    ),
    ...submissions.map((submission) =>
      prisma.submission.upsert({
        where: { id: submission.id! },
        update: {
          assignedGrade: submission.assignedGrade ?? null,
          state: submission.state ?? null,
          late: submission.late ?? false,
          syncedAt: new Date(),
        },
        create: {
          id: submission.id!,
          assignmentId: submission.courseWorkId!,
          userId,
          assignedGrade: submission.assignedGrade ?? null,
          state: submission.state ?? null,
          late: submission.late ?? false,
        },
      })
    ),
    ...teachers.map((teacher) =>
      prisma.teacher.upsert({
        where: { courseId_googleId: { courseId, googleId: teacher.userId! } },
        update: {
          name: teacher.profile!.name!.fullName!,
          // Only populated if the classroom.profile.emails / .profile.photos
          // scopes were granted — otherwise these come back null.
          email: teacher.profile?.emailAddress ?? null,
          photoUrl: teacher.profile?.photoUrl ?? null,
          syncedAt: new Date(),
        },
        create: {
          courseId,
          googleId: teacher.userId!,
          name: teacher.profile!.name!.fullName!,
          email: teacher.profile?.emailAddress ?? null,
          photoUrl: teacher.profile?.photoUrl ?? null,
        },
      })
    ),
  ]);
  console.log(
    `[sync] ${courseId} DB upserts: ${Date.now() - dbStart}ms (${courseWork.length} assignments, ${announcements.length} announcements, ${submissions.length} submissions, ${teachers.length} teachers)`
  );

  return {
    assignments: courseWork.length,
    announcements: announcements.length,
    submissions: submissions.length,
    teachers: teachers.length,
  };
}

async function syncClassroom(userId: string) {
  const totalStart = Date.now();
  const classroom = await getClassroomClient(userId);

  const listStart = Date.now();
  const coursesRes = await withRetry(() => classroom.courses.list({ studentId: "me" }));
  const courses = coursesRes.data.courses ?? [];
  console.log(`[sync] courses.list: ${Date.now() - listStart}ms (${courses.length} courses)`);

  const results = await Promise.all(
    courses.map((course) => syncCourse(classroom, userId, course))
  );

  const totals = results.reduce(
    (acc, r) => ({
      assignments: acc.assignments + r.assignments,
      announcements: acc.announcements + r.announcements,
      submissions: acc.submissions + r.submissions,
      teachers: acc.teachers + r.teachers,
    }),
    { assignments: 0, announcements: 0, submissions: 0, teachers: 0 }
  );

  console.log(`[sync] TOTAL: ${Date.now() - totalStart}ms`);
  return NextResponse.json({ courses: courses.length, ...totals });
}
