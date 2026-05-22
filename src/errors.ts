export class CanvasConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanvasConfigError";
  }
}

export class CanvasApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "CanvasApiError";
    this.statusCode = statusCode;
  }
}

export function statusCodeToMessage(statusCode: number): string {
  switch (statusCode) {
    case 401:
      return "Ongeldige Canvas token. Controleer CANVAS_ACCESS_TOKEN in je .env bestand.";
    case 403:
      return "Geen toegang tot dit Canvas onderdeel. Controleer je Canvas-rechten.";
    case 404:
      return "Niet gevonden. Controleer of het courseId of endpoint correct is.";
    case 429:
      return "Canvas rate limit bereikt. Wacht even en probeer het opnieuw.";
    default:
      return `Canvas API fout (HTTP ${statusCode}). Probeer het later opnieuw.`;
  }
}
