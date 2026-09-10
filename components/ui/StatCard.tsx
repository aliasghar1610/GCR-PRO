import Link from "next/link";
import { cn } from "@/lib/cn";

export function StatCard({
  label,
  value,
  href,
  tone = "default",
}: {
  label: string;
  value: number;
  href?: string;
  tone?: "default" | "danger";
}) {
  const content = (
    <>
      <p className="micro-label text-text-muted">{label}</p>
      <p
        className={cn(
          "mt-2 text-3xl font-semibold tabular-nums",
          tone === "danger" ? "text-danger" : "text-text-primary"
        )}
      >
        {value}
      </p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="rounded-lg bg-bg-card border border-border shadow-card p-5 block transition-transform hover:-translate-y-0.5 hover:shadow-pop focus-visible:outline-2 focus-visible:outline-accent"
      >
        {content}
      </Link>
    );
  }

  return <div className="rounded-lg bg-bg-card border border-border shadow-card p-5">{content}</div>;
}
