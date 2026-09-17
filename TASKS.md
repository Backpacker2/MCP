# Tasks

## Active


## Waiting On

## Someday

- [ ] **Canvas Inbox berichten sturen** - bericht sturen met expliciete gebruikersbevestiging (roadmap "Later")
- [ ] **Opdracht inleveren via MCP** - `POST .../submissions` met bevestigingsmechanisme (roadmap "Later")
- [ ] **Security check rapport (v3)** - automatische rapportage van beveiligingsinstellingen
- [ ] **ePortfolio write-acties** - Bearer token werkt niet voor interne routes; buiten scope zolang FHICT de API uitgeschakeld heeft

## Done

- [x] ~~Caching toevoegen~~ (3 sep 2026)
- [x] ~~Weekoverzicht genereren~~ (3 sep 2026)
- [x] ~~Voortgangsrapportage per cursus~~ (3 sep 2026)
- [x] ~~Deadline-burndown~~ (3 sep 2026)
- [x] ~~canvas_list_eportfolios en canvas_get_eportfolio_pages~~ (3 sep 2026)
- [x] ~~canvas_list_inbox en canvas_get_conversation~~ (3 sep 2026)
- [x] ~~Cursus-specifiek aankondigingen endpoint~~ (3 sep 2026)
- [x] ~~Verlopen vs. toekomstige openstaande opdrachten splitsen in voortgangsrapport~~ (3 sep 2026)
- [x] ~~`canvas_list_pages` fallback via module-items~~ (17 sep 2026) — vindt nu 27 pagina's via modules
- [x] ~~`canvas_list_files` vriendelijke 403-melding~~ (17 sep 2026)
- [x] ~~`canvas_list_eportfolios` vriendelijke foutafhandeling~~ (17 sep 2026)
- [x] ~~Rate-limit retry logic (exponential backoff bij 429)~~ — was al geïmplementeerd in canvasClient.ts
- [x] ~~FeedPulse rechten uitzoeken~~ (17 sep 2026) — is `fhict.feedpulse.com`, geen publieke REST API; alleen via LTI-iframe bereikbaar
- [x] ~~Portflow onderzoeken~~ (17 sep 2026) — is "Portfolio" van Drieam (`portfolio.drieam.app`), geen publieke REST API
- [x] ~~`canvas_course_overview` toevoegen~~ (17 sep 2026) — alle modules + items in één aanroep, 9 modules/39 items/2823 tekens
- [x] ~~`canvas_get_portfolio_evidence` toevoegen~~ (17 sep 2026) — beoordeelde indieningen + cursuspagina's per module

---

## Onderzoeksresultaten (17 sep 2026)

### Werkt ✅
| Tool | Resultaat |
|------|-----------|
| `canvas_list_courses` | 3 cursussen (15807, 16040, 15470) |
| `canvas_list_assignments` | 6 opdrachten in cursus 16040 |
| `canvas_upcoming_deadlines` (planner) | 10 items |
| `canvas_get_announcements` | 10 mededelingen |
| `canvas_list_modules` | 9 modules, werkt op alle 3 cursussen |
| `canvas_get_module_items` | werkt, geeft page_url + type terug |
| `canvas_get_page_content` (via URL) | werkt — directe URL ophalen werkt wél |
| `canvas_list_submissions` | 6 indieningen, met grade + state |
| `canvas_list_discussions` | werkt (0 items in deze cursus) |
| `canvas_calendar_events` | werkt (0 events) |
| `canvas_list_inbox` | werkt (0 berichten) |
| `canvas_enrollments` | werkt (cijfers zijn null — geen numerieke beoordeling) |

### Werkt niet ❌
| Tool | Fout | Oorzaak |
|------|------|---------|
| `canvas_list_pages` | 404: "disabled for this course" | Pages-feature uitgeschakeld door docent/FHICT, alle 3 cursussen |
| `canvas_list_files` | 403 Forbidden | Student-token heeft geen bestandenlijst-toegang bij FHICT |
| `canvas_list_eportfolios` | 404 HTML pagina | FHICT heeft ePortfolio API uitgeschakeld |

### Externe tools (LTI)
- **FeedPulse**: aanwezig als cursus-tab (LTI ID 1067), maar géén Canvas REST API — extern platform
- **Portflow**: niet gevonden als Canvas-tab in de 3 cursussen — extern platform, los van Canvas
