import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  rollNumber: z.string().max(100).nullable().optional(),
  program: z.string().max(200).nullable().optional(),
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
    name: user.name,
    rollNumber: user.rollNumber,
    program: user.program,
  });
}
