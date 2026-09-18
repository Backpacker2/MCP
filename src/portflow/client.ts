import { CanvasApiError } from "../errors.js";
import { logLine } from "../utils/redact.js";
import {
  FETCH_TIMEOUT_MS,
  MAX_RESPONSE_BYTES,
  PORTFLOW_BASE,
} from "./http.js";

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

  // Alleen methode en pad loggen — nooit het JWT of de headers.
  logLine(`[Portflow] ${method} ${path}\n`);

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string> | undefined),
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new CanvasApiError(
        0,
        `Portflow reageerde niet binnen ${FETCH_TIMEOUT_MS / 1000} seconden.`
      );
    }
    throw new CanvasApiError(
      0,
      `Netwerkfout bij Portflow: ${err instanceof Error ? err.message : "onbekend"}`
    );
  }

  const declared = response.headers.get("content-length");
  if (declared && Number(declared) > MAX_RESPONSE_BYTES) {
    throw new CanvasApiError(
      response.status,
      `Antwoord van Portflow is te groot (${declared} bytes).`
    );
  }

  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES) {
    throw new CanvasApiError(
      response.status,
      `Antwoord van Portflow overschrijdt de limiet van ${MAX_RESPONSE_BYTES} bytes.`
    );
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
    const msg = err?.message ?? `Portflow API fout (status ${response.status}).`;
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
