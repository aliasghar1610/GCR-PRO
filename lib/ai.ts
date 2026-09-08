import Anthropic from "@anthropic-ai/sdk";

// Server-side only — import this into API routes, never into client
// components. Reads ANTHROPIC_API_KEY from the environment.
const client = new Anthropic();

const MODEL = "claude-opus-5";

export async function askClaude(system: string, userContent: string): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system,
    messages: [{ role: "user", content: userContent }],
  });

  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text"
  );
  if (!textBlock) {
    throw new Error("No text response from the model.");
  }
  return textBlock.text;
}
