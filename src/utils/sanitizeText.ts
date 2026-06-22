/**
 * Sanitizes free-text strings from Canvas before they are returned to Claude.
 * Strips ASCII control characters and Unicode zero-width characters that could
 * be used to smuggle invisible content, then truncates to maxLength.
 * Newlines (\n) are preserved because teacher comments can be multi-line.
 */
export function sanitizeText(text: string, maxLength = 500): string {
  return text
    // Strip ASCII control characters but keep tab (\x09), newline (\x0A), carriage return (\x0D)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Strip Unicode zero-width space (U+200B), non-joiner (U+200C), joiner (U+200D),
    // BOM (U+FEFF), and soft-hyphen (U+00AD)
    .replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, "")
    .slice(0, maxLength)
    .trim();
}
