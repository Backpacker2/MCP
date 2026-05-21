import { CanvasConfigError } from "./errors.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new CanvasConfigError(
      `Omgevingsvariabele ${name} is niet ingesteld. Voeg deze toe aan je .env bestand of MCP config.`
    );
  }
  return value.trim();
}

export function loadConfig(): { baseUrl: string; accessToken: string } {
  const baseUrl = requireEnv("CANVAS_BASE_URL").replace(/\/$/, "");
  const accessToken = requireEnv("CANVAS_ACCESS_TOKEN");
  return { baseUrl, accessToken };
}
