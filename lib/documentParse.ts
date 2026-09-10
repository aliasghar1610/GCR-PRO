import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export const PDF_MIME = "application/pdf";
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const ACCEPTED_MIME_TYPES = [PDF_MIME, DOCX_MIME] as const;

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB
export const MAX_EXTRACTED_CHARS = 60_000;

export type ParsedDocument = { text: string; wordCount: number; pageCount: number | null };

/**
 * Parses a PDF or DOCX buffer into text. Callers must have already validated
 * mimeType against ACCEPTED_MIME_TYPES and size against MAX_UPLOAD_BYTES.
 */
export async function parseDocument(buffer: Buffer, mimeType: string): Promise<ParsedDocument> {
  if (mimeType === PDF_MIME) {
    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      const text = parsed.text;
      return { text, wordCount: countWords(text), pageCount: parsed.pages?.length ?? null };
    } finally {
      await parser.destroy();
    }
  }

  if (mimeType === DOCX_MIME) {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;
    return { text, wordCount: countWords(text), pageCount: null };
  }

  throw new Error("Unsupported file type");
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
