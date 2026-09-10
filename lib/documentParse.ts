import "server-only";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export const PDF_MIME = "application/pdf";
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const ACCEPTED_MIME_TYPES = [PDF_MIME, DOCX_MIME] as const;

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB
export const MAX_EXTRACTED_CHARS = 60_000;

export type ParsedDocument = { text: string; wordCount: number; pageCount: number | null };

/** Hard stop so a malformed or adversarial file can't tie up a request. */
export const PARSE_TIMEOUT_MS = 20_000;

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

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Timed out while parsing the document")), ms)
    ),
  ]);
}

/**
 * Parses a PDF or DOCX buffer into text. Callers must have already validated
 * mimeType against ACCEPTED_MIME_TYPES and size against MAX_UPLOAD_BYTES.
 */
export async function parseDocument(buffer: Buffer, mimeType: string): Promise<ParsedDocument> {
  if (mimeType === PDF_MIME) {
    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await withTimeout(parser.getText(), PARSE_TIMEOUT_MS);
      const text = parsed.text;
      return { text, wordCount: countWords(text), pageCount: parsed.pages?.length ?? null };
    } finally {
      await parser.destroy();
    }
  }

  if (mimeType === DOCX_MIME) {
    const result = await withTimeout(mammoth.extractRawText({ buffer }), PARSE_TIMEOUT_MS);
    const text = result.value;
    return { text, wordCount: countWords(text), pageCount: null };
  }

  throw new Error("Unsupported file type");
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
