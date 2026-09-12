import Link from "next/link";
import { Users, Mail, Sparkles } from "lucide-react";
import { requireSessionUser } from "@/lib/sessionUser";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Avatar } from "@/components/ui/Avatar";
import { CopyButton } from "@/components/ui/CopyButton";
import { courseColorClasses } from "@/lib/courseColor";
import { groupProfessors } from "@/lib/professors";

export default async function ProfessorsPage() {
  const userId = (await requireSessionUser()).id;

  const courses = await prisma.course.findMany({
    where: { userId },
    include: { teachers: true },
    orderBy: { name: "asc" },
  });

  const professors = groupProfessors(courses);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Professors</h1>
        <p className="text-sm text-text-muted mt-0.5">
          {professors.length} instructor{professors.length === 1 ? "" : "s"} across your courses
        </p>
      </div>

      {professors.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={Users}
            title="No teacher info synced yet"
            description="Instructor contacts from your courses will show up here."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {professors.map((p) => (
            <Card key={p.googleId} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={p.name} image={p.photoUrl} size={40} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{p.name}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {p.courses.map((c) => {
                      const tag = courseColorClasses(c.id);
                      return (
                        <span
                          key={c.id}
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tag.bg} ${tag.text}`}
                        >
                          {c.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {p.email ? (
                <div className="flex items-center gap-2 rounded-md bg-bg-subtle px-2.5 py-2">
                  <Mail className="size-3.5 text-text-muted shrink-0" />
                  <span className="text-xs text-text-body truncate flex-1">{p.email}</span>
                  <CopyButton value={p.email} label="Email copied" />
                </div>
              ) : (
                <p className="text-xs text-text-muted rounded-md bg-bg-subtle px-2.5 py-2">
                  Email not shared — the classroom.profile.emails permission wasn&rsquo;t granted.
                </p>
              )}

              {p.email && (
                <Link
                  href={`/dashboard/email?to=${encodeURIComponent(p.email)}&name=${encodeURIComponent(p.name)}`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-sm font-medium text-text-body hover:bg-bg-subtle transition-colors"
                >
                  <Sparkles className="size-3.5" /> Draft email with AI
                </Link>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
