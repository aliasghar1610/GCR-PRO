import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  // The recipient must be an instructor on one of this user's own courses —
  // otherwise this is a general-purpose "write a personalised email to any
  // address" endpoint running on our AI budget, which is both a cost problem
  // and an abuse vector.
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

  // The draft is handed back to the browser and never touches the user's
  // mailbox. Writing it to Gmail would require the `gmail.compose` scope,
  // which is a Google *restricted* scope: it would let this app create
  // messages in the user's account and would put every user's mailbox inside
  // this app's breach radius. The compose-URL handoff in the UI achieves the
  // same result with no mail access at all.
  return NextResponse.json({ draft: draftText, subject: `Re: ${sanitizeHeaderValue(topic)}` });
}
