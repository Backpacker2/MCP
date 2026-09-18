/**
 * Redactie voor logs en foutmeldingen.
 *
 * Logregels en stacktraces zijn de plek waar geheimen per ongeluk terechtkomen:
 * ze worden naar bestanden geschreven, in issues geplakt en in chats gedeeld.
 * Alles wat deze server naar stderr schrijft gaat daarom eerst hier langs.
 */

/** Canvas-tokens hebben de vorm `<cijfers>~<lange reeks>`. */
const CANVAS_TOKEN = /\b\d{3,6}~[A-Za-z0-9]{20,}\b/g;

/** JWT's: drie base64url-delen gescheiden door punten. */
const JWT = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g;

/** Token in een query-parameter, bijv. ?access_token=... of &session_token=... */
const TOKEN_PARAM =
  /([?&](?:access_token|session_token|api_key|token|id_token|state)=)[^&\s"']+/gi;

/** Een Authorization-header die toch ergens in een string beland is. */
const AUTH_HEADER = /\b(Authorization\s*[:=]\s*)(?:Bearer\s+)?\S+/gi;

/** Cookie-headers bevatten sessiegegevens die net zo gevoelig zijn als een token. */
const COOKIE_HEADER = /\b(Cookie\s*[:=]\s*)[^\n\r]+/gi;

export function redact(input: string): string {
  return input
    .replace(CANVAS_TOKEN, "<CANVAS_TOKEN_VERBORGEN>")
    .replace(JWT, "<JWT_VERBORGEN>")
    .replace(TOKEN_PARAM, "$1<VERBORGEN>")
    .replace(AUTH_HEADER, "$1<VERBORGEN>")
    .replace(COOKIE_HEADER, "$1<VERBORGEN>");
}

/**
 * Zet een willekeurige waarde om naar een veilige logregel.
 * Bij een Error gebruiken we alleen naam en bericht — geen stacktrace met
 * mogelijk gevoelige request-details erin.
 */
export function safeErrorText(error: unknown): string {
  if (error instanceof Error) {
    return redact(`${error.name}: ${error.message}`);
  }
  return redact(String(error));
}

/** Schrijft een regel naar stderr met redactie erop. */
export function logLine(line: string): void {
  process.stderr.write(redact(line));
}
