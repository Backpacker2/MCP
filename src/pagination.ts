import { CanvasClient } from "./canvasClient.js";
import { CanvasApiError } from "./errors.js";

function parseNextUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const parts = linkHeader.split(",");
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match) return match[1];
  }
  return null;
}

function validatePaginationUrl(nextUrl: string, baseUrl: string): string {
  const next = new URL(nextUrl);
  const base = new URL(baseUrl);

  if (next.hostname !== base.hostname) {
    throw new CanvasApiError(0, "Paginering-URL wijst naar een onbekende host — verzoek geweigerd.");
  }
  if (!next.pathname.startsWith("/api/v1/")) {
    throw new CanvasApiError(0, "Paginering-URL heeft een onverwacht pad — verzoek geweigerd.");
  }

  return next.pathname + next.search;
}

export async function fetchAllPages<T>(
  client: CanvasClient,
  path: string,
  params: Record<string, string | number | boolean> = {}
): Promise<T[]> {
  const results: T[] = [];
  let currentPath: string | null = path;
  let currentParams: Record<string, string | number | boolean> | undefined = {
    per_page: 100,
    ...params,
  };

  while (currentPath) {
    const { data, linkHeader } = await client.getWithHeaders<T[]>(
      currentPath,
      currentParams
    );
    results.push(...data);

    const nextUrl = parseNextUrl(linkHeader);
    if (nextUrl) {
      currentPath = validatePaginationUrl(nextUrl, client.baseUrl);
      currentParams = undefined;
    } else {
      currentPath = null;
    }
  }

  return results;
}
