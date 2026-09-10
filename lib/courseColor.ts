import { initialsOf } from "./initials";

const TAG_COUNT = 8;

/**
 * Deterministic djb2 hash of a Google courseId -> one of 8 tag colors.
 * Never index by array position (list order shifts as courses are added or
 * dropped) — hash the stable courseId instead so a course keeps its color
 * across every screen, session, and the extension.
 */
export function courseColorIndex(courseId: string): number {
  let hash = 5381;
  for (let i = 0; i < courseId.length; i++) {
    hash = (hash * 33) ^ courseId.charCodeAt(i);
  }
  return (hash >>> 0) % TAG_COUNT;
}

export function courseColorVars(courseId: string) {
  const n = courseColorIndex(courseId) + 1;
  return {
    solid: `var(--tag-${n}-solid)`,
    soft: `var(--tag-${n}-soft)`,
  };
}

// Tailwind's scanner only picks up utility classes that appear as literal
// strings in source — a template-literal like `bg-tag-${n}-soft` would never
// be generated. This lookup keeps every combination spelled out so it is.
const TAG_CLASSES = [
  { bg: "bg-tag-1-soft", text: "text-tag-1-solid", bar: "bg-tag-1-solid" },
  { bg: "bg-tag-2-soft", text: "text-tag-2-solid", bar: "bg-tag-2-solid" },
  { bg: "bg-tag-3-soft", text: "text-tag-3-solid", bar: "bg-tag-3-solid" },
  { bg: "bg-tag-4-soft", text: "text-tag-4-solid", bar: "bg-tag-4-solid" },
  { bg: "bg-tag-5-soft", text: "text-tag-5-solid", bar: "bg-tag-5-solid" },
  { bg: "bg-tag-6-soft", text: "text-tag-6-solid", bar: "bg-tag-6-solid" },
  { bg: "bg-tag-7-soft", text: "text-tag-7-solid", bar: "bg-tag-7-solid" },
  { bg: "bg-tag-8-soft", text: "text-tag-8-solid", bar: "bg-tag-8-solid" },
] as const;

export function courseColorClasses(courseId: string) {
  return TAG_CLASSES[courseColorIndex(courseId)];
}

export const courseInitials = initialsOf;
