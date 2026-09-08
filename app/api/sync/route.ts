import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { classroom_v1 } from "googleapis";
import { authOptions } from "@/lib/auth";
import { getClassroomClient } from "@/lib/classroom";
import { prisma } from "@/lib/prisma";

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

  try {
    return await syncClassroom(userId);
  } catch (err) {
    console.error("Classroom sync failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}

async function syncClassroom(userId: string) {
  const classroom = await getClassroomClient(userId);

  const coursesRes = await classroom.courses.list({ studentId: "me" });
  const courses = coursesRes.data.courses ?? [];

  let assignmentCount = 0;
  let announcementCount = 0;
  let submissionCount = 0;
  let teacherCount = 0;

  for (const course of courses) {
    if (!course.id) continue;

    await prisma.course.upsert({
      where: { id: course.id },
      update: {
        name: course.name ?? "Untitled course",
        section: course.section ?? null,
        descriptionHeading: course.descriptionHeading ?? null,
        room: course.room ?? null,
        ownerName: course.ownerId ?? null,
        syncedAt: new Date(),
      },
      create: {
        id: course.id,
        userId,
        name: course.name ?? "Untitled course",
        section: course.section ?? null,
        descriptionHeading: course.descriptionHeading ?? null,
        room: course.room ?? null,
        ownerName: course.ownerId ?? null,
      },
    });

    // A course with no coursework/announcements yields an empty list here —
    // nothing further to upsert, so the loops below simply don't run.
    const courseWork =
      (await classroom.courses.courseWork.list({ courseId: course.id })).data
        .courseWork ?? [];

    for (const work of courseWork) {
      if (!work.id) continue;
      await prisma.assignment.upsert({
        where: { id: work.id },
        update: {
          title: work.title ?? "Untitled assignment",
          description: work.description ?? null,
          dueDate: toDueDate(work.dueDate, work.dueTime),
          state: work.state ?? null,
          alternateLink: work.alternateLink ?? null,
          syncedAt: new Date(),
        },
        create: {
          id: work.id,
          courseId: course.id,
          title: work.title ?? "Untitled assignment",
          description: work.description ?? null,
          dueDate: toDueDate(work.dueDate, work.dueTime),
          state: work.state ?? null,
          alternateLink: work.alternateLink ?? null,
        },
      });
      assignmentCount++;
    }

    const announcements =
      (await classroom.courses.announcements.list({ courseId: course.id })).data
        .announcements ?? [];

    for (const announcement of announcements) {
      if (!announcement.id) continue;
      await prisma.announcement.upsert({
        where: { id: announcement.id },
        update: {
          text: announcement.text ?? null,
          alternateLink: announcement.alternateLink ?? null,
          createdAt: announcement.creationTime ? new Date(announcement.creationTime) : null,
          syncedAt: new Date(),
        },
        create: {
          id: announcement.id,
          courseId: course.id,
          text: announcement.text ?? null,
          alternateLink: announcement.alternateLink ?? null,
          createdAt: announcement.creationTime ? new Date(announcement.creationTime) : null,
        },
      });
      announcementCount++;
    }

    // "-" requests submissions for every piece of coursework in the course
    // in one call instead of listing per-assignment.
    const submissions =
      (
        await classroom.courses.courseWork.studentSubmissions.list({
          courseId: course.id,
          courseWorkId: "-",
        })
      ).data.studentSubmissions ?? [];

    for (const submission of submissions) {
      if (!submission.id || !submission.courseWorkId) continue;
      // studentSubmissions.list is scoped to the caller's own token, so every
      // row here belongs to `userId` — store our internal id, not Google's
      // raw submission.userId, to stay consistent with Course.userId etc.
      await prisma.submission.upsert({
        where: { id: submission.id },
        update: {
          assignedGrade: submission.assignedGrade ?? null,
          state: submission.state ?? null,
          late: submission.late ?? false,
          syncedAt: new Date(),
        },
        create: {
          id: submission.id,
          assignmentId: submission.courseWorkId,
          userId,
          assignedGrade: submission.assignedGrade ?? null,
          state: submission.state ?? null,
          late: submission.late ?? false,
        },
      });
      submissionCount++;
    }

    // A course may have multiple teachers — store all of them.
    const teachers =
      (await classroom.courses.teachers.list({ courseId: course.id })).data
        .teachers ?? [];

    for (const teacher of teachers) {
      if (!teacher.userId || !teacher.profile?.name?.fullName) continue;
      await prisma.teacher.upsert({
        where: { courseId_googleId: { courseId: course.id, googleId: teacher.userId } },
        update: {
          name: teacher.profile.name.fullName,
          // Only populated if the classroom.profile.emails / .profile.photos
          // scopes were granted — otherwise these come back null.
          email: teacher.profile.emailAddress ?? null,
          photoUrl: teacher.profile.photoUrl ?? null,
          syncedAt: new Date(),
        },
        create: {
          courseId: course.id,
          googleId: teacher.userId,
          name: teacher.profile.name.fullName,
          email: teacher.profile.emailAddress ?? null,
          photoUrl: teacher.profile.photoUrl ?? null,
        },
      });
      teacherCount++;
    }
  }

  return NextResponse.json({
    courses: courses.length,
    assignments: assignmentCount,
    announcements: announcementCount,
    submissions: submissionCount,
    teachers: teacherCount,
  });
}
