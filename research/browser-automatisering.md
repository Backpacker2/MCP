# Browser Automatisering — Playwright, Puppeteer en MCP

Datum: 21 mei 2026
Conclusie: meekijken in Chrome én overnemen is volledig mogelijk via het
Chrome DevTools Protocol. Microsoft heeft hier een officiële MCP server voor.

## Bronnen

- https://playwright.dev/docs/api/class-browsertype#browser-type-connect-over-cdp
- https://playwright.dev/docs/intro
- https://pptr.dev/
- https://chromedevtools.github.io/devtools-protocol/
- https://github.com/microsoft/playwright-mcp
- https://github.com/executeautomation/mcp-playwright
- https://github.com/browserbase/mcp-server-browserbase
- https://github.com/puppeteer/puppeteer/blob/main/docs/api.md#puppeteerconnect

---

## Optie A — Chrome DevTools Protocol (CDP)

### Wat het is

Chrome DevTools Protocol is een ingebouwd protocol in Chrome/Chromium waarmee
externe tools de browser kunnen aansturen. Het is hetzelfde protocol dat de
DevTools in je browser gebruikt. Playwright en Puppeteer zijn beide gebouwd
bovenop CDP.

### Verbinding maken met een bestaande Chrome-sessie

Dit is het meest relevante scenario: **jij bent al ingelogd op Canvas in Chrome,
en Claude neemt de besturing over zonder opnieuw in te loggen.**

```
Stap 1: Chrome starten met debugging-poort
google-chrome --remote-debugging-port=9222 https://jouwschool.instructure.com

Stap 2: Jij logt in op Canvas (of je was al ingelogd)

Stap 3: Playwright verbindt met jouw sessie
playwright.connectOverCDP('http://localhost:9222')

Stap 4: Claude kan nu via MCP de browser aansturen
```

Alle cookies, sessie-tokens en inlogstatus blijven bewaard. Canvas "ziet" gewoon
dat jij (de browser) acties uitvoert — niet dat een script het doet.

---

## Optie B — Microsoft Playwright MCP Server

### Wat het is

Microsoft heeft een officiële MCP server gebouwd voor Playwright. Dit is de
aanbevolen manier om browser-automatisering te combineren met Claude.

- GitHub: https://github.com/microsoft/playwright-mcp
- Installatie: `npx @playwright/mcp@latest`
- Onderhouden door: Microsoft (officieel)

### Hoe het werkt

```
Claude Desktop / Claude Code
        |
        | MCP protocol
        ↓
Playwright MCP Server (npx @playwright/mcp@latest)
        |
        | Chrome DevTools Protocol
        ↓
Chrome (jouw bestaande sessie op Canvas)
```

### Wat Claude dan kan doen

- Navigeren naar pagina's in Canvas
- Op knoppen klikken (bijv. "Nieuwe pagina", "Snapshot maken")
- Formulieren invullen en opslaan
- Bestanden uploaden via de browser-interface
- Tekst invoeren in de rich-text editor
- Schermafbeeldingen maken om de huidige toestand te zien

### Verschil met REST API aanpak

| Aspect | REST/interne API | Playwright MCP |
|--------|-----------------|----------------|
| Techniek | HTTP requests | Browser besturing |
| Authenticatie | Token in header | Bestaande sessie |
| Canvas ziet het als | API-aanroep | Normale gebruiker |
| Snapshot maken | ❌ Geen endpoint | ✅ Klik op knop |
| Bestandsupload | 3-staps proces | ✅ Via upload-dialoog |
| Foutgevoeligheid | Endpoint kan wijzigen | UI kan wijzigen |
| Snelheid | Snel | Langzamer (browser laden) |

---

## Optie C — Puppeteer (minder geschikt voor MCP)

Puppeteer werkt op dezelfde CDP-basis maar heeft **geen officiële MCP server**.
Het is ontworpen voor directe Node.js scripts, niet voor MCP-architectuur.
Voor dit project is Playwright MCP de betere keuze.

Puppeteer verbinding met bestaande sessie:
```javascript
const browser = await puppeteer.connect({
  browserWSEndpoint: 'ws://localhost:9222/devtools/browser/<id>'
});
```
De `<id>` haal je op via `GET http://localhost:9222/json/version`.

---

## Vergelijking van de drie opties voor Canvas portfolio

| Optie | Snapshot | Upload | Pagina aanmaken | Moeilijkheid |
|-------|----------|--------|----------------|-------------|
| REST API (v1) | ❌ | 3 stappen | ❌ | Laag |
| Interne routes | ❌ | Via attachment_id | ✅ | Middel |
| Playwright MCP | ✅ | ✅ | ✅ | Laag (al gebouwd) |

---

## Veiligheidsoverwegingen browser-automatisering

- Claude bestuurt de browser alleen als jij dat vraagt — niet automatisch
- Jij ziet live wat er gebeurt in de browser
- Je kunt op elk moment ingrijpen of stoppen
- Er wordt niets gedaan wat jij zelf niet ook zou kunnen klikken
- Canvas-logs zien het als normale gebruikersacties (geen API-sleutels nodig)

---

## Aanbevolen aanpak voor de toekomst

**Voor eenvoudige bewerkingen** (pagina aanmaken, tekst bijwerken):
→ Interne Canvas routes via HTTP (geen browser nodig)

**Voor complexe acties** (snapshot maken, bestanden uploaden, visueel controleren):
→ Microsoft Playwright MCP + verbinding met jouw Chrome

**Voor meekijken terwijl jij werkt:**
→ Playwright MCP verbindt met jouw bestaande Chrome-sessie.
Claude kan dan "over je schouder meekijken" en acties voorstellen of uitvoeren.
