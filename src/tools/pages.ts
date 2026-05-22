import { CanvasClient } from "../canvasClient.js";
import { fetchAllPages } from "../pagination.js";
import { formatDate } from "../utils/formatDate.js";

interface CanvasPage {
  url: string;
  title: string;
  updated_at: string;
  published: boolean;
}

export async function listPages(client: CanvasClient, courseId: string): Promise<string> {
  const pages = await fetchAllPages<CanvasPage>(
    client,
    `/api/v1/courses/${courseId}/pages`,
    { sort: "updated_at", order: "desc" }
  );

  if (pages.length === 0) {
    return `Geen pagina's gevonden voor cursus ${courseId}.`;
  }

  const lines = pages
    .filter((p) => p.published)
    .map((p) => {
      const updated = formatDate(p.updated_at);
      return `- ${p.title} (bijgewerkt: ${updated})\n  Slug: ${p.url}`;
    });

  return `Gepubliceerde pagina's voor cursus ${courseId} (${lines.length}):\n\n${lines.join("\n")}`;
}

export const pageTools = [
  {
    name: "canvas_list_pages",
    description:
      "Haal de gepubliceerde Canvas pagina's op voor een cursus. Pagina's bevatten cursusinformatie, instructies of leesmateriaal.",
    inputSchema: {
      type: "object" as const,
      properties: {
        courseId: {
          type: "string",
          description: "Het Canvas course ID.",
        },
      },
      required: ["courseId"],
    },
    handler: (client: CanvasClient, args: Record<string, string>) =>
      listPages(client, args.courseId),
  },
];
