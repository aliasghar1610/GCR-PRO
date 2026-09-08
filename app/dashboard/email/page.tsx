import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmailDraftForm } from "./EmailDraftForm";

export default async function EmailPage() {
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

  const teachers = await prisma.teacher.findMany({
    where: { course: { userId } },
    distinct: ["googleId"],
    orderBy: { name: "asc" },
  });

  return (
    <main className="p-8 flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">AI Email Writer</h1>
        <Link href="/dashboard" className="text-sm underline">Back to dashboard</Link>
      </div>
      <EmailDraftForm
        professors={teachers.map((t) => ({ id: t.id, name: t.name, email: t.email }))}
      />
    </main>
  );
}
