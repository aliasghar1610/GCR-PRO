import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const body = await req.json().catch(() => null);
  const answers: Record<string, string> = body?.answers ?? {};

  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId, userId },
    include: { questions: true },
  });
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  let score = 0;
  for (const q of quiz.questions) {
    if (answers[q.id] === q.correctAnswer) score++;
  }

  await prisma.quizAttempt.create({
    data: { quizId, userId, score, answers },
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
