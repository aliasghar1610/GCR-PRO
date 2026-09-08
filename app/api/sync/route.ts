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
  }

  return NextResponse.json({
    courses: courses.length,
    assignments: assignmentCount,
    announcements: announcementCount,
  });
}
