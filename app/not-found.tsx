import Link from "next/link";
import { Compass } from "lucide-react";
import { Card } from "@/components/ui/Card";

export default function NotFound() {
  return (
    <main className="min-h-dvh bg-bg-app flex items-center justify-center px-4">
      <Card className="flex flex-col items-center text-center gap-3 py-12 max-w-sm w-full">
        <div className="flex items-center justify-center size-12 rounded-full bg-accent-soft text-accent">
          <Compass className="size-6" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Page not found</h1>
          <p className="mt-1 text-sm text-text-muted">
            That page doesn&rsquo;t exist, or you don&rsquo;t have access to it.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="mt-2 inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
        >
          Back to Dashboard
        </Link>
      </Card>
    </main>
  );
}
