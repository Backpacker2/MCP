import { z } from "zod";
import { CanvasClient } from "../canvasClient.js";
import { fetchAllPages } from "../pagination.js";
import { isoToShort } from "../utils/formatDate.js";

const idParam = z.string().regex(/^\d+$/, "ID mag alleen cijfers bevatten");

// --- helpers ---

function toDateKey(iso: string): string {
  return iso.slice(0, 10); // "YYYY-MM-DD"
}

function dayLabel(dateKey: string): string {
  const d = new Date(dateKey + "T12:00:00");
  return d.toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Amsterdam",
  });
}

function toTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  });
}

function isoWeekKey(iso: string): { key: string; weekNum: number; year: number } {
  const d = new Date(iso);
  const thursday = new Date(d);
  thursday.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3);
  const jan4 = new Date(thursday.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round((thursday.getTime() - jan4.getTime()) / 604800000);
  return {
    key: `${thursday.getFullYear()}-W${String(weekNum).padStart(2, "0")}`,
    weekNum,
    year: thursday.getFullYear(),
  };
}

// --- Issue #18: canvas_get_week_overview ---

interface PlannerItem {
  plannable_type: string;
  plannable_date: string;
  plannable: { id: number; title: string; due_at?: string | null };
  context_name?: string;
  submissions?: { submitted?: boolean };
}

interface CalendarEvent {
  id: number;
  title: string;
  start_at: string;
  end_at: string | null;
  location_name: string | null;
  context_name: string | null;
}

export async function getWeekOverview(client: CanvasClient): Promise<string> {
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + 7);

  const startStr = now.toISOString().split("T")[0];
  const endStr = weekEnd.toISOString().split("T")[0];

  const [plannerItems, calendarEvents] = await Promise.all([
    fetchAllPages<PlannerItem>(client, "/api/v1/planner/items", {
      start_date: now.toISOString(),
      end_date: weekEnd.toISOString(),
    }),
    fetchAllPages<CalendarEvent>(client, "/api/v1/calendar_events", {
      start_date: startStr,
      end_date: endStr,
      "type[]": "event",
    }),
  ]);

  const deadlinesByDay = new Map<string, PlannerItem[]>();
  for (const item of plannerItems) {
    const key = toDateKey(item.plannable_date);
    if (!deadlinesByDay.has(key)) deadlinesByDay.set(key, []);
    deadlinesByDay.get(key)!.push(item);
  }

  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const event of calendarEvents) {
    const key = toDateKey(event.start_at);
    if (!eventsByDay.has(key)) eventsByDay.set(key, []);
    eventsByDay.get(key)!.push(event);
  }

  const dayKeys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    dayKeys.push(toDateKey(d.toISOString()));
  }

  const sections: string[] = [`## Weekoverzicht: ${isoToShort(startStr)} – ${isoToShort(endStr)}\n`];
  let hasContent = false;

  for (const key of dayKeys) {
    const deadlines = deadlinesByDay.get(key) ?? [];
    const events = eventsByDay.get(key) ?? [];
    if (deadlines.length === 0 && events.length === 0) continue;
    hasContent = true;

    sections.push(`### ${dayLabel(key)}`);

    if (deadlines.length > 0) {
      sections.push("**Deadlines:**");
      for (const d of deadlines) {
        const course = d.context_name ? ` — ${d.context_name}` : "";
        const time = d.plannable.due_at ? ` (${toTime(d.plannable.due_at)})` : "";
        const submitted = d.submissions?.submitted ? " ✓" : "";
        sections.push(`- ${d.plannable.title}${course}${time}${submitted}`);
      }
    }

    if (events.length > 0) {
      sections.push("**Events:**");
      for (const e of events) {
        const context = e.context_name ? ` — ${e.context_name}` : "";
        const location = e.location_name ? ` | ${e.location_name}` : "";
        sections.push(`- ${e.title}${context} (${toTime(e.start_at)}${location})`);
      }
    }

    sections.push("");
  }

  if (!hasContent) {
    return "Geen deadlines of events gevonden in de komende 7 dagen.";
  }

  return sections.join("\n");
}

// --- Issue #19: canvas_get_course_progress ---

interface CanvasAssignment {
  id: number;
  name: string;
  due_at: string | null;
  points_possible: number | null;
}

interface CanvasSubmission {
  assignment_id: number;
  workflow_state: string;
  score: number | null;
  grade: string | null;
  assignment?: { name: string; points_possible: number | null };
}

interface CanvasModule {
  id: number;
  name: string;
  items_count: number;
}

export async function getCourseProgress(client: CanvasClient, courseId: string): Promise<string> {
  const [assignments, submissions, modules] = await Promise.all([
    fetchAllPages<CanvasAssignment>(client, `/api/v1/courses/${courseId}/assignments`),
    fetchAllPages<CanvasSubmission>(
      client,
      `/api/v1/courses/${courseId}/students/submissions`,
      { "student_ids[]": "self", "include[]": "assignment" } as Record<string, string>
    ),
    fetchAllPages<CanvasModule>(client, `/api/v1/courses/${courseId}/modules`),
  ]);

  const total = assignments.length;
  const submitted = submissions.filter((s) => s.workflow_state !== "unsubmitted").length;
  const graded = submissions.filter((s) => s.workflow_state === "graded").length;

  const scored = submissions.filter(
    (s) => s.score !== null && s.assignment?.points_possible != null && s.assignment.points_possible > 0
  );
  let gradeStr = "Nog geen cijfers";
  if (scored.length > 0) {
    const avg =
      (scored.reduce((acc, s) => acc + s.score! / s.assignment!.points_possible!, 0) / scored.length) * 100;
    gradeStr = `${avg.toFixed(1)}% gemiddeld (${scored.length} beoordeeld)`;
  }

  const moduleStr =
    modules.length > 0 ? `${modules.length} modules in deze cursus` : "Geen modules gevonden";

  const lines = [
    `## Voortgang cursus ${courseId}`,
    ``,
    `**Opdrachten:** ${submitted}/${total} ingeleverd, ${graded} beoordeeld`,
    `**Cijfer:** ${gradeStr}`,
    `**Modules:** ${moduleStr}`,
  ];

  const openAssignments = assignments.filter((a) => {
    const sub = submissions.find((s) => s.assignment_id === a.id);
    return !sub || sub.workflow_state === "unsubmitted";
  });

  if (openAssignments.length > 0) {
    lines.push(``, `**Nog in te leveren (${openAssignments.length}):**`);
    for (const a of openAssignments.slice(0, 10)) {
      const deadline = a.due_at ? `deadline ${isoToShort(a.due_at)}` : "geen deadline";
      lines.push(`- ${a.name} (${deadline})`);
    }
    if (openAssignments.length > 10) lines.push(`... en ${openAssignments.length - 10} meer`);
  }

  return lines.join("\n");
}

// --- Issue #24: canvas_get_deadline_burndown ---

export async function getDeadlineBurndown(client: CanvasClient): Promise<string> {
  const now = new Date();
  const eightWeeksOut = new Date(now);
  eightWeeksOut.setDate(now.getDate() + 56);

  const items = await fetchAllPages<PlannerItem>(client, "/api/v1/planner/items", {
    start_date: now.toISOString(),
    end_date: eightWeeksOut.toISOString(),
  });

  if (items.length === 0) {
    return "Geen deadlines gevonden in de komende 8 weken.";
  }

  const weekMap = new Map<string, { weekNum: number; mondayKey: string; sundayKey: string; total: number; submitted: number }>();

  for (const item of items) {
    const d = new Date(item.plannable_date);
    const { key, weekNum } = isoWeekKey(item.plannable_date);

    if (!weekMap.has(key)) {
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      weekMap.set(key, {
        weekNum,
        mondayKey: toDateKey(monday.toISOString()),
        sundayKey: toDateKey(sunday.toISOString()),
        total: 0,
        submitted: 0,
      });
    }

    const entry = weekMap.get(key)!;
    entry.total++;
    if (item.submissions?.submitted) entry.submitted++;
  }

  const sortedWeeks = [...weekMap.entries()].sort(([a], [b]) => a.localeCompare(b));
  const maxTotal = Math.max(...sortedWeeks.map(([, v]) => v.total));

  const lines = ["## Deadline-burndown (komende 8 weken)\n"];

  for (const [, { weekNum, mondayKey, sundayKey, total, submitted }] of sortedWeeks) {
    const open = total - submitted;
    const bar = "█".repeat(total) + "░".repeat(Math.max(0, maxTotal - total));
    const drukst = total === maxTotal && maxTotal > 1 ? " ← drukste week" : "";
    lines.push(
      `**Week ${weekNum}** (${isoToShort(mondayKey)} – ${isoToShort(sundayKey)}): ${total} deadline${total !== 1 ? "s" : ""} (${submitted} ingeleverd, ${open} open)`
    );
    lines.push(`${bar}${drukst}`);
    lines.push("");
  }

  const totalItems = items.length;
  const totalSubmitted = items.filter((i) => i.submissions?.submitted).length;
  lines.push(`---`);
  lines.push(`Totaal: ${totalItems} deadlines — ${totalSubmitted} ingeleverd, ${totalItems - totalSubmitted} open`);

  return lines.join("\n");
}

// --- exports ---

export const reportTools = [
  {
    name: "canvas_get_week_overview",
    description:
      "Genereer een weekoverzicht voor de komende 7 dagen met alle deadlines en kalender-events, gegroepeerd per dag.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
    schema: z.object({}),
    handler: (client: CanvasClient) => getWeekOverview(client),
  },
  {
    name: "canvas_get_course_progress",
    description:
      "Toon een voortgangsrapportage voor een cursus: hoeveel opdrachten ingeleverd en beoordeeld, gemiddeld cijfer, en module-voltooiing.",
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
    schema: z.object({ courseId: idParam }),
    handler: (client: CanvasClient, args: Record<string, string>) =>
      getCourseProgress(client, args.courseId),
  },
  {
    name: "canvas_get_deadline_burndown",
    description:
      "Bereken hoeveel deadlines er per week zijn in de komende 8 weken. Toont welke weken het drukst zijn en hoeveel al ingeleverd is.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
    schema: z.object({}),
    handler: (client: CanvasClient) => getDeadlineBurndown(client),
  },
];
