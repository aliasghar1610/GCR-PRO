import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "What we collect",
    body: (
      <ul className="list-disc pl-5 flex flex-col gap-1.5">
        <li>Your Google account&rsquo;s name, email, and profile picture.</li>
        <li>
          Classroom data you have access to: courses, assignments, announcements, your own
          submissions and grades, and teacher names/emails (only if you grant the
          classroom.profile.emails scope).
        </li>
        <li>Content of a Drive file only when you explicitly pick one with the Drive file picker, or a document you upload directly.</li>
        <li>Quizzes generated for you and your answers to them.</li>
      </ul>
    ),
  },
  {
    title: "Why we collect it",
    body: (
      <p>
        Solely to run the features you use: syncing your dashboard, showing grades and deadlines,
        generating a study aid or quiz from an assignment, and drafting an email to a professor
        (saved to your Gmail drafts — never sent automatically).
      </p>
    ),
  },
  {
    title: "Where it's stored",
    body: (
      <p>
        In a Postgres database hosted on Supabase. Your Google access/refresh tokens are stored
        there too, so we can call the Classroom API on your behalf — they are never sent to the
        Chrome extension or exposed in any client-side code.
      </p>
    ),
  },
  {
    title: "Third-party AI processing (Limited Use disclosure)",
    body: (
      <p>
        When you use the study aid, quiz generator, or email drafter, the relevant assignment text
        (and any Drive file or uploaded document text you attach) is sent to Google&rsquo;s Gemini
        API to generate a response. This data is used only to produce that response for you —
        never for advertising, and never to train AI models. Our use of Google Classroom data
        complies with Google API Services User Data Policy, including the Limited Use
        requirements.
      </p>
    ),
  },
  {
    title: "The Chrome extension",
    body: (
      <p>
        The extension holds no API keys, no Google token, and no database credentials. It only
        stores a revocable app token (issued when you click &ldquo;Connect extension&rdquo;) used
        to call the same backend the web app uses.
      </p>
    ),
  },
  {
    title: "Deleting your data",
    body: (
      <p>
        Sign in and visit Settings → Data &amp; Privacy to permanently delete your account. This
        removes every row associated with you (courses, assignments, submissions, documents,
        quizzes, alerts) from our database, clears the extension token, and revokes our access to
        your Google account. This cannot be undone.
      </p>
    ),
  },
  {
    title: "Age",
    body: (
      <p>
        GCR PRO is intended for students old enough to consent to this policy under applicable
        law, or with a parent/guardian&rsquo;s consent where required. If you believe a minor has
        used this app without appropriate consent, contact us and we will delete the account.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-bg-app px-4 py-10">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-text-primary">Privacy Policy</h1>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
          >
            <ArrowLeft className="size-3.5" /> Home
          </Link>
        </div>

        <p className="text-sm text-text-body leading-relaxed">
          GCR PRO is a small, independently-run project that adds study tools on top of your
          Google Classroom account. This page explains what data it collects, why, where
          it&rsquo;s stored, and how to delete it.
        </p>

        {SECTIONS.map((s) => (
          <section key={s.title} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-text-primary">{s.title}</h2>
            <div className="text-sm text-text-body leading-relaxed">{s.body}</div>
          </section>
        ))}
      </div>
    </main>
  );
}
