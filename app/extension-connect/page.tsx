"use client";

import { useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { useTheme } from "next-themes";
import { Puzzle, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";

declare global {
  interface Window {
    chrome?: {
      runtime?: {
        sendMessage: (
          extensionId: string,
          message: unknown,
          callback?: (response?: { ok?: boolean }) => void
        ) => void;
        lastError?: { message?: string };
      };
    };
  }
}

const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID;

export default function ExtensionConnectPage() {
  const { data: session, status } = useSession();
  const { resolvedTheme } = useTheme();
  const [state, setState] = useState<"idle" | "connecting" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleConnect() {
    setState("connecting");
    setMessage(null);
    try {
      const res = await fetch("/api/extension/token", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not issue a token");

      if (!EXTENSION_ID || !window.chrome?.runtime?.sendMessage) {
        throw new Error("GCR PRO extension not detected — make sure it's installed and loaded.");
      }

      window.chrome.runtime.sendMessage(
        EXTENSION_ID,
        { type: "GCR_TOKEN", token: data.token, theme: resolvedTheme ?? "system" },
        (response) => {
          if (window.chrome?.runtime?.lastError || !response?.ok) {
            setState("error");
            setMessage("Couldn't reach the extension. Make sure it's installed and try again.");
            return;
          }
          setState("done");
        }
      );
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (status === "loading") {
    return (
      <main className="min-h-dvh bg-bg-app flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-text-muted" />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-dvh bg-bg-app flex items-center justify-center px-4">
        <Card className="flex flex-col items-center gap-4 text-center max-w-sm w-full">
          <p className="text-sm text-text-body">Sign in to connect the GCR PRO extension.</p>
          <button
            onClick={() => signIn("google")}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
          >
            Sign in with Google
          </button>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-bg-app flex items-center justify-center px-4">
      <Card className="flex flex-col items-center gap-4 text-center max-w-sm w-full">
        <div className="flex items-center justify-center size-12 rounded-full bg-accent-soft text-accent">
          <Puzzle className="size-6" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Connect the extension</h1>
          <p className="mt-1.5 text-sm text-text-muted">
            Links the Chrome extension to your account so it can show deadlines and search
            Classroom without a separate sign-in. No password or Google token is ever given to the
            extension — just a revocable app token.
          </p>
        </div>
        <button
          onClick={handleConnect}
          disabled={state === "connecting"}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-60"
        >
          {state === "connecting" && <Loader2 className="size-4 animate-spin" />}
          {state === "connecting" ? "Connecting…" : "Connect extension"}
        </button>
        {state === "done" && (
          <p className="flex items-center gap-1.5 text-sm text-success">
            <CheckCircle2 className="size-4" /> Connected! You can close this tab.
          </p>
        )}
        {message && (
          <p className="flex items-center gap-1.5 text-sm text-danger">
            <AlertTriangle className="size-4 shrink-0" /> {message}
          </p>
        )}
      </Card>
    </main>
  );
}
