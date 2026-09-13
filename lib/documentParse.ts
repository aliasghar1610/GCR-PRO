import "server-only";
import mammoth from "mammoth";

// Limits live in pdfLimits.ts because the browser-side parser needs the same
// numbers and cannot import a "server-only" module. Re-exported here so the
// existing server imports keep working from one place.
import {
  ACCEPTED_MIME_TYPES,
  DOCX_MIME,
  MAX_EXTRACTED_CHARS,
  MAX_PDF_PAGES,
  MAX_UPLOAD_BYTES,
  PDF_MIME,
} from "./pdfLimits";

export {
  ACCEPTED_MIME_TYPES,
  DOCX_MIME,
  MAX_EXTRACTED_CHARS,
  MAX_PDF_PAGES,
  MAX_UPLOAD_BYTES,
  PDF_MIME,
};

export type ParsedDocument = {
  text: string;
  wordCount: number;
  /** Pages in the file. Null when the PDF didn't report a count. */
  pageCount: number | null;
  /** Pages actually parsed — below pageCount when MAX_PDF_PAGES applied. */
  pagesRead: number | null;
  /**
   * Whether any real text came out.
   *
   * Not the same as `text.length > 0`: pdf-parse separates pages with a
   * "-- 1 of 3 --" joiner, so a scanned PDF with no text layer at all still
   * returns a non-empty string made entirely of those markers. Callers that
   * want "did we actually get content" must read this rather than measure
   * `text`, or they will feed page numbers to the model and call it a
   * document.
   */
  hasText: boolean;
};

/**
 * Identifies the file from its own leading bytes rather than the filename or
 * the browser-supplied Content-Type, both of which the uploader controls.
 * Returns null when the content doesn't look like anything we accept.
 */
export function sniffMimeType(buffer: Buffer): (typeof ACCEPTED_MIME_TYPES)[number] | null {
  // "%PDF-"
  if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return PDF_MIME;
  // DOCX is a zip: "PK\x03\x04" (or an empty/spanned archive variant).
  if (buffer.subarray(0, 2).toString("latin1") === "PK") {
    const third = buffer[2];
    const fourth = buffer[3];
    if ((third === 0x03 && fourth === 0x04) || (third === 0x05 && fourth === 0x06)) {
      return DOCX_MIME;
    }
  }
  return null;
}

/** Hard stop for parse work that actually yields to the event loop. */
export const PARSE_TIMEOUT_MS = 20_000;

/**
 * Rejects if `promise` hasn't settled within `ms`.
 *
 * Only interrupts work that yields to the event loop — a timer cannot fire
 * while the loop is blocked, so this is no defence against a long synchronous
 * parse. MAX_PDF_PAGES is what bounds that case. Keep this as a backstop for
 * genuinely async stalls (a hung stream, a pathological zip), not as a
 * guarantee that parsing returns within `ms`.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Timed out while parsing the document")), ms);
    }),
  ]);
}

/**
 * Extracts text from PDF bytes, reading at most MAX_PDF_PAGES.
 *
 * getInfo() is a metadata-only read (single-digit milliseconds even on a
 * 300-page file), so the true page count is still reported when only a
 * prefix of the document was parsed — callers can tell the user what they
 * actually got rather than silently returning a partial document.
 */
export async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  // Imported here rather than at module scope, deliberately.
  //
  // pdf-parse pulls in pdfjs-dist and @napi-rs/canvas, the latter a native
  // binary that resolves to a per-platform package. Next's file tracing does
  // not follow it into the serverless bundle, so on the host the import
  // throws — and a top-level import that throws takes the whole route module
  // down before any handler runs. Every upload then returned a bare HTML 500
  // that no error handling of ours could annotate, including DOCX uploads,
  // which have nothing to do with pdfjs.
  //
  // Kept inside the function, the same failure is an ordinary rejected
  // promise: it lands in the caller's catch, the document is recorded as
  // FAILED, and the response is still clean JSON.
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    let pageCount: number | null = null;
    try {
      const info = await withTimeout(parser.getInfo(), PARSE_TIMEOUT_MS);
      pageCount = typeof info.total === "number" ? info.total : null;
    } catch {
      // Metadata is a nicety — a PDF that won't report a page count can
      // still extract fine, so fall through to the text pass.
    }

    const parsed = await withTimeout(parser.getText({ first: MAX_PDF_PAGES }), PARSE_TIMEOUT_MS);
    const text = parsed.text;
    const pages = parsed.pages ?? [];
    return {
      text,
      wordCount: countWords(text),
      pageCount,
      pagesRead: pages.length || null,
      // Per-page text, so the page-joiner markers in `text` don't read as
      // content on a PDF that has none.
      hasText: pages.some((page) => page.text.trim().length > 0),
    };
  } finally {
    await parser.destroy();
  }
}

/**
 * Parses a PDF or DOCX buffer into text. Callers must have already validated
 * mimeType against ACCEPTED_MIME_TYPES and size against MAX_UPLOAD_BYTES.
 */
export async function parseDocument(buffer: Buffer, mimeType: string): Promise<ParsedDocument> {
  if (mimeType === PDF_MIME) {
    return parsePdf(buffer);
  }

  if (mimeType === DOCX_MIME) {
    const result = await withTimeout(mammoth.extractRawText({ buffer }), PARSE_TIMEOUT_MS);
    const text = result.value;
    return {
      text,
      wordCount: countWords(text),
      pageCount: null,
      pagesRead: null,
      hasText: text.trim().length > 0,
    };
  }

  throw new Error("Unsupported file type");
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
