"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";

type SyncResult = { courses: number; assignments: number; announcements: number };

export default function Home() {
  const { data: session, status } = useSession();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  if (status === "loading") {
    return <main className="p-8">Loading...</main>;
  }

  if (!session) {
    return (
      <main className="p-8 flex flex-col gap-4">
        <h1 className="text-xl font-semibold">GCR PRO</h1>
        <button
          onClick={() => signIn("google")}
          className="border rounded px-4 py-2 w-fit"
        >
          Sign in with Google
        </button>
      </main>
    );
  }

  return (
    <main className="p-8 flex flex-col gap-4">
      <h1 className="text-xl font-semibold">GCR PRO</h1>
      <p>
        Signed in as {session.user?.name} ({session.user?.email})
      </p>
      <button onClick={() => signOut()} className="border rounded px-4 py-2 w-fit">
        Sign out
      </button>
      <button
        onClick={handleSync}
        disabled={syncing}
        className="border rounded px-4 py-2 w-fit disabled:opacity-50"
      >
        {syncing ? "Syncing..." : "Sync my Classroom"}
      </button>
      {result && (
        <p>
          Synced {result.courses} courses, {result.assignments} assignments,{" "}
          {result.announcements} announcements. <Link href="/synced" className="underline">View synced data</Link>
        </p>
      )}
      {error && <p className="text-red-600">{error}</p>}
    </main>
  );
}
