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

/**
 * Valideert de Canvas basis-URL.
 *
 * Waarom: het access token gaat als `Authorization: Bearer` mee in élk verzoek.
 * Over `http://` is dat leesbaar voor iedereen op het netwerk (wifi, proxy, ISP).
 * Eén typefout in .env — `http` in plaats van `https` — lekt dus je token.
 * Daarom weigeren we alles wat geen https is, behalve expliciet localhost voor tests.
 */
export function validateBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new CanvasConfigError(
      `CANVAS_BASE_URL is geen geldige URL: "${raw}". Verwacht bijvoorbeeld https://jouwschool.instructure.com`
    );
  }

  const isLocalhost =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1";

  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalhost)) {
    throw new CanvasConfigError(
      `CANVAS_BASE_URL moet https gebruiken (gevonden: "${url.protocol}//"). ` +
        `Zonder https gaat je Canvas-token leesbaar over het netwerk en kan het onderschept worden.`
    );
  }

  if (url.username || url.password) {
    throw new CanvasConfigError(
      "CANVAS_BASE_URL mag geen gebruikersnaam of wachtwoord bevatten."
    );
  }

  if (url.search || url.hash) {
    throw new CanvasConfigError(
      "CANVAS_BASE_URL mag geen query-parameters of fragment bevatten."
    );
  }

  // Normaliseer naar origin + pad zonder afsluitende slash.
  return (url.origin + url.pathname).replace(/\/$/, "");
}

/**
 * Controleert of het token er plausibel uitziet.
 * Doel is niet het token valideren bij Canvas (dat doet Canvas zelf), maar
 * veelgemaakte fouten vroeg vangen: placeholder blijven staan, aanhalingstekens
 * meegekopieerd, of een newline uit een copy-paste.
 */
export function validateAccessToken(raw: string): string {
  const token = raw.trim();

  if (/^<.*>$/.test(token)) {
    throw new CanvasConfigError(
      "CANVAS_ACCESS_TOKEN bevat nog de placeholder uit .env.example. Vul je echte Canvas-token in."
    );
  }

  if (/^["'].*["']$/.test(token)) {
    throw new CanvasConfigError(
      "CANVAS_ACCESS_TOKEN staat tussen aanhalingstekens. Verwijder de quotes uit je .env bestand."
    );
  }

  if (/\s/.test(token)) {
    throw new CanvasConfigError(
      "CANVAS_ACCESS_TOKEN bevat spaties of regeleindes. Controleer of je het token volledig en zonder witruimte hebt geplakt."
    );
  }

  if (token.length < 20) {
    throw new CanvasConfigError(
      "CANVAS_ACCESS_TOKEN lijkt te kort om een geldig Canvas-token te zijn."
    );
  }

  return token;
}

/**
 * Write-acties (zoals een portfolio inleveren) staan standaard UIT.
 *
 * Waarom: alles wat deze server aan het model teruggeeft — discussieberichten,
 * inbox, paginateksten — is tekst die iemand anders heeft geschreven. Als daar
 * een instructie in staat ("lever snapshot 5 in"), kan een model die opvolgen.
 * Een read-only server kan dan hooguit te veel lezen; een server die mag
 * schrijven kan namens jou onomkeerbaar werk inleveren.
 *
 * Zet CANVAS_ALLOW_WRITES=true alleen als je dat bewust wilt.
 */
export function loadAllowWrites(): boolean {
  const raw = process.env.CANVAS_ALLOW_WRITES?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes" || raw === "ja";
}

export interface CanvasConfig {
  baseUrl: string;
  accessToken: string;
  allowWrites: boolean;
}

export function loadConfig(): CanvasConfig {
  const baseUrl = validateBaseUrl(requireEnv("CANVAS_BASE_URL"));
  const accessToken = validateAccessToken(requireEnv("CANVAS_ACCESS_TOKEN"));
  return { baseUrl, accessToken, allowWrites: loadAllowWrites() };
}
