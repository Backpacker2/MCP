import { z } from "zod";
import { CanvasClient } from "../canvasClient.js";
import { fetchAllPages } from "../pagination.js";
import { cleanHtml } from "../utils/cleanHtml.js";
import { formatDate } from "../utils/formatDate.js";

interface CanvasAssignment {
  id: number;
  name: string;
  due_at: string | null;
  points_possible: number | null;
  description: string | null;
  html_url: string;
  submission_types: string[];
  workflow_state: string;
}

const idParam = z.string().regex(/^\d+$/, "ID mag alleen cijfers bevatten");

export const listAssignmentsSchema = z.object({
  courseId: idParam.describe("Het Canvas course ID. Gebruik canvas_list_courses om dit op te zoeken."),
});

export const getAssignmentDetailsSchema = z.object({
  courseId: idParam.describe("Het Canvas course ID."),
  assignmentId: idParam.describe("Het Canvas assignment ID."),
});

export async function listAssignments(client: CanvasClient, courseId: string): Promise<string> {
  const assignments = await fetchAllPages<CanvasAssignment>(
    client,
    `/api/v1/courses/${courseId}/assignments`,
    { order_by: "due_at" }
  );

  if (assignments.length === 0) {
    return `Geen opdrachten gevonden voor cursus ${courseId}.`;
  }

  const lines = assignments.map((a) => {
    const deadline = a.due_at ? formatDate(a.due_at) : "Geen deadline";
    const points = a.points_possible !== null ? `${a.points_possible} punten` : "Geen punten";
    return `- [${a.id}] ${a.name}\n  Deadline: ${deadline} | ${points}`;
  });

  return `Opdrachten voor cursus ${courseId} (${assignments.length}):\n\n${lines.join("\n")}`;
}

export async function getAssignmentDetails(
  client: CanvasClient,
  courseId: string,
  assignmentId: string
): Promise<string> {
  const a = await client.get<CanvasAssignment>(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}`
  );

  const description = cleanHtml(a.description) || "Geen beschrijving beschikbaar.";
  const deadline = a.due_at ? formatDate(a.due_at) : "Geen deadline ingesteld";
  const points = a.points_possible !== null ? `${a.points_possible} punten` : "Geen puntenwaardering";
  const types = a.submission_types.join(", ") || "onbekend";

  return [
    `**${a.name}**`,
    ``,
    `Deadline: ${deadline}`,
    `Puntenwaardering: ${points}`,
    `Inlevertype: ${types}`,
    ``,
    `Beschrijving:`,
    description,
    ``,
    `Link: ${a.html_url}`,
  ].join("\n");
}

export const assignmentTools = [
  {
    name: "canvas_list_assignments",
    description:
      "Haal alle opdrachten op voor een specifieke Canvas cursus. Geeft naam, deadline en puntenwaardering terug.",
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
    schema: listAssignmentsSchema,
    handler: (client: CanvasClient, args: Record<string, string>) =>
      listAssignments(client, args.courseId),
  },
  {
    name: "canvas_get_assignment_details",
    description:
      "Haal de volledige details op van één Canvas opdracht, inclusief beschrijving, deadline en inlevertype.",
    inputSchema: {
      type: "object" as const,
      properties: {
        courseId: {
          type: "string",
          description: "Het Canvas course ID.",
        },
        assignmentId: {
          type: "string",
          description: "Het Canvas assignment ID. Gebruik canvas_list_assignments om dit te vinden.",
        },
      },
      required: ["courseId", "assignmentId"],
    },
    schema: getAssignmentDetailsSchema,
    handler: (client: CanvasClient, args: Record<string, string>) =>
      getAssignmentDetails(client, args.courseId, args.assignmentId),
  },
];
