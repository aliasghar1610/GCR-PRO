"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Info, Loader2, AlertTriangle } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    "That Google account is already linked differently. Try another account or contact support.",
  AccessDenied: "Sign-in was cancelled — you can try again whenever you're ready.",
  Default: "Something went wrong signing you in. Please try again.",
};

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.5 29.6 4.5 24 4.5 12.9 4.5 4 13.4 4 24.5s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-4z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 15.9 19 12.5 24 12.5c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.5 29.6 4.5 24 4.5c-7.7 0-14.4 4.4-17.7 10.2z"
      />
      <path
        fill="#4CAF50"
        d="M24 44.5c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6c-2 1.5-4.7 2.6-7.7 2.6-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 40 16.2 44.5 24 44.5z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.6C41.4 35.7 44 30.5 44 24.5c0-1.3-.1-2.7-.4-4z"
      />
    </svg>
  );
}

export function LoginCard() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const errorCode = searchParams.get("error");
  const errorMessage = errorCode ? ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default : null;

  function handleSignIn() {
    setLoading(true);
    signIn("google", { callbackUrl: "/dashboard" });
  }

  return (
    <div className="relative w-full max-w-md rounded-lg bg-bg-card border border-border shadow-pop p-8 flex flex-col items-center text-center gap-6">
      <div className="flex flex-col items-center gap-3">
        <Logo size={48} />
        <div>
          <h1 className="text-2xl font-semibold text-text-primary leading-tight">GCR PRO</h1>
          <p className="mt-1 text-sm text-text-muted">
            Deadlines, grades, and AI study tools — everything Classroom doesn&rsquo;t show you.
          </p>
        </div>
      </div>

      <div className="w-full flex flex-col gap-3">
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-md border border-border-strong bg-bg-card py-2.5 text-sm font-medium text-text-primary hover:bg-bg-subtle transition-colors disabled:opacity-70 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-accent"
        >
          {loading ? (
            <>
              <Loader2 className="size-5 animate-spin text-text-muted" />
              Redirecting to Google…
            </>
          ) : (
            <>
              <GoogleMark />
              Continue with Google
            </>
          )}
        </button>

        {errorMessage && (
          <div className="flex items-start gap-2 rounded-md bg-danger-soft border border-danger/20 px-3 py-2.5 text-left text-sm text-danger">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      <div className="w-full flex flex-col gap-2">
        <p className="micro-label text-accent self-start">Institutional Access</p>
        <div className="flex items-start gap-2.5 rounded-md bg-accent-soft px-3.5 py-3 text-left text-sm text-text-body">
          <Info className="size-4 shrink-0 mt-0.5 text-accent" />
          <p>
            We read your courses, coursework, grades, and instructor contacts from Google
            Classroom. Content you submit to the AI Solver or Quiz Generator is processed by an
            AI provider.{" "}
            <Link href="/privacy" className="font-medium text-accent hover:underline">
              Read our privacy policy
            </Link>
            .
          </p>
        </div>
      </div>

      <p className="text-xs text-text-muted">
        GCR PRO is an independent student tool and isn&rsquo;t affiliated with Google.
      </p>
    </div>
  );
}
