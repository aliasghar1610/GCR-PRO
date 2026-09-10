import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";

const TEMPLATE_PATH = path.join(process.cwd(), "templates", "assignment.docx");
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 60 * 1000;

const bodySchema = z.object({
  studentName: z.string().max(200).optional(),
  rollNumber: z.string().max(100).optional(),
  subject: z.string().max(200).optional(),
  courseName: z.string().max(200).optional(),
  title: z.string().min(1).max(300),
  body: z.string().min(1).max(60_000),
}).strict();

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const limit = await checkRateLimit(userId, "format", RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    return rateLimitResponse("document formatting", limit.resetAt);
  }

  const rawBody = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 }
    );
  }
  const { studentName, rollNumber, subject, courseName, title, body: content } = parsed.data;

  // The template is a static file we ship; the request only supplies the data
  // substituted into its placeholders, never the template or its delimiters.
  let buffer: Buffer;
  try {
    const templateContent = fs.readFileSync(TEMPLATE_PATH, "binary");
    const zip = new PizZip(templateContent);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    doc.render({
      title,
      studentName: studentName ?? "",
      rollNumber: rollNumber ?? "",
      subject: subject ?? "",
      courseName: courseName ?? "",
      bodyParagraphs: content.split("\n").filter((line) => line.trim() !== ""),
    });

    buffer = doc.getZip().generate({ type: "nodebuffer" });
  } catch (err) {
    // docxtemplater errors carry template internals — log, don't return.
    console.error("DOCX render failed:", err);
    return NextResponse.json({ error: "Could not build the document" }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${title.replace(/[^a-z0-9]+/gi, "_")}.docx"`,
    },
  });
}
