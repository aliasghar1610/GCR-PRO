"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";

export function ProfileTab({
  name: initialName,
  email,
  rollNumber: initialRollNumber,
  program: initialProgram,
}: {
  name: string;
  email: string;
  rollNumber: string;
  program: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(initialName);
  const [rollNumber, setRollNumber] = useState(initialRollNumber);
  const [program, setProgram] = useState(initialProgram);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, rollNumber: rollNumber || null, program: program || null }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast("Profile saved");
      router.refresh();
    } catch {
      toast("Failed to save profile", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 max-w-md">
      <h2 className="text-base font-semibold text-text-primary">Profile</h2>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-body">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-border bg-bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-body">Email</label>
        <input
          value={email}
          disabled
          className="rounded-md border border-border bg-bg-subtle px-3 py-2 text-sm text-text-muted"
        />
        <p className="text-xs text-text-muted">Your email comes from your Google account and can&rsquo;t be changed here.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-body">Roll Number</label>
        <input
          value={rollNumber}
          onChange={(e) => setRollNumber(e.target.value)}
          placeholder="e.g. 21-CS-042"
          className="rounded-md border border-border bg-bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-body">Program</label>
        <input
          value={program}
          onChange={(e) => setProgram(e.target.value)}
          placeholder="e.g. BS Computer Science"
          className="rounded-md border border-border bg-bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <p className="text-xs text-text-muted">
          Roll number and program appear on the cover page when you download a formatted document
          from the AI Solver.
        </p>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="self-start inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-60"
      >
        {saving && <Loader2 className="size-4 animate-spin" />}
        Save changes
      </button>
    </div>
  );
}
