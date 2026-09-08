import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SyncedPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <main className="p-8">
        <p>
          Please <Link href="/" className="underline">sign in</Link> first.
        </p>
      </main>
    );
  }

  const courses = await prisma.course.findMany({
    where: { userId },
    include: { _count: { select: { assignments: true, announcements: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <main className="p-8 flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Synced Courses</h1>
      <Link href="/" className="underline w-fit">Back</Link>
      {courses.length === 0 ? (
        <p>No synced courses yet — go back and click &quot;Sync my Classroom&quot;.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {courses.map((course) => (
            <li key={course.id} className="border rounded p-3">
              <div className="font-medium">{course.name}</div>
              <div className="text-sm">
                {course._count.assignments} assignments, {course._count.announcements} announcements
              </div>
              <div className="text-xs text-gray-500">
                Last synced: {course.syncedAt.toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
