import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Clears stored Google tokens without deleting the account or its synced
// data — Classroom/Gmail features stop working until the user signs in
// again. A full data wipe is /api/account/delete (Settings > Data & Privacy).
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

  const tokenToRevoke = user.refreshToken ?? user.accessToken;
  if (tokenToRevoke) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokenToRevoke)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
    } catch (err) {
      console.error("Failed to revoke Google token during disconnect:", err);
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { accessToken: null, refreshToken: null },
  });

  return NextResponse.json({ ok: true });
}
