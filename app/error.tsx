"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";

// Catches any unhandled exception in a page/layout below this point and
// shows a friendly message instead of a raw stack trace (6.6).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled app error:", error);
  }, [error]);

  return (
    <main className="min-h-dvh bg-bg-app flex items-center justify-center px-4">
      <Card className="flex flex-col items-center text-center gap-3 py-12 max-w-sm w-full">
        <div className="flex items-center justify-center size-12 rounded-full bg-danger-soft text-danger">
          <AlertTriangle className="size-6" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Something went wrong</h1>
          <p className="mt-1 text-sm text-text-muted">
            That&rsquo;s on us — try again, and if it keeps happening, come back later.
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
    </main>
  );
}
