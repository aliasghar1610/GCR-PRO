import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SearchBar } from "./SearchBar";

function daysLeft(due: Date): number {
  const ms = due.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export default async function DashboardPage() {
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
    include: { assignments: true, announcements: true, teachers: true },
    orderBy: { name: "asc" },
  });

  const allAssignments = courses.flatMap((c) =>
    c.assignments.map((a) => ({ ...a, courseName: c.name }))
  );
  const upcoming = allAssignments
    .filter((a) => a.dueDate)
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime());
  const noDeadline = allAssignments.filter((a) => !a.dueDate);

  return (
    <main className="p-8 flex flex-col gap-8">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <SearchBar />
        <nav className="flex gap-4 text-sm underline">
          <Link href="/dashboard/grades">Grades</Link>
          <Link href="/dashboard/professors">Professors</Link>
          <Link href="/dashboard/solver">AI Solver</Link>
          <Link href="/dashboard/quiz">Quiz</Link>
          <Link href="/dashboard/email">Email Writer</Link>
          <Link href="/">Home</Link>
        </nav>
      </div>

      <section>
        <h2 className="font-medium mb-2">Upcoming assignments</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing with a due date yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((a) => {
              const left = daysLeft(a.dueDate!);
              return (
                <li key={a.id} className="border rounded p-3">
                  <div className="text-sm text-gray-500">{a.courseName}</div>
                  <div className="font-medium">{a.title}</div>
                  <div className="text-sm">
                    Due {a.dueDate!.toLocaleDateString()} —{" "}
                    {left < 0
                      ? "overdue"
                      : left === 0
                        ? "due today"
                        : `${left} day${left === 1 ? "" : "s"} left`}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {noDeadline.length > 0 && (
        <section>
          <h2 className="font-medium mb-2">No deadline</h2>
          <ul className="flex flex-col gap-2">
            {noDeadline.map((a) => (
              <li key={a.id} className="border rounded p-3">
                <div className="text-sm text-gray-500">{a.courseName}</div>
                <div className="font-medium">{a.title}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-medium mb-2">Courses</h2>
        {courses.length === 0 ? (
          <p className="text-sm text-gray-500">No synced courses yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {courses.map((c) => (
              <li key={c.id} className="border rounded p-3">
                <div className="font-medium">{c.name}</div>
                <div className="text-sm text-gray-500">
                  {c.assignments.length} assignments, {c.announcements.length} announcements
                </div>
                <div className="text-sm">
                  {c.teachers.length === 0
                    ? "No teacher info synced"
                    : c.teachers.map((t) => t.name).join(", ")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
