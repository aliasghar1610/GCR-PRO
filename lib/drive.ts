import "server-only";
import { type ParsedDocument, parsePdf, sniffMimeType, PDF_MIME } from "@/lib/documentParse";

/**
 * Extracts text from a PDF buffer. Used by the Drive Picker flow — the
 * browser fetches the file bytes directly from Drive using a short-lived
 * drive.file-scoped token (see components/DriveAttachButton.tsx) and posts
 * them here for parsing, so this helper never needs Google auth itself.
 *
 * Shares parsePdf with the upload route rather than driving PDFParse itself,
 * so the MAX_PDF_PAGES bound applies to both entry points — an uncapped one
 * would just move the runaway parse somewhere else.
 */
export async function extractPdfText(buffer: Buffer): Promise<ParsedDocument> {
  // These bytes arrive from the browser, so "it's a PDF" is a claim, not a
  // fact, until the leading bytes say so.
  if (sniffMimeType(buffer) !== PDF_MIME) {
    throw new Error("Not a PDF");
  }

  return parsePdf(buffer);
}
