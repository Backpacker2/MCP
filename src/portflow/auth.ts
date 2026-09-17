/**
 * Portflow LTI 1.3 OIDC authenticatie.
 *
 * Flow (6 stappen, volledig programmatisch):
 * 1. Canvas sessionless_launch → launch URL met session_token
 * 2. GET launch URL → HTML met LTI form params + Canvas session cookies
 * 3. POST Portflow /lti/open_id → Canvas authorize redirect + Portflow cookie
 * 4. GET Canvas authorize URL (met Canvas cookies) → HTML met id_token
 * 5. POST id_token naar Portflow /lti/launches → HTML met data-session JWT
 * 6. Extract JWT → cachen voor 7u (JWT loopt na 8u af)
 */

import { CanvasClient } from "../canvasClient.js";
import { CanvasApiError } from "../errors.js";

interface CachedSession {
  jwt: string;
  expiresAt: number;
}

// Cache per courseId — JWT duurt 8u, we vernieuwen na 7u
const sessionCache = new Map<string, CachedSession>();

class CookieJar {
  private cookies = new Map<string, string>();

  update(headers: Headers): void {
    const setCookies = headers.getSetCookie?.() ?? [];
    for (const raw of setCookies) {
      const [nameValue] = raw.split(";");
      const eqIdx = nameValue.indexOf("=");
      if (eqIdx < 0) continue;
      const name = nameValue.slice(0, eqIdx).trim();
      const value = nameValue.slice(eqIdx + 1).trim();
      if (name) this.cookies.set(name, value);
    }
  }

  header(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

function extractInputFields(html: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const regex = /<input[^>]+type="hidden"[^>]+name="([^"]+)"[^>]*value="([^"]*)"/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    fields[m[1]] = m[2];
  }
  return fields;
}

function extractDataSession(html: string): string | null {
  const m = html.match(/data-session="([^"]+)"/);
  return m ? m[1] : null;
}

async function fetchText(
  url: string,
  options: RequestInit = {},
  cookieJar?: CookieJar
): Promise<{ text: string; headers: Headers; finalUrl: string }> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (cookieJar) {
    const cookieHeader = cookieJar.header();
    if (cookieHeader) headers["Cookie"] = cookieHeader;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    redirect: "manual",
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) throw new Error(`Redirect zonder Location header van ${url}`);
    cookieJar?.update(response.headers);
    return fetchText(location, { method: "GET" }, cookieJar);
  }

  cookieJar?.update(response.headers);
  const text = await response.text();
  return { text, headers: response.headers, finalUrl: url };
}

async function getPortflowJwtInternal(
  client: CanvasClient,
  courseId: string
): Promise<string> {
  // Stap 1: haal sessionless launch URL op via Canvas API
  const launchData = await client.get<{ url?: string; errors?: unknown }>(
    `/api/v1/courses/${courseId}/external_tools/sessionless_launch`,
    { id: "23360" } as Record<string, string | number | boolean>
  );

  if (!launchData.url) {
    throw new CanvasApiError(
      404,
      `Portflow LTI tool niet gevonden in cursus ${courseId}. Controleer of Portflow beschikbaar is in Canvas.`
    );
  }

  const canvasCookies = new CookieJar();
  const portflowCookies = new CookieJar();

  // Stap 2: laad de Canvas LTI pagina (met session_token) → HTML + cookies
  const { text: canvasHtml } = await fetchText(launchData.url, {}, canvasCookies);

  const ltiFields = extractInputFields(canvasHtml);
  if (!ltiFields["lti_message_hint"]) {
    throw new Error("Kon LTI form parameters niet extracten uit Canvas pagina.");
  }

  // Stap 3: POST naar Portflow /lti/open_id → Canvas authorize redirect
  const portflowOpenIdBody = new URLSearchParams(ltiFields);
  const openIdResponse = await fetch("https://portfolio.drieam.app/lti/open_id", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: portflowOpenIdBody.toString(),
    redirect: "manual",
  });

  portflowCookies.update(openIdResponse.headers);
  const canvasAuthorizeUrl = openIdResponse.headers.get("location");
  if (!canvasAuthorizeUrl) {
    throw new Error("Portflow /lti/open_id gaf geen redirect terug.");
  }

  // Stap 4: GET Canvas authorize URL (met Canvas cookies) → HTML met id_token
  const { text: authorizeHtml } = await fetchText(
    canvasAuthorizeUrl,
    {},
    canvasCookies
  );

  const tokenFields = extractInputFields(authorizeHtml);
  if (!tokenFields["id_token"]) {
    throw new Error(
      "Kon geen id_token vinden in Canvas authorize response. Mogelijk is de sessie verlopen."
    );
  }

  // Stap 5: POST id_token naar Portflow /lti/launches → HTML met data-session JWT
  const launchBody = new URLSearchParams({
    id_token: tokenFields["id_token"],
    state: tokenFields["state"] ?? "",
    lti_storage_target: tokenFields["lti_storage_target"] ?? "",
  });

  const launchResponse = await fetch("https://portfolio.drieam.app/lti/launches", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: portflowCookies.header(),
    },
    body: launchBody.toString(),
    redirect: "manual",
  });

  const launchHtml = await launchResponse.text();
  const jwt = extractDataSession(launchHtml);

  if (!jwt) {
    throw new Error(
      "Kon geen Portflow sessie JWT vinden. De LTI launch is mislukt."
    );
  }

  return jwt;
}

export async function getPortflowJwt(
  client: CanvasClient,
  courseId: string
): Promise<string> {
  const cached = sessionCache.get(courseId);
  // Vernieuw 30 minuten voor verlopen (8u - 30min = 7.5u)
  const refreshThreshold = Date.now() + 30 * 60 * 1000;
  if (cached && cached.expiresAt > refreshThreshold) {
    return cached.jwt;
  }

  process.stderr.write(`[Portflow] Nieuwe LTI sessie aanvragen voor cursus ${courseId}\n`);
  const jwt = await getPortflowJwtInternal(client, courseId);

  // JWT verloopt na 8u (28800s)
  sessionCache.set(courseId, {
    jwt,
    expiresAt: Date.now() + 8 * 60 * 60 * 1000,
  });

  return jwt;
}

export function clearPortflowCache(): void {
  sessionCache.clear();
}
