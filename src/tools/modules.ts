import { CanvasClient } from "../canvasClient.js";
import { fetchAllPages } from "../pagination.js";

interface CanvasModule {
  id: number;
  name: string;
  position: number;
  items_count: number;
  workflow_state: string;
}

interface CanvasModuleItem {
  id: number;
  title: string;
  type: string;
  position: number;
  indent: number;
  html_url: string | null;
  completion_requirement?: {
    type: string;
    completed: boolean;
  };
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

export async function getModuleItems(
  client: CanvasClient,
  courseId: string,
  moduleId: string
): Promise<string> {
  const items = await fetchAllPages<CanvasModuleItem>(
    client,
    `/api/v1/courses/${courseId}/modules/${moduleId}/items`
  );

  if (items.length === 0) {
    return `Geen items gevonden in module ${moduleId} van cursus ${courseId}.`;
  }

  const lines = items.map((item) => {
    const indent = "  ".repeat(item.indent);
    const done = item.completion_requirement?.completed ? " ✓" : "";
    return `${indent}- [${item.type}] ${item.title}${done}`;
  });

  return `Items in module ${moduleId} (${items.length}):\n\n${lines.join("\n")}`;
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
  {
    name: "canvas_get_module_items",
    description:
      "Haal de inhoud op van één module: welke pagina's, opdrachten, bestanden en discussies erin zitten. Gebruik canvas_list_modules om het moduleId te vinden.",
    inputSchema: {
      type: "object" as const,
      properties: {
        courseId: {
          type: "string",
          description: "Het Canvas course ID.",
        },
        moduleId: {
          type: "string",
          description: "Het Canvas module ID. Staat als [ID] in de uitvoer van canvas_list_modules.",
        },
      },
      required: ["courseId", "moduleId"],
    },
    handler: (client: CanvasClient, args: Record<string, string>) =>
      getModuleItems(client, args.courseId, args.moduleId),
  },
];
