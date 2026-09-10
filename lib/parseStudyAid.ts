const HEADERS = ["Outline", "Approach", "Draft"] as const;
export type StudyAidSections = Record<(typeof HEADERS)[number], string>;

/**
 * The solve endpoint's system prompt (lib/ai / app/api/solve) always asks for
 * three sections starting on their own line as "Outline:", "Approach:",
 * "Draft:" — split the raw response back into those parts for the
 * collapsible-section UI.
 */
export function parseStudyAid(raw: string): StudyAidSections {
  const pattern = /^(Outline|Approach|Draft):\s*$/im;
  const sections: StudyAidSections = { Outline: "", Approach: "", Draft: "" };

  const lines = raw.split("\n");
  let current: (typeof HEADERS)[number] | null = null;
  const buffers: Record<string, string[]> = { Outline: [], Approach: [], Draft: [] };

  for (const line of lines) {
    const match = line.match(pattern);
    if (match) {
      current = match[1] as (typeof HEADERS)[number];
      continue;
    }
    if (current) buffers[current].push(line);
  }

  for (const h of HEADERS) {
    sections[h] = buffers[h].join("\n").trim();
  }

  // Nothing matched the expected headers — fall back to putting the whole
  // response under Draft rather than silently dropping it.
  if (!sections.Outline && !sections.Approach && !sections.Draft) {
    sections.Draft = raw.trim();
  }

  return sections;
}
