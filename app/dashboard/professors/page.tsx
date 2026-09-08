import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CopyEmailButton } from "./CopyEmailButton";

export default async function ProfessorsPage() {
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
    include: { teachers: true },
    orderBy: { name: "asc" },
  });

  return (
    <main className="p-8 flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Professors</h1>
        <Link href="/dashboard" className="text-sm underline">Back to dashboard</Link>
      </div>

      {courses.every((c) => c.teachers.length === 0) ? (
        <p className="text-sm text-gray-500">No teacher info synced yet.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {courses
            .filter((c) => c.teachers.length > 0)
            .map((course) => (
              <li key={course.id} className="border rounded p-3">
                <div className="font-medium mb-2">{course.name}</div>
                <ul className="flex flex-col gap-2">
                  {course.teachers.map((teacher) => (
                    <li key={teacher.id} className="flex items-center gap-3">
                      {teacher.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={teacher.photoUrl}
                          alt={teacher.name}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200" />
                      )}
                      <div className="flex-1">
                        <div>{teacher.name}</div>
                        {teacher.email ? (
                          <div className="text-sm text-gray-500">{teacher.email}</div>
                        ) : (
                          <div className="text-xs text-gray-400">
                            Email not shared (classroom.profile.emails scope not granted)
                          </div>
                        )}
                      </div>
                      {teacher.email && <CopyEmailButton email={teacher.email} />}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
        </ul>
      )}
    </main>
  );
}
