import { z } from "zod";
import { CanvasClient } from "../canvasClient.js";
import { fetchAllPages } from "../pagination.js";
import { cleanHtml } from "../utils/cleanHtml.js";
import { formatDate } from "../utils/formatDate.js";

interface CanvasConversation {
  id: number;
  subject: string;
  last_message: string | null;
  last_message_at: string | null;
  message_count: number;
  workflow_state: string;
  participants: Array<{ name: string }>;
}

interface CanvasConversationDetail {
  id: number;
  subject: string;
  messages: Array<{
    id: number;
    author_id: number;
    created_at: string;
    body: string;
    author: { name: string };
  }>;
  participants: Array<{ id: number; name: string }>;
}

const listInboxSchema = z.object({});
const getConversationSchema = z.object({
  conversationId: z.string().regex(/^\d+$/, "ID mag alleen cijfers bevatten"),
});

export async function listInbox(client: CanvasClient): Promise<string> {
  const conversations = await fetchAllPages<CanvasConversation>(
    client,
    "/api/v1/conversations",
    { scope: "inbox", per_page: 25 }
  );

  if (conversations.length === 0) {
    return "Je Canvas inbox is leeg.";
  }

  const lines = conversations.map((c) => {
    const date = c.last_message_at ? formatDate(c.last_message_at) : "onbekend";
    const participants = c.participants.map((p) => p.name).join(", ");
    const state = c.workflow_state === "unread" ? " [ongelezen]" : "";
    const preview = c.last_message ? ` — ${cleanHtml(c.last_message).slice(0, 80)}…` : "";
    return `- [${c.id}] ${c.subject || "(geen onderwerp)"}${state}\n  Van/met: ${participants} | ${date} (${c.message_count} berichten)${preview}`;
  });

  return `Canvas inbox (${conversations.length}):\n\n${lines.join("\n")}`;
}

export async function getConversation(
  client: CanvasClient,
  conversationId: string
): Promise<string> {
  const conv = await client.get<CanvasConversationDetail>(
    `/api/v1/conversations/${conversationId}`
  );

  const participants = conv.participants.map((p) => p.name).join(", ");
  const lines = [
    `**${conv.subject || "(geen onderwerp)"}**`,
    `Deelnemers: ${participants}`,
    "",
    "Berichten:",
  ];

  for (const msg of conv.messages) {
    const date = formatDate(msg.created_at);
    const body = cleanHtml(msg.body);
    lines.push(`\n[${date}] ${msg.author.name}:\n${body}`);
  }

  return lines.join("\n");
}

export const inboxTools = [
  {
    name: "canvas_list_inbox",
    description:
      "Haal de Canvas inbox op: een overzicht van alle gesprekken (conversations) met docenten of medestudenten.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
    schema: listInboxSchema,
    handler: (client: CanvasClient) => listInbox(client),
  },
  {
    name: "canvas_get_conversation",
    description:
      "Haal de volledige berichtenreeks op van één Canvas-gesprek. Gebruik canvas_list_inbox om het conversationId te vinden.",
    inputSchema: {
      type: "object" as const,
      properties: {
        conversationId: {
          type: "string",
          description: "Het Canvas conversation ID. Staat als [ID] in canvas_list_inbox.",
        },
      },
      required: ["conversationId"],
    },
    schema: getConversationSchema,
    handler: (client: CanvasClient, args: Record<string, string>) =>
      getConversation(client, args.conversationId),
  },
];
