import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ACCEPTED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  MAX_EXTRACTED_CHARS,
  parseDocument,
} from "@/lib/documentParse";
import { truncate } from "@/lib/text";

const metaSchema = z.object({
  filename: z.string().min(1).max(300),
  mimeType: z.enum(ACCEPTED_MIME_TYPES),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File is too large — 20MB max" }, { status: 413 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const meta = metaSchema.safeParse({
    filename: file.name,
    mimeType: file.type,
    size: file.size,
  });
  if (!meta.success) {
    // A rejected MIME type or oversized file is still a real row — surfaced
    // in the UI as Unsupported, not silently dropped.
    const doc = await prisma.document.create({
      data: {
        userId,
        filename: file.name.slice(0, 300),
        mimeType: file.type || "unknown",
        size: file.size,
        status: "UNSUPPORTED",
      },
    });
    return NextResponse.json({ document: doc }, { status: 201 });
  }

  const doc = await prisma.document.create({
    data: {
      userId,
      filename: meta.data.filename,
      mimeType: meta.data.mimeType,
      size: meta.data.size,
      status: "PARSING",
    },
  });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseDocument(buffer, meta.data.mimeType);
    const updated = await prisma.document.update({
      where: { id: doc.id },
      data: {
        status: "READY",
        extractedText: truncate(parsed.text, MAX_EXTRACTED_CHARS),
        wordCount: parsed.wordCount,
        pageCount: parsed.pageCount,
      },
    });
    return NextResponse.json({ document: updated }, { status: 201 });
  } catch (err) {
    console.error("Document parse failed:", err);
    const failed = await prisma.document.update({
      where: { id: doc.id },
      data: { status: "FAILED" },
    });
    return NextResponse.json({ document: failed }, { status: 201 });
  }
}
