import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  answers: z.record(z.string().max(200), z.string().max(2000)).default({}),
}).strict();

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id: quizId } = await params;
  const rawBody = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { answers } = parsed.data;

  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId, userId },
    include: { questions: true },
  });
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  // Only accept answers keyed by this quiz's own question ids — anything else
  // is dropped rather than trusted.
  const knownQuestionIds = new Set(quiz.questions.map((q) => q.id));
  const safeAnswers = Object.fromEntries(
    Object.entries(answers).filter(([questionId]) => knownQuestionIds.has(questionId))
  );

  let score = 0;
  for (const q of quiz.questions) {
    if (safeAnswers[q.id] === q.correctAnswer) score++;
  }

  await prisma.quizAttempt.create({
    data: { quizId, userId, score, answers: safeAnswers },
  });

  return NextResponse.json({
    score,
    total: quiz.questions.length,
    feedback: quiz.questions.map((q) => ({
      id: q.id,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
    })),
  });
}
