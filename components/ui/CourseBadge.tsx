import { courseColorClasses, courseInitials } from "@/lib/courseColor";
import { cn } from "@/lib/cn";

export function CourseBadge({
  courseId,
  name,
  size = 36,
  className,
}: {
  courseId: string;
  name: string;
  size?: number;
  className?: string;
}) {
  const tag = courseColorClasses(courseId);
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-md font-semibold shrink-0",
        tag.bg,
        tag.text,
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {courseInitials(name)}
    </span>
  );
}
