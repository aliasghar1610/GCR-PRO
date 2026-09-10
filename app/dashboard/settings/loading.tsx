import { Skeleton } from "@/components/ui/Skeleton";

export default function SettingsLoading() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <Skeleton className="h-7 w-32 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6">
        <div className="flex md:flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
        <div className="rounded-lg bg-bg-card border border-border shadow-card p-5 flex flex-col gap-4 max-w-md">
          <Skeleton className="h-5 w-24" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
