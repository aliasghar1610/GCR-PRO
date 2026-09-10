/**
 * Caps text sent to the AI or stored, so one huge document can't blow up
 * prompt cost/time (6.3.2).
 */
export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[...truncated]`;
}
