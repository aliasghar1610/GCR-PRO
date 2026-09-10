import { TopSearch } from "./TopSearch";
import { SyncIndicator } from "./SyncIndicator";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "./NotificationBell";
import { TopBarAccountMenu } from "./TopBarAccountMenu";

export function TopBar({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  return (
    <header className="h-16 shrink-0 bg-bg-card border-b border-border flex items-center gap-4 px-4 lg:px-6">
      <div className="flex-1 min-w-0">
        <TopSearch />
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <SyncIndicator lastSyncedAt={lastSyncedAt} />
        <ThemeToggle />
        <NotificationBell />
        <div className="w-px h-6 bg-border mx-1" />
        <TopBarAccountMenu />
      </div>
    </header>
  );
}
