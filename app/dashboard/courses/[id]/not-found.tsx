import Link from "next/link";
import { BookX } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export default function CourseNotFound() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <Card className="p-0">
        <EmptyState
          icon={BookX}
          title="Course not found"
          description="It may have been removed, or you don't have access to it."
          action={
            <Link
              href="/dashboard/courses"
              className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
            >
              Back to Courses
            </Link>
          }
        />
      </Card>
    </div>
  );
}
