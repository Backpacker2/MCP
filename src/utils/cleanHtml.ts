export function cleanHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    // Decode entities first so encoded tags like &lt;script&gt; become real tags
    // and are then removed in the next step instead of passing through as-is.
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
