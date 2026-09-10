import { Skeleton } from "@/components/ui/Skeleton";

export default function CoursesLoading() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-bg-card border border-border shadow-card overflow-hidden">
            <Skeleton className="h-1.5 w-full rounded-none" />
            <div className="flex flex-col gap-3 p-5">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-md" />
                <div className="flex-1 flex flex-col gap-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </div>
            <div className="border-t border-border px-5 py-3">
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
