/**
 * Geharde HTTP-laag voor de Portflow LTI-flow.
 *
 * De LTI 1.3 flow stuurt sessiecookies heen en weer tussen Canvas en Portflow
 * en volgt daarbij redirects die de servers zelf aandragen. Dat is precies het
 * soort flow waar een fout stil en duur is: één redirect naar een vreemde host
 * en je Canvas-sessiecookie ligt op straat.
 *
 * Daarom gelden hier vier regels:
 *  1. Cookies zijn gebonden aan de host die ze zette (nooit breder versturen).
 *  2. Redirects mogen alleen naar een vooraf toegestane host.
 *  3. Er is een maximum aantal redirects (geen oneindige lus).
 *  4. Elk verzoek heeft een timeout en een maximale responsegrootte.
 */

import { CanvasApiError } from "../errors.js";

export const PORTFLOW_HOST = "portfolio.drieam.app";
export const PORTFLOW_BASE = `https://${PORTFLOW_HOST}`;

export const FETCH_TIMEOUT_MS = 15_000;
export const MAX_REDIRECTS = 10;
export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Cookiejar die cookies per host bijhoudt.
 *
 * Bewust strenger dan een browser: cookies gaan alleen terug naar exact de host
 * die ze heeft gezet. Geen subdomein-matching — bij Canvas draaien alle scholen
 * op *.instructure.com, dus domein-brede cookies zouden tussen scholen kunnen
 * lekken.
 */
export class HostScopedCookieJar {
  private byHost = new Map<string, Map<string, string>>();

  update(host: string, headers: Headers): void {
    const setCookies = headers.getSetCookie?.() ?? [];
    if (setCookies.length === 0) return;

    let jar = this.byHost.get(host);
    if (!jar) {
      jar = new Map<string, string>();
      this.byHost.set(host, jar);
    }

    for (const raw of setCookies) {
      const [nameValue] = raw.split(";");
      const eqIdx = nameValue.indexOf("=");
      if (eqIdx < 0) continue;
      const name = nameValue.slice(0, eqIdx).trim();
      const value = nameValue.slice(eqIdx + 1).trim();
      if (name) jar.set(name, value);
    }
  }

  /** Geeft de Cookie-header voor exact deze host, of "" als er niets bekend is. */
  header(host: string): string {
    const jar = this.byHost.get(host);
    if (!jar || jar.size === 0) return "";
    return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  /** Wist alle cookies — aanroepen zodra de flow klaar of mislukt is. */
  clear(): void {
    for (const jar of this.byHost.values()) jar.clear();
    this.byHost.clear();
  }
}

export function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

/**
 * Controleert of een URL veilig genoeg is om cookies of tokens naartoe te sturen.
 * Weigert alles wat niet https is en elke host die niet expliciet is toegestaan.
 */
export function assertAllowedUrl(
  rawUrl: string,
  allowedHosts: readonly string[],
  context: string
): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new CanvasApiError(
      0,
      `Onveilige ${context}: "${rawUrl.slice(0, 80)}" is geen geldige URL — verzoek geweigerd.`
    );
  }

  // Zelfde regel als in config.ts: plaintext mag alleen naar de eigen machine,
  // waar er geen netwerkverbinding is om af te luisteren. In de echte LTI-flow
  // staat loopback nooit in allowedHosts, dus dit verruimt daar niets.
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopbackHost(url.hostname))) {
    throw new CanvasApiError(
      0,
      `Onveilige ${context}: ${url.protocol}// is niet toegestaan, alleen https. ` +
        `Zonder https zouden sessiecookies leesbaar over het netwerk gaan.`
    );
  }

  if (!allowedHosts.includes(url.hostname)) {
    throw new CanvasApiError(
      0,
      `Onveilige ${context}: host "${url.hostname}" staat niet op de lijst van vertrouwde hosts ` +
        `(${allowedHosts.join(", ")}) — verzoek geweigerd om te voorkomen dat sessiegegevens lekken.`
    );
  }

  return url;
}

/** Leest de response met een harde limiet, zodat een enorme body het geheugen niet opvreet. */
async function readTextLimited(response: Response, context: string): Promise<string> {
  const declared = response.headers.get("content-length");
  if (declared && Number(declared) > MAX_RESPONSE_BYTES) {
    throw new CanvasApiError(
      0,
      `Antwoord van ${context} is te groot (${declared} bytes, limiet ${MAX_RESPONSE_BYTES}).`
    );
  }

  const body = response.body;
  if (!body) return "";

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new CanvasApiError(
          0,
          `Antwoord van ${context} overschrijdt de limiet van ${MAX_RESPONSE_BYTES} bytes — afgebroken.`
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock?.();
  }

  return Buffer.concat(chunks).toString("utf-8");
}

export interface SafeFetchResult {
  text: string;
  status: number;
  headers: Headers;
  finalUrl: URL;
}

export interface SafeFetchOptions {
  cookieJar?: HostScopedCookieJar;
  allowedHosts: readonly string[];
  /** Volg redirects zelf (met validatie). Zo niet, dan krijg je de 3xx terug. */
  followRedirects?: boolean;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  context?: string;
}

/**
 * Doet een verzoek met timeout, hostvalidatie, host-gebonden cookies,
 * een limiet op het aantal redirects en op de responsegrootte.
 */
export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions
): Promise<SafeFetchResult> {
  const {
    cookieJar,
    allowedHosts,
    followRedirects = true,
    context = "verzoek",
  } = options;

  let url = assertAllowedUrl(rawUrl, allowedHosts, context);
  let method = options.method ?? "GET";
  let body = options.body;
  let hops = 0;

  for (;;) {
    const headers: Record<string, string> = { ...(options.headers ?? {}) };

    // Cookies alleen voor exact deze host.
    if (cookieJar) {
      const cookieHeader = cookieJar.header(url.hostname);
      if (cookieHeader) headers["Cookie"] = cookieHeader;
      else delete headers["Cookie"];
    }

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method,
        headers,
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      if (err instanceof Error && err.name === "TimeoutError") {
        throw new CanvasApiError(
          0,
          `Time-out na ${FETCH_TIMEOUT_MS / 1000}s bij ${context} (${url.hostname}).`
        );
      }
      throw new CanvasApiError(
        0,
        `Netwerkfout bij ${context} (${url.hostname}): ${
          err instanceof Error ? err.message : "onbekend"
        }`
      );
    }

    cookieJar?.update(url.hostname, response.headers);

    const isRedirect = response.status >= 300 && response.status < 400;
    if (!isRedirect || !followRedirects) {
      const text = await readTextLimited(response, context);
      return { text, status: response.status, headers: response.headers, finalUrl: url };
    }

    if (++hops > MAX_REDIRECTS) {
      throw new CanvasApiError(
        0,
        `Te veel redirects (meer dan ${MAX_REDIRECTS}) bij ${context} — afgebroken om een oneindige lus te voorkomen.`
      );
    }

    const location = response.headers.get("location");
    if (!location) {
      throw new CanvasApiError(0, `Redirect zonder Location-header bij ${context}.`);
    }

    // Relatieve redirects oplossen tegen de huidige URL, daarna opnieuw valideren.
    const nextRaw = new URL(location, url).toString();
    url = assertAllowedUrl(nextRaw, allowedHosts, `redirect tijdens ${context}`);

    // Na een redirect is het altijd een GET zonder body.
    method = "GET";
    body = undefined;
  }
}
