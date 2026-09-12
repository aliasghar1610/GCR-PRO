import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { extractPdfText } from "@/lib/drive";
import { truncate } from "@/lib/text";
import { MAX_EXTRACTED_CHARS, MAX_UPLOAD_BYTES } from "@/lib/documentParse";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";

// The browser already downloaded these bytes from Drive using its own
// short-lived drive.file token (see components/DriveAttachButton.tsx) — this
// route never talks to Google, it just parses bytes the user already fetched.
const RATE_LIMIT = 40;
const RATE_WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Rate limiting is a database round trip, so it fails for reasons that have
  // nothing to do with the file. Left unguarded it threw past the catch below
  // as an unhandled 500, which the client then reported as "Could not read
  // that PDF" — sending you to debug the parser over a database blip.
  try {
    const limit = await checkRateLimit(userId, "extract-pdf", RATE_LIMIT, RATE_WINDOW_MS);
    if (!limit.allowed) {
      return rateLimitResponse("PDF extraction", limit.resetAt);
    }
  } catch (err) {
    console.error("[extract-pdf] rate-limit check failed:", err);
    return NextResponse.json(
      { error: "Service is temporarily unavailable. Try again in a moment." },
      { status: 503 }
    );
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "That PDF is too large (20MB max)" }, { status: 413 });
  }

  const arrayBuffer = await req.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "That PDF is too large (20MB max)" }, { status: 413 });
  }

  const startedAt = Date.now();
  try {
    const parsed = await extractPdfText(Buffer.from(arrayBuffer));

    if (!parsed.hasText) {
      // A scanned PDF is images with no text layer. Extraction "succeeded"
      // and returned nothing, which downstream would look like a document
      // about nothing — say so instead of sending an empty prompt.
      return NextResponse.json(
        { error: "That PDF has no selectable text — it looks scanned. Try a text-based PDF." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      text: truncate(parsed.text, MAX_EXTRACTED_CHARS),
      pageCount: parsed.pageCount,
      pagesRead: parsed.pagesRead,
    });
  } catch (err) {
    // Log the real cause with timing — a parse that dies near the platform's
    // function timeout looks identical to a malformed file from the client.
    console.error(
      `[extract-pdf] failed after ${Date.now() - startedAt}ms ` +
        `(${arrayBuffer.byteLength} bytes) for user ${userId}:`,
      err
    );
    const message = err instanceof Error && err.message === "Not a PDF"
      ? "That file isn't a PDF"
      : "Could not read that PDF";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
