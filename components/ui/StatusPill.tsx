import { cn } from "@/lib/cn";

export type PillStatus =
  | "overdue"
  | "due-soon"
  | "upcoming"
  | "completed"
  | "turned-in"
  | "late"
  | "graded"
  | "missing"
  | "not-started";

const STYLES: Record<PillStatus, { label: string; className: string }> = {
  overdue: { label: "Overdue", className: "bg-danger-soft text-danger" },
  "due-soon": { label: "Due Soon", className: "bg-warning-soft text-warning" },
  upcoming: { label: "Upcoming", className: "bg-accent-soft text-accent" },
  completed: { label: "Completed", className: "bg-success-soft text-success" },
  "turned-in": { label: "Turned In", className: "bg-success-soft text-success" },
  late: { label: "Late", className: "bg-warning-soft text-warning" },
  graded: { label: "Graded", className: "bg-accent-soft text-accent" },
  missing: { label: "Missing", className: "bg-danger-soft text-danger" },
  "not-started": { label: "Not Started", className: "bg-bg-subtle text-text-muted" },
};

// Status is always carried by the text label, never color alone (§14 a11y).
export function StatusPill({ status, className }: { status: PillStatus; className?: string }) {
  const { label, className: styleClassName } = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        styleClassName,
        className
      )}
    >
      {label}
    </span>
  );
}
