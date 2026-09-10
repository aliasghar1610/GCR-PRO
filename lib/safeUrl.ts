/**
 * Returns the value only if it is an http(s) URL, otherwise null.
 *
 * Links like `alternateLink` are synced from the Classroom API — data authored
 * outside this app. Rendering one straight into an `href` would let a
 * `javascript:` or `data:` URL run in the page's own origin, so anything that
 * isn't a plain web link is dropped rather than linked.
 */
export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}
