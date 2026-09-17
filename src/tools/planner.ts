import { z } from "zod";
import { CanvasClient } from "../canvasClient.js";
import { fetchAllPages } from "../pagination.js";
import { formatDate } from "../utils/formatDate.js";

const getUpcomingDeadlinesSchema = z.object({});
const getMissingSubmissionsSchema = z.object({});

interface PlannerItem {
  plannable_type: string;
  plannable_date: string;
  plannable: {
    id: number;
    title: string;
    due_at?: string | null;
    points_possible?: number | null;
  };
  context_name?: string;
  submissions?: {
    submitted?: boolean;
    graded?: boolean;
  };
}

export async function getUpcomingDeadlines(client: CanvasClient): Promise<string> {
  const now = new Date().toISOString();
  const items = await fetchAllPages<PlannerItem>(client, "/api/v1/planner/items", {
    start_date: now,
    per_page: 50,
  });

  if (items.length === 0) {
    return "Er zijn geen aankomende deadlines gevonden in je Canvas planner.";
  }

  const sorted = items
    .filter((item) => item.plannable_date)
    .sort((a, b) => new Date(a.plannable_date).getTime() - new Date(b.plannable_date).getTime())
    .slice(0, 20);

  const lines = sorted.map((item) => {
    const date = formatDate(item.plannable_date);
    const course = item.context_name ? ` — ${item.context_name}` : "";
    const submitted = item.submissions?.submitted ? " ✓ ingeleverd" : "";
    return `- ${date}${course}: ${item.plannable.title}${submitted}`;
  });

  return `Aankomende deadlines (${sorted.length}):\n\n${lines.join("\n")}`;
}

interface MissingAssignment {
  id: number;
  name: string;
  due_at: string | null;
  course_id: number;
  points_possible: number | null;
}

export async function getMissingSubmissions(client: CanvasClient): Promise<string> {
  const [missing, courses] = await Promise.all([
    fetchAllPages<MissingAssignment>(client, "/api/v1/users/self/missing_submissions"),
    fetchAllPages<{ id: number; name: string }>(client, "/api/v1/courses", {
      enrollment_state: "active",
    }),
  ]);

  if (missing.length === 0) {
    return "Geen ontbrekende indieningen gevonden. Alles is op tijd ingeleverd!";
  }

  const courseMap = new Map(courses.map((c) => [c.id, c.name]));

  const lines = missing.map((a) => {
    const courseName = courseMap.get(a.course_id) ?? `Cursus ${a.course_id}`;
    const due = a.due_at ? formatDate(a.due_at) : "geen deadline";
    const pts = a.points_possible !== null ? ` (${a.points_possible} pt)` : "";
    return `- **${a.name}**${pts}\n  Cursus: ${courseName} | Deadline was: ${due}`;
  });

  return `Ontbrekende indieningen (${missing.length}):\n\n${lines.join("\n")}`;
}

export const plannerTools = [
  {
    name: "canvas_get_upcoming_deadlines",
    description:
      "Haal de aankomende deadlines op uit de Canvas planner. Geeft de eerstvolgende opdrachten, toetsen en andere items gesorteerd op datum.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
    schema: getUpcomingDeadlinesSchema,
    handler: (client: CanvasClient) => getUpcomingDeadlines(client),
  },
  {
    name: "canvas_get_missing_submissions",
    description:
      "Haal alle verlopen opdrachten op die je nog niet hebt ingeleverd, over alle cursussen. Nuttig om te checken wat je gemist hebt.",
    inputSchema: { type: "object" as const, properties: {}, required: [] },
    schema: getMissingSubmissionsSchema,
    handler: (client: CanvasClient) => getMissingSubmissions(client),
  },
];
