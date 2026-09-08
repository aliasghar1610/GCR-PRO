import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const TEMPLATE_PATH = path.join(process.cwd(), "templates", "assignment.docx");

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const requestBody = await req.json().catch(() => null);
  const studentName: string | undefined = requestBody?.studentName;
  const rollNumber: string | undefined = requestBody?.rollNumber;
  const subject: string | undefined = requestBody?.subject;
  const courseName: string | undefined = requestBody?.courseName;
  const title: string | undefined = requestBody?.title;
  const content: string | undefined = requestBody?.body;

  if (!title || !content) {
    return NextResponse.json({ error: "title and body are required" }, { status: 400 });
  }

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
