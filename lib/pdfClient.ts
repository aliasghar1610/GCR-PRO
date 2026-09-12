"use client";

import { MAX_PDF_PAGES } from "./pdfLimits";

export type ClientParsedPdf = {
  text: string;
  /** Pages in the file. Null when the PDF didn't report a count. */
  pageCount: number | null;
  /** Pages actually parsed — below pageCount when MAX_PDF_PAGES applied. */
  pagesRead: number | null;
  /**
   * Whether any real text came out. Not the same as `text.length > 0`:
   * pdf-parse joins pages with a "-- 1 of 3 --" marker, so a scanned PDF
   * with no text layer still returns a string made entirely of page numbers.
   */
  hasText: boolean;
};

let workerReady = false;

/**
 * Extracts text from PDF bytes in the browser.
 *
 * This runs client-side on purpose. Posting the bytes to a route meant every
 * file crossed a serverless request-payload limit (~4.5MB of real PDF on
 * Netlify/Lambda once base64 overhead is counted) and was rejected by the
 * platform before any handler could explain why. The browser already holds
 * the file — whether picked from Drive or chosen from disk — so parsing it
 * here removes the ceiling entirely and keeps a CPU-heavy parse out of a
 * function billed by the millisecond.
 *
 * The import is dynamic so pdfjs (and its 2MB worker) only load when someone
 * actually attaches a PDF, rather than landing in the initial bundle.
 */
export async function extractPdfTextInBrowser(data: ArrayBuffer): Promise<ClientParsedPdf> {
  const { PDFParse } = await import("pdf-parse");

  if (!workerReady) {
    // Copied into public/ by scripts/copy-pdf-worker.mjs. Using the static
    // rather than the standalone export: TypeScript resolves this package to
    // its Node typings (the "browser" export condition is a bundler concern,
    // not a tsc one), and the static is declared identically in both builds.
    PDFParse.setWorker("/pdf.worker.mjs");
    workerReady = true;
  }

  const parser = new PDFParse({ data: new Uint8Array(data) });
  try {
    let pageCount: number | null = null;
    try {
      const info = await parser.getInfo();
      pageCount = typeof info.total === "number" ? info.total : null;
    } catch {
      // Metadata is a nicety — a PDF that won't report a page count can
      // still extract fine, so fall through to the text pass.
    }

    const parsed = await parser.getText({ first: MAX_PDF_PAGES });
    const pages = parsed.pages ?? [];
    return {
      text: parsed.text,
      pageCount,
      pagesRead: pages.length || null,
      hasText: pages.some((page) => page.text.trim().length > 0),
    };
  } finally {
    await parser.destroy();
  }
}
