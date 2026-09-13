/**
 * Document limits shared by server and browser code.
 *
 * Deliberately free of `server-only`: PDF text extraction now runs in the
 * browser (see lib/pdfClient.ts), so the client needs these same numbers.
 * lib/documentParse.ts re-exports them so existing server imports keep
 * working from one place.
 */

export const PDF_MIME = "application/pdf";
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const ACCEPTED_MIME_TYPES = [PDF_MIME, DOCX_MIME] as const;

/**
 * Ceiling on a stored/prompted document. The model gains nothing from more,
 * and it bounds both prompt cost and the row we persist.
 */
export const MAX_EXTRACTED_CHARS = 60_000;

/**
 * Hard cap on how many pages pdfjs is asked to extract.
 *
 * pdfjs extracts synchronously, so it holds whichever thread it runs on for
 * the whole parse and a setTimeout guard cannot fire until the parse has
 * already finished. Capping pages bounds the work up front instead of
 * pretending it can be interrupted. 50 pages is far more than the AI needs —
 * MAX_EXTRACTED_CHARS truncates long before a 50-page document runs out.
 */
export const MAX_PDF_PAGES = 50;

/**
 * Largest file we'll accept at all.
 *
 * Applies to DOCX, whose bytes are posted to the server. A PDF is parsed in
 * the browser and only its text is sent, so its size is bounded by
 * MAX_EXTRACTED_CHARS rather than by any byte limit. `size` is still recorded
 * on a PDF row for display, but it is a number the client reports and nothing
 * on the server may branch on it.
 */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB

/**
 * Practical ceiling on a request body that reaches a serverless route.
 *
 * Netlify Functions run on AWS Lambda, which caps a synchronous request
 * payload at ~6MB. Binary bodies are base64-encoded in transit (~4/3
 * overhead), so the real limit on file bytes is closer to 4.5MB — and the
 * rejection happens at the platform edge, returning a bare 413 with an HTML
 * body before any handler runs. Nothing server-side can catch it or explain
 * it, so anything uploading bytes must check this in the browser first.
 *
 * DOCX is now the only thing that does. PDFs — both the Drive attach flow and
 * direct uploads — parse in the browser and send text, so this limit does not
 * apply to them.
 */
export const MAX_REQUEST_BODY_BYTES = 4 * 1024 * 1024; // 4MB, under the ~4.5MB effective cap
