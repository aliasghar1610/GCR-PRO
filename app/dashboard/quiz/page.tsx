import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { QuizGeneratorForm } from "./QuizGeneratorForm";

export default async function QuizGeneratePage() {
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

  const [courses, assignments] = await Promise.all([
    prisma.course.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    prisma.assignment.findMany({
      where: { course: { userId } },
      include: { course: true },
      orderBy: { title: "asc" },
    }),
  ]);

  return (
    <main className="p-8 flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Generate a Quiz</h1>
        <Link href="/dashboard" className="text-sm underline">Back to dashboard</Link>
      </div>
      <QuizGeneratorForm
        courses={courses.map((c) => ({ id: c.id, name: c.name }))}
        assignments={assignments.map((a) => ({
          id: a.id,
          title: a.title,
          courseName: a.course.name,
        }))}
      />
    </main>
  );
}
