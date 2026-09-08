import { google } from "googleapis";
import { PDFParse } from "pdf-parse";
import { getGoogleAuthClient } from "@/lib/google-auth";

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
const GOOGLE_SLIDES_MIME = "application/vnd.google-apps.presentation";
const PDF_MIME = "application/pdf";

/**
 * Fetches the text content of a Drive file for a given user. Google Docs /
 * Slides are exported as plain text; PDFs are downloaded and parsed; other
 * types return null since we don't have a text extraction path for them.
 */
export async function getDriveFileText(
  userId: string,
  fileId: string
): Promise<string | null> {
  const auth = await getGoogleAuthClient(userId);
  const drive = google.drive({ version: "v3", auth });

  const { data: meta } = await drive.files.get({
    fileId,
    fields: "mimeType, name",
  });

  if (meta.mimeType === GOOGLE_DOC_MIME || meta.mimeType === GOOGLE_SLIDES_MIME) {
    const { data } = await drive.files.export(
      { fileId, mimeType: "text/plain" },
      { responseType: "text" }
    );
    return typeof data === "string" ? data : null;
  }

  if (meta.mimeType === PDF_MIME) {
    const { data } = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );
    const buffer = Buffer.from(data as ArrayBuffer);
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    return parsed.text;
  }

  return null;
}
