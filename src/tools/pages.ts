import { z } from "zod";
import { CanvasClient } from "../canvasClient.js";
import { CanvasApiError } from "../errors.js";
import { fetchAllPages } from "../pagination.js";
import { cleanHtml } from "../utils/cleanHtml.js";
import { formatDate } from "../utils/formatDate.js";


const idParam = z.string().regex(/^\d+$/, "ID mag alleen cijfers bevatten");
const listPagesSchema = z.object({ courseId: idParam });
const getPageContentSchema = z.object({ courseId: idParam, pageUrl: z.string().min(1, "pageUrl mag niet leeg zijn") });

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

interface CanvasModule {
  id: number;
  name: string;
}

interface CanvasModulePageItem {
  type: string;
  title: string;
  page_url: string | null;
}

async function listPagesFromModules(client: CanvasClient, courseId: string): Promise<string> {
  const modules = await fetchAllPages<CanvasModule>(
    client,
    `/api/v1/courses/${courseId}/modules`
  );

  if (modules.length === 0) {
    return `De pagina's-functie is uitgeschakeld voor cursus ${courseId} en er zijn geen modules beschikbaar.`;
  }

  const pageItems: Array<{ moduleName: string; title: string; slug: string }> = [];

  for (const mod of modules) {
    const items = await fetchAllPages<CanvasModulePageItem>(
      client,
      `/api/v1/courses/${courseId}/modules/${mod.id}/items`
    );
    for (const item of items) {
      if (item.type === "Page" && item.page_url) {
        pageItems.push({ moduleName: mod.name, title: item.title, slug: item.page_url });
      }
    }
  }

  if (pageItems.length === 0) {
    return `De pagina's-functie is uitgeschakeld voor cursus ${courseId} en er zijn geen pagina's gevonden in de modules.`;
  }

  const lines = pageItems.map(
    (p) => `- ${p.title}\n  Module: ${p.moduleName}\n  Slug: ${p.slug}`
  );

  return `Pagina's in cursus ${courseId} via modules (${pageItems.length}):\n\nGebruik canvas_get_page_content met de Slug om een pagina te lezen.\n\n${lines.join("\n")}`;
}

export async function listPages(client: CanvasClient, courseId: string): Promise<string> {
  try {
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
  } catch (err) {
    if (
      err instanceof CanvasApiError &&
      err.statusCode === 404 &&
      err.canvasMessage?.includes("disabled")
    ) {
      return listPagesFromModules(client, courseId);
    }
    throw err;
  }
}

// pageUrl is de "slug" van de pagina, bijvoorbeeld "weekplanning".
// canvas_list_pages geeft deze slug terug als het 'Slug:' veld.
export async function getPageContent(
  client: CanvasClient,
  courseId: string,
  pageUrl: string
): Promise<string> {
  const page = await client.get<CanvasPageDetail>(
    `/api/v1/courses/${courseId}/pages/${pageUrl}`
  );

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
    schema: listPagesSchema,
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
    schema: getPageContentSchema,
    handler: (client: CanvasClient, args: Record<string, string>) =>
      getPageContent(client, args.courseId, args.pageUrl),
  },
];
