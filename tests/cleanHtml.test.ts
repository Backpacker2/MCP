import { cleanHtml } from "../src/utils/cleanHtml";

describe("cleanHtml", () => {
  it("geeft lege string terug bij null", () => {
    expect(cleanHtml(null)).toBe("");
  });

  it("geeft lege string terug bij undefined", () => {
    expect(cleanHtml(undefined)).toBe("");
  });

  it("geeft lege string terug bij lege string", () => {
    expect(cleanHtml("")).toBe("");
  });

  it("verwijdert HTML-tags", () => {
    expect(cleanHtml("<p>Hallo</p>")).toBe("Hallo");
  });

  it("verwijdert geneste HTML-tags", () => {
    expect(cleanHtml("<div><strong>Vet</strong> en <em>cursief</em></div>")).toBe("Vet en cursief");
  });

  it("vervangt &nbsp; door spatie", () => {
    expect(cleanHtml("Hallo&nbsp;wereld")).toBe("Hallo wereld");
  });

  it("decodeert &amp;", () => {
    expect(cleanHtml("Tom &amp; Jerry")).toBe("Tom & Jerry");
  });

  it("decodeert &quot;", () => {
    expect(cleanHtml("&quot;geciteerd&quot;")).toBe('"geciteerd"');
  });

  it("decodeert &#39;", () => {
    expect(cleanHtml("it&#39;s")).toBe("it's");
  });

  it("verwijdert overbodige witruimte", () => {
    expect(cleanHtml("  veel   spaties  ")).toBe("veel spaties");
  });

  // ─── Beveiligingstests ────────────────────────────────────────────────────

  it("SECURITY: verwijdert echte <script>-tags", () => {
    expect(cleanHtml("<script>alert('xss')</script>")).not.toContain("<script>");
    expect(cleanHtml("<script>alert('xss')</script>")).not.toContain("</script>");
  });

  it("SECURITY: verwijdert encoded <script> via &lt;script&gt; — tags worden niet als letterlijke tekst doorgelaten", () => {
    // Belangrijk: &lt;script&gt; moet worden herkend als een tag en verwijderd,
    // niet als escaped tekst naar buiten komen als "<script>".
    const input = "&lt;script&gt;alert('injection')&lt;/script&gt;";
    const result = cleanHtml(input);
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("</script>");
    // Tekstinhoud van de tag mag overblijven (dat is normale tag-stripping);
    // het gaat erom dat de HTML-tags zelf niet door kunnen komen.
  });

  it("SECURITY: verwijdert dubbel-encoded tags zoals &amp;lt;script&amp;gt;", () => {
    const input = "&amp;lt;script&amp;gt;bad&amp;lt;/script&amp;gt;";
    const result = cleanHtml(input);
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("</script>");
  });

  it("SECURITY: verwijdert <img onerror> aanval", () => {
    const input = '<img src="x" onerror="alert(1)">';
    const result = cleanHtml(input);
    expect(result).not.toContain("<img");
    expect(result).not.toContain("onerror");
  });

  it("SECURITY: encoded <img onerror> via entiteiten wordt ook verwijderd", () => {
    const input = "&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;";
    const result = cleanHtml(input);
    expect(result).not.toContain("<img");
    expect(result).not.toContain("onerror");
  });

  it("verwerkt normale HTML-paginainhoud correct", () => {
    const input =
      "<h1>Weekplanning</h1><p>In week 3 lees je <strong>hoofdstuk 2</strong> &amp; maak je opdracht 1.</p>";
    const result = cleanHtml(input);
    expect(result).toContain("Weekplanning");
    expect(result).toContain("hoofdstuk 2");
    expect(result).toContain("& maak je opdracht 1");
    expect(result).not.toContain("<h1>");
    expect(result).not.toContain("<p>");
    expect(result).not.toContain("<strong>");
  });
});
