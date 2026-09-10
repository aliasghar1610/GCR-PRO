import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/tokenCrypto";

// Required by Google's Limited Use policy and the Chrome Web Store — the
// single most commonly missed pre-launch requirement (6.9.2). The schema has
// no onDelete: Cascade (several userId columns, e.g. Quiz.userId, aren't even
// real FKs), so this deletes child rows before parents explicitly rather than
// relying on a cascade.
export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.quizAttempt.deleteMany({ where: { OR: [{ userId }, { quiz: { userId } }] } }),
    prisma.quizQuestion.deleteMany({ where: { quiz: { userId } } }),
    prisma.quiz.deleteMany({ where: { userId } }),
    prisma.submission.deleteMany({ where: { userId } }),
    prisma.document.deleteMany({ where: { userId } }),
    prisma.alertLog.deleteMany({ where: { userId } }),
    prisma.apiUsage.deleteMany({ where: { userId } }),
    prisma.assignment.deleteMany({ where: { course: { userId } } }),
    prisma.teacher.deleteMany({ where: { course: { userId } } }),
    prisma.announcement.deleteMany({ where: { course: { userId } } }),
    prisma.course.deleteMany({ where: { userId } }),
  ]);

  // Best-effort — a failed revoke shouldn't block the user from deleting
  // their own data. Revoking the refresh token invalidates the access token
  // that was issued from it too.
  const stored = user.refreshToken ?? user.accessToken;
  const tokenToRevoke = stored ? decryptToken(stored) : null;
  if (tokenToRevoke) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokenToRevoke)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
    } catch (err) {
      console.error("Failed to revoke Google token during account deletion:", err);
    }
  }

  await prisma.user.delete({ where: { id: userId } });

  return NextResponse.json({ ok: true });
}
