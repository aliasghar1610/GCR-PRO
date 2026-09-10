import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/cn";

export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn("flex items-center justify-center rounded-lg bg-accent text-white shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <GraduationCap style={{ width: size * 0.6, height: size * 0.6 }} />
    </div>
  );
}
