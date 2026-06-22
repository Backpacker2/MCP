import { CanvasClient } from "../src/canvasClient";
import { listCourses } from "../src/tools/courses";
import { listAssignments, getAssignmentDetails } from "../src/tools/assignments";
import { getUpcomingDeadlines } from "../src/tools/planner";
import { getPageContent } from "../src/tools/pages";
import { getModuleItems } from "../src/tools/modules";
import { listFiles } from "../src/tools/files";
import { listSubmissions, getSubmission } from "../src/tools/submissions";
import { getCalendarEvents } from "../src/tools/calendar";
import { listDiscussions, getDiscussionEntries } from "../src/tools/discussions";
import { getWeekOverview, getCourseProgress, getDeadlineBurndown } from "../src/tools/reports";

const mockClient = {
  get: jest.fn(),
  getWithHeaders: jest.fn(),
  cacheGet: jest.fn().mockReturnValue(undefined),
  cacheSet: jest.fn(),
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

  it("gebruikt cache bij tweede aanroep", async () => {
    interface CanvasCourse { id: number; name: string; course_code: string; enrollment_term_id: number; workflow_state: string; }
    let store: CanvasCourse[] | undefined;
    const cachingClient = {
      getWithHeaders: jest.fn().mockResolvedValue({
        data: [{ id: 2, name: "Wiskunde", course_code: "WIS1", enrollment_term_id: 1, workflow_state: "available" }],
        linkHeader: null,
      }),
      cacheGet: jest.fn().mockImplementation(() => store),
      cacheSet: jest.fn().mockImplementation((_k: string, v: unknown) => { store = v as CanvasCourse[]; }),
      baseUrl: "https://school.example.com",
    } as unknown as CanvasClient;

    await listCourses(cachingClient);
    await listCourses(cachingClient);

    expect(cachingClient.getWithHeaders).toHaveBeenCalledTimes(1);
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

describe("getCalendarEvents", () => {
  it("toont events met titel, datum en context", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 1,
          title: "Tentamen Informatica",
          start_at: new Date(Date.now() + 86400000 * 5).toISOString(),
          end_at: null,
          description: "<p>Zorg dat je op tijd bent.</p>",
          location_name: "Zaal A1",
          context_name: "Informatica",
          type: "event",
        },
      ],
      linkHeader: null,
    });

    const result = await getCalendarEvents(mockClient);
    expect(result).toContain("Tentamen Informatica");
    expect(result).toContain("Informatica");
    expect(result).toContain("Zaal A1");
    expect(result).toContain("Zorg dat je op tijd bent");
    expect(result).not.toContain("<p>");
  });

  it("geeft melding als er geen events zijn", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({ data: [], linkHeader: null });
    const result = await getCalendarEvents(mockClient);
    expect(result).toContain("Geen kalender-events");
  });

  it("filtert op cursus als courseId opgegeven", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({ data: [], linkHeader: null });
    const result = await getCalendarEvents(mockClient, "42");
    expect(result).toContain("cursus 42");
  });
});

describe("listDiscussions", () => {
  it("toont discussieonderwerpen met type en datum", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 7,
          title: "Vraag over het portfolio",
          message: "<p>Wie heeft al begonnen?</p>",
          posted_at: "2025-09-10T08:00:00Z",
          discussion_type: "side_comment",
          author: { display_name: "Docent Pietersen" },
        },
      ],
      linkHeader: null,
    });

    const result = await listDiscussions(mockClient, "1");
    expect(result).toContain("Vraag over het portfolio");
    expect(result).toContain("[7]");
    expect(result).toContain("Docent Pietersen");
  });

  it("geeft melding bij geen discussies", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({ data: [], linkHeader: null });
    const result = await listDiscussions(mockClient, "1");
    expect(result).toContain("Geen discussies gevonden");
  });
});

describe("getDiscussionEntries", () => {
  it("toont berichten met auteur en schone tekst", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 101,
          message: "<p>Ik ben al begonnen met hoofdstuk 2.</p>",
          user_name: "Student A",
          created_at: "2025-09-11T10:00:00Z",
        },
      ],
      linkHeader: null,
    });

    const result = await getDiscussionEntries(mockClient, "1", "7");
    expect(result).toContain("Student A");
    expect(result).toContain("hoofdstuk 2");
    expect(result).not.toContain("<p>");
  });

  it("geeft melding als discussie leeg is", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({ data: [], linkHeader: null });
    const result = await getDiscussionEntries(mockClient, "1", "7");
    expect(result).toContain("Geen berichten gevonden");
  });
});

describe("getWeekOverview", () => {
  it("toont deadlines en events per dag", async () => {
    const tomorrow = new Date(Date.now() + 86400000);
    const tomorrowStr = tomorrow.toISOString();

    (mockClient.getWithHeaders as jest.Mock)
      .mockResolvedValueOnce({
        data: [
          {
            plannable_type: "assignment",
            plannable_date: tomorrowStr,
            plannable: { id: 1, title: "Essay inleveren", due_at: tomorrowStr },
            context_name: "Nederlands",
            submissions: { submitted: false },
          },
        ],
        linkHeader: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 5,
            title: "Gastcollege",
            start_at: tomorrowStr,
            end_at: null,
            location_name: "Zaal B2",
            context_name: "Informatica",
          },
        ],
        linkHeader: null,
      });

    const result = await getWeekOverview(mockClient);
    expect(result).toContain("Essay inleveren");
    expect(result).toContain("Nederlands");
    expect(result).toContain("Gastcollege");
    expect(result).toContain("Zaal B2");
    expect(result).toContain("Weekoverzicht");
  });

  it("geeft melding als er niets is in de komende 7 dagen", async () => {
    (mockClient.getWithHeaders as jest.Mock)
      .mockResolvedValueOnce({ data: [], linkHeader: null })
      .mockResolvedValueOnce({ data: [], linkHeader: null });

    const result = await getWeekOverview(mockClient);
    expect(result).toContain("Geen deadlines of events");
  });
});

describe("getCourseProgress", () => {
  it("toont voortgang met percentage en openstaande opdrachten", async () => {
    (mockClient.getWithHeaders as jest.Mock)
      .mockResolvedValueOnce({
        data: [
          { id: 1, name: "Opdracht A", due_at: "2026-07-01T00:00:00Z", points_possible: 10 },
          { id: 2, name: "Opdracht B", due_at: null, points_possible: 20 },
        ],
        linkHeader: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            assignment_id: 1,
            workflow_state: "graded",
            score: 8,
            grade: "8",
            assignment: { name: "Opdracht A", points_possible: 10 },
          },
          {
            assignment_id: 2,
            workflow_state: "unsubmitted",
            score: null,
            grade: null,
            assignment: { name: "Opdracht B", points_possible: 20 },
          },
        ],
        linkHeader: null,
      })
      .mockResolvedValueOnce({
        data: [
          { id: 10, name: "Module 1", items_count: 5, workflow_state: "completed" },
          { id: 11, name: "Module 2", items_count: 3, workflow_state: "active" },
        ],
        linkHeader: null,
      });

    const result = await getCourseProgress(mockClient, "1");
    expect(result).toContain("1/2 ingeleverd");
    expect(result).toContain("2 modules");
    expect(result).toContain("Opdracht B");
  });

  it("geeft melding als er nog niets ingeleverd is", async () => {
    (mockClient.getWithHeaders as jest.Mock)
      .mockResolvedValueOnce({ data: [], linkHeader: null })
      .mockResolvedValueOnce({ data: [], linkHeader: null })
      .mockResolvedValueOnce({ data: [], linkHeader: null });

    const result = await getCourseProgress(mockClient, "42");
    expect(result).toContain("0/0 ingeleverd");
  });

  it("splitst verlopen en toekomstige openstaande opdrachten", async () => {
    const verleden = new Date(Date.now() - 86400000 * 10).toISOString(); // 10 dagen geleden
    const toekomst = new Date(Date.now() + 86400000 * 10).toISOString(); // 10 dagen vooruit

    (mockClient.getWithHeaders as jest.Mock)
      .mockResolvedValueOnce({
        data: [
          { id: 1, name: "Verlopen opdracht", due_at: verleden, points_possible: 10 },
          { id: 2, name: "Toekomstige opdracht", due_at: toekomst, points_possible: 10 },
          { id: 3, name: "Geen deadline", due_at: null, points_possible: 10 },
        ],
        linkHeader: null,
      })
      .mockResolvedValueOnce({ data: [], linkHeader: null }) // geen submissions
      .mockResolvedValueOnce({ data: [], linkHeader: null }); // geen modules

    const result = await getCourseProgress(mockClient, "1");
    expect(result).toContain("Nog in te leveren");
    expect(result).toContain("Toekomstige opdracht");
    expect(result).toContain("Geen deadline");
    expect(result).toContain("Verlopen zonder inlevering");
    expect(result).toContain("Verlopen opdracht");
  });
});

describe("getDeadlineBurndown", () => {
  it("toont deadlines per week met bar", async () => {
    const nextWeek = new Date(Date.now() + 86400000 * 8);

    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({
      data: [
        {
          plannable_type: "assignment",
          plannable_date: new Date(Date.now() + 86400000 * 2).toISOString(),
          plannable: { id: 1, title: "Opdracht 1" },
          submissions: { submitted: true },
        },
        {
          plannable_type: "assignment",
          plannable_date: nextWeek.toISOString(),
          plannable: { id: 2, title: "Opdracht 2" },
          submissions: { submitted: false },
        },
      ],
      linkHeader: null,
    });

    const result = await getDeadlineBurndown(mockClient);
    expect(result).toContain("Deadline-burndown");
    expect(result).toContain("Week");
    expect(result).toContain("ingeleverd");
    expect(result).toContain("Totaal");
  });

  it("geeft melding als er geen deadlines zijn", async () => {
    (mockClient.getWithHeaders as jest.Mock).mockResolvedValue({ data: [], linkHeader: null });
    const result = await getDeadlineBurndown(mockClient);
    expect(result).toContain("Geen deadlines gevonden");
  });
});
