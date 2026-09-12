import Link from "next/link";
import { requireSessionUser } from "@/lib/sessionUser";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { ProfileTab } from "@/components/settings/ProfileTab";
import { AppearanceTab } from "@/components/settings/AppearanceTab";
import { NotificationsTab } from "@/components/settings/NotificationsTab";
import { ConnectedAccountTab } from "@/components/settings/ConnectedAccountTab";
import { DataPrivacyTab } from "@/components/settings/DataPrivacyTab";

const TABS = [
  { key: "profile", label: "Profile" },
  { key: "appearance", label: "Appearance" },
  { key: "notifications", label: "Notifications" },
  { key: "connected", label: "Connected Account" },
  { key: "privacy", label: "Data & Privacy" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const userId = (await requireSessionUser()).id;

  // Explicit select: never pull the whole User row into a component tree.
  // accessToken/refreshToken/extensionTokenHash are reduced to booleans here so
  // there is no way for a stored credential to end up in the RSC payload.
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      rollNumber: true,
      program: true,
      alertsEnabled: true,
      alertLeadHours: true,
      accessToken: true,
      extensionTokenHash: true,
    },
  });
  const latestCourse = await prisma.course.findFirst({
    where: { userId },
    orderBy: { syncedAt: "desc" },
    select: { syncedAt: true },
  });

  const activeTab: TabKey = TABS.some((t) => t.key === tab) ? (tab as TabKey) : "profile";

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold text-text-primary mb-6">Settings</h1>
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-start">
        <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/dashboard/settings?tab=${t.key}`}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                activeTab === t.key
                  ? "bg-accent-soft text-accent"
                  : "text-text-muted hover:bg-bg-subtle hover:text-text-body"
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <Card>
          {activeTab === "profile" && (
            <ProfileTab
              name={user.name ?? ""}
              email={user.email}
              rollNumber={user.rollNumber ?? ""}
              program={user.program ?? ""}
            />
          )}
          {activeTab === "appearance" && <AppearanceTab />}
          {activeTab === "notifications" && (
            <NotificationsTab
              alertsEnabled={user.alertsEnabled}
              alertLeadHours={user.alertLeadHours}
            />
          )}
          {activeTab === "connected" && (
            <ConnectedAccountTab
              connected={!!user.accessToken}
              extensionConnected={!!user.extensionTokenHash}
              lastSyncedAt={latestCourse?.syncedAt.toISOString() ?? null}
            />
          )}
          {activeTab === "privacy" && <DataPrivacyTab email={user.email} />}
        </Card>
      </div>
    </div>
  );
}
