import { z } from "zod";
import { CanvasClient } from "../canvasClient.js";
import { fetchAllPages } from "../pagination.js";
import { cleanHtml } from "../utils/cleanHtml.js";
import { formatDate } from "../utils/formatDate.js";

interface CanvasEportfolio {
  id: number;
  name: string;
  public: boolean;
  created_at: string;
  updated_at: string;
}

interface CanvasEportfolioPage {
  id: number;
  name: string;
  position: number;
  content: string | null;
  updated_at: string;
}

const idParam = z.string().regex(/^\d+$/, "ID mag alleen cijfers bevatten");
const listEportfoliosSchema = z.object({});
const getEportfolioPagesSchema = z.object({ eportfolioId: idParam });

export async function listEportfolios(client: CanvasClient): Promise<string> {
  const portfolios = await fetchAllPages<CanvasEportfolio>(
    client,
    "/api/v1/users/self/eportfolios"
  );

  if (portfolios.length === 0) {
    return "Je hebt nog geen ePortfolios aangemaakt in Canvas.";
  }

  const lines = portfolios.map((p) => {
    const updated = formatDate(p.updated_at);
    const visibility = p.public ? "openbaar" : "privé";
    return `- [${p.id}] ${p.name} (${visibility}, bijgewerkt: ${updated})`;
  });

  return `Jouw Canvas ePortfolios (${portfolios.length}):\n\n${lines.join("\n")}`;
}

export async function getEportfolioPages(
  client: CanvasClient,
  eportfolioId: string
): Promise<string> {
  const pages = await fetchAllPages<CanvasEportfolioPage>(
    client,
    `/api/v1/eportfolios/${eportfolioId}/pages`
  );

  if (pages.length === 0) {
    return `Geen pagina's gevonden in ePortfolio ${eportfolioId}.`;
  }

  const sorted = [...pages].sort((a, b) => a.position - b.position);

  const lines = sorted.map((p) => {
    const updated = formatDate(p.updated_at);
    const preview = p.content ? `\n  ${cleanHtml(p.content).slice(0, 150)}…` : "";
    return `- [${p.id}] ${p.name} (bijgewerkt: ${updated})${preview}`;
  });

  return `Pagina's in ePortfolio ${eportfolioId} (${sorted.length}):\n\n${lines.join("\n")}`;
}

export const eportfolioTools = [
  {
    name: "canvas_list_eportfolios",
    description:
      "Haal een overzicht op van jouw Canvas ePortfolios met naam, zichtbaarheid en laatste wijzigingsdatum.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
    schema: listEportfoliosSchema,
    handler: (client: CanvasClient) => listEportfolios(client),
  },
  {
    name: "canvas_get_eportfolio_pages",
    description:
      "Haal de pagina's op van één Canvas ePortfolio, inclusief een preview van de inhoud. Gebruik canvas_list_eportfolios om het eportfolioId te vinden.",
    inputSchema: {
      type: "object" as const,
      properties: {
        eportfolioId: {
          type: "string",
          description: "Het Canvas ePortfolio ID. Staat als [ID] in canvas_list_eportfolios.",
        },
      },
      required: ["eportfolioId"],
    },
    schema: getEportfolioPagesSchema,
    handler: (client: CanvasClient, args: Record<string, string>) =>
      getEportfolioPages(client, args.eportfolioId),
  },
];
