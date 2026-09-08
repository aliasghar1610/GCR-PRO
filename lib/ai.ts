import { GoogleGenAI } from "@google/genai";

// Server-side only — import this into API routes, never into client
// components. Reads GEMINI_API_KEY from the environment.
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Override with GEMINI_MODEL if Google renames/retires this model.
const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

export async function askGemini(system: string, userContent: string): Promise<string> {
  const response = await client.models.generateContent({
    model: MODEL,
    contents: userContent,
    config: { systemInstruction: system },
  });

  const text = response.text;
  if (!text) {
    throw new Error("No text response from the model.");
  }
  return text;
}
