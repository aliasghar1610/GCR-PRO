/**
 * Retries a Classroom/Google API call once on a transient 5xx or 429 (6.6) —
 * not on any other error, which is left to bubble up immediately.
 */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 2, delayMs = 500): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = (err as { code?: number; response?: { status?: number } })?.response?.status
        ?? (err as { code?: number })?.code;
      const retryable = status === 429 || (typeof status === "number" && status >= 500);
      if (!retryable || attempt === attempts - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
  throw lastErr;
}
