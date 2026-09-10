"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <Card className="flex flex-col items-center text-center gap-3 py-12">
        <div className="flex items-center justify-center size-12 rounded-full bg-danger-soft text-danger">
          <AlertTriangle className="size-6" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Couldn&rsquo;t load your dashboard</h2>
          <p className="mt-1 text-sm text-text-muted max-w-sm">
            Something went wrong fetching your courses and assignments. Try again, and if it keeps
            happening, come back later.
          </p>
        </div>
        <button
          onClick={() => reset()}
          className="mt-2 inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
        >
          <RefreshCw className="size-4" />
          Try again
        </button>
      </Card>
    </div>
  );
}
