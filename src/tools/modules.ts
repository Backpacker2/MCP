import { CanvasClient } from "../canvasClient.js";
import { fetchAllPages } from "../pagination.js";

interface CanvasModule {
  id: number;
  name: string;
  position: number;
  items_count: number;
  workflow_state: string;
}

export async function listModules(client: CanvasClient, courseId: string): Promise<string> {
  const modules = await fetchAllPages<CanvasModule>(
    client,
    `/api/v1/courses/${courseId}/modules`
  );

  if (modules.length === 0) {
    return `Geen modules gevonden voor cursus ${courseId}.`;
  }

  const lines = modules.map(
    (m) => `- [${m.id}] ${m.name} (${m.items_count} items, status: ${m.workflow_state})`
  );

  return `Modules voor cursus ${courseId} (${modules.length}):\n\n${lines.join("\n")}`;
}

export const moduleTools = [
  {
    name: "canvas_list_modules",
    description:
      "Haal de lijst van modules op voor een Canvas cursus. Modules structureren de cursusinhoud in weken of onderwerpen.",
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
      listModules(client, args.courseId),
  },
];
