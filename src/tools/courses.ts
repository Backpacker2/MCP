import { z } from "zod";
import { CanvasClient } from "../canvasClient.js";
import { fetchAllPages } from "../pagination.js";

interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  enrollment_term_id: number;
  workflow_state: string;
}

export const listCoursesSchema = z.object({});

const CACHE_KEY = "courses:active";

export async function listCourses(client: CanvasClient): Promise<string> {
  let courses = client.cacheGet<CanvasCourse[]>(CACHE_KEY);
  if (!courses) {
    courses = await fetchAllPages<CanvasCourse>(client, "/api/v1/courses", {
      enrollment_state: "active",
    });
    client.cacheSet(CACHE_KEY, courses);
  }

  if (courses.length === 0) {
    return "Je hebt momenteel geen actieve Canvas cursussen.";
  }

  const lines = courses.map(
    (c) => `- [${c.id}] ${c.name} (${c.course_code})`
  );
  return `Jouw actieve Canvas cursussen (${courses.length}):\n\n${lines.join("\n")}`;
}

export const courseTools = [
  {
    name: "canvas_list_courses",
    description:
      "Haal een lijst op van alle actieve Canvas cursussen waarvoor je ingeschreven bent. Gebruik dit als startpunt om een courseId te vinden voor andere tools.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
    schema: listCoursesSchema,
    handler: (client: CanvasClient) => listCourses(client),
  },
];
