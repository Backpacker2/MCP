/**
 * Portflow LTI 1.3 OIDC authenticatie.
 *
 * Flow (6 stappen, volledig programmatisch):
 * 1. Canvas sessionless_launch → launch URL met session_token
 * 2. GET launch URL → HTML met LTI form params + Canvas session cookies
 * 3. POST Portflow /lti/open_id → Canvas authorize redirect + Portflow cookie
 * 4. GET Canvas authorize URL (met Canvas cookies) → HTML met id_token
 * 5. POST id_token naar Portflow /lti/launches → HTML met data-session JWT
 * 6. Extract JWT → cachen tot vlak voor de vervaldatum uit het token zelf
 *
 * Beveiliging: elke URL in deze flow wordt aangedragen door een server
 * (launch URL door Canvas, authorize URL door Portflow). Die URL's worden
 * daarom stuk voor stuk gevalideerd tegen een vaste lijst van vertrouwde
 * hosts voordat er cookies of tokens naartoe gaan. Zie ./http.ts.
 */

import { CanvasClient } from "../canvasClient.js";
import { logLine } from "../utils/redact.js";
import { CanvasApiError } from "../errors.js";
import {
  HostScopedCookieJar,
  PORTFLOW_BASE,
  PORTFLOW_HOST,
  assertAllowedUrl,
  safeFetch,
} from "./http.js";

interface CachedSession {
  jwt: string;
  expiresAt: number;
}

// Cache per courseId. De levensduur komt uit het JWT zelf, niet uit een aanname.
const sessionCache = new Map<string, CachedSession>();

/** Vernieuw ruim voor het verlopen, zodat een lopend verzoek niet halverwege ongeldig wordt. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;
/** Val hierop terug als het JWT geen leesbare exp-claim heeft. Bewust kort. */
const FALLBACK_TTL_MS = 60 * 60 * 1000;

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

/**
 * Leest de exp-claim uit een JWT om te bepalen hoelang we mogen cachen.
 *
 * We verifiëren de handtekening niet — dat is aan Portflow. We lezen alleen de
 * vervaldatum, zodat we geen token blijven gebruiken dat allang ongeldig is.
 * Bij twijfel kiezen we de korte fallback: liever te vaak vernieuwen dan een
 * dood token hergebruiken.
 */
export function jwtExpiryMs(jwt: string, now: number = Date.now()): number {
  const parts = jwt.split(".");
  if (parts.length !== 3) return now + FALLBACK_TTL_MS;

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    ) as { exp?: unknown };

    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
      return now + FALLBACK_TTL_MS;
    }

    const expMs = payload.exp * 1000;
    // Een exp in het verleden of absurd ver weg vertrouwen we niet.
    if (expMs <= now || expMs > now + 24 * 60 * 60 * 1000) {
      return now + FALLBACK_TTL_MS;
    }
    return expMs;
  } catch {
    return now + FALLBACK_TTL_MS;
  }
}

async function getPortflowJwtInternal(
  client: CanvasClient,
  courseId: string
): Promise<string> {
  // Alleen deze twee hosts mogen cookies of tokens ontvangen in deze flow.
  const canvasHost = new URL(client.baseUrl).hostname;
  const allowedHosts = [canvasHost, PORTFLOW_HOST] as const;

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

  // De launch URL bevat een session_token: die mag alleen naar Canvas zelf.
  assertAllowedUrl(launchData.url, [canvasHost], "Canvas launch-URL");

  const cookieJar = new HostScopedCookieJar();

  try {
    // Stap 2: laad de Canvas LTI pagina (met session_token) → HTML + cookies
    const { text: canvasHtml } = await safeFetch(launchData.url, {
      cookieJar,
      allowedHosts,
      context: "Canvas LTI-launchpagina",
    });

    const ltiFields = extractInputFields(canvasHtml);
    if (!ltiFields["lti_message_hint"]) {
      throw new CanvasApiError(
        0,
        "Kon LTI form parameters niet extracten uit Canvas pagina."
      );
    }

    // Stap 3: POST naar Portflow /lti/open_id → Canvas authorize redirect
    const { headers: openIdHeaders } = await safeFetch(
      `${PORTFLOW_BASE}/lti/open_id`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(ltiFields).toString(),
        cookieJar,
        allowedHosts,
        followRedirects: false,
        context: "Portflow open_id",
      }
    );

    const canvasAuthorizeUrl = openIdHeaders.get("location");
    if (!canvasAuthorizeUrl) {
      throw new CanvasApiError(0, "Portflow /lti/open_id gaf geen redirect terug.");
    }

    // Deze URL komt van Portflow maar krijgt Canvas-cookies mee: streng valideren.
    assertAllowedUrl(canvasAuthorizeUrl, [canvasHost], "Canvas authorize-URL");

    // Stap 4: GET Canvas authorize URL (met Canvas cookies) → HTML met id_token
    const { text: authorizeHtml } = await safeFetch(canvasAuthorizeUrl, {
      cookieJar,
      allowedHosts,
      context: "Canvas authorize",
    });

    const tokenFields = extractInputFields(authorizeHtml);
    if (!tokenFields["id_token"]) {
      throw new CanvasApiError(
        0,
        "Kon geen id_token vinden in Canvas authorize response. Mogelijk is de sessie verlopen."
      );
    }

    // Stap 5: POST id_token naar Portflow /lti/launches → HTML met data-session JWT
    const launchBody = new URLSearchParams({
      id_token: tokenFields["id_token"],
      state: tokenFields["state"] ?? "",
      lti_storage_target: tokenFields["lti_storage_target"] ?? "",
    });

    const { text: launchHtml } = await safeFetch(`${PORTFLOW_BASE}/lti/launches`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: launchBody.toString(),
      cookieJar,
      allowedHosts,
      followRedirects: false,
      context: "Portflow launch",
    });

    const jwt = extractDataSession(launchHtml);
    if (!jwt) {
      throw new CanvasApiError(
        0,
        "Kon geen Portflow sessie JWT vinden. De LTI launch is mislukt."
      );
    }

    return jwt;
  } finally {
    // Sessiecookies niet langer in het geheugen houden dan nodig.
    cookieJar.clear();
  }
}

export async function getPortflowJwt(
  client: CanvasClient,
  courseId: string
): Promise<string> {
  const cached = sessionCache.get(courseId);
  if (cached && cached.expiresAt > Date.now() + REFRESH_MARGIN_MS) {
    return cached.jwt;
  }

  logLine(
    `[Portflow] Nieuwe LTI sessie aanvragen voor cursus ${courseId}\n`
  );
  const jwt = await getPortflowJwtInternal(client, courseId);

  sessionCache.set(courseId, { jwt, expiresAt: jwtExpiryMs(jwt) });

  return jwt;
}

/**
 * Gooit de gecachte sessie weg. Aanroepen zodra Portflow 401/403 geeft:
 * anders blijven we een ongeldig token hergebruiken tot de cache vanzelf verloopt.
 */
export function invalidatePortflowSession(courseId: string): void {
  sessionCache.delete(courseId);
}

export function clearPortflowCache(): void {
  sessionCache.clear();
}
