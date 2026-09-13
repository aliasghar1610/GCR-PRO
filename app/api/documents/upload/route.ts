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
  hasMeaningfulText,
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

/**
 * Named steps, so a failure can say where it happened without leaking
 * anything. These are fixed internal labels — never an exception message, a
 * Prisma error, or a stack trace, per the audit spec's error-handling rules.
 */
type Stage = "auth" | "rate-limit" | "read-body" | "parse" | "db-write";

export async function POST(req: Request) {
  let stage: Stage = "auth";
  try {
    return await handleUpload(req, (s) => {
      stage = s;
    });
  } catch (err) {
    // A correlation id ties this response to the server log line without
    // putting the cause on the wire. Previously an unexpected throw here
    // escaped as the platform's own HTML 500, which the client could only
    // report as an unexplained failure.
    const correlationId = crypto.randomUUID();
    console.error(`[upload ${correlationId}] failed at stage "${stage}":`, err);
    return NextResponse.json(
      {
        error: "The upload could not be completed. Please try again.",
        stage,
        correlationId,
      },
      { status: 500 }
    );
  }
}

async function handleUpload(req: Request, at: (s: Stage) => void) {
  at("auth");
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
  at("rate-limit");
  const limit = await peekRateLimit(userId, "document-upload", RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    return rateLimitResponse("document uploads", limit.resetAt);
  }

  at("read-body");
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
  at("parse");
  let parsed: ParsedDocument | null = null;
  try {
    parsed = await parseDocument(buffer, sniffed);
  } catch (err) {
    console.error("Document parse failed:", err);
  }

  at("db-write");
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
              // A PDF with no text layer — a scan, or pages that are images —
              // parses without error and yields a string made entirely of
              // pdf-parse's "-- 1 of 1 --" page markers. Stored as READY, that
              // reached the quiz generator as study material, and the model,
              // handed page numbers, invented plausible questions about
              // nothing. The Drive attach path already refuses these; this one
              // did not.
              status: parsed.hasText && hasMeaningfulText(parsed.text) ? "READY" : "NO_TEXT",
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
