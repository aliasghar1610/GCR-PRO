# GCR PRO

A study layer on top of Google Classroom. It syncs your courses, coursework and
grades, then adds the things Classroom itself doesn't give students: a
cross-course deadline view, grade trends, AI study aids, generated practice
quizzes, and a Chrome side panel that follows you onto classroom.google.com.

Built as a solo project. Next.js App Router, TypeScript, Prisma/Postgres,
Google Classroom API, Gemini.

---

## What it does

| Feature | Notes |
|---|---|
| **Dashboard** | Deadlines, overdue/completed counts, weekly progress, recent activity |
| **Courses & assignments** | Per-course detail with announcements, materials and grades; one cross-course assignments table with filters |
| **AI Solver** | Turns an assignment into an outline, an approach and a rough draft — framed as a study aid to rework, not a submission |
| **Quiz generator** | Multiple-choice quizzes from a course, assignment or uploaded document, with scoring and explanations |
| **Grades** | Per-course averages and a performance-over-time chart; ungraded work is visually distinct from a zero |
| **Professors** | Instructor directory with copy-to-clipboard emails |
| **Email writer** | Drafts a message to an instructor and opens it in Gmail's compose window, ready to send |
| **Documents** | PDF/DOCX upload with text extraction, usable as a source for the solver or quizzes |
| **Chrome extension** | Side panel with due-soon deadlines and the current course's instructors |

---

## Security

This project was audited against a written threat model before deployment.
[**SECURITY-AUDIT.md**](./SECURITY-AUDIT.md) records every finding with its
severity, realistic impact, the fix, and how the fix was verified.

Highlights of the resulting design:

- **Minimal OAuth scopes, no restricted scopes.** Every Google permission is
  read-only. The app requests no Gmail scope and no Drive scope, so it cannot
  read your mail, browse your Drive, or change anything in Classroom.
- **Drive files without Drive access.** Attachments are fetched by the browser
  using a token scoped to the single file you picked; the server never holds a
  credential that can read your Drive.
- **Google tokens encrypted at rest** (AES-256-GCM) under a key held outside the
  database, so a database copy alone yields no usable account access.
- **Ownership scoping is tested, not assumed.** `npm run test:security` seeds two
  users and replays every id-accepting route's query as the wrong user. This
  caught a real cross-user grade leak, which is written up in the audit.
- **Untrusted content is treated as untrusted** — Classroom text and uploaded
  documents are delimited in AI prompts, model output never drives control flow,
  and no AI output is rendered as raw HTML.

---

## Running locally

```bash
npm install
cp .env.example .env      # then fill it in
npx prisma migrate deploy
npm run dev
```

You'll need a Google Cloud project with the Classroom API enabled and an OAuth
client whose redirect URI is `http://localhost:3000/api/auth/callback/google`,
plus a Postgres database and a Gemini API key. Every variable is documented in
[.env.example](./.env.example).

Two secrets must be generated rather than copied:

```bash
openssl rand -base64 32   # TOKEN_ENCRYPTION_KEY — must decode to exactly 32 bytes
openssl rand -base64 32   # EXTENSION_JWT_SECRET — deliberately not NEXTAUTH_SECRET
```

Rotating `TOKEN_ENCRYPTION_KEY` invalidates every stored Google token and forces
all users to re-consent.

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run test:security` | Cross-user access probe (needs `DATABASE_URL`) |

### Chrome extension

Load `extension/` unpacked via `chrome://extensions` with Developer Mode on,
then visit `/extension-connect` in the web app to link it. `API_BASE` in
`extension/background.js` and `extension/sidepanel/panel.js` must point at the
same origin the app is served from.

---

## Deployment notes

- Set every variable from `.env.example` in your host's dashboard, never in the
  repo. Production should use its own OAuth client, database and freshly
  generated secrets.
- On serverless hosts use a **pooled** Postgres connection, not the direct one.
- `NEXTAUTH_URL` must be the real https origin — cookie security is derived
  from it.
- **Deadline alerts** (`/api/alerts/check`) need a scheduler that sends
  `Authorization: Bearer $CRON_SECRET`. Nothing calls it automatically yet; see
  `netlify.toml` for where that hooks in.
- The Content-Security-Policy in `next.config.ts` ships as **Report-Only**.
  Exercise login, the Drive Picker, the solver and the quiz flow, clear any
  violations, then switch the header name to enforce it.

---

## Status

Working and deployed as a portfolio project. Known open items are tracked in the
audit; the notable one is that `Course`, `Assignment` and `Submission` are keyed
by Google's globally-shared ids, so two users enrolled in the same Classroom
course contend for the same rows. Cross-user data exposure from this is fixed
and tested, but the underlying per-user keying migration is still outstanding.
