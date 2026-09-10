import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionUserExists } from "@/lib/sessionUser";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { MobileTabBar } from "@/components/shell/MobileTabBar";
import { CommandPaletteProvider } from "@/components/shell/CommandPaletteProvider";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/");
  }

  // Several dashboard pages assume the session's user row exists and would
  // otherwise crash with a raw Prisma "record not found" error on a stale
  // session — catch that here, once, instead of in every page.
  if (!(await sessionUserExists(session.user.id))) {
    redirect("/");
  }

  const latestCourse = await prisma.course.findFirst({
    where: { userId: session.user.id },
    orderBy: { syncedAt: "desc" },
    select: { syncedAt: true },
  });

  return (
    <CommandPaletteProvider>
      <div className="flex h-dvh overflow-hidden bg-bg-app">
        <Sidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <TopBar lastSyncedAt={latestCourse?.syncedAt.toISOString() ?? null} />
          <main className="flex-1 overflow-y-auto pb-20 md:pb-0">{children}</main>
        </div>
        <MobileTabBar />
      </div>
    </CommandPaletteProvider>
  );
}
