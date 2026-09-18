import { CanvasApiError } from "../errors.js";

const PORTFLOW_BASE = "https://portfolio.drieam.app";

interface PortflowError {
  code?: number;
  message?: string;
  errors?: unknown;
}

async function portflowFetch<T>(
  jwt: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${PORTFLOW_BASE}${path}`;
  const method = (options.method ?? "GET").toUpperCase();

  process.stderr.write(`[Portflow] ${method} ${path}\n`);

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  const text = await response.text();

  if (response.status === 204 || text.trim() === "") {
    if (!response.ok) {
      throw new CanvasApiError(response.status, `Portflow API fout (status ${response.status}).`);
    }
    return null as T;
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new CanvasApiError(
      response.status,
      `Portflow gaf een onverwacht antwoord (status ${response.status}).`
    );
  }

  if (!response.ok) {
    const err = data as PortflowError;
    const msg =
      err?.message ?? `Portflow API fout (status ${response.status}).`;
    throw new CanvasApiError(response.status, `Portflow: ${msg}`);
  }

  return data as T;
}

export interface FrozenPortfolio {
  id: number;
  version_number: number;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
  updated_at: string;
  lti_submission_count: number;
  snapshot_code: string;
  assessment_url: string | null;
  showcase_url: string | null;
  user?: {
    id: number;
    name: string;
    current_role: string;
  };
}

export interface PortflowUser {
  id: number;
  name: string;
  user_type: string;
  lms_id: string;
  current_role: string;
}

export interface PortflowEvidence {
  id: number;
  portfolio_id: number;
  name: string;
  description: string | null;
  feedback_status: string;
  created_at: string;
  updated_at: string;
  versions_count: number;
  collections_count: number;
  latest_version_type: string;
  date: string | null;
  location: string | null;
  duration: number | null;
}

export interface PortflowSection {
  id: number;
  name: string;
  position: number;
}

export interface PortflowCollection {
  id: number;
  name: string;
  description: string | null;
  section_id: number;
  position: number;
}

export async function listSnapshots(jwt: string): Promise<FrozenPortfolio[]> {
  return portflowFetch<FrozenPortfolio[]>(jwt, "/api/v1/frozen-portfolios");
}

export async function getSnapshot(
  jwt: string,
  snapshotId: string
): Promise<FrozenPortfolio> {
  return portflowFetch<FrozenPortfolio>(
    jwt,
    `/api/v1/frozen-portfolios/${encodeURIComponent(snapshotId)}`
  );
}

export async function submitSnapshotToCanvas(
  jwt: string,
  snapshotId: string
): Promise<unknown> {
  return portflowFetch<unknown>(
    jwt,
    `/api/v1/frozen-portfolios/${encodeURIComponent(snapshotId)}/assessment`,
    { method: "POST" }
  );
}

export async function listSections(
  jwt: string,
  portfolioId: number
): Promise<PortflowSection[]> {
  return portflowFetch<PortflowSection[]>(
    jwt,
    `/api/v1/portfolios/${portfolioId}/sections`
  );
}

export async function createSection(
  jwt: string,
  portfolioId: number,
  name: string
): Promise<PortflowSection> {
  return portflowFetch<PortflowSection>(
    jwt,
    `/api/v1/portfolios/${portfolioId}/sections`,
    { method: "POST", body: JSON.stringify({ name }) }
  );
}

export async function listCollections(
  jwt: string,
  portfolioId: number
): Promise<PortflowCollection[]> {
  return portflowFetch<PortflowCollection[]>(
    jwt,
    `/api/v1/portfolios/${portfolioId}/collections`
  );
}

export async function createCollection(
  jwt: string,
  portfolioId: number,
  name: string,
  sectionId: number
): Promise<PortflowCollection> {
  return portflowFetch<PortflowCollection>(
    jwt,
    `/api/v1/portfolios/${portfolioId}/collections`,
    { method: "POST", body: JSON.stringify({ name, section_id: sectionId }) }
  );
}

export async function createFreeTextEvidence(
  jwt: string,
  portfolioId: number,
  name: string,
  content: string,
  collectionIds: number[] = []
): Promise<PortflowEvidence> {
  const evidence = await portflowFetch<PortflowEvidence>(
    jwt,
    `/api/v1/portfolios/${portfolioId}/evidence`,
    {
      method: "POST",
      body: JSON.stringify({
        name,
        version_type: "free_text",
        free_text: content,
      }),
    }
  );

  if (collectionIds.length > 0) {
    await portflowFetch<unknown>(
      jwt,
      `/api/v1/portfolios/${portfolioId}/evidence/${evidence.id}/link-to-collections`,
      {
        method: "POST",
        body: JSON.stringify({ collection_ids: collectionIds }),
      }
    );
  }

  return evidence;
}

export async function getPortfolioId(jwt: string): Promise<number> {
  // Portfolio ID ophalen via de huidige gebruiker
  const user = await portflowFetch<{ portfolio?: { id: number } }>(
    jwt,
    "/api/v1/users/current"
  );
  if (user.portfolio?.id) return user.portfolio.id;
  throw new CanvasApiError(404, "Portflow portfolio ID niet gevonden.");
}
