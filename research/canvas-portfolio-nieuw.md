# Canvas Portfolio — Nieuwe Tool (vervangt ePortfolio)

Datum: 21 mei 2026

## ⚠️ Kritieke tijdlijn

| Datum | Wat er gebeurt |
|-------|---------------|
| November 2025 | Nieuwe Canvas Portfolio tool beschikbaar voor alle instellingen |
| Januari 2026 | In-app meldingen in de oude tool: "migreer je inhoud" |
| **30 juni 2026** | **Oude ePortfolio tool wordt permanent verwijderd** |
| Na 30 juni 2026 | Alleen de nieuwe Canvas Portfolio tool beschikbaar |

**De oude ePortfolio wordt over ~40 dagen afgesloten** (vanaf 21 mei 2026).

---

## Bronnen

- https://sites.udel.edu/canvas/2025/10/canvas-current-native-portfolio-tool-retiring-june-30-2026/
- https://community.instructure.com/en/discussion/660793/introducing-canvas-portfolio-now-part-of-the-core-canvas-experience
- https://sites.gatech.edu/dlt-blog/2026/03/12/canvas-portfolio-transition-and-eportfolio-retirement/
- https://blogs.goucher.edu/knowledgebase/2026/01/09/canvas-portfolio-new-in-2026/
- https://helpdesk.findlay.edu/support/solutions/articles/13000117012-canvas-portfolio-transition-guide
- https://www.fgcu.edu/digitallearning/digital-learning-blog/portfolio-enhancements

---

## Wat is de nieuwe Canvas Portfolio?

Instructure heeft de oude ePortfolio vervangen door een volledig nieuwe tool die
direct in Canvas is ingebouwd. Er zijn twee typen:

### Evaluation Portfolios
- Gekoppeld aan Canvas cursussen en SpeedGrader
- Flexibele portfolio-assignments
- Bewijs koppelen aan competenties en vaardigheden
- Ondersteuning voor programma-assessment over meerdere cursussen

### Showcase Portfolios
- Studenten verzamelen en reflecteren op hun werk
- Combinatie van cursuswerk, activiteiten en persoonlijke projecten
- Veilig delen of exporteren na afstuderen

---

## API-status van de nieuwe tool

De nieuwe Canvas Portfolio heeft **op dit moment geen gedocumenteerde publieke API**.
De zoekresultaten en documentatie vermelden geen REST of GraphQL endpoints voor de
nieuwe tool. Dit kan betekenen:

1. De API is nog niet beschikbaar (tool is recent, november 2025)
2. De API wordt via de bestaande Canvas REST API uitgebreid (nog niet gepubliceerd)
3. De tool werkt voorlopig alleen via de browser-interface

---

## Implicaties voor dit project

De interne routes die we onderzocht hebben (`/eportfolios/...`) horen bij
de **oude tool** die op 30 juni 2026 verdwijnt. Code die we nu bouwen voor
die routes is dus over ~40 dagen mogelijk niet meer bruikbaar.

### Aanbevolen koers

| Optie | Risico | Aanbeveling |
|-------|--------|-------------|
| Interne routes oude ePortfolio bouwen | ❌ Hoog — verdwijnt 30 juni 2026 | Niet doen |
| Wachten op nieuwe Canvas Portfolio API | ⚠️ Middel — tijdlijn onbekend | Volgen |
| Playwright/browser automatisering | ✅ Laag — werkt ongeacht API | Beste keuze voor nu |
| Read-only MCP server verder uitbreiden | ✅ Geen risico | Veiligste optie |

### Wat nu te doen

1. **Controleer** of jouw school al de nieuwe Canvas Portfolio tool beschikbaar heeft
2. **Exporteer** je inhoud uit de oude ePortfolio vóór 30 juni 2026
3. **Volg** de Instructure Developer Portal voor nieuwe API-aankondigingen
4. **Gebruik** in de tussentijd Playwright MCP voor portfolio-automatisering via de browser

---

## Hoe de nieuwe tool eruitziet (functioneel)

Gebaseerd op beschikbare documentatie:
- Geïntegreerd in Canvas navigatie (geen apart account-menu meer)
- Studenten kunnen evidence aan cursussen koppelen
- Docenten kunnen portfolio-assignments aanmaken in SpeedGrader
- Export mogelijk voor gebruik na school
- Geen aparte "snapshot" meer — submissie werkt direct via de opdracht
