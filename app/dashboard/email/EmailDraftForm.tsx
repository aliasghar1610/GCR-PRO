"use client";

import { useState } from "react";

type Professor = { id: string; name: string; email: string | null };

export function EmailDraftForm({ professors }: { professors: Professor[] }) {
  const withEmail = professors.filter((p): p is Professor & { email: string } => !!p.email);
  const [professorId, setProfessorId] = useState(withEmail[0]?.id ?? "");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("polite and professional");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const professor = withEmail.find((p) => p.id === professorId);
    if (!professor) return;

    setLoading(true);
    setError(null);
    setDraft(null);
    setSaved(false);
    try {
      const res = await fetch("/api/email/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName: professor.name,
          recipientEmail: professor.email,
          topic,
          tone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setDraft(data.draft);
      setSaved(!!data.gmailDraftId);
      if (!data.gmailDraftId && data.error) setError(data.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  if (withEmail.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No professor emails synced yet — visit the Professors page, or grant the
        classroom.profile.emails scope and re-sync.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <select
          value={professorId}
          onChange={(e) => setProfessorId(e.target.value)}
          className="border rounded px-2 py-1.5 text-sm bg-[var(--background)] text-[var(--foreground)]"
        >
          {withEmail.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.email})
            </option>
          ))}
        </select>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Topic (e.g. requesting an extension)"
          required
          className="border rounded px-2 py-1.5 text-sm bg-[var(--background)] text-[var(--foreground)]"
        />
        <input
          type="text"
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          placeholder="Tone"
          className="border rounded px-2 py-1.5 text-sm bg-[var(--background)] text-[var(--foreground)]"
        />
        <button
          type="submit"
          disabled={loading}
          className="border rounded px-3 py-1.5 text-sm w-fit disabled:opacity-50"
        >
          {loading ? "Drafting..." : "Generate & save to Gmail drafts"}
        </button>
      </form>
      {draft && (
        <div className="flex flex-col gap-2">
          <div className="border rounded p-4 whitespace-pre-wrap text-sm">{draft}</div>
          {saved && <p className="text-sm text-green-700 dark:text-green-400">Saved to Gmail drafts — review and send it yourself.</p>}
        </div>
      )}
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}
