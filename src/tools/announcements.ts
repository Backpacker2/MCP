import { CanvasClient } from "../canvasClient.js";
import { fetchAllPages } from "../pagination.js";
import { cleanHtml } from "../utils/cleanHtml.js";
import { formatDate } from "../utils/formatDate.js";
import { sanitizeText } from "../utils/sanitizeText.js";

interface CanvasAnnouncement {
  id: number;
  title: string;
  message: string;
  posted_at: string;
  author: { display_name?: string };
}

export async function getAnnouncements(client: CanvasClient, courseId: string): Promise<string> {
  const announcements = await fetchAllPages<CanvasAnnouncement>(
    client,
    "/api/v1/announcements",
    { "context_codes[]": `course_${courseId}`, per_page: 20 }
  );

  if (announcements.length === 0) {
    return `Geen mededelingen gevonden voor cursus ${courseId}.`;
  }

  const lines = announcements.map((a) => {
    const date = formatDate(a.posted_at);
    const author = sanitizeText(a.author?.display_name ?? "Onbekend", 100);
    const title = sanitizeText(a.title, 200);
    const cleaned = cleanHtml(a.message);
    const message = cleaned.slice(0, 300);
    const truncated = cleaned.length > 300 ? "…" : "";
    return `**${title}**\nGeplaatst: ${date} door ${author}\n${message}${truncated}`;
  });

  return `Mededelingen voor cursus ${courseId} (${announcements.length}):\n\n${lines.join("\n\n---\n\n")}`;
}

export const announcementTools = [
  {
    name: "canvas_get_announcements",
    description:
      "Haal de mededelingen (announcements) op voor een specifieke Canvas cursus. Geeft titel, datum, auteur en tekst terug.",
    inputSchema: {
      type: "object" as const,
      properties: {
        courseId: {
          type: "string",
          description: "Het Canvas course ID. Gebruik canvas_list_courses om dit te vinden.",
        },
      },
      required: ["courseId"],
    },
    handler: (client: CanvasClient, args: Record<string, string>) =>
      getAnnouncements(client, args.courseId),
  },
];
