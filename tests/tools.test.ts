import { CanvasClient } from "../src/canvasClient";
import { CanvasApiError } from "../src/errors";
import { listCourses } from "../src/tools/courses";
import { listAssignments, getAssignmentDetails } from "../src/tools/assignments";
import { getUpcomingDeadlines } from "../src/tools/planner";
import { listModules } from "../src/tools/modules";
import { getModuleItems } from "../src/tools/modules";
import { listPages } from "../src/tools/pages";
import { getPageContent } from "../src/tools/pages";
import { getAnnouncements } from "../src/tools/announcements";
import { listFiles } from "../src/tools/files";
import { listSubmissions, getSubmission } from "../src/tools/submissions";

const mockClient = {
  get: jest.fn(),
  getWithHeaders: jest.fn(),
} as unknown as CanvasClient;

beforeEach(() => jest.clearAllMocks());

// ─── listCourses ────────────────────────────────────────────────────────────

describe("listCourses", () => {
  it("toont cursussen als er data is", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [{ id: 1, name: "Informatica", course_code: "INF1", enrollment_term_id: 1, workflow_state: "available" }],
      linkHeader: null,
    });
    const result = await listCourses(mockClient);
    expect(result).toContain("Informatica");
    expect(result).toContain("[1]");
    expect(result).toContain("INF1");
  });

  it("toont het aantal cursussen in de header", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [
        { id: 1, name: "Informatica", course_code: "INF1", enrollment_term_id: 1, workflow_state: "available" },
        { id: 2, name: "Wiskunde", course_code: "WIS1", enrollment_term_id: 1, workflow_state: "available" },
      ],
      linkHeader: null,
    });
    const result = await listCourses(mockClient);
    expect(result).toContain("(2)");
    expect(result).toContain("Wiskunde");
  });

  it("geeft melding bij lege lijst", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({ data: [], linkHeader: null });
    const result = await listCourses(mockClient);
    expect(result).toContain("geen actieve Canvas cursussen");
  });

  it("crasht niet bij ontbrekende course_code", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [{ id: 3, name: "Ontwerp", course_code: undefined, enrollment_term_id: 1, workflow_state: "available" }],
      linkHeader: null,
    });
    await expect(listCourses(mockClient)).resolves.toContain("Ontwerp");
  });

  it("gooit CanvasApiError bij 401 (ongeldig token)", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockRejectedValue(new CanvasApiError(401, "Ongeldige Canvas token."));
    await expect(listCourses(mockClient)).rejects.toThrow(CanvasApiError);
  });

  it("gooit CanvasApiError bij 403 (geen toegang)", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockRejectedValue(new CanvasApiError(403, "Geen toegang."));
    await expect(listCourses(mockClient)).rejects.toThrow(CanvasApiError);
  });

  it("gooit CanvasApiError bij 429 (rate limit)", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockRejectedValue(new CanvasApiError(429, "Rate limit bereikt."));
    await expect(listCourses(mockClient)).rejects.toThrow(CanvasApiError);
  });
});

// ─── listAssignments ────────────────────────────────────────────────────────

describe("listAssignments", () => {
  it("toont opdrachten met deadline en punten", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [{
        id: 10, name: "Opdracht 1", due_at: "2025-06-01T23:59:00Z",
        points_possible: 10, description: "<p>Beschrijving</p>",
        html_url: "https://school.example.com/courses/1/assignments/10",
        submission_types: ["online_upload"], workflow_state: "published",
      }],
      linkHeader: null,
    });
    const result = await listAssignments(mockClient, "1");
    expect(result).toContain("Opdracht 1");
    expect(result).toContain("10 punten");
  });

  it("toont 'Geen deadline' als due_at null is", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [{
        id: 11, name: "Vrije opdracht", due_at: null, points_possible: 5,
        description: null, html_url: "https://school.example.com/",
        submission_types: ["online_upload"], workflow_state: "published",
      }],
      linkHeader: null,
    });
    const result = await listAssignments(mockClient, "1");
    expect(result).toContain("Geen deadline");
  });

  it("toont 'Geen punten' als points_possible null is", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [{
        id: 12, name: "Bonusopdracht", due_at: null, points_possible: null,
        description: null, html_url: "https://school.example.com/",
        submission_types: [], workflow_state: "published",
      }],
      linkHeader: null,
    });
    const result = await listAssignments(mockClient, "1");
    expect(result).toContain("Geen punten");
  });

  it("geeft melding bij geen opdrachten", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({ data: [], linkHeader: null });
    const result = await listAssignments(mockClient, "42");
    expect(result).toContain("Geen opdrachten");
  });

  it("gooit CanvasApiError bij 404 (cursus bestaat niet)", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockRejectedValue(new CanvasApiError(404, "Niet gevonden."));
    await expect(listAssignments(mockClient, "99999")).rejects.toThrow(CanvasApiError);
  });

  it("gooit CanvasApiError bij 401", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockRejectedValue(new CanvasApiError(401, "Ongeldige token."));
    await expect(listAssignments(mockClient, "1")).rejects.toThrow(CanvasApiError);
  });
});

// ─── getAssignmentDetails ───────────────────────────────────────────────────

describe("getAssignmentDetails", () => {
  it("toont volledige opdrachtdetails inclusief beschrijving", async () => {
    (mockClient.get as jest.Mock).mockResolvedValue({
      id: 10, name: "Portfolio opdracht", due_at: "2025-07-15T12:00:00Z",
      points_possible: 20, description: "<p>Lever een portfolio in.</p>",
      html_url: "https://school.example.com/courses/1/assignments/10",
      submission_types: ["online_upload"], workflow_state: "published",
    });
    const result = await getAssignmentDetails(mockClient, "1", "10");
    expect(result).toContain("Portfolio opdracht");
    expect(result).toContain("Lever een portfolio in");
    expect(result).toContain("20 punten");
    expect(result).toContain("online_upload");
  });

  it("toont 'Geen beschrijving' als description null is", async () => {
    (mockClient.get as jest.Mock).mockResolvedValue({
      id: 10, name: "Lege opdracht", due_at: null, points_possible: null,
      description: null,
      html_url: "https://school.example.com/courses/1/assignments/10",
      submission_types: [], workflow_state: "published",
    });
    const result = await getAssignmentDetails(mockClient, "1", "10");
    expect(result).toContain("Geen beschrijving beschikbaar");
  });

  it("toont 'Geen deadline' als due_at null is", async () => {
    (mockClient.get as jest.Mock).mockResolvedValue({
      id: 10, name: "Opdracht zonder deadline", due_at: null, points_possible: 10,
      description: "Tekst", html_url: "https://school.example.com/",
      submission_types: ["online_text_entry"], workflow_state: "published",
    });
    const result = await getAssignmentDetails(mockClient, "1", "10");
    expect(result).toContain("Geen deadline ingesteld");
  });

  it("strips HTML-tags uit de beschrijving", async () => {
    (mockClient.get as jest.Mock).mockResolvedValue({
      id: 10, name: "HTML opdracht", due_at: null, points_possible: 5,
      description: "<h1>Titel</h1><p><strong>Vet</strong> en <em>cursief</em></p>",
      html_url: "https://school.example.com/",
      submission_types: ["online_upload"], workflow_state: "published",
    });
    const result = await getAssignmentDetails(mockClient, "1", "10");
    expect(result).not.toContain("<h1>");
    expect(result).not.toContain("<strong>");
    expect(result).toContain("Vet");
  });

  it("gooit CanvasApiError bij 404 (opdracht bestaat niet)", async () => {
    (mockClient.get as jest.Mock).mockRejectedValue(new CanvasApiError(404, "Niet gevonden."));
    await expect(getAssignmentDetails(mockClient, "1", "99999")).rejects.toThrow(CanvasApiError);
  });

  it("gooit CanvasApiError bij 403", async () => {
    (mockClient.get as jest.Mock).mockRejectedValue(new CanvasApiError(403, "Geen toegang."));
    await expect(getAssignmentDetails(mockClient, "1", "10")).rejects.toThrow(CanvasApiError);
  });
});

// ─── getUpcomingDeadlines ───────────────────────────────────────────────────

describe("getUpcomingDeadlines", () => {
  it("toont aankomende deadlines gesorteerd op datum", async () => {
    const morgen = new Date(Date.now() + 86400000).toISOString();
    const overmorgen = new Date(Date.now() + 2 * 86400000).toISOString();
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [
        { plannable_type: "assignment", plannable_date: overmorgen, plannable: { id: 2, title: "Overmorgen" }, context_name: "Wiskunde" },
        { plannable_type: "assignment", plannable_date: morgen, plannable: { id: 1, title: "Morgen inleveren" }, context_name: "Informatica" },
      ],
      linkHeader: null,
    });
    const result = await getUpcomingDeadlines(mockClient);
    expect(result).toContain("Morgen inleveren");
    expect(result).toContain("Informatica");
    const indexMorgen = result.indexOf("Morgen inleveren");
    const indexOvermorgen = result.indexOf("Overmorgen");
    expect(indexMorgen).toBeLessThan(indexOvermorgen);
  });

  it("toont ingeleverd-markering bij submitted items", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [{
        plannable_type: "assignment",
        plannable_date: new Date(Date.now() + 86400000).toISOString(),
        plannable: { id: 1, title: "Al ingeleverd" },
        context_name: "Wiskunde",
        submissions: { submitted: true, graded: false },
      }],
      linkHeader: null,
    });
    const result = await getUpcomingDeadlines(mockClient);
    expect(result).toContain("ingeleverd");
  });

  it("filtert items zonder plannable_date eruit", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [
        { plannable_type: "assignment", plannable_date: null, plannable: { id: 1, title: "Zonder datum" }, context_name: "Vak" },
        { plannable_type: "assignment", plannable_date: new Date(Date.now() + 86400000).toISOString(), plannable: { id: 2, title: "Met datum" }, context_name: "Vak" },
      ],
      linkHeader: null,
    });
    const result = await getUpcomingDeadlines(mockClient);
    expect(result).toContain("Met datum");
    expect(result).not.toContain("Zonder datum");
  });

  it("geeft melding als er geen deadlines zijn", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({ data: [], linkHeader: null });
    const result = await getUpcomingDeadlines(mockClient);
    expect(result).toContain("geen aankomende deadlines");
  });

  it("gooit CanvasApiError bij 401", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockRejectedValue(new CanvasApiError(401, "Ongeldige token."));
    await expect(getUpcomingDeadlines(mockClient)).rejects.toThrow(CanvasApiError);
  });
});

// ─── listModules ─────────────────────────────────────────────────────────────

describe("listModules", () => {
  it("toont modules met naam, itemsaantal en status", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [
        { id: 1, name: "Week 1", position: 1, items_count: 5, workflow_state: "active" },
        { id: 2, name: "Week 2", position: 2, items_count: 3, workflow_state: "active" },
      ],
      linkHeader: null,
    });
    const result = await listModules(mockClient, "1");
    expect(result).toContain("Week 1");
    expect(result).toContain("5 items");
    expect(result).toContain("[1]");
  });

  it("toont module met 0 items", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [{ id: 1, name: "Lege module", position: 1, items_count: 0, workflow_state: "active" }],
      linkHeader: null,
    });
    const result = await listModules(mockClient, "1");
    expect(result).toContain("0 items");
  });

  it("geeft melding bij geen modules", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({ data: [], linkHeader: null });
    const result = await listModules(mockClient, "42");
    expect(result).toContain("Geen modules gevonden");
  });

  it("gooit CanvasApiError bij 404", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockRejectedValue(new CanvasApiError(404, "Niet gevonden."));
    await expect(listModules(mockClient, "99999")).rejects.toThrow(CanvasApiError);
  });

  it("gooit CanvasApiError bij 401", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockRejectedValue(new CanvasApiError(401, "Ongeldige token."));
    await expect(listModules(mockClient, "1")).rejects.toThrow(CanvasApiError);
  });
});

// ─── getModuleItems ───────────────────────────────────────────────────────────

describe("getModuleItems", () => {
  it("toont items in een module met type en voltooiingsstatus", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [
        { id: 1, title: "Introductie pagina", type: "Page", position: 1, indent: 0, html_url: null },
        { id: 2, title: "Opdracht 1", type: "Assignment", position: 2, indent: 0, html_url: null, completion_requirement: { type: "must_submit", completed: true } },
      ],
      linkHeader: null,
    });
    const result = await getModuleItems(mockClient, "1", "10");
    expect(result).toContain("Introductie pagina");
    expect(result).toContain("[Page]");
    expect(result).toContain("Opdracht 1");
    expect(result).toContain("✓");
  });

  it("toont item zonder voltooiingsstatus zonder te crashen", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [{ id: 1, title: "Bestand", type: "File", position: 1, indent: 0, html_url: null }],
      linkHeader: null,
    });
    await expect(getModuleItems(mockClient, "1", "10")).resolves.toContain("Bestand");
  });

  it("geeft melding bij lege module", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({ data: [], linkHeader: null });
    const result = await getModuleItems(mockClient, "1", "10");
    expect(result).toContain("Geen items gevonden");
  });

  it("gooit CanvasApiError bij 404", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockRejectedValue(new CanvasApiError(404, "Niet gevonden."));
    await expect(getModuleItems(mockClient, "1", "99999")).rejects.toThrow(CanvasApiError);
  });

  it("gooit CanvasApiError bij 401", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockRejectedValue(new CanvasApiError(401, "Ongeldige token."));
    await expect(getModuleItems(mockClient, "1", "10")).rejects.toThrow(CanvasApiError);
  });
});

// ─── listPages ───────────────────────────────────────────────────────────────

describe("listPages", () => {
  it("toont gepubliceerde pagina's met titel en slug", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [{ url: "weekplanning", title: "Weekplanning", updated_at: "2025-05-01T10:00:00Z", published: true }],
      linkHeader: null,
    });
    const result = await listPages(mockClient, "1");
    expect(result).toContain("Weekplanning");
    expect(result).toContain("weekplanning");
  });

  it("filtert ongepubliceerde pagina's eruit", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [
        { url: "zichtbaar", title: "Zichtbare pagina", updated_at: "2025-05-01T10:00:00Z", published: true },
        { url: "concept", title: "Conceptpagina", updated_at: "2025-05-01T10:00:00Z", published: false },
      ],
      linkHeader: null,
    });
    const result = await listPages(mockClient, "1");
    expect(result).toContain("Zichtbare pagina");
    expect(result).not.toContain("Conceptpagina");
  });

  it("toont 0 als alle pagina's ongepubliceerd zijn", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [{ url: "concept", title: "Concept", updated_at: "2025-05-01T10:00:00Z", published: false }],
      linkHeader: null,
    });
    const result = await listPages(mockClient, "1");
    expect(result).toContain("(0)");
  });

  it("geeft melding bij geen pagina's", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({ data: [], linkHeader: null });
    const result = await listPages(mockClient, "42");
    expect(result).toContain("Geen pagina's gevonden");
  });

  it("geeft begrijpelijke melding bij 404 (pagina's uitgeschakeld in cursus)", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockRejectedValue(new CanvasApiError(404, "Niet gevonden."));
    const result = await listPages(mockClient, "15807");
    expect(result).toContain("niet beschikbaar");
    expect(result).toContain("15807");
    expect(result).not.toContain("404");
  });

  it("gooit CanvasApiError door bij andere fouten (bijv. 401)", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockRejectedValue(new CanvasApiError(401, "Ongeldig token."));
    await expect(listPages(mockClient, "1")).rejects.toThrow(CanvasApiError);
  });
});

// ─── getPageContent ───────────────────────────────────────────────────────────

describe("getPageContent", () => {
  it("toont paginatitel en schone inhoud zonder HTML-tags", async () => {
    (mockClient.get as jest.Mock).mockResolvedValue({
      url: "weekplanning", title: "Weekplanning",
      body: "<p>Week 1: <strong>Introductie</strong></p>",
      updated_at: "2025-09-01T10:00:00Z", published: true,
    });
    const result = await getPageContent(mockClient, "42", "weekplanning");
    expect(result).toContain("Weekplanning");
    expect(result).toContain("Introductie");
    expect(result).not.toContain("<p>");
    expect(result).not.toContain("<strong>");
  });

  it("geeft melding als de pagina geen body heeft (null)", async () => {
    (mockClient.get as jest.Mock).mockResolvedValue({
      url: "lege-pagina", title: "Lege pagina",
      body: null, updated_at: "2025-09-01T10:00:00Z", published: true,
    });
    const result = await getPageContent(mockClient, "42", "lege-pagina");
    expect(result).toContain("Lege pagina");
    expect(result).toContain("Geen inhoud beschikbaar");
  });

  it("geeft begrijpelijke melding bij 404 (pagina bestaat niet)", async () => {
    (mockClient.get as jest.Mock).mockRejectedValue(new CanvasApiError(404, "Niet gevonden."));
    const result = await getPageContent(mockClient, "1", "bestaat-niet");
    expect(result).toContain("bestaat-niet");
    expect(result).toContain("bestaat niet");
    expect(result).toContain("canvas_list_pages");
    expect(result).not.toContain("404");
  });

  it("gooit CanvasApiError door bij 403", async () => {
    (mockClient.get as jest.Mock).mockRejectedValue(new CanvasApiError(403, "Geen toegang."));
    await expect(getPageContent(mockClient, "1", "pagina")).rejects.toThrow(CanvasApiError);
  });
});

// ─── getAnnouncements ────────────────────────────────────────────────────────

describe("getAnnouncements", () => {
  it("toont mededelingen met titel, datum en auteur", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [{
        id: 1, title: "Deadline verschoven",
        message: "<p>De deadline is met een week verschoven.</p>",
        posted_at: "2025-05-10T09:00:00Z",
        author: { display_name: "Jan Docent" },
      }],
      linkHeader: null,
    });
    const result = await getAnnouncements(mockClient, "1");
    expect(result).toContain("Deadline verschoven");
    expect(result).toContain("Jan Docent");
    expect(result).toContain("deadline is met een week verschoven");
  });

  it("strips HTML-tags uit het bericht", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [{
        id: 1, title: "HTML mededeling",
        message: "<h2>Titel</h2><p><strong>Vet</strong></p>",
        posted_at: "2025-05-10T09:00:00Z",
        author: { display_name: "Docent" },
      }],
      linkHeader: null,
    });
    const result = await getAnnouncements(mockClient, "1");
    expect(result).not.toContain("<h2>");
    expect(result).toContain("Vet");
  });

  it("trunceert lange berichten op 300 tekens", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [{
        id: 1, title: "Lang bericht",
        message: "x".repeat(500),
        posted_at: "2025-05-10T09:00:00Z",
        author: { display_name: "Docent" },
      }],
      linkHeader: null,
    });
    const result = await getAnnouncements(mockClient, "1");
    expect(result).toContain("…");
  });

  it("toont 'Onbekend' als auteur ontbreekt", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [{
        id: 1, title: "Anoniem", message: "Tekst",
        posted_at: "2025-05-10T09:00:00Z", author: {},
      }],
      linkHeader: null,
    });
    const result = await getAnnouncements(mockClient, "1");
    expect(result).toContain("Onbekend");
  });

  it("crasht niet als author null is", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [{
        id: 1, title: "Geen auteur object", message: "Tekst",
        posted_at: "2025-05-10T09:00:00Z", author: null,
      }],
      linkHeader: null,
    });
    await expect(getAnnouncements(mockClient, "1")).resolves.toContain("Geen auteur object");
  });

  it("geeft melding bij geen mededelingen", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({ data: [], linkHeader: null });
    const result = await getAnnouncements(mockClient, "42");
    expect(result).toContain("Geen mededelingen gevonden");
  });

  it("gooit CanvasApiError bij 404", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockRejectedValue(new CanvasApiError(404, "Niet gevonden."));
    await expect(getAnnouncements(mockClient, "99999")).rejects.toThrow(CanvasApiError);
  });

  it("gooit CanvasApiError bij 401", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockRejectedValue(new CanvasApiError(401, "Ongeldige token."));
    await expect(getAnnouncements(mockClient, "1")).rejects.toThrow(CanvasApiError);
  });
});

// ─── listFiles ───────────────────────────────────────────────────────────────

describe("listFiles", () => {
  it("toont bestanden met naam, type en grootte", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [{
        id: 99, display_name: "Syllabus.pdf", filename: "Syllabus.pdf",
        "content-type": "application/pdf", size: 204800,
        updated_at: "2025-09-01T08:00:00Z",
        url: "https://school.example.com/files/99", folder_id: 1,
      }],
      linkHeader: null,
    });
    const result = await listFiles(mockClient, "1");
    expect(result).toContain("Syllabus.pdf");
    expect(result).toContain("application/pdf");
    expect(result).toContain("200.0 KB");
  });

  it("toont bestandsgrootte in MB voor grote bestanden", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [{
        id: 100, display_name: "Video.mp4", filename: "Video.mp4",
        "content-type": "video/mp4", size: 5242880,
        updated_at: "2025-09-01T08:00:00Z",
        url: "https://school.example.com/files/100", folder_id: 1,
      }],
      linkHeader: null,
    });
    const result = await listFiles(mockClient, "1");
    expect(result).toContain("5.0 MB");
  });

  it("geeft melding als er geen bestanden zijn", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({ data: [], linkHeader: null });
    const result = await listFiles(mockClient, "1");
    expect(result).toContain("Geen bestanden gevonden");
  });

  it("geeft begrijpelijke melding bij 403 (student-token heeft geen bestandsrechten)", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockRejectedValue(new CanvasApiError(403, "Geen toegang."));
    const result = await listFiles(mockClient, "1");
    expect(result).toContain("niet beschikbaar");
    expect(result.toLowerCase()).toContain("student");
    expect(result).not.toContain("403");
  });

  it("gooit CanvasApiError door bij 404", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockRejectedValue(new CanvasApiError(404, "Niet gevonden."));
    await expect(listFiles(mockClient, "99999")).rejects.toThrow(CanvasApiError);
  });

  it("gooit CanvasApiError door bij 401", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockRejectedValue(new CanvasApiError(401, "Ongeldige token."));
    await expect(listFiles(mockClient, "1")).rejects.toThrow(CanvasApiError);
  });
});

// ─── listSubmissions ─────────────────────────────────────────────────────────

describe("listSubmissions", () => {
  it("toont ingeleverde opdrachten met status en cijfer", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [{
        id: 55, assignment_id: 10, workflow_state: "graded",
        submitted_at: "2025-06-01T10:00:00Z", score: 8.5, grade: "8.5",
        late: false, missing: false,
        assignment: { name: "Portfolio opdracht", points_possible: 10 },
      }],
      linkHeader: null,
    });
    const result = await listSubmissions(mockClient, "1");
    expect(result).toContain("Portfolio opdracht");
    expect(result).toContain("Beoordeeld");
    expect(result).toContain("8.5");
  });

  it("toont 'Ingeleverd' voor niet-beoordeelde indieningen", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [{
        id: 56, assignment_id: 11, workflow_state: "submitted",
        submitted_at: "2025-06-02T10:00:00Z", score: null, grade: null,
        late: false, missing: false,
        assignment: { name: "Opdracht 2", points_possible: 10 },
      }],
      linkHeader: null,
    });
    const result = await listSubmissions(mockClient, "1");
    expect(result).toContain("Ingeleverd");
  });

  it("geeft melding als er niets ingeleverd is", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [{
        id: 1, assignment_id: 1, workflow_state: "unsubmitted",
        submitted_at: null, score: null, grade: null, late: false, missing: false,
      }],
      linkHeader: null,
    });
    const result = await listSubmissions(mockClient, "1");
    expect(result).toContain("Geen ingeleverde opdrachten");
  });

  it("gooit CanvasApiError bij 404", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockRejectedValue(new CanvasApiError(404, "Niet gevonden."));
    await expect(listSubmissions(mockClient, "99999")).rejects.toThrow(CanvasApiError);
  });

  it("gooit CanvasApiError bij 401", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockRejectedValue(new CanvasApiError(401, "Ongeldige token."));
    await expect(listSubmissions(mockClient, "1")).rejects.toThrow(CanvasApiError);
  });
});

// ─── getSubmission ────────────────────────────────────────────────────────────

describe("getSubmission", () => {
  it("toont indiening met status, cijfer en feedback", async () => {
    (mockClient.get as jest.Mock).mockResolvedValue({
      id: 55, assignment_id: 10, workflow_state: "graded",
      submitted_at: "2025-06-01T10:00:00Z", score: 7, grade: "7",
      late: false, missing: false,
      submission_comments: [
        { author_name: "Docent Jansen", created_at: "2025-06-03T09:00:00Z", comment: "Goed gedaan!" },
      ],
    });
    const result = await getSubmission(mockClient, "1", "10");
    expect(result).toContain("Beoordeeld");
    expect(result).toContain("7");
    expect(result).toContain("Docent Jansen");
    expect(result).toContain("Goed gedaan!");
  });

  it("toont melding als opdracht nog niet ingeleverd is", async () => {
    (mockClient.get as jest.Mock).mockResolvedValue({
      id: 0, assignment_id: 99, workflow_state: "unsubmitted",
      submitted_at: null, score: null, grade: null,
      late: false, missing: false, submission_comments: [],
    });
    const result = await getSubmission(mockClient, "1", "99");
    expect(result).toContain("nog niet ingeleverd");
  });

  it("toont melding als er geen feedback is", async () => {
    (mockClient.get as jest.Mock).mockResolvedValue({
      id: 55, assignment_id: 10, workflow_state: "submitted",
      submitted_at: "2025-06-01T10:00:00Z", score: null, grade: null,
      late: false, missing: false, submission_comments: [],
    });
    const result = await getSubmission(mockClient, "1", "10");
    expect(result).not.toContain("Docent");
  });

  it("gooit CanvasApiError bij 404", async () => {
    (mockClient.get as jest.Mock).mockRejectedValue(new CanvasApiError(404, "Niet gevonden."));
    await expect(getSubmission(mockClient, "1", "99999")).rejects.toThrow(CanvasApiError);
  });

  it("gooit CanvasApiError bij 401", async () => {
    (mockClient.get as jest.Mock).mockRejectedValue(new CanvasApiError(401, "Ongeldige token."));
    await expect(getSubmission(mockClient, "1", "10")).rejects.toThrow(CanvasApiError);
  });
});
