import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  alertsEnabled: z.boolean().optional(),
  alertLeadHours: z.number().int().min(1).max(336).optional(), // up to 14 days
});

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const rawBody = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 }
    );
  }

  const user = await prisma.user.update({ where: { id: userId }, data: parsed.data });
  return NextResponse.json({
    alertsEnabled: user.alertsEnabled,
    alertLeadHours: user.alertLeadHours,
  });
}
