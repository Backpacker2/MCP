// Canvas IDs are always positive integers; page slugs are alphanumeric + hyphens/underscores.
// These patterns prevent path traversal (e.g. courseId = "1/../../../users/self").
const NUMERIC_ID_RE = /^\d+$/;
const SLUG_RE = /^[a-zA-Z0-9_-]+$/;
const NUMERIC_ID_ARGS = new Set(["courseId", "assignmentId", "moduleId"]);

export function validateArgs(args: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(args)) {
    const str = String(value);
    if (NUMERIC_ID_ARGS.has(key)) {
      if (!NUMERIC_ID_RE.test(str)) {
        return `Ongeldig ${key}: moet een positief getal zijn (ontvangen: "${str}").`;
      }
    } else if (key === "pageUrl") {
      if (!SLUG_RE.test(str)) {
        return `Ongeldig pageUrl: mag alleen letters, cijfers, koppeltekens en underscores bevatten (ontvangen: "${str}").`;
      }
    }
  }
  return null;
}
