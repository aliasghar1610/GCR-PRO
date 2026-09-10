import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { groupProfessors } from "@/lib/professors";
import { EmailWriterClient } from "./EmailWriterClient";

export default async function EmailPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string; name?: string }>;
}) {
  const { to } = await searchParams;
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const courses = await prisma.course.findMany({
    where: { userId },
    include: { teachers: true },
    orderBy: { name: "asc" },
  });

  const professors = groupProfessors(courses).filter((p) => p.email);
  const initialGoogleId = to ? professors.find((p) => p.email === to)?.googleId : undefined;

  return <EmailWriterClient professors={professors} initialGoogleId={initialGoogleId} />;
}
