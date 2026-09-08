import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGoogleAuthClient } from "@/lib/google-auth";
import { askClaude } from "@/lib/ai";

const SYSTEM_PROMPT = `You write polite, well-structured, concise emails from a student to their \
professor. Given a recipient name, a topic, and a tone, write ONLY the email body — no subject \
line, no placeholder brackets. Address the recipient by the given name. Keep it professional and \
appropriately brief.`;

function toRawMessage(to: string, subject: string, body: string): string {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
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

  const body = await req.json().catch(() => null);
  const recipientName: string | undefined = body?.recipientName;
  const recipientEmail: string | undefined = body?.recipientEmail;
  const topic: string | undefined = body?.topic;
  const tone: string | undefined = body?.tone;

  if (!recipientEmail || !topic) {
    return NextResponse.json(
      { error: "recipientEmail and topic are required" },
      { status: 400 }
    );
  }

  const userContent = `Recipient: ${recipientName ?? "Professor"}\nTopic: ${topic}\nTone: ${
    tone ?? "polite and professional"
  }`;

  let draftText: string;
  try {
    draftText = await askClaude(SYSTEM_PROMPT, userContent);
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
