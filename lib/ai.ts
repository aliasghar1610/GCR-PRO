import "server-only";
import { GoogleGenAI } from "@google/genai";

// Server-side only — import this into API routes, never into client
// components. Reads GEMINI_API_KEY from the environment.
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Override with GEMINI_MODEL if Google renames/retires this model.
// (gemini-2.5-flash was already retired for new users as of this writing —
// verify against aistudio.google.com if this one stops working too.)
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

/**
 * Ceiling on a single model call.
 *
 * Deliberately under a serverless host's function timeout: an unbounded call
 * that outlasts the platform's limit gets the whole process killed, so the
 * catch block never runs and nothing is logged — the request just disappears
 * after N seconds with no explanation. Failing here instead keeps the error
 * ours to report.
 */
export const AI_TIMEOUT_MS = 25_000;

export async function askGemini(system: string, userContent: string): Promise<string> {
  // Unlike the parse path, this is genuinely async (a network round trip), so
  // an abort signal actually interrupts it.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  let response;
  try {
    response = await client.models.generateContent({
      model: MODEL,
      contents: userContent,
      config: { systemInstruction: system, abortSignal: controller.signal },
    });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`The AI request timed out after ${AI_TIMEOUT_MS / 1000}s.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const text = response.text;
  if (!text) {
    throw new Error("No text response from the model.");
  }
  return text;
}
