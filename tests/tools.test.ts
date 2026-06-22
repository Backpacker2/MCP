import { CanvasClient } from "../src/canvasClient";
import { listCourses } from "../src/tools/courses";
import { listAssignments, getAssignmentDetails } from "../src/tools/assignments";
import { getUpcomingDeadlines } from "../src/tools/planner";
import { getPageContent } from "../src/tools/pages";
import { getModuleItems } from "../src/tools/modules";
import { listFiles } from "../src/tools/files";
import { listSubmissions, getSubmission } from "../src/tools/submissions";

const mockClient = {
  get: jest.fn(),
  getWithHeaders: jest.fn(),
} as unknown as CanvasClient;

beforeEach(() => jest.clearAllMocks());

describe("listCourses", () => {
  it("toont cursussen als er data is", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [
        { id: 1, name: "Informatica", course_code: "INF1", enrollment_term_id: 1, workflow_state: "available" },
      ],
      linkHeader: null,
    });

    const result = await listCourses(mockClient);
    expect(result).toContain("Informatica");
    expect(result).toContain("[1]");
  });

  it("geeft melding bij lege lijst", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({ data: [], linkHeader: null });
    const result = await listCourses(mockClient);
    expect(result).toContain("geen actieve Canvas cursussen");
  });
});

describe("listAssignments", () => {
  it("toont opdrachten met deadline", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 10,
          name: "Opdracht 1",
          due_at: "2025-06-01T23:59:00Z",
          points_possible: 10,
          description: "<p>Maak iets moois</p>",
          html_url: "https://school.example.com/courses/1/assignments/10",
          submission_types: ["online_upload"],
          workflow_state: "published",
        },
      ],
      linkHeader: null,
    });

    const result = await listAssignments(mockClient, "1");
    expect(result).toContain("Opdracht 1");
    expect(result).toContain("10 punten");
  });

  it("geeft melding bij geen opdrachten", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({ data: [], linkHeader: null });
    const result = await listAssignments(mockClient, "42");
    expect(result).toContain("Geen opdrachten");
  });
});

describe("getAssignmentDetails", () => {
  it("toont opdrachtdetails inclusief beschrijving", async () => {
    (mockClient.get as jest.Mock).mockResolvedValue({
      id: 10,
      name: "Portfolio opdracht",
      due_at: "2025-07-15T12:00:00Z",
      points_possible: 20,
      description: "<p>Lever een portfolio in.</p>",
      html_url: "https://school.example.com/courses/1/assignments/10",
      submission_types: ["online_upload"],
      workflow_state: "published",
    });

    const result = await getAssignmentDetails(mockClient, "1", "10");
    expect(result).toContain("Portfolio opdracht");
    expect(result).toContain("Lever een portfolio in");
    expect(result).toContain("20 punten");
  });
});

describe("getPageContent", () => {
  it("toont paginatitel en schone inhoud", async () => {
    // We mocken client.get — canvas geeft een object terug (geen array), dus geen getWithHeaders nodig.
    (mockClient.get as jest.Mock).mockResolvedValue({
      url: "weekplanning",
      title: "Weekplanning",
      body: "<p>Week 1: <strong>Introductie</strong></p>",
      updated_at: "2025-09-01T10:00:00Z",
      published: true,
    });

    const result = await getPageContent(mockClient, "42", "weekplanning");

    // De titel moet zichtbaar zijn
    expect(result).toContain("Weekplanning");
    // HTML-tags moeten verwijderd zijn door cleanHtml()
    expect(result).toContain("Introductie");
    expect(result).not.toContain("<p>");
    expect(result).not.toContain("<strong>");
  });

  it("geeft nette melding als de pagina geen body heeft", async () => {
    (mockClient.get as jest.Mock).mockResolvedValue({
      url: "lege-pagina",
      title: "Lege pagina",
      body: null, // Canvas stuurt soms null als de pagina leeg is
      updated_at: "2025-09-01T10:00:00Z",
      published: true,
    });

    const result = await getPageContent(mockClient, "42", "lege-pagina");

    expect(result).toContain("Lege pagina");
    expect(result).toContain("Geen inhoud beschikbaar");
  });
});

describe("getUpcomingDeadlines", () => {
  it("toont aankomende deadlines", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [
        {
          plannable_type: "assignment",
          plannable_date: new Date(Date.now() + 86400000).toISOString(),
          plannable: { id: 1, title: "Morgen inleveren", due_at: null },
          context_name: "Wiskunde",
        },
      ],
      linkHeader: null,
    });

    const result = await getUpcomingDeadlines(mockClient);
    expect(result).toContain("Morgen inleveren");
    expect(result).toContain("Wiskunde");
  });

  it("geeft melding als er geen deadlines zijn", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({ data: [], linkHeader: null });
    const result = await getUpcomingDeadlines(mockClient);
    expect(result).toContain("geen aankomende deadlines");
  });
});

describe("getModuleItems", () => {
  it("toont items in een module met type en titel", async () => {
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

  it("geeft melding bij lege module", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({ data: [], linkHeader: null });
    const result = await getModuleItems(mockClient, "1", "10");
    expect(result).toContain("Geen items gevonden");
  });
});

describe("listFiles", () => {
  it("toont bestanden met naam, type en grootte", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 99,
          display_name: "Syllabus.pdf",
          filename: "Syllabus.pdf",
          "content-type": "application/pdf",
          size: 204800,
          updated_at: "2025-09-01T08:00:00Z",
          url: "https://school.example.com/files/99",
          folder_id: 1,
        },
      ],
      linkHeader: null,
    });

    const result = await listFiles(mockClient, "1");
    expect(result).toContain("Syllabus.pdf");
    expect(result).toContain("application/pdf");
    expect(result).toContain("200.0 KB");
  });

  it("geeft melding als er geen bestanden zijn", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({ data: [], linkHeader: null });
    const result = await listFiles(mockClient, "1");
    expect(result).toContain("Geen bestanden gevonden");
  });
});

describe("listSubmissions", () => {
  it("toont ingeleverde opdrachten met cijfer", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 55,
          assignment_id: 10,
          workflow_state: "graded",
          submitted_at: "2025-06-01T10:00:00Z",
          score: 8.5,
          grade: "8.5",
          late: false,
          missing: false,
          assignment: { name: "Portfolio opdracht", points_possible: 10 },
        },
      ],
      linkHeader: null,
    });

    const result = await listSubmissions(mockClient, "1");
    expect(result).toContain("Portfolio opdracht");
    expect(result).toContain("Beoordeeld");
    expect(result).toContain("8.5");
  });

  it("geeft melding als er niets ingeleverd is", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [
        { id: 1, assignment_id: 1, workflow_state: "unsubmitted", submitted_at: null, score: null, grade: null, late: false, missing: false },
      ],
      linkHeader: null,
    });
    const result = await listSubmissions(mockClient, "1");
    expect(result).toContain("Geen ingeleverde opdrachten");
  });
});

describe("getSubmission", () => {
  it("toont indiening met feedback", async () => {
    (mockClient.get as jest.Mock).mockResolvedValue({
      id: 55,
      assignment_id: 10,
      workflow_state: "graded",
      submitted_at: "2025-06-01T10:00:00Z",
      score: 7,
      grade: "7",
      late: false,
      missing: false,
      submission_comments: [
        { author_name: "Docent Jansen", created_at: "2025-06-03T09:00:00Z", comment: "Goed gedaan!" },
      ],
    });

    const result = await getSubmission(mockClient, "1", "10");
    expect(result).toContain("Beoordeeld");
    expect(result).toContain("Cijfer: 7");
    expect(result).toContain("Docent Jansen");
    expect(result).toContain("Goed gedaan!");
  });

  it("geeft melding als opdracht niet ingeleverd is", async () => {
    (mockClient.get as jest.Mock).mockResolvedValue({
      id: 0,
      assignment_id: 99,
      workflow_state: "unsubmitted",
      submitted_at: null,
      score: null,
      grade: null,
      late: false,
      missing: false,
    });

    const result = await getSubmission(mockClient, "1", "99");
    expect(result).toContain("nog niet ingeleverd");
  });
});
