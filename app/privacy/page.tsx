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
        generating a study aid or quiz from an assignment, and writing a draft email to a
        professor.
      </p>
    ),
  },
  {
    title: "What we deliberately cannot do",
    body: (
      <>
        <p className="mb-2">
          The permissions this app asks for are every permission it has. It requests no
          &ldquo;restricted&rdquo; Google scopes, so there are things it is structurally incapable
          of doing:
        </p>
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li>
            <strong>It has no access to your email.</strong> The Email Writer generates text and
            opens Gmail&rsquo;s own compose window with it filled in. GCR PRO cannot read, write,
            or send mail, and never sees your mailbox.
          </li>
          <li>
            <strong>It has no access to your Drive.</strong> When you attach a Drive file, your
            browser fetches that one file using a permission scoped to it alone. Our server never
            holds a credential that can browse your Drive.
          </li>
          <li>
            <strong>It cannot change anything in Classroom.</strong> Every Classroom permission
            requested is read-only — it cannot submit work, post, or alter your grades.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Where it's stored",
    body: (
      <p>
        In a Postgres database hosted on Supabase. Your Google tokens are stored there so we can
        sync Classroom on your behalf, and they are <strong>encrypted at rest</strong>{" "}
        (AES-256-GCM) under a key held outside the database, so a copy of the database alone does
        not yield usable access to your Google account. They are never sent to the Chrome
        extension and never appear in any client-side code.
      </p>
    ),
  },
  {
    title: "Third-party AI processing (Limited Use disclosure)",
    body: (
      <p>
        When you use the study aid, quiz generator, or email writer, the relevant assignment text
        (and any Drive file or uploaded document text you attach) is sent to Google&rsquo;s Gemini
        API to generate a response. Only the text the feature needs is sent — not your name,
        email, roll number, or anyone else&rsquo;s data. This is used only to produce that
        response for you — never for advertising, and never to train AI models. Our use of Google
        Classroom data complies with the Google API Services User Data Policy, including the
        Limited Use requirements.
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
