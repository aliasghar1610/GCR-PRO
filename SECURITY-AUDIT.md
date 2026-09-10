# GCR PRO — Security Audit

Audit of the full repository against `CLAUDE.md` (Security Audit & Hardening
Spec), worked section by section with the code open. Date: 2026-09-10.

**Scope:** Next.js app (`app/`, `components/`, `lib/`), Prisma schema and
migrations, the Chrome extension (`extension/`), configuration, and git history.

**Method:** every control was verified by reading the code, not inferred from an
earlier spec. Ownership scoping was additionally proven with a two-user probe
(`npm run test:security`) rather than by eye.

---

## Summary

| Severity | Found | Fixed this pass | Open |
|---|---|---|---|
| Critical | 0 | 0 | 0 |
| High | 3 | 3 | 0 |
| Medium | 12 | 11 | 1 |
| Low | 7 | 5 | 2 |

No Critical findings. The three High findings are closed. One Medium
(shared-course row collision) and two Low items remain open and are described
with proposed fixes below — one needs a decision before it can be done safely.

---

## High

### [HIGH] Cross-user submission and grade exposure between classmates
- **Location:** `app/dashboard/page.tsx:32`, `app/dashboard/assignments/page.tsx:12`,
  `app/dashboard/courses/page.tsx:19`, `app/dashboard/courses/[id]/page.tsx:20`
- **Category:** Broken Access Control (OWASP A01)
- **What's wrong:** `Course`, `Assignment` and `Submission` use Google's
  *globally shared* ids as primary keys. Every student in a Classroom course
  sees the same `courseId` and `courseWorkId`, so two GCR PRO users enrolled in
  the same course write into the same rows. Four of the five read paths pulled
  `submissions: true` with no user filter and then took `submissions[0]` — which
  can be another student's row. Only `app/dashboard/grades/page.tsx:18` filtered
  correctly.
- **Realistic impact:** if two classmates both use GCR PRO — the expected usage
  pattern for a student tool — one sees the other's assigned grades, turned-in
  state and lateness on the dashboard, the assignments table, the courses grid
  and the course detail page. Course averages silently mixed both students' marks.
- **Fix applied:** every read now scopes the relation to the viewing user
  (`submissions: { where: { userId } }`). The course detail page's hoisted
  `courseInclude` became `courseInclude(userId)` so the scope can't be forgotten.
- **Verified by:** `npm run test:security` ("submissions scoped by viewer"). The
  check was also confirmed capable of failing: replaying the pre-fix query
  against a seeded classmate's submission returned that classmate's grade (42),
  while the post-fix query returns none.

### [HIGH] Google refresh tokens stored in plaintext
- **Location:** `prisma/schema.prisma:15-16`, `lib/auth.ts` (jwt callback)
- **Category:** Cryptographic Failure (OWASP A02)
- **What's wrong:** `User.accessToken` / `User.refreshToken` were written to
  Postgres as readable text. A Google refresh token is a long-lived master key
  to every granted scope.
- **Realistic impact:** a single database dump, a leaked backup, or a read-only
  DB credential hands an attacker live access to every user's Google account
  within the granted scopes — their Classroom data and the ability to create
  Gmail drafts. No further compromise of the app is needed.
- **Fix applied:** new `lib/tokenCrypto.ts` encrypts both tokens with
  AES-256-GCM (random 96-bit IV per value, authenticated, stored as
  `v1:iv:tag:ciphertext`) under a dedicated `TOKEN_ENCRYPTION_KEY`. Writes go
  through `encryptOptionalToken` in `lib/auth.ts` and the token-refresh handler
  in `lib/google-auth.ts`; reads decrypt in `getGoogleAuthClient`, and the
  revoke paths in `/api/account/delete` and `/api/account/disconnect` decrypt
  before calling Google's revoke endpoint. A failed decryption is treated as
  "no usable token" and raises `ReauthRequiredError` rather than throwing into a
  handler.
- **Note:** values written before this change are read back as legacy plaintext
  and re-encrypted on the next token refresh. That branch in `decryptToken` can
  be deleted once no legacy rows remain.
- **Verified by:** `npx tsc --noEmit` and a clean production build; the
  encrypt/decrypt round trip is exercised on every sign-in.

### [HIGH] Extension bearer tokens signed with the NextAuth session secret
- **Location:** `lib/extensionAuth.ts:10` (was `process.env.NEXTAUTH_SECRET`)
- **Category:** Cryptographic Failure (OWASP A02)
- **What's wrong:** the extension JWT and NextAuth's session cookies were keyed
  off the same secret — two credential systems with different lifetimes,
  different blast radii and different exposure surfaces sharing one key.
- **Realistic impact:** a leak of that one value forges both extension tokens
  and web sessions; rotating it to contain one incident force-invalidates the
  other. Key separation is what keeps those two incidents independent.
- **Fix applied:** dedicated `EXTENSION_JWT_SECRET` (rejected at startup if
  shorter than 32 chars), and `jwtVerify` now pins `algorithms: ["HS256"]` so a
  token advertising another algorithm is refused before its signature is
  considered.
- **Verified by:** build passes; both secrets generated and added to `.env`, and
  documented in the new `.env.example`.

---

## Medium

### [MEDIUM] Quiz share links were the primary key, and unauthenticated
- **Location:** `app/quiz/[id]/share/page.tsx` (route replaced)
- **Category:** Broken Access Control (OWASP A01)
- **What's wrong:** the share page did `prisma.quiz.findUnique({ where: { id } })`
  with no auth and no owner check, using the quiz's cuid primary key as the
  capability. cuid is not designed to be unguessable and is partly sequential.
- **Realistic impact:** anyone who obtains or guesses a quiz id reads its
  questions, answers and title — and the title embeds the source assignment,
  course or uploaded filename of a real student. Every quiz was reachable this
  way, whether or not its owner ever shared it.
- **Fix applied:** sharing is now opt-in. Added `Quiz.shareId String? @unique`
  (migration `20260910180000_quiz_share_id`), null until the owner shares.
  `POST /api/quiz/[id]/share` mints 128 bits of `randomBytes` scoped to the
  owner; `DELETE` revokes it. The page moved to `/quiz/share/[shareId]` and
  looks up strictly by `shareId` with an explicit `select` that excludes the
  owner, their attempts and their scores.
- **Verified by:** `npm run test:security` ("share page via guessed id",
  "quiz share minting").

### [MEDIUM] HTML injection into deadline alert emails
- **Location:** `app/api/alerts/check/route.ts` (email body construction)
- **Category:** Injection (OWASP A03)
- **What's wrong:** assignment titles, course names and the recipient's name were
  interpolated raw into the alert email's HTML. Titles and course names come
  from the Classroom API — authored by whoever set up the course, i.e. trust
  boundary 3.
- **Realistic impact:** a course or assignment named with markup injects
  arbitrary HTML (including links) into an email our domain sends to a student,
  who has every reason to trust it. A convincing phishing link delivered from a
  legitimate sender.
- **Fix applied:** new `escapeHtml` in `lib/text.ts`, applied to every
  interpolated value in the message.

### [MEDIUM] Email header injection via the draft subject
- **Location:** `app/api/email/draft/route.ts` (`toRawMessage`)
- **Category:** Injection (OWASP A03)
- **What's wrong:** `Subject: Re: ${topic}` placed up-to-2000 chars of user input,
  newlines included, straight into an RFC 5322 header block.
- **Realistic impact:** a newline in `topic` appends headers of the caller's
  choosing (`Bcc:`, `Reply-To:`) to the drafted message, or terminates the
  header block early to control the body.
- **Fix applied:** `sanitizeHeaderValue` strips CR/LF from both `To` and
  `Subject`, and the subject is RFC 2047 base64-encoded.

### [MEDIUM] Email drafts could be addressed to any recipient
- **Location:** `app/api/email/draft/route.ts`
- **Category:** Broken Access Control (OWASP A01)
- **What's wrong:** `recipientEmail` was accepted as any valid address, contrary
  to spec §12 ("recipient addresses come from the authenticated user's own
  record").
- **Realistic impact:** bounded — the result is a *draft* in the caller's own
  mailbox, not a send, so this is not an open relay. But it let the app's Gemini
  budget and the user's Gmail account be driven toward arbitrary third parties.
- **Fix applied:** the recipient must match a `Teacher` on one of the caller's
  own courses, or the request is refused with 403.

### [MEDIUM] Upload MIME type trusted from the client
- **Location:** `app/api/documents/upload/route.ts`, `lib/documentParse.ts`
- **Category:** Insecure Design
- **What's wrong:** the accepted type was validated against `file.type`, which is
  supplied by the browser, and the bytes were then handed to the matching parser.
- **Realistic impact:** a file's declared type steered which parser ran on
  attacker-chosen bytes — e.g. a zip presented as `application/pdf`.
- **Fix applied:** `sniffMimeType` identifies the file from its own leading bytes
  (`%PDF-`, `PK\x03\x04`) and the declared type must agree; anything else is
  recorded as `UNSUPPORTED` and never parsed. The same check now guards
  `extractPdfText` in `lib/drive.ts`.

### [MEDIUM] No timeout on document parsing
- **Location:** `lib/documentParse.ts`, `lib/drive.ts`
- **Category:** Denial of Service
- **What's wrong:** PDF/DOCX parsing had a size cap but no time bound. DOCX is a
  zip, so a small file can expand enormously.
- **Realistic impact:** one malformed or deliberately crafted upload occupies a
  serverless invocation until the platform kills it.
- **Fix applied:** `PARSE_TIMEOUT_MS` (20s) enforced via `withTimeout` around
  both parsers.

### [MEDIUM] Missing rate limits on six routes
- **Location:** `/api/format`, `/api/email/draft`, `/api/search`, `/api/sync`,
  `/api/documents/upload`, `/api/drive/extract-pdf`
- **Category:** Denial of Service / cost abuse
- **What's wrong:** only `/api/solve` and `/api/quiz/generate` were limited,
  against spec §9 which lists all of the above.
- **Realistic impact:** unmetered Gemini spend via `/api/email/draft`, unmetered
  CPU via the parsers, and — worst — `/api/sync` letting one user exhaust the
  *project-wide* Google Classroom quota, degrading the app for everyone.
- **Fix applied:** per-user Postgres-backed limits on all six.

### [MEDIUM] Rate-limit responses gave no reset time
- **Location:** `lib/rateLimit.ts`
- **Category:** Insecure Design (spec §9)
- **Fix applied:** `checkRateLimit` now returns the moment the window frees up,
  and the shared `rateLimitResponse` helper emits 429 with `resetAt`,
  `retryAfterSeconds` and a `Retry-After` header.

### [MEDIUM] Cron secret compared with `!==`
- **Location:** `app/api/alerts/check/route.ts:11`
- **Category:** Cryptographic Failure
- **What's wrong:** the `CRON_SECRET` bearer comparison was a plain string
  compare, which short-circuits on the first differing byte.
- **Realistic impact:** low in practice over a network, but this endpoint sends
  email to every user and writes to the DB, so it deserves a constant-time check.
- **Fix applied:** `timingSafeEqual` with an explicit length guard.

### [MEDIUM] Alert endpoint disclosed pending recipients
- **Location:** `app/api/alerts/check/route.ts` (missing-API-key branch)
- **Category:** Sensitive Data Exposure
- **What's wrong:** when `RESEND_API_KEY` was unset the route returned a
  `wouldAlert` array containing every pending user's email address and
  assignment titles, with HTTP 200.
- **Realistic impact:** a misconfiguration turns a cron endpoint into a roster
  dump, most likely straight into cron/platform logs.
- **Fix applied:** returns a count and HTTP 500; the detail goes to server logs.

### [MEDIUM] Upstream Google errors returned to the client
- **Location:** `app/api/sync/route.ts` (catch block)
- **Category:** Information Disclosure
- **What's wrong:** `err.message` from the Classroom API was passed through
  verbatim, against spec §10.
- **Fix applied:** generic message to the client, full error to server logs.
  `/api/format` gained the same treatment around `docxtemplater.render`, whose
  errors carry template internals.

### [MEDIUM] No security headers or CSP
- **Location:** `next.config.ts`
- **Category:** Security Misconfiguration
- **What's wrong:** the app set none of HSTS, `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, or a CSP.
- **Fix applied:** all five static headers added (HSTS production-only so it
  can't pin localhost), plus a CSP with no `unsafe-eval`, `object-src 'none'`,
  `frame-ancestors 'none'`, and script sources limited to self and the two
  Google origins the Drive Picker needs.
- **Still open below:** the CSP ships as **Report-Only** (see Open Items).

### [MEDIUM] Unbounded search query and result set
- **Location:** `app/api/search/route.ts`
- **Category:** Denial of Service
- **What's wrong:** `q` had no length cap and none of the three queries had a
  `take`, so a one-character query returned every matching row including full
  announcement bodies.
- **Fix applied:** 100-char cap on `q`, `take: 20` per group, and a per-user
  rate limit. Ownership scoping was already correct and is now covered by the
  probe.

---

## Low

### [LOW] `javascript:` URLs reachable through synced links — **fixed**
`alternateLink` is synced from Classroom and was rendered straight into `href`
in the extension panel and three web views. New `lib/safeUrl.ts` (and a matching
`safeUrl` in `extension/sidepanel/panel.js`) allow only http(s). This matters
most in the extension, whose page holds the bearer token.

### [LOW] Extension accepted a token handoff without checking the sender — **fixed**
`chrome.runtime.onMessageExternal` ignored `sender`. Chrome's
`externally_connectable` already gates this, but that list is easy to widen by
accident, so `extension/background.js` now checks `sender.origin` against a
trusted list and rejects anything else.

### [LOW] Extension token was not actually revocable — **fixed**
`revokeExtensionToken` existed but had no caller, so spec §7's "Disconnect
extension" requirement was unmet. Added `DELETE /api/extension/token` and a
"Disconnect extension" control in Settings → Connected Account.

### [LOW] Whole `User` row loaded into a component tree — **fixed**
`app/dashboard/settings/page.tsx` used `findUniqueOrThrow` with no `select`,
pulling `accessToken`, `refreshToken` and `extensionTokenHash` into the render
tree. Nothing serialized them to the client today, but one careless prop would
have. Replaced with an explicit `select`.

### [LOW] No compile-time client/server boundary guard — **fixed**
Added `import "server-only"` to `lib/ai.ts`, `lib/auth.ts`, `lib/prisma.ts`,
`lib/drive.ts`, `lib/classroom.ts`, `lib/google-auth.ts`, `lib/documentParse.ts`,
`lib/extensionAuth.ts`, `lib/rateLimit.ts` and `lib/tokenCrypto.ts`, so importing
any of them from a client component fails the build instead of shipping a secret.

### [LOW] `deepmerge-ts` advisory — **open, no action**
`npm audit` reports GHSA-ggr8-5vv4-36mx (high) via
`prisma → @prisma/config → deepmerge-ts`. `prisma` is a **devDependency** (the
CLI); the advisory is stack exhaustion when merging recursive object graphs,
which is reachable only by feeding the CLI a hostile config we author ourselves.
Not reachable from any request path. The offered fix downgrades Prisma to 6.12
(breaking). Recommend leaving it and re-checking when Prisma ships a bumped
`@prisma/config`. Runtime dependencies are clean.

### [LOW] Rate-limit counter has a check-then-insert race — **open, accepted**
`checkRateLimit` counts then inserts without a transaction, so tightly
parallel requests can each observe a count below the limit and all proceed.
The overshoot is bounded by concurrency, and the limiter exists for cost
control rather than as a security boundary. Fixing properly means a DB-side
atomic counter or an advisory lock — worth doing if AI spend becomes a real
concern, noted rather than done.

---

## Verified as already correct

These were checked against the code and needed no change:

- **No SQL injection surface.** No `$queryRawUnsafe` / `$executeRawUnsafe`
  anywhere; all access goes through parameterized Prisma queries.
- **No raw-HTML rendering of AI output.** No `dangerouslySetInnerHTML` in the
  app. The extension panel builds HTML by interpolation but escapes every value
  through `escapeHtml`.
- **Prompt injection defenses.** `/api/solve` and `/api/quiz/generate` wrap
  untrusted material in `<assignment_material>` / `<study_material>` and
  instruct the model to treat the contents as data. `/api/email/draft` now
  fences its inputs the same way.
- **Model output never drives control flow.** Generated text is stored and
  rendered; no model value reaches a query, path, URL, or permission decision.
  Quiz JSON is fence-stripped, `JSON.parse`d in a try/catch and shape-checked.
- **No SSRF.** Nothing fetches a user-supplied URL. Drive bytes are fetched by
  the *browser* with a short-lived `drive.file` token and posted to us for
  parsing; the server holds no Drive-wide credential.
- **OAuth scopes are minimal** and each is tied to a shipped feature; the
  restricted `drive.readonly` scope is deliberately avoided. PKCE and `state`
  are NextAuth defaults and are not disabled.
- **Session contents.** The `session` callback exposes only `user.id` — no
  Google tokens reach `useSession()`.
- **CORS.** `proxy.ts` reflects one exact extension origin, never `*`, and
  applies the same check to preflights.
- **Account deletion** removes every child row explicitly (several `userId`
  columns are not real FKs, so there is no cascade to rely on), revokes the
  Google token, and drops the user — which also invalidates the extension token.
- **Git history is clean.** No `.env` file was ever committed and no
  secret-shaped string appears in any commit. `.env` is ignored; the new
  `.env.example` carries names and instructions only.
- **No secrets in the client bundle.** Every server secret value from `.env` was
  searched for across all 38 files in `.next/static` after a production build —
  no matches. No secret-bearing variable is `NEXT_PUBLIC_`.
- **No credentials in `extension/`**, confirmed by reading every file.
- **Content script** derives the course id from the URL only; it never reads
  page DOM content and ships it to the backend.
- **No PII in logs.** The only `console.log` calls are sync timing counters
  (ids and durations). Error paths log objects server-side and return generic
  messages.
- **`docxtemplater` template is static** (`templates/assignment.docx`); requests
  supply only the data substituted into placeholders.

---

## Open items

### 1. Shared-course row collision — needs a schema decision (Medium)
The data leak this caused is fixed, but the root cause is not. `Course`,
`Assignment`, `Announcement` and `Submission` are keyed by Google's global ids,
so two GCR PRO users in the same Classroom course contend for one row. The
first to sync owns it; the second's sync is now **skipped** by a guard added to
`app/api/sync/route.ts`, so no data is mixed — but that classmate simply does
not see the course.

That is a correctness bug standing in for a security bug, and it should be fixed
before launch. The proper fix is to key these tables per user: a cuid primary
key plus `@@unique([userId, googleId])` (and `@@unique([courseId, googleId])`
for children), with every query and upsert updated to match. That is a real
migration across roughly fifteen query sites and needs sign-off before starting.

### 2. CSP is Report-Only (Medium)
Shipped as `Content-Security-Policy-Report-Only` deliberately, per spec §10
("start in report-only, then enforce"). Enforcing it without a browser pass
would likely break the Google Picker and the pre-paint theme script. It also
still carries `script-src 'unsafe-inline'`, which Next's hydration bootstrap and
`next-themes` require; removing it needs nonce plumbing through `proxy.ts`.
**Next step:** exercise login, the Picker, the solver and the quiz flow in a
browser, clear any violations, then rename the header to enforce.

### 3. Deployment configuration (blocking, not a code defect)
- `NEXTAUTH_URL` is `http://localhost:3000`. Production needs the real https
  origin — NextAuth derives `__Secure-` cookie prefixing from it.
- `extension/background.js` and `extension/sidepanel/panel.js` hardcode
  `API_BASE = "http://localhost:3000"`, and `manifest.json` lists localhost in
  both `host_permissions` and `externally_connectable`. All must become the
  production https origin before the extension is published — the origin check
  added to the token handoff is only as good as that list.
- `NEXT_PUBLIC_GOOGLE_API_KEY` is public by design (it is inlined into the
  bundle) and must be restricted by HTTP referrer in Google Cloud Console.
- The Supabase URL uses the direct port 5432. On Vercel, use the pooled
  connection (6543, `?pgbouncer=true`) to avoid exhausting connections.
- Production must use its own Google OAuth client, database and freshly
  generated secrets, with no localhost redirect URI on the production client.

### 4. Test coverage (§15)
The repository has no test framework. `npm run test:security` now covers
requirement 1 (cross-user access) as a runnable probe over every id-accepting
predicate. Requirements 2–9 — unauthenticated access, extension token
expiry/wrong-key/`alg:none`/revocation, validation rejection, prompt injection,
rate limiting, CORS, cron auth and post-deletion row checks — still need a real
harness (Vitest plus a running server or a test database).

---

## Could not be verified statically

These need a runtime or console check and are not provable from the code:

- **Google Cloud Console configuration**: the redirect URI allowlist, absence of
  wildcards, referrer restrictions on the Picker API key, and the OAuth consent
  screen's declared scopes.
- **Gemini data-retention terms** for this account tier, which `/privacy` makes
  claims about. Confirm the policy text matches the actual tier.
- **Supabase transport**: that SSL is enforced and the DB password is not a
  default.
- **CSP behavior in a real browser** — see Open Item 2.
- **Account deletion end to end** on a live account, including that Google
  actually accepts the token revocation.
- **Whether any user may be under 18**, which brings Google's education/child
  data policies into play before public launch.
