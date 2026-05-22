# Canvas Claude MCP

Een read-only MCP server waarmee Claude veilig Canvas LMS kan uitlezen. Claude kan vragen beantwoorden over cursussen, opdrachten, deadlines, mededelingen, modules en pagina's — zonder ooit iets in Canvas aan te passen.

## Wat het doet

- Canvas cursussen, opdrachten en deadlines ophalen
- Mededelingen, modules en pagina's uitlezen
- Alles beschikbaar als MCP tools voor Claude Desktop
- Volledig read-only — geen schrijfacties, geen Canvas-aanpassingen

## Installatie

```bash
git clone <jouw-repo-url>
cd canvas-claude-mcp
npm install
```

## .env instellen

```bash
cp .env.example .env
```

Bewerk `.env`:

```
CANVAS_BASE_URL=https://jouwschool.instructure.com
CANVAS_ACCESS_TOKEN=<jouw-token>
```

**Hoe maak je een Canvas token aan:**
1. Log in op Canvas
2. Ga naar Account → Instellingen
3. Scroll naar Toegangstokens → Token toevoegen
4. Geef het een naam (bijv. `canvas-claude-mcp`) en kopieer het token
5. Plak het token in `.env` als `CANVAS_ACCESS_TOKEN`

> ⚠️ Deel je token nooit. Commit `.env` nooit naar Git.

## Builden

```bash
npm run build
```

Dit compileert TypeScript naar `dist/`.

## Starten

```bash
npm start
# of voor ontwikkeling:
npm run dev
```

## Tests draaien

```bash
npm test
```

Tests gebruiken mocks — er is geen echte Canvas-verbinding nodig.

## Claude Desktop configureren

Voeg de volgende configuratie toe aan je `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "canvas": {
      "command": "node",
      "args": ["/absoluut/pad/naar/canvas-claude-mcp/dist/index.js"],
      "env": {
        "CANVAS_BASE_URL": "https://jouwschool.instructure.com",
        "CANVAS_ACCESS_TOKEN": "<CANVAS_ACCESS_TOKEN>"
      }
    }
  }
}
```

Start Claude Desktop opnieuw na het aanpassen van de config.

## Beschikbare tools

| Tool | Functie |
|------|---------|
| `canvas_list_courses` | Actieve cursussen ophalen |
| `canvas_list_assignments` | Opdrachten per cursus |
| `canvas_get_assignment_details` | Volledige opdrachtdetails |
| `canvas_get_upcoming_deadlines` | Aankomende deadlines uit planner |
| `canvas_get_announcements` | Mededelingen per cursus |
| `canvas_list_modules` | Modules per cursus |
| `canvas_list_pages` | Gepubliceerde pagina's per cursus |

## Wat bewust niet kan (versie 1)

- Opdrachten inleveren
- Berichten sturen
- Bestanden uploaden of verwijderen
- Canvas aanpassen op welke manier dan ook
- Cijfers bekijken

## Demo

Start Claude Desktop en stel één van deze vragen:

1. "Welke cursussen volg ik op Canvas?"
2. "Wat zijn mijn aankomende deadlines?"
3. "Welke opdrachten heb ik voor cursus [naam]?"
4. "Zijn er nieuwe mededelingen?"

## Security waarschuwingen

- Zet je Canvas token nooit in code, documentatie of Git
- `.env` staat in `.gitignore` en wordt nooit gecommit
- Gebruik alleen Canvas tokens met minimale rechten
- Als je token per ongeluk gedeeld is: verwijder het direct via Canvas → Account → Instellingen → Toegangstokens
- Zie [docs/security.md](docs/security.md) voor de volledige security checklist

## Projectstructuur

```
canvas-claude-mcp/
  src/
    index.ts          MCP server entry point
    config.ts         Env-variabelen laden
    canvasClient.ts   Canvas API HTTP client
    errors.ts         Fouttypen en meldingen
    pagination.ts     Canvas Link-header pagination
    tools/            Eén bestand per Canvas-domein
    utils/            HTML-stripper en datumformatter
  docs/               Uitgebreide documentatie
  tests/              Unit tests met mocks
```

## Documentatie

- [Projectoverzicht](docs/overview.md)
- [Architectuur](docs/architecture.md)
- [Canvas API Map](docs/canvas-api-map.md)
- [Security](docs/security.md)
- [MCP Tools](docs/mcp-tools.md)
- [Testplan](docs/test-plan.md)
- [Roadmap](docs/roadmap.md)
- [Automatisering](docs/automation.md)
