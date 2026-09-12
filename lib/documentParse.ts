import "server-only";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export const PDF_MIME = "application/pdf";
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const ACCEPTED_MIME_TYPES = [PDF_MIME, DOCX_MIME] as const;

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB
export const MAX_EXTRACTED_CHARS = 60_000;

/**
 * Hard cap on how many pages pdfjs is asked to extract.
 *
 * This — not PARSE_TIMEOUT_MS — is what actually bounds PDF work. pdfjs
 * extracts synchronously, so it holds the event loop for the whole parse and
 * the timer inside withTimeout cannot fire until the parse has already
 * finished. A document heavy enough to outlast the host's function timeout
 * would therefore run until the platform killed the process mid-request,
 * taking the catch block — and any log line explaining it — down with it.
 * Capping pages keeps the worst case bounded up front instead.
 *
 * 50 pages is far more than the AI needs: MAX_EXTRACTED_CHARS truncates the
 * text long before a 50-page document is exhausted.
 */
export const MAX_PDF_PAGES = 50;

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
