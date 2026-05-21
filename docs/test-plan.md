# Testplan

## Overzicht

Dit testplan beschrijft hoe je canvas-claude-mcp handmatig test voor versie 1. Er zijn drie testmethoden: directe unit tests, MCP Inspector en Claude Desktop.

---

## Automatische tests

```bash
npm run build
npm test
```

Tests bevinden zich in `tests/` en gebruiken Jest met mocks — er is geen echte Canvas-verbinding nodig.

---

## Handmatige teststappen

### Voorbereiding

1. Kopieer `.env.example` naar `.env`
2. Vul `CANVAS_BASE_URL` in met jouw school URL
3. Genereer een Canvas token via Account → Instellingen → Toegangstokens
4. Vul `CANVAS_ACCESS_TOKEN` in
5. Voer uit: `npm install && npm run build`

### Test 1: Server opstarten

```bash
node dist/index.js
```

**Verwacht:** `[canvas-claude-mcp] Server gestart via stdio.` op stderr  
**Fout:** Als je `Omgevingsvariabele CANVAS_BASE_URL is niet ingesteld` ziet → .env ontbreekt

### Test 2: MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

- Open de Inspector URL in je browser
- Klik op "List Tools" → je ziet 7 tools
- Roep `canvas_list_courses` aan zonder parameters
- Verwacht: lijst van je cursussen

### Test 3: Claude Desktop

Voeg toe aan `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "canvas": {
      "command": "node",
      "args": ["/pad/naar/canvas-claude-mcp/dist/index.js"],
      "env": {
        "CANVAS_BASE_URL": "https://jouwschool.instructure.com",
        "CANVAS_ACCESS_TOKEN": "<CANVAS_ACCESS_TOKEN>"
      }
    }
  }
}
```

Start Claude Desktop opnieuw. Test met: "Welke cursussen volg ik op Canvas?"

---

## Testtabel

| Test | Doel | Stappen | Verwacht resultaat |
|------|------|---------|-------------------|
| T01 | Server start correct | `node dist/index.js` | Melding op stderr, geen crash |
| T02 | Config fout zonder .env | Verwijder .env, start server | Duidelijke foutmelding over ontbrekende env var |
| T03 | Ongeldige token (401) | Zet token op `invalid`, roep tool aan | "Ongeldige Canvas token. Controleer CANVAS_ACCESS_TOKEN." |
| T04 | Geen toegang (403) | Gebruik token zonder rechten | "Geen toegang tot dit Canvas onderdeel." |
| T05 | Verkeerde courseId (404) | Roep `canvas_list_assignments` aan met courseId `99999` | "Niet gevonden. Controleer of het courseId correct is." |
| T06 | Verkeerde base URL | Zet CANVAS_BASE_URL op `https://fout.example.com` | Axios timeout of verbindingsfout |
| T07 | Lege cursuslijst | Test-account zonder cursussen | "Je hebt momenteel geen actieve Canvas cursussen." |
| T08 | Opdracht zonder deadline | Opdracht met `due_at: null` | "Geen deadline" ipv crash |
| T09 | Lege opdrachtlijst | Cursus zonder opdrachten | "Geen opdrachten gevonden" |
| T10 | Rate limiting (429) | Simuleer 429-response | "Canvas rate limit bereikt. Wacht even en probeer het opnieuw." |
| T11 | Token niet in logs | Start server, roep tool aan, bekijk stderr | Geen token zichtbaar in output |
| T12 | HTML in beschrijving | Opdracht met HTML-beschrijving | Beschrijving zonder HTML-tags |
| T13 | Pagination | Cursus met 100+ opdrachten | Alle opdrachten worden opgehaald |
| T14 | MCP Inspector tools | Open Inspector | 7 tools zichtbaar met beschrijvingen |
| T15 | Build zonder fouten | `npm run build` | Exit 0, geen TypeScript-fouten |

---

## Testen of tokens nergens gelogd worden

1. Start de server: `node dist/index.js 2>server.log`
2. Roep een tool aan via MCP Inspector
3. Bekijk `server.log`: `cat server.log`
4. Zoek op het token: `grep "jouw-token" server.log`
5. **Verwacht:** geen matches

---

## Testen bij lege responses

Canvas geeft soms een lege array `[]` terug als er geen data is. Elke tool heeft een aparte check en retourneert dan een leesbare melding. Test dit door een nieuw/leeg testaccount te gebruiken of door de mock in `tests/tools.test.ts` te gebruiken.

---

## Rate limiting testen

Canvas heeft rate limits (meestal 700 requests per 10 minuten). Bij een 429-response gooit `canvasClient.ts` een `CanvasApiError` met de boodschap "Canvas rate limit bereikt." Je kunt dit simuleren door in de tests een 429-mock toe te voegen.
