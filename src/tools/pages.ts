import { CanvasClient } from "../canvasClient.js";
import { fetchAllPages } from "../pagination.js";
import { cleanHtml } from "../utils/cleanHtml.js";
import { formatDate } from "../utils/formatDate.js";
import { CanvasApiError } from "../errors.js";

interface CanvasPage {
  url: string;
  title: string;
  updated_at: string;
  published: boolean;
}

// De Canvas API geeft bij een enkele pagina ook de HTML-body terug.
// Bij de lijst (listPages) ontbreekt 'body' — vandaar twee aparte interfaces.
interface CanvasPageDetail {
  url: string;
  title: string;
  body: string | null;
  updated_at: string;
  published: boolean;
}

export async function listPages(client: CanvasClient, courseId: string): Promise<string> {
  let pages: CanvasPage[];
  try {
    pages = await fetchAllPages<CanvasPage>(
      client,
      `/api/v1/courses/${courseId}/pages`,
      { sort: "updated_at", order: "desc" }
    );
  } catch (error) {
    if (error instanceof CanvasApiError && error.statusCode === 404) {
      return `Pagina's zijn niet beschikbaar voor cursus ${courseId}. Mogelijk zijn pagina's uitgeschakeld in deze cursus, of is het cursus-ID onjuist.`;
    }
    throw error;
  }

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

// pageUrl is de "slug" van de pagina, bijvoorbeeld "weekplanning".
// canvas_list_pages geeft deze slug terug als het 'Slug:' veld.
export async function getPageContent(
  client: CanvasClient,
  courseId: string,
  pageUrl: string
): Promise<string> {
  let page: CanvasPageDetail;
  try {
    page = await client.get<CanvasPageDetail>(
      `/api/v1/courses/${courseId}/pages/${pageUrl}`
    );
  } catch (error) {
    if (error instanceof CanvasApiError && error.statusCode === 404) {
      return `Pagina '${pageUrl}' bestaat niet in cursus ${courseId}. Gebruik canvas_list_pages om de beschikbare pagina's op te vragen.`;
    }
    throw error;
  }

  const updated = formatDate(page.updated_at);
  const body = cleanHtml(page.body) || "Geen inhoud beschikbaar op deze pagina.";

  return [
    `**${page.title}**`,
    ``,
    `Bijgewerkt: ${updated}`,
    ``,
    `Inhoud:`,
    body,
  ].join("\n");
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
  {
    name: "canvas_get_page_content",
    description:
      "Haal de volledige tekst op van één Canvas pagina. Gebruik eerst canvas_list_pages om de slug (pageUrl) van de gewenste pagina te achterhalen.",
    inputSchema: {
      type: "object" as const,
      properties: {
        courseId: {
          type: "string",
          description: "Het Canvas course ID.",
        },
        pageUrl: {
          type: "string",
          description: "De slug van de pagina, bijv. 'weekplanning'. Staat als 'Slug:' in de uitvoer van canvas_list_pages.",
        },
      },
      required: ["courseId", "pageUrl"],
    },
    handler: (client: CanvasClient, args: Record<string, string>) =>
      getPageContent(client, args.courseId, args.pageUrl),
  },
];
