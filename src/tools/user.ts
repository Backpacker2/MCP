import { z } from "zod";
import { CanvasClient } from "../canvasClient.js";
import { fetchAllPages } from "../pagination.js";
import { formatDate } from "../utils/formatDate.js";

// --- canvas_get_activity_stream ---

interface ActivityItem {
  type: string;
  title: string;
  created_at: string;
  course_id?: number;
  message?: string;
}

export async function getActivityStream(client: CanvasClient): Promise<string> {
  const items = await fetchAllPages<ActivityItem>(
    client,
    "/api/v1/users/self/activity_stream",
    { per_page: 30 }
  );

  if (items.length === 0) {
    return "Geen recente Canvas-activiteit gevonden.";
  }

  const lines = items.slice(0, 20).map((a) => {
    const date = formatDate(a.created_at);
    const course = a.course_id ? ` [cursus ${a.course_id}]` : "";
    return `- **${a.type}**${course}: ${a.title}\n  ${date}`;
  });

  return `Recente Canvas-activiteit (${Math.min(items.length, 20)} van ${items.length}):\n\n${lines.join("\n")}`;
}

// --- canvas_get_todo ---

interface TodoItem {
  type: string;
  context_name?: string;
  assignment?: { id: number; name: string; due_at?: string | null };
  ignore?: string;
}

export async function getTodo(client: CanvasClient): Promise<string> {
  const items = await fetchAllPages<TodoItem>(client, "/api/v1/users/self/todo");

  if (items.length === 0) {
    return "Je Canvas to-do lijst is leeg. Goed bezig!";
  }

  const lines = items.map((t) => {
    const name = t.assignment?.name ?? `(${t.type})`;
    const course = t.context_name ? ` — ${t.context_name}` : "";
    const due = t.assignment?.due_at ? ` | deadline: ${formatDate(t.assignment.due_at)}` : "";
    return `- **${name}**${course}${due}`;
  });

  return `Canvas to-do lijst (${items.length}):\n\n${lines.join("\n")}`;
}

// --- canvas_list_my_groups ---

interface CanvasGroup {
  id: number;
  name: string;
  members_count: number;
  course_id?: number;
  context_type: string;
}

export async function listMyGroups(client: CanvasClient): Promise<string> {
  const [groups, courses] = await Promise.all([
    fetchAllPages<CanvasGroup>(client, "/api/v1/users/self/groups"),
    fetchAllPages<{ id: number; name: string }>(client, "/api/v1/courses", {
      enrollment_state: "active",
    }),
  ]);

  if (groups.length === 0) {
    return "Je zit momenteel in geen studiegroepen.";
  }

  const courseMap = new Map(courses.map((c) => [c.id, c.name]));

  const lines = groups.map((g) => {
    const courseName = g.course_id ? courseMap.get(g.course_id) ?? `cursus ${g.course_id}` : "account";
    return `- **${g.name}** (${g.members_count} leden) — ${courseName}`;
  });

  return `Jouw studiegroepen (${groups.length}):\n\n${lines.join("\n")}`;
}

// --- exports ---

export const userTools = [
  {
    name: "canvas_get_activity_stream",
    description:
      "Haal de recente Canvas-activiteit op: aankondigingen, berichtwijzigingen, reageerde discussies en meer.",
    inputSchema: { type: "object" as const, properties: {}, required: [] },
    schema: z.object({}),
    handler: (client: CanvasClient) => getActivityStream(client),
  },
  {
    name: "canvas_get_todo",
    description:
      "Haal de Canvas to-do lijst op: opdrachten die nog ingeleverd of nagekeken moeten worden.",
    inputSchema: { type: "object" as const, properties: {}, required: [] },
    schema: z.object({}),
    handler: (client: CanvasClient) => getTodo(client),
  },
  {
    name: "canvas_list_my_groups",
    description:
      "Geeft een overzicht van alle studiegroepen waar je in zit, inclusief het aantal leden en de bijbehorende cursus.",
    inputSchema: { type: "object" as const, properties: {}, required: [] },
    schema: z.object({}),
    handler: (client: CanvasClient) => listMyGroups(client),
  },
];
