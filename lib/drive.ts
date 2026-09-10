import { PDFParse } from "pdf-parse";

/**
 * Extracts text from a PDF buffer. Used by the Drive Picker flow — the
 * browser fetches the file bytes directly from Drive using a short-lived
 * drive.file-scoped token (see components/DriveAttachButton.tsx) and posts
 * them here for parsing, so this helper never needs Google auth itself.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    return parsed.text;
  } finally {
    await parser.destroy();
  }
}
