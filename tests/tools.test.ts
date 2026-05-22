import { CanvasClient } from "../src/canvasClient";
import { listCourses } from "../src/tools/courses";
import { listAssignments, getAssignmentDetails } from "../src/tools/assignments";
import { getUpcomingDeadlines } from "../src/tools/planner";

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
