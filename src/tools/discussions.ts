import { z } from "zod";
import { CanvasClient } from "../canvasClient.js";
import { fetchAllPages } from "../pagination.js";
import { cleanHtml } from "../utils/cleanHtml.js";
import { formatDate } from "../utils/formatDate.js";

const idParam = z.string().regex(/^\d+$/, "ID mag alleen cijfers bevatten");
const listDiscussionsSchema = z.object({ courseId: idParam });
const getDiscussionEntriesSchema = z.object({ courseId: idParam, topicId: idParam });

interface CanvasDiscussionTopic {
  id: number;
  title: string;
  message: string | null;
  posted_at: string;
  discussion_type: string;
  user_name?: string;
  author?: { display_name: string };
}

interface CanvasDiscussionEntry {
  id: number;
  message: string | null;
  user_name: string;
  created_at: string;
}

export async function listDiscussions(client: CanvasClient, courseId: string): Promise<string> {
  const topics = await fetchAllPages<CanvasDiscussionTopic>(
    client,
    `/api/v1/courses/${courseId}/discussion_topics`
  );

  if (topics.length === 0) {
    return `Geen discussies gevonden voor cursus ${courseId}.`;
  }

  const lines = topics.map((t) => {
    const date = formatDate(t.posted_at);
    const author = t.author?.display_name ?? t.user_name ?? "onbekend";
    return `- [${t.id}] ${t.title} (${t.discussion_type}, geplaatst: ${date} door ${author})`;
  });

  return `Discussies voor cursus ${courseId} (${topics.length}):\n\n${lines.join("\n")}`;
}

export async function getDiscussionEntries(
  client: CanvasClient,
  courseId: string,
  topicId: string
): Promise<string> {
  const entries = await fetchAllPages<CanvasDiscussionEntry>(
    client,
    `/api/v1/courses/${courseId}/discussion_topics/${topicId}/entries`
  );

  if (entries.length === 0) {
    return `Geen berichten gevonden in discussie ${topicId}.`;
  }

  const lines = entries.map((e) => {
    const date = formatDate(e.created_at);
    const message = cleanHtml(e.message) || "(geen tekst)";
    return `[${date}] ${e.user_name}:\n  ${message}`;
  });

  return `Berichten in discussie ${topicId} (${entries.length}):\n\n${lines.join("\n\n")}`;
}

export const discussionTools = [
  {
    name: "canvas_list_discussions",
    description:
      "Haal de lijst van discussieonderwerpen op voor een Canvas cursus. Discussies worden gebruikt voor vragen, groepsopdrachten of reflecties.",
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
    schema: listDiscussionsSchema,
    handler: (client: CanvasClient, args: Record<string, string>) =>
      listDiscussions(client, args.courseId),
  },
  {
    name: "canvas_get_discussion_entries",
    description:
      "Haal de berichten op uit één Canvas-discussie. Gebruik canvas_list_discussions om het topicId te vinden.",
    inputSchema: {
      type: "object" as const,
      properties: {
        courseId: {
          type: "string",
          description: "Het Canvas course ID.",
        },
        topicId: {
          type: "string",
          description: "Het Canvas discussion topic ID. Staat als [ID] in canvas_list_discussions.",
        },
      },
      required: ["courseId", "topicId"],
    },
    schema: getDiscussionEntriesSchema,
    handler: (client: CanvasClient, args: Record<string, string>) =>
      getDiscussionEntries(client, args.courseId, args.topicId),
  },
];
