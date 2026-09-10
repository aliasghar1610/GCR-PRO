import { Skeleton } from "@/components/ui/Skeleton";

export default function DocumentsLoading() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-40 w-full rounded-lg" />
      <div className="rounded-lg bg-bg-card border border-border shadow-card p-5 flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-5 rounded" />
            <div className="flex-1 flex flex-col gap-2">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
