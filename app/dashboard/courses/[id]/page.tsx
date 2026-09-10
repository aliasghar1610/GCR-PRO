import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { ExternalLink, FileText, Megaphone, GraduationCap, ClipboardList } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { CourseBadge } from "@/components/ui/CourseBadge";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { assignmentChipStatus } from "@/lib/assignmentStatus";
import { gradePercent, courseAveragePercent } from "@/lib/grade";
import { relativeTime } from "@/lib/relativeTime";
import { courseColorClasses } from "@/lib/courseColor";
import { cn } from "@/lib/cn";

const courseInclude = {
  assignments: { include: { submissions: true }, orderBy: { dueDate: "asc" } },
  announcements: { orderBy: { createdAt: "desc" } },
  teachers: true,
} satisfies Prisma.CourseInclude;

type CourseWithData = Prisma.CourseGetPayload<{ include: typeof courseInclude }>;

const TABS = [
  { key: "assignments", label: "Assignments" },
  { key: "announcements", label: "Announcements" },
  { key: "materials", label: "Materials" },
  { key: "grades", label: "Grades" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const course = await prisma.course.findFirst({
    where: { id, userId },
    include: courseInclude,
  });

  if (!course) notFound();

  const activeTab: TabKey = TABS.some((t) => t.key === tabParam) ? (tabParam as TabKey) : "assignments";

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6">
      <Card className="p-0 overflow-hidden">
        <div className={`h-2 ${courseColorClasses(course.id).bar}`} />
        <div className="flex flex-wrap items-start gap-4 p-6">
          <CourseBadge courseId={course.id} name={course.name} size={48} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold text-text-primary truncate">{course.name}</h1>
            {course.section && <p className="text-sm text-text-muted mt-0.5">{course.section}</p>}
          </div>
          {course.teachers.length > 0 && (
            <div className="flex flex-col items-end gap-1.5">
              <AvatarStack
                people={course.teachers.map((t) => ({ name: t.name, image: t.photoUrl }))}
                size={28}
              />
              <p className="text-xs text-text-muted">
                {course.teachers.map((t) => t.name).join(", ")}
              </p>
            </div>
          )}
        </div>
        <nav className="flex gap-1 px-4 border-t border-border">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/dashboard/courses/${course.id}?tab=${t.key}`}
              className={cn(
                "px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === t.key
                  ? "border-accent text-accent"
                  : "border-transparent text-text-muted hover:text-text-body"
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </Card>

      {activeTab === "assignments" && <AssignmentsTab course={course} />}
      {activeTab === "announcements" && <AnnouncementsTab course={course} />}
      {activeTab === "materials" && <MaterialsTab course={course} />}
      {activeTab === "grades" && <GradesTab course={course} />}
    </div>
  );
}

function AssignmentsTab({ course }: { course: CourseWithData }) {
  if (course.assignments.length === 0) {
    return (
      <Card className="p-0">
        <EmptyState
          icon={ClipboardList}
          title="No assignments yet"
          description="Coursework posted in this course will show up here."
        />
      </Card>
    );
  }

  return (
    <Card className="p-0 overflow-hidden">
      <ul>
        {course.assignments.map((a) => {
          const submission = a.submissions[0];
          const status = assignmentChipStatus(a.dueDate, submission);
          const percent = gradePercent(submission?.assignedGrade, a.maxPoints);
          return (
            <li
              key={a.id}
              className="flex items-center gap-3 px-5 py-3 border-t border-border first:border-t-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary truncate">{a.title}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {a.dueDate
                    ? `Due ${a.dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                    : "No due date"}
                </p>
              </div>
              {percent != null && (
                <span className="text-sm tabular-nums text-text-body shrink-0">{percent}%</span>
              )}
              <StatusPill status={status} />
              {a.alternateLink && (
                <a
                  href={a.alternateLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-muted hover:text-accent shrink-0"
                  title="Open in Classroom"
                >
                  <ExternalLink className="size-4" />
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function AnnouncementsTab({ course }: { course: CourseWithData }) {
  if (course.announcements.length === 0) {
    return (
      <Card className="p-0">
        <EmptyState
          icon={Megaphone}
          title="No announcements yet"
          description="Posts from your instructor will show up here."
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {course.announcements.map((a) => (
        <Card key={a.id} className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-text-muted">
              {a.createdAt ? relativeTime(a.createdAt) : "Unknown date"}
            </span>
            {a.alternateLink && (
              <a
                href={a.alternateLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-accent hover:underline shrink-0"
              >
                Open in Classroom <ExternalLink className="size-3" />
              </a>
            )}
          </div>
          <p className="text-sm text-text-body whitespace-pre-wrap">{a.text || "(no text)"}</p>
        </Card>
      ))}
    </div>
  );
}

function MaterialsTab({ course }: { course: CourseWithData }) {
  const withMaterials = course.assignments.filter((a) => a.driveFileIds.length > 0);

  if (withMaterials.length === 0) {
    return (
      <Card className="p-0">
        <EmptyState
          icon={FileText}
          title="No materials yet"
          description="Files attached to coursework will show up here."
        />
      </Card>
    );
  }

  return (
    <Card className="p-0 overflow-hidden">
      <ul>
        {withMaterials.map((a) => (
          <li key={a.id} className="border-t border-border first:border-t-0 px-5 py-3">
            <p className="text-sm font-medium text-text-primary mb-2">{a.title}</p>
            <div className="flex flex-col gap-1.5">
              {a.driveFileIds.map((fileId) => (
                <a
                  key={fileId}
                  href={`https://drive.google.com/file/d/${fileId}/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-text-body hover:text-accent"
                >
                  <FileText className="size-4 text-text-muted shrink-0" />
                  Attachment
                  <ExternalLink className="size-3 text-text-muted" />
                </a>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function GradesTab({ course }: { course: CourseWithData }) {
  const graded = course.assignments.filter((a) => a.submissions[0]?.assignedGrade != null);
  const average = courseAveragePercent(course.assignments);

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-center justify-between">
        <div>
          <p className="micro-label text-text-muted">Course Average</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-text-primary">
            {average == null ? "—" : `${average}%`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-text-body tabular-nums">
            {graded.length} of {course.assignments.length} graded
          </p>
        </div>
      </Card>

      {course.assignments.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={GraduationCap}
            title="No assignments yet"
            description="Grades will show up here once coursework is posted and graded."
          />
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ul>
            {course.assignments.map((a) => {
              const submission = a.submissions[0];
              const percent = gradePercent(submission?.assignedGrade, a.maxPoints);
              return (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border first:border-t-0"
                >
                  <p className="text-sm text-text-body truncate">{a.title}</p>
                  {percent != null ? (
                    <span className="text-sm font-medium tabular-nums text-text-primary shrink-0">
                      {submission?.assignedGrade}/{a.maxPoints} · {percent}%
                    </span>
                  ) : (
                    <span className="text-sm text-text-muted shrink-0">Ungraded</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
