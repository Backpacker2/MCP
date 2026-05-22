import { CanvasClient } from "./canvasClient.js";

function parseNextUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const parts = linkHeader.split(",");
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match) return match[1];
  }
  return null;
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
      // Canvas geeft een volledige URL terug; we extraheren alleen het pad + query
      const url = new URL(nextUrl);
      currentPath = url.pathname + url.search;
      currentParams = undefined; // params zitten al in de URL
    } else {
      currentPath = null;
    }
  }

  return results;
}
