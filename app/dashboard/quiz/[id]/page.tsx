import { notFound } from "next/navigation";
import { requireSessionUser } from "@/lib/sessionUser";
import { prisma } from "@/lib/prisma";
import { QuizRunner } from "./QuizRunner";

export default async function QuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = (await requireSessionUser()).id;

  const quiz = await prisma.quiz.findFirst({
    where: { id, userId },
    include: { questions: true },
  });

  if (!quiz) notFound();

  return (
    <QuizRunner
      quizId={quiz.id}
      title={quiz.title}
      questions={quiz.questions.map((q) => ({
        id: q.id,
        question: q.question,
        options: Array.isArray(q.options) ? (q.options as string[]) : [],
      }))}
    />
  );
}
