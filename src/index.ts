import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { ZodError } from "zod";
import { loadConfig } from "./config.js";
import { CanvasClient } from "./canvasClient.js";
import { CanvasApiError, CanvasConfigError } from "./errors.js";
import { courseTools } from "./tools/courses.js";
import { assignmentTools } from "./tools/assignments.js";
import { plannerTools } from "./tools/planner.js";
import { announcementTools } from "./tools/announcements.js";
import { moduleTools } from "./tools/modules.js";
import { pageTools } from "./tools/pages.js";
import { fileTools } from "./tools/files.js";
import { submissionTools } from "./tools/submissions.js";
import { calendarTools } from "./tools/calendar.js";
import { discussionTools } from "./tools/discussions.js";
import { inboxTools } from "./tools/inbox.js";
import { eportfolioTools } from "./tools/eportfolio.js";
import { reportTools } from "./tools/reports.js";

const config = loadConfig();
const client = new CanvasClient({
  baseUrl: config.baseUrl,
  accessToken: config.accessToken,
});

const allTools = [
  ...courseTools,
  ...assignmentTools,
  ...plannerTools,
  ...announcementTools,
  ...moduleTools,
  ...pageTools,
  ...fileTools,
  ...submissionTools,
  ...calendarTools,
  ...discussionTools,
  ...inboxTools,
  ...eportfolioTools,
  ...reportTools,
];

const server = new Server(
  { name: "canvas-claude-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: allTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = allTools.find((t) => t.name === name);

  if (!tool) {
    return {
      content: [{ type: "text", text: `Onbekende tool: ${name}` }],
      isError: true,
    };
  }

  try {
    const parsed = tool.schema.parse(args ?? {});
    const result = await tool.handler(client, parsed as Record<string, string>);
    return { content: [{ type: "text", text: result }] };
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
      return {
        content: [{ type: "text", text: `Ongeldige invoer voor ${name}: ${details}` }],
        isError: true,
      };
    }
    if (error instanceof CanvasApiError || error instanceof CanvasConfigError) {
      return {
        content: [{ type: "text", text: error.message }],
        isError: true,
      };
    }
    process.stderr.write(`[canvas-claude-mcp] Onverwachte fout in ${name}: ${error}\n`);
    return {
      content: [{ type: "text", text: `Er is een onverwachte fout opgetreden bij ${name}. Controleer de server logs.` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[canvas-claude-mcp] Server gestart via stdio.\n");
}

main().catch((error) => {
  process.stderr.write(`[canvas-claude-mcp] Fatale fout: ${error.message}\n`);
  process.exit(1);
});
