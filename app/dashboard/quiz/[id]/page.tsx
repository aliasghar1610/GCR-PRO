import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { QuizRunner } from "./QuizRunner";

export default async function QuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const quiz = await prisma.quiz.findFirst({
    where: { id, userId },
    include: { questions: true },
  });

  if (!quiz) {
    return (
      <main className="p-8">
        <p>Quiz not found.</p>
      </main>
    );
  }

  return (
    <main className="p-8 flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">{quiz.title}</h1>
        <div className="flex gap-4 text-sm">
          <Link href={`/quiz/${quiz.id}/share`} className="underline">
            Share (read-only)
          </Link>
          <Link href="/dashboard" className="underline">Back to dashboard</Link>
        </div>
      </div>
      <QuizRunner
        quizId={quiz.id}
        questions={quiz.questions.map((q) => ({
          id: q.id,
          question: q.question,
          options: q.options,
        }))}
      />
    </main>
  );
}
