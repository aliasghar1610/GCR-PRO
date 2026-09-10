/**
 * Caps text sent to the AI or stored, so one huge document can't blow up
 * prompt cost/time (6.3.2).
 */
export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[...truncated]`;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escapes text for interpolation into an HTML email body. Assignment titles,
 * course names and instructor names are written by other people and reach us
 * through the Classroom API — they are untrusted markup until encoded.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/**
 * Strips CR/LF (and surrounding whitespace) from a value destined for an
 * RFC 5322 header. A newline in a header value lets the caller append headers
 * of their own — the classic email header-injection bug.
 */
export function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}
