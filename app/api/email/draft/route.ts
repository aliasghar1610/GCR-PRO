import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGoogleAuthClient } from "@/lib/google-auth";
import { askGemini } from "@/lib/ai";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { sanitizeHeaderValue } from "@/lib/text";

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;

const bodySchema = z.object({
  recipientName: z.string().max(200).optional(),
  recipientEmail: z.string().email().max(320),
  topic: z.string().min(1).max(2000),
  tone: z.string().max(200).optional(),
}).strict();

const SYSTEM_PROMPT = `You write polite, well-structured, concise emails from a student to their \
professor. Given a recipient name, a topic, and a tone, write ONLY the email body — no subject \
line, no placeholder brackets. Address the recipient by the given name. Keep it professional and \
appropriately brief.`;

function toRawMessage(to: string, subject: string, body: string): string {
  // Header values are sanitized, not merely interpolated: a newline in
  // `subject` would otherwise let the caller append arbitrary headers (Bcc,
  // Reply-To) to the drafted message. RFC 2047-encode the subject so
  // non-ASCII survives without needing raw bytes in the header.
  const encodedSubject = `=?utf-8?B?${Buffer.from(sanitizeHeaderValue(subject), "utf8").toString(
    "base64"
  )}?=`;

  const message = [
    `To: ${sanitizeHeaderValue(to)}`,
    `Subject: ${encodedSubject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\n");

  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const rawBody = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 }
    );
  }
  const { recipientName, recipientEmail, topic, tone } = parsed.data;

  const limit = await checkRateLimit(userId, "email-draft", RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    return rateLimitResponse("email drafting", limit.resetAt);
  }

  // The recipient must be an instructor on one of this user's own courses.
  // Without this the endpoint would draft mail to any address the caller
  // names, using the caller's Gmail account.
  const teacher = await prisma.teacher.findFirst({
    where: { email: recipientEmail, course: { userId } },
    select: { id: true },
  });
  if (!teacher) {
    return NextResponse.json(
      { error: "Recipient must be an instructor from one of your courses." },
      { status: 403 }
    );
  }

  // The topic is the student's own text but the recipient name arrives from
  // Classroom, so both are fenced off as data rather than instructions.
  const userContent = `<request>
Recipient: ${recipientName ?? "Professor"}
Topic: ${topic}
Tone: ${tone ?? "polite and professional"}
</request>`;

  let draftText: string;
  try {
    draftText = await askGemini(SYSTEM_PROMPT, userContent);
  } catch (err) {
    console.error("AI email draft failed:", err);
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }

  try {
    const auth = await getGoogleAuthClient(userId);
    const gmail = google.gmail({ version: "v1", auth });
    const raw = toRawMessage(recipientEmail, `Re: ${topic}`, draftText);

    const { data } = await gmail.users.drafts.create({
      userId: "me",
      requestBody: { message: { raw } },
    });

    return NextResponse.json({ draft: draftText, gmailDraftId: data.id });
  } catch (err) {
    console.error("Saving Gmail draft failed:", err);
    return NextResponse.json(
      {
        draft: draftText,
        error:
          "Generated the email but couldn't save it to Gmail drafts (check the gmail.compose scope is granted).",
      },
      { status: 200 }
    );
  }
}
