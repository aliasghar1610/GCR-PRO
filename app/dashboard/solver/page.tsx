import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SolverForm } from "./SolverForm";

export default async function SolverPage() {
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

  const assignments = await prisma.assignment.findMany({
    where: { course: { userId } },
    include: { course: true },
    orderBy: { title: "asc" },
  });

  return (
    <main className="p-8 flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">AI Study Aid</h1>
        <Link href="/dashboard" className="text-sm underline">Back to dashboard</Link>
      </div>
      <SolverForm
        assignments={assignments.map((a) => ({
          id: a.id,
          title: a.title,
          courseName: a.course.name,
        }))}
      />
    </main>
  );
}
