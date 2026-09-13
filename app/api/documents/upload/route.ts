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
  sniffMimeType,
  type ParsedDocument,
} from "@/lib/documentParse";
import { truncate } from "@/lib/text";
import { peekRateLimit, rateLimitRecord, rateLimitResponse } from "@/lib/rateLimit";

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 60 * 1000;

const metaSchema = z.object({
  filename: z.string().min(1).max(300),
  mimeType: z.enum(ACCEPTED_MIME_TYPES),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
}).strict();

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Read the limit now, record the call later — batched with the document
  // insert below, so this route costs two database round trips rather than
  // three. Every round trip is a second or more against a distant database,
  // and three of them serially is what pushed this past a serverless
  // execution limit and left the UI stuck on "Parsing".
  const limit = await peekRateLimit(userId, "document-upload", RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    return rateLimitResponse("document uploads", limit.resetAt);
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_UPLOAD_BYTES) {
    // Recorded even though nothing is stored: these paths return before the
    // batched write below, and a rejected request that goes uncounted is a
    // free retry. Malformed uploads have to count against the limit too.
    await rateLimitRecord(userId, "document-upload");
    return NextResponse.json({ error: "File is too large — 20MB max" }, { status: 413 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    await rateLimitRecord(userId, "document-upload");
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
    const [, doc] = await prisma.$transaction([
      rateLimitRecord(userId, "document-upload"),
      prisma.document.create({
        data: {
          userId,
          filename: file.name.slice(0, 300),
          mimeType: file.type || "unknown",
          size: file.size,
          status: "UNSUPPORTED",
        },
      }),
    ]);
    return NextResponse.json({ document: doc }, { status: 201 });
  }

  // The declared Content-Type got us this far; the file's own leading bytes
  // decide what actually gets parsed. A .docx renamed to .pdf (or a client
  // simply lying about the type) is rejected here rather than handed to a
  // parser that wasn't built for it.
  const buffer = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffMimeType(buffer);
  if (!sniffed || sniffed !== meta.data.mimeType) {
    const [, doc] = await prisma.$transaction([
      rateLimitRecord(userId, "document-upload"),
      prisma.document.create({
        data: {
          userId,
          filename: meta.data.filename,
          mimeType: meta.data.mimeType,
          size: meta.data.size,
          status: "UNSUPPORTED",
        },
      }),
    ]);
    return NextResponse.json({ document: doc }, { status: 201 });
  }

  // Parse before the row exists, then write once.
  //
  // This used to INSERT a PARSING row, parse, then UPDATE it — two round
  // trips around a CPU-bound parse. Against a distant database that is a
  // second write this route has to survive, and if the function is killed
  // in between (a serverless time limit, a cold start on a slow link) the
  // row is stranded at PARSING forever with nothing left running to finish
  // it. That is exactly what the UI showed: an upload stuck on "Parsing".
  // The status is only ever known once parsing has finished, so there is
  // nothing for an intermediate row to record.
  let parsed: ParsedDocument | null = null;
  try {
    parsed = await parseDocument(buffer, sniffed);
  } catch (err) {
    console.error("Document parse failed:", err);
  }

  const [, doc] = await prisma.$transaction([
    rateLimitRecord(userId, "document-upload"),
    prisma.document.create({
      data: {
        userId,
        filename: meta.data.filename,
        mimeType: sniffed,
        size: meta.data.size,
        ...(parsed
          ? {
              status: "READY",
              extractedText: truncate(parsed.text, MAX_EXTRACTED_CHARS),
              wordCount: parsed.wordCount,
              pageCount: parsed.pageCount,
            }
          : { status: "FAILED" }),
      },
    }),
  ]);

  return NextResponse.json({ document: doc }, { status: 201 });
}
