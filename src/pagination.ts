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

/**
 * Een Canvas-lijst kan over heel veel pagina's lopen. Zonder bovengrens haalt
 * één tool-aanroep in het ergste geval honderdduizenden records op: traag,
 * geheugenvretend en het levert een antwoord op dat toch niet bruikbaar is.
 */
export const MAX_PAGES = 50;

function validatePaginationUrl(nextUrl: string, baseUrl: string): string {
  let next: URL;
  try {
    next = new URL(nextUrl);
  } catch {
    throw new CanvasApiError(
      0,
      "Paginering-URL is geen geldige URL — verzoek geweigerd."
    );
  }
  const base = new URL(baseUrl);

  if (next.protocol !== base.protocol) {
    throw new CanvasApiError(
      0,
      "Paginering-URL wisselt van protocol — verzoek geweigerd."
    );
  }
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

  let pages = 0;
  const seen = new Set<string>();

  while (currentPath) {
    if (++pages > MAX_PAGES) {
      process.stderr.write(
        `[Canvas] Paginalimiet (${MAX_PAGES}) bereikt voor ${path} — resultaat is afgekapt.\n`
      );
      break;
    }

    const { data, linkHeader } = await client.getWithHeaders<T[]>(
      currentPath,
      currentParams
    );
    results.push(...data);

    const nextUrl = parseNextUrl(linkHeader);
    if (nextUrl) {
      const nextPath = validatePaginationUrl(nextUrl, client.baseUrl);
      // Een server die steeds naar dezelfde pagina wijst zou ons eindeloos laten rondlopen.
      if (seen.has(nextPath)) {
        process.stderr.write(
          `[Canvas] Paginering wijst naar een al bezochte pagina — gestopt.\n`
        );
        break;
      }
      seen.add(nextPath);
      currentPath = nextPath;
      currentParams = undefined;
    } else {
      currentPath = null;
    }
  }

  return results;
}
