import { statSync } from "node:fs";
import { resolve } from "node:path";
import { logLine } from "./utils/redact.js";

/**
 * Controleert of het .env bestand niet breder leesbaar is dan nodig.
 *
 * Een Canvas-token in een bestand met rechten 644 is leesbaar voor elk proces
 * en elke gebruiker op de machine. Dat is geen theoretisch risico: alles wat
 * je draait — een npm-postinstall script, een tool die je even uitprobeert —
 * kan het bestand openen. Rechten 600 beperken dat tot jouw account.
 */
export function checkEnvFilePermissions(
  envPath = resolve(process.cwd(), ".env")
): string | null {
  let mode: number;
  try {
    mode = statSync(envPath).mode;
  } catch {
    // Geen .env (config via MCP-omgeving) — niets te controleren.
    return null;
  }

  // Bits voor groep en overige gebruikers.
  const groupAndOther = mode & 0o077;
  if (groupAndOther === 0) return null;

  const octal = (mode & 0o777).toString(8).padStart(3, "0");
  return (
    `WAARSCHUWING: ${envPath} heeft rechten ${octal} en is daarmee leesbaar ` +
    `voor andere gebruikers of processen op deze machine. Je Canvas-token ligt ` +
    `daar in platte tekst in. Herstel met: chmod 600 "${envPath}"`
  );
}

export function runStartupChecks(allowWrites: boolean): void {
  const envWarning = checkEnvFilePermissions();
  if (envWarning) logLine(`[canvas-claude-mcp] ${envWarning}\n`);

  if (allowWrites) {
    logLine(
      `[canvas-claude-mcp] LET OP: CANVAS_ALLOW_WRITES staat aan. ` +
        `Write-acties (zoals een portfolio inleveren) zijn mogelijk. ` +
        `Zet dit uit zodra je het niet meer nodig hebt.\n`
    );
  } else {
    logLine(`[canvas-claude-mcp] Read-only modus (write-acties geblokkeerd).\n`);
  }
}
