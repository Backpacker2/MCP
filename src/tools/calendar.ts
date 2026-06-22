import { z } from "zod";
import { CanvasClient } from "../canvasClient.js";
import { fetchAllPages } from "../pagination.js";
import { cleanHtml } from "../utils/cleanHtml.js";
import { formatDate } from "../utils/formatDate.js";

const idParam = z.string().regex(/^\d+$/, "ID mag alleen cijfers bevatten");
const getCalendarEventsSchema = z.object({ courseId: idParam.optional() });

interface CanvasCalendarEvent {
  id: number;
  title: string;
  start_at: string;
  end_at: string | null;
  description: string | null;
  location_name: string | null;
  context_name: string | null;
  type: string;
}

export async function getCalendarEvents(
  client: CanvasClient,
  courseId?: string
): Promise<string> {
  const now = new Date();
  const future = new Date(now);
  future.setDate(future.getDate() + 30);

  const params: Record<string, string> = {
    start_date: now.toISOString().split("T")[0],
    end_date: future.toISOString().split("T")[0],
    "type[]": "event",
  };

  if (courseId) {
    params["context_codes[]"] = `course_${courseId}`;
  }

  const events = await fetchAllPages<CanvasCalendarEvent>(
    client,
    "/api/v1/calendar_events",
    params
  );

  if (events.length === 0) {
    return courseId
      ? `Geen kalender-events gevonden voor cursus ${courseId} in de komende 30 dagen.`
      : "Geen kalender-events gevonden in de komende 30 dagen.";
  }

  const sorted = [...events].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  );

  const lines = sorted.map((e) => {
    const start = formatDate(e.start_at);
    const context = e.context_name ? ` | ${e.context_name}` : "";
    const location = e.location_name ? ` | Locatie: ${e.location_name}` : "";
    const description = e.description ? `\n  ${cleanHtml(e.description)}` : "";
    return `- ${e.title} (${start}${context}${location})${description}`;
  });

  const scope = courseId ? `cursus ${courseId}` : "alle cursussen";
  return `Kalender-events komende 30 dagen (${scope}, ${lines.length}):\n\n${lines.join("\n")}`;
}

export const calendarTools = [
  {
    name: "canvas_get_calendar_events",
    description:
      "Haal Canvas kalender-events op voor de komende 30 dagen, zoals tentamens, lessen en andere geplande activiteiten. Optioneel te filteren op één cursus.",
    inputSchema: {
      type: "object" as const,
      properties: {
        courseId: {
          type: "string",
          description:
            "Optioneel Canvas course ID om alleen events van die cursus te tonen. Weglaten geeft events van alle cursussen.",
        },
      },
      required: [],
    },
    schema: getCalendarEventsSchema,
    handler: (client: CanvasClient, args: Record<string, string>) =>
      getCalendarEvents(client, args.courseId),
  },
];
