import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionUserExists } from "@/lib/sessionUser";
import { LoginCard } from "./LoginCard";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  // Checking session.user.id alone isn't enough — a stale session (the
  // User row behind it was deleted) would otherwise bounce here from
  // /dashboard's own existence check, straight back to /dashboard, forever.
  if (session?.user?.id && (await sessionUserExists(session.user.id))) {
    redirect("/dashboard");
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-bg-app px-4">
      {/* Soft geometric background shapes — low opacity, purely decorative. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 size-96 rounded-full bg-accent opacity-[0.06] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 -right-32 size-[28rem] rounded-full bg-accent opacity-[0.05] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 left-1/4 size-80 rounded-full bg-tag-2-solid opacity-[0.05] blur-3xl"
      />

      <Suspense fallback={null}>
        <LoginCard />
      </Suspense>
    </main>
  );
}
