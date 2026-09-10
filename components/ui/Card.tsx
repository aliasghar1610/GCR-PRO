import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
  as: As = "div",
}: {
  className?: string;
  children: React.ReactNode;
  as?: React.ElementType;
}) {
  return (
    <As
      className={cn(
        "rounded-lg bg-bg-card border border-border shadow-card p-5",
        className
      )}
    >
      {children}
    </As>
  );
}
