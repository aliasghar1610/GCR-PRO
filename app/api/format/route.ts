import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";

const TEMPLATE_PATH = path.join(process.cwd(), "templates", "assignment.docx");

const bodySchema = z.object({
  studentName: z.string().max(200).optional(),
  rollNumber: z.string().max(100).optional(),
  subject: z.string().max(200).optional(),
  courseName: z.string().max(200).optional(),
  title: z.string().min(1).max(300),
  body: z.string().min(1).max(60_000),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
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
  const { studentName, rollNumber, subject, courseName, title, body: content } = parsed.data;

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

  const buffer: Buffer = doc.getZip().generate({ type: "nodebuffer" });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${title.replace(/[^a-z0-9]+/gi, "_")}.docx"`,
    },
  });
}
