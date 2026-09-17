import { z } from "zod";
import { CanvasClient } from "../canvasClient.js";
import { fetchAllPages } from "../pagination.js";

const idParam = z.string().regex(/^\d+$/, "ID mag alleen cijfers bevatten");
const getCourseCompetenciesSchema = z.object({ courseId: idParam });

interface OutcomeLink {
  outcome_group: { title: string };
  outcome: { id: number; display_name: string; title: string };
  assessed: boolean;
}

export async function getCourseCompetencies(client: CanvasClient, courseId: string): Promise<string> {
  const links = await fetchAllPages<OutcomeLink>(
    client,
    `/api/v1/courses/${courseId}/outcome_group_links`
  );

  if (links.length === 0) {
    return `Geen competenties gevonden voor cursus ${courseId}.`;
  }

  const byGroup = new Map<string, string[]>();
  for (const link of links) {
    const group = link.outcome_group.title;
    const name = (link.outcome.display_name || link.outcome.title).trim();
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group)!.push(name);
  }

  const sections: string[] = [];
  for (const [group, outcomes] of byGroup) {
    sections.push(`**${group}**\n${outcomes.map((o) => `  - ${o}`).join("\n")}`);
  }

  return `Competenties voor cursus ${courseId} (${links.length} totaal):\n\n${sections.join("\n\n")}`;
}

export const outcomeTools = [
  {
    name: "canvas_get_course_competencies",
    description:
      "Haal alle competenties (outcomes) op voor een cursus, gegroepeerd per niveau. Geeft een overzicht van welke competenties in de cursus worden beoordeeld.",
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
    schema: getCourseCompetenciesSchema,
    handler: (client: CanvasClient, args: Record<string, string>) =>
      getCourseCompetencies(client, args.courseId),
  },
];
