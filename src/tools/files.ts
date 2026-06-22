import { CanvasClient } from "../canvasClient.js";
import { fetchAllPages } from "../pagination.js";
import { formatDate } from "../utils/formatDate.js";
import { sanitizeText } from "../utils/sanitizeText.js";
import { CanvasApiError } from "../errors.js";

interface CanvasFile {
  id: number;
  display_name: string;
  filename: string;
  "content-type": string;
  size: number;
  updated_at: string;
  url: string;
  folder_id: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function listFiles(client: CanvasClient, courseId: string): Promise<string> {
  let files: CanvasFile[];
  try {
    files = await fetchAllPages<CanvasFile>(
      client,
      `/api/v1/courses/${courseId}/files`,
      { sort: "updated_at", order: "desc" }
    );
  } catch (error) {
    if (error instanceof CanvasApiError && error.statusCode === 403) {
      return `Bestanden zijn niet beschikbaar voor cursus ${courseId}. Student-tokens hebben op deze Canvas-omgeving geen toegang tot het bestandsoverzicht. Vraag je docent om bestanden via een andere manier te delen.`;
    }
    throw error;
  }

  if (files.length === 0) {
    return `Geen bestanden gevonden voor cursus ${courseId}.`;
  }

  const lines = files.map((f) => {
    const size = formatBytes(f.size);
    const updated = formatDate(f.updated_at);
    const name = sanitizeText(f.display_name, 200);
    const contentType = sanitizeText(f["content-type"], 100);
    return `- [${f.id}] ${name} (${contentType}, ${size}, bijgewerkt: ${updated})`;
  });

  return `Bestanden voor cursus ${courseId} (${files.length}):\n\n${lines.join("\n")}`;
}

export const fileTools = [
  {
    name: "canvas_list_files",
    description:
      "Haal de lijst van bestanden op die gedeeld zijn in een Canvas cursus, met bestandsnaam, type en grootte.",
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
      listFiles(client, args.courseId),
  },
];
