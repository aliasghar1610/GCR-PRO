import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ACCEPTED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  MAX_EXTRACTED_CHARS,
  PDF_MIME,
  countWords,
  parseDocument,
  sniffMimeType,
  hasMeaningfulText,
  type ParsedDocument,
} from "@/lib/documentParse";
import { truncate } from "@/lib/text";
import { peekRateLimit, rateLimitRecord, rateLimitResponse } from "@/lib/rateLimit";

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 60 * 1000;

/** DOCX: the browser posts bytes and the server parses them. */
const metaSchema = z
  .object({
    filename: z.string().min(1).max(300),
    mimeType: z.enum(ACCEPTED_MIME_TYPES),
    size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  })
  .strict();

/**
 * PDF: the browser parses and posts only the text.
 *
 * This schema is the trust boundary for that path. Nothing here was produced
 * by code we control at the time it arrives — the browser ran the parse, and
 * a client can post this body directly without running one at all. So:
 *
 * - `.strict()`, so an unexpected key is rejected rather than reaching Prisma.
 * - `text` is capped at MAX_EXTRACTED_CHARS, a server constant. The cap is
 *   never read from the request; `size`, `pageCount` and the rest cannot
 *   widen it.
 * - `pageCount` is bounded but believed, because there is no longer a
 *   server-side parse to derive it from. It is display-only, and the audit
 *   below the schema records what that means.
 * - `size` is the file's own byte length, recorded for display. It is
 *   deliberately NOT used to size, cap or budget anything: the bytes never
 *   reach this route, so the number is a claim.
 */
const pdfTextSchema = z
  .object({
    filename: z.string().min(1).max(300),
    mimeType: z.literal(PDF_MIME),
    size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
    text: z.string().max(MAX_EXTRACTED_CHARS),
    pageCount: z.number().int().positive().max(100_000).nullable().optional(),
  })
  .strict();

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

  // A JSON body is the browser-parsed PDF path; multipart is DOCX bytes.
  const isJson = (req.headers.get("content-type") ?? "").includes("application/json");
  return isJson
    ? storeBrowserParsedPdf(req, userId, at)
    : storeUploadedBytes(req, userId, at);
}

/**
 * PDF, parsed in the browser: only text crosses to the server.
 *
 * No byte-size ceiling applies here beyond the JSON body itself, which
 * `text`'s cap already bounds — the platform's ~4.5MB request limit was only
 * ever a constraint on shipping the file, and the file no longer moves.
 */
async function storeBrowserParsedPdf(req: Request, userId: string, at: (s: Stage) => void) {
  at("read-body");
  const raw = await req.json().catch(() => null);
  const body = pdfTextSchema.safeParse(raw);
  if (!body.success) {
    // Generic, per the audit spec — the raw input is never echoed back.
    await rateLimitRecord(userId, "document-upload");
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }

  at("parse");
  // Measured here, from the string this route actually received, against a
  // constant defined on the server. The zod cap above already rejects an
  // oversized body; this second pass is what guarantees the stored column —
  // and so everything later sent to the model — is bounded regardless of how
  // the row got here.
  const text = truncate(body.data.text, MAX_EXTRACTED_CHARS);

  // The client's own scanned-PDF check is a courtesy to the user, not a
  // control. This is the one that decides, and it reads the text rather than
  // trusting any flag alongside it.
  const readable = hasMeaningfulText(text);

  at("db-write");
  const [, doc] = await prisma.$transaction([
    rateLimitRecord(userId, "document-upload"),
    prisma.document.create({
      data: {
        userId,
        filename: body.data.filename,
        mimeType: PDF_MIME,
        size: body.data.size,
        status: readable ? "READY" : "NO_TEXT",
        extractedText: text,
        // Derived here, not accepted from the client, because it can be.
        wordCount: countWords(text),
        // Cannot be derived without parsing the file, so this one is the
        // client's word. Display only — see the note on pdfTextSchema.
        pageCount: body.data.pageCount ?? null,
      },
    }),
  ]);

  return NextResponse.json({ document: doc }, { status: 201 });
}

/** DOCX: bytes are posted and parsed here, with mammoth. */
async function storeUploadedBytes(req: Request, userId: string, at: (s: Stage) => void) {
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
  // decide what actually gets parsed. A PDF renamed to .docx (or a client
  // simply lying about the type) is rejected here rather than handed to a
  // parser that wasn't built for it.
  const buffer = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffMimeType(buffer);
  if (!sniffed || sniffed !== meta.data.mimeType || sniffed === PDF_MIME) {
    // PDF is refused on this path on purpose: nothing here parses one any
    // more, and accepting the bytes only to store an empty row would be
    // worse than saying so. The client parses PDFs before posting.
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
  // Inserting a PARSING row, parsing, then updating it was two round trips
  // around a CPU-bound parse, and if the function was killed in between the
  // row was stranded at PARSING forever with nothing left running to advance
  // it. The status is only known once parsing has finished, so there is
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
              status: hasMeaningfulText(parsed.text) ? "READY" : "NO_TEXT",
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
