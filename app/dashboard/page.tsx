import Link from "next/link";
import { ChevronRight, CalendarDays, Megaphone, Inbox } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/sessionUser";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { StatusPill } from "@/components/ui/StatusPill";
import { CourseBadge } from "@/components/ui/CourseBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SyncCTA } from "@/components/dashboard/SyncCTA";
import { dueBucket, isCompleted } from "@/lib/assignmentStatus";
import { relativeTime } from "@/lib/relativeTime";

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default async function DashboardPage() {
  const user = await requireSessionUser();
  const userId = user.id;
  const firstName = (user.name ?? "there").split(" ")[0];
  const now = new Date();

  const courses = await prisma.course.findMany({
    where: { userId },
    include: {
      // Submission rows are keyed by Google's global submission id and hang
      // off the shared Assignment row, so a course shared with another GCR
      // PRO user holds their submissions too. Always scope to this user.
      assignments: { include: { submissions: { where: { userId } } } },
      announcements: true,
      teachers: true,
    },
    orderBy: { name: "asc" },
  });

  if (courses.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <SyncCTA />
      </div>
    );
  }

  const allAssignments = courses.flatMap((c) =>
    c.assignments.map((a) => ({ ...a, course: c, submission: a.submissions[0] }))
  );

  const overdue = allAssignments.filter((a) => dueBucket(a.dueDate, a.submission) === "overdue");
  const dueSoonOrLater = allAssignments.filter((a) => {
    const bucket = dueBucket(a.dueDate, a.submission);
    return bucket === "due-soon" || bucket === "upcoming";
  });
  const completed = allAssignments.filter((a) => isCompleted(a.submission));

  const upcomingDeadlines = [...dueSoonOrLater, ...overdue]
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
    .slice(0, 5);

  const weekEnd = new Date(now.getTime() + WEEK_MS);
  const coursesWithWorkThisWeek = courses.filter((c) =>
    c.assignments.some((a) => a.dueDate && a.dueDate >= now && a.dueDate <= weekEnd)
  );
  const coursesDoneThisWeek = coursesWithWorkThisWeek.filter((c) =>
    c.assignments
      .filter((a) => a.dueDate && a.dueDate >= now && a.dueDate <= weekEnd)
      .every((a) => isCompleted(a.submissions[0]))
  );
  const weekPercent =
    coursesWithWorkThisWeek.length === 0
      ? 0
      : Math.round((coursesDoneThisWeek.length / coursesWithWorkThisWeek.length) * 100);

  const recentActivity = courses
    .flatMap((c) => c.announcements.map((a) => ({ ...a, course: c })))
    .filter((a) => a.createdAt)
    .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime())
    .slice(0, 6);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">
            {greeting(now.getHours())}, {firstName}
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            Here&rsquo;s what&rsquo;s happening across your courses.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-card px-3 py-1.5 text-sm text-text-body">
          <CalendarDays className="size-4 text-text-muted" />
          {now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Courses" value={courses.length} href="/dashboard/courses" />
        <StatCard
          label="Upcoming"
          value={dueSoonOrLater.length}
          href="/dashboard/assignments?filter=due-soon"
        />
        <StatCard
          label="Overdue"
          value={overdue.length}
          tone={overdue.length > 0 ? "danger" : "default"}
          href="/dashboard/assignments?filter=overdue"
        />
        <StatCard
          label="Completed"
          value={completed.length}
          href="/dashboard/assignments?filter=completed"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="flex flex-col gap-4">
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="text-base font-semibold text-text-primary">Upcoming Deadlines</h2>
              <Link
                href="/dashboard/assignments"
                className="text-sm font-medium text-accent hover:underline"
              >
                View All
              </Link>
            </div>
            {upcomingDeadlines.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No upcoming deadlines"
                description="You're all caught up — new assignments will show up here as they're posted."
                className="py-8"
              />
            ) : (
              <ul>
                {upcomingDeadlines.map((a) => {
                  const bucket = dueBucket(a.dueDate, a.submission) ?? "upcoming";
                  return (
                    <li
                      key={a.id}
                      className="flex items-center gap-3 px-5 py-3 border-t border-border first:border-t-0"
                    >
                      <CourseBadge courseId={a.course.id} name={a.course.name} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-primary truncate">{a.title}</p>
                        <p className="text-xs text-text-muted truncate">
                          {a.course.name}
                          {a.course.section ? ` · ${a.course.section}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-xs text-text-muted tabular-nums">
                          {a.dueDate!.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                        <StatusPill status={bucket} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <p className="text-sm font-medium text-text-primary">This Week&rsquo;s Progress</p>
            <p className="text-xs text-text-muted mt-0.5">
              {coursesDoneThisWeek.length} of {coursesWithWorkThisWeek.length} courses completed
            </p>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex-1 h-2 rounded-full bg-bg-subtle overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-300"
                  style={{ width: `${weekPercent}%` }}
                />
              </div>
              <span className="text-2xl font-semibold tabular-nums text-text-primary">
                {weekPercent}%
              </span>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="p-0 overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <h2 className="text-base font-semibold text-text-primary">My Courses</h2>
            </div>
            <ul>
              {courses.map((c) => (
                <li key={c.id} className="border-t border-border first:border-t-0">
                  <Link
                    href={`/dashboard/courses/${c.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-bg-subtle transition-colors"
                  >
                    <CourseBadge courseId={c.id} name={c.name} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary truncate">{c.name}</p>
                      {c.section && <p className="text-xs text-text-muted truncate">{c.section}</p>}
                    </div>
                    <ChevronRight className="size-4 text-text-muted shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <h2 className="text-base font-semibold text-text-primary">Recent Activity</h2>
            </div>
            {recentActivity.length === 0 ? (
              <EmptyState
                icon={Megaphone}
                title="No recent activity"
                description="Announcements from your courses will show up here."
                className="py-8"
              />
            ) : (
              <ul>
                {recentActivity.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-start gap-3 px-5 py-3 border-t border-border first:border-t-0"
                  >
                    <span className="flex items-center justify-center size-8 rounded-full bg-accent-soft text-accent shrink-0 mt-0.5">
                      <Megaphone className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-text-body">
                        New announcement in <span className="font-medium">{a.course.name}</span>
                      </p>
                      <p className="text-xs text-text-muted truncate mt-0.5">
                        {(a.text ?? "").slice(0, 70) || "(no text)"}
                      </p>
                    </div>
                    <span className="text-xs text-text-muted shrink-0 whitespace-nowrap">
                      {relativeTime(a.createdAt!)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
