import "server-only";
import { PDFParse } from "pdf-parse";
import { PARSE_TIMEOUT_MS, sniffMimeType, withTimeout, PDF_MIME } from "@/lib/documentParse";

/**
 * Extracts text from a PDF buffer. Used by the Drive Picker flow — the
 * browser fetches the file bytes directly from Drive using a short-lived
 * drive.file-scoped token (see components/DriveAttachButton.tsx) and posts
 * them here for parsing, so this helper never needs Google auth itself.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  // These bytes arrive from the browser, so "it's a PDF" is a claim, not a
  // fact, until the leading bytes say so.
  if (sniffMimeType(buffer) !== PDF_MIME) {
    throw new Error("Not a PDF");
  }

  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await withTimeout(parser.getText(), PARSE_TIMEOUT_MS);
    return parsed.text;
  } finally {
    await parser.destroy();
  }
}
