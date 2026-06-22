import { z } from "zod";
import { CanvasClient } from "../canvasClient.js";
import { fetchAllPages } from "../pagination.js";
import { formatDate } from "../utils/formatDate.js";

const getUpcomingDeadlinesSchema = z.object({});

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
];
