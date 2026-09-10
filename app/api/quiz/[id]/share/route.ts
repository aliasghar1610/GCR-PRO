import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Mints (or returns) the share link for a quiz the caller owns.
 *
 * Sharing is opt-in: until this runs, Quiz.shareId is null and there is no
 * public URL for the quiz at all. The id is 128 bits of randomness rather than
 * the primary key, so share URLs can't be guessed or walked.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;
  const quiz = await prisma.quiz.findFirst({
    where: { id, userId },
    select: { id: true, shareId: true },
  });
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  const shareId = quiz.shareId ?? randomBytes(16).toString("hex");
  if (!quiz.shareId) {
    await prisma.quiz.update({ where: { id: quiz.id }, data: { shareId } });
  }

  return NextResponse.json({ shareId });
}

/** Revokes an existing share link. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;
  const updated = await prisma.quiz.updateMany({
    where: { id, userId },
    data: { shareId: null },
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
