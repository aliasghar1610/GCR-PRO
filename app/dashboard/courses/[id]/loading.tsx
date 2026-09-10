import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";

export default function CourseDetailLoading() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6">
      <Card className="p-0 overflow-hidden">
        <Skeleton className="h-2 w-full rounded-none" />
        <div className="flex items-start gap-4 p-6">
          <Skeleton className="size-12 rounded-md" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex gap-4 px-4 border-t border-border py-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-20" />
          ))}
        </div>
      </Card>
      <Card className="flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="flex-1 flex flex-col gap-2">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </Card>
    </div>
  );
}
