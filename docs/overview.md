# Canvas Claude MCP — Projectoverzicht

## Wat doet dit project?

Canvas Claude MCP is een **read-only MCP server** die Claude toegang geeft tot Canvas LMS via de Canvas REST API. Claude kan hiermee vragen beantwoorden zoals:

- "Welke cursussen volg ik?"
- "Wat zijn mijn aankomende deadlines?"
- "Wat staat er in de beschrijving van opdracht X?"
- "Zijn er nieuwe mededelingen geplaatst?"

De server doet **niets anders dan lezen**. Canvas wordt nooit aangepast.

## Waarom MCP?

Model Context Protocol (MCP) is het standaardprotocol van Anthropic voor het uitbreiden van Claude met externe tools en databronnen. Voordelen voor dit project:

- Claude kan Canvas-tools aanroepen alsof het ingebouwde functies zijn
- De server draait lokaal — data verlaat jouw machine niet naar derden
- Tools zijn modulair: versie 1 heeft 7 tools, uitbreiding is eenvoudig
- Veiligheid zit in het protocol: Claude vraagt altijd expliciet toestemming om een tool aan te roepen

## Verschil tussen Claude, MCP server en Canvas API

```
Gebruiker
   ↕  (chat)
Claude (AI)
   ↕  (MCP protocol via stdio)
canvas-claude-mcp (deze server)
   ↕  (HTTPS REST API)
Canvas LMS (jouw school)
```

| Component | Rol |
|-----------|-----|
| **Claude** | Begrijpt de vraag, kiest welke tool nodig is, interpreteert de output |
| **MCP server** | Vertaalt Claude's toolaanroepen naar Canvas API calls, formatteert de output |
| **Canvas API** | Beheert en levert de eigenlijke cursusdata |

## Versie 1 — wat kan het?

| Tool | Functie |
|------|---------|
| `canvas_list_courses` | Actieve cursussen ophalen |
| `canvas_list_assignments` | Opdrachten per cursus |
| `canvas_get_assignment_details` | Volledige opdrachtdetails incl. beschrijving |
| `canvas_get_upcoming_deadlines` | Aankomende deadlines uit de planner |
| `canvas_get_announcements` | Mededelingen per cursus |
| `canvas_list_modules` | Modules per cursus |
| `canvas_list_pages` | Gepubliceerde pagina's per cursus |

## Bewust buiten scope voor versie 1

- Opdrachten inleveren
- Berichten sturen (Inbox)
- Bestanden uploaden of verwijderen
- Canvas aanpassen op welke manier dan ook
- Cijfers bekijken (gevoelig, voor versie 2)
- Bestanden downloaden (voor versie 2)

## Uitbreidingsmogelijkheden

- Cijfers en feedback uitlezen (v2)
- Module-items en bestanden (v2)
- Kalender en events (v2)
- Planningsrapporten genereren (v3)
- Veilige write-acties met menselijke goedkeuring (later)
