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

/**
 * pdf-parse's page separator, e.g. "-- 3 of 12 --".
 *
 * It is emitted between pages regardless of whether those pages held any
 * text, so a scanned PDF with no text layer still yields a non-empty string
 * made entirely of these. Any check of the form `text.trim().length > 0` will
 * pass on such a document and hand the model a few page numbers as if they
 * were study material.
 *
 * Still relevant with PDFs parsed in the browser: the text arriving from the
 * client comes out of the same library and carries the same markers, and the
 * client's claim that a document has text is not one the server can take on
 * trust.
 */
const PAGE_MARKER_RE = /--\s*\d+\s+of\s+\d+\s*--/g;

/**
 * Whether extracted text contains anything beyond page separators and
 * whitespace. Use this, never `text.length`, before sending a document to the
 * model or accepting it as readable.
 */
export function hasMeaningfulText(text: string | null | undefined): boolean {
  if (!text) return false;
  return text.replace(PAGE_MARKER_RE, "").trim().length > 0;
}

export type ParsedDocument = {
  text: string;
  wordCount: number;
  /** Pages in the file. Null when the format doesn't report a count. */
  pageCount: number | null;
  /**
   * Whether any real text came out.
   *
   * Not the same as `text.length > 0` — see PAGE_MARKER_RE. Callers that want
   * "did we actually get content" must read this rather than measure `text`,
   * or they will feed page numbers to the model and call it a document.
   */
  hasText: boolean;
};

/**
 * Identifies the file from its own leading bytes rather than the filename or
 * the browser-supplied Content-Type, both of which the uploader controls.
 * Returns null when the content doesn't look like anything we accept.
 *
 * Only DOCX still reaches the server as bytes; PDFs are parsed in the browser
 * and arrive as text (see lib/pdfClient.ts). The PDF branch stays because this
 * is what rejects a PDF — or anything else — renamed to .docx before it is
 * handed to a DOCX parser.
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
 * parse. Keep this as a backstop for genuinely async stalls (a hung stream, a
 * pathological zip), not as a guarantee that parsing returns within `ms`.
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
 * Parses DOCX bytes into text.
 *
 * PDFs are deliberately absent. They are parsed in the browser now
 * (lib/pdfClient.ts) and reach the server as text, because pdf-parse depends
 * on pdfjs-dist and the native @napi-rs/canvas, and Next's file tracing does
 * not carry that native binary into a serverless bundle — every PDF upload
 * returned a platform 500 once deployed while working locally, where
 * node_modules has the host's own build of it. The browser has neither
 * problem, and the Drive attach path had already proven the approach in
 * production.
 *
 * mammoth is pure JavaScript and bundles cleanly, so DOCX stays here.
 * Callers must have already validated mimeType against ACCEPTED_MIME_TYPES
 * and size against MAX_UPLOAD_BYTES.
 */
export async function parseDocument(buffer: Buffer, mimeType: string): Promise<ParsedDocument> {
  if (mimeType === DOCX_MIME) {
    const result = await withTimeout(mammoth.extractRawText({ buffer }), PARSE_TIMEOUT_MS);
    const text = result.value;
    return {
      text,
      wordCount: countWords(text),
      pageCount: null,
      hasText: hasMeaningfulText(text),
    };
  }

  throw new Error("Unsupported file type");
}

/**
 * Word count, measured here rather than taken from a caller.
 *
 * For a browser-parsed PDF this is the difference between a server-derived
 * fact and a client-supplied claim. It is only ever displayed, but deriving
 * it costs nothing and keeps one less client-controlled number in the row.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
