import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function GradesPage() {
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
    include: {
      assignments: { include: { submissions: { where: { userId } } } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <main className="p-8 flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Grades</h1>
        <Link href="/dashboard" className="text-sm underline">Back to dashboard</Link>
      </div>

      {courses.length === 0 ? (
        <p className="text-sm text-gray-500">No synced courses yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {courses.map((course) => {
            const submissions = course.assignments.flatMap((a) => a.submissions);
            const graded = submissions.filter((s) => s.assignedGrade != null);
            const average =
              graded.length > 0
                ? graded.reduce((sum, s) => sum + (s.assignedGrade ?? 0), 0) / graded.length
                : null;
            const gradedPct =
              submissions.length > 0 ? Math.round((graded.length / submissions.length) * 100) : 0;

            return (
              <li key={course.id} className="border rounded p-3 flex flex-col gap-1">
                <div className="font-medium">{course.name}</div>
                {submissions.length === 0 ? (
                  <div className="text-sm text-gray-500">No submissions synced yet.</div>
                ) : (
                  <>
                    <div className="text-sm">
                      {graded.length} of {submissions.length} graded
                      {average !== null && ` — average ${average.toFixed(1)} points`}
                    </div>
                    <div className="w-full bg-gray-200 rounded h-2">
                      <div
                        className="bg-gray-700 h-2 rounded"
                        style={{ width: `${gradedPct}%` }}
                      />
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
