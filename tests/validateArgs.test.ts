import { validateArgs } from "../src/utils/validateArgs";

describe("validateArgs", () => {
  // ─── Geldige invoer ────────────────────────────────────────────────────────

  it("accepteert geldig courseId", () => {
    expect(validateArgs({ courseId: "12345" })).toBeNull();
  });

  it("accepteert geldig assignmentId", () => {
    expect(validateArgs({ assignmentId: "99" })).toBeNull();
  });

  it("accepteert geldig moduleId", () => {
    expect(validateArgs({ moduleId: "1" })).toBeNull();
  });

  it("accepteert geldige pageUrl met alleen letters", () => {
    expect(validateArgs({ pageUrl: "weekplanning" })).toBeNull();
  });

  it("accepteert geldige pageUrl met koppeltekens", () => {
    expect(validateArgs({ pageUrl: "week-3-opdracht" })).toBeNull();
  });

  it("accepteert geldige pageUrl met underscores en cijfers", () => {
    expect(validateArgs({ pageUrl: "les_1b" })).toBeNull();
  });

  it("accepteert gecombineerde geldige args", () => {
    expect(validateArgs({ courseId: "42", pageUrl: "welkom" })).toBeNull();
  });

  it("geeft null terug bij lege args", () => {
    expect(validateArgs({})).toBeNull();
  });

  it("negeert onbekende arg-namen", () => {
    expect(validateArgs({ onbekend: "willekeurige waarde!" })).toBeNull();
  });

  // ─── Beveiligingstests: path-traversal via numerieke IDs ──────────────────

  it("SECURITY: blokkeert courseId met puntpuntschuine streep", () => {
    expect(validateArgs({ courseId: "1/../../../users/self" })).not.toBeNull();
  });

  it("SECURITY: blokkeert courseId met schuine streep", () => {
    expect(validateArgs({ courseId: "123/extra" })).not.toBeNull();
  });

  it("SECURITY: blokkeert courseId met spatie", () => {
    expect(validateArgs({ courseId: "123 456" })).not.toBeNull();
  });

  it("SECURITY: blokkeert courseId als lege string", () => {
    expect(validateArgs({ courseId: "" })).not.toBeNull();
  });

  it("SECURITY: blokkeert assignmentId met puntpuntschuine streep", () => {
    expect(validateArgs({ assignmentId: "5/../submissions" })).not.toBeNull();
  });

  it("SECURITY: blokkeert moduleId als tekst", () => {
    expect(validateArgs({ moduleId: "abc" })).not.toBeNull();
  });

  it("SECURITY: blokkeert negatief courseId", () => {
    expect(validateArgs({ courseId: "-1" })).not.toBeNull();
  });

  it("SECURITY: blokkeert courseId als drijvend getal", () => {
    expect(validateArgs({ courseId: "1.5" })).not.toBeNull();
  });

  // ─── Beveiligingstests: path-traversal via pageUrl ────────────────────────

  it("SECURITY: blokkeert pageUrl met schuine streep", () => {
    expect(validateArgs({ pageUrl: "slug/../../assignments" })).not.toBeNull();
  });

  it("SECURITY: blokkeert pageUrl met puntpuntschuine streep", () => {
    expect(validateArgs({ pageUrl: "../geheim" })).not.toBeNull();
  });

  it("SECURITY: blokkeert pageUrl met spatie", () => {
    expect(validateArgs({ pageUrl: "pagina naam" })).not.toBeNull();
  });

  it("SECURITY: blokkeert pageUrl met vraagteken (query-injectie)", () => {
    expect(validateArgs({ pageUrl: "pagina?admin=true" })).not.toBeNull();
  });

  it("SECURITY: blokkeert pageUrl als lege string", () => {
    expect(validateArgs({ pageUrl: "" })).not.toBeNull();
  });

  it("SECURITY: blokkeert pageUrl met hekje (fragment-injectie)", () => {
    expect(validateArgs({ pageUrl: "pagina#sectie" })).not.toBeNull();
  });

  // ─── Foutberichten ────────────────────────────────────────────────────────

  it("foutbericht vermeldt de arg-naam bij ongeldig numeriek ID", () => {
    const msg = validateArgs({ courseId: "abc" });
    expect(msg).toContain("courseId");
  });

  it("foutbericht vermeldt de ontvangen waarde bij ongeldig numeriek ID", () => {
    const msg = validateArgs({ courseId: "abc" });
    expect(msg).toContain("abc");
  });

  it("foutbericht vermeldt de ontvangen waarde bij ongeldige pageUrl", () => {
    const msg = validateArgs({ pageUrl: "bad/slug" });
    expect(msg).toContain("bad/slug");
  });
});
