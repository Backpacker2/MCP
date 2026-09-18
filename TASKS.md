# Tasks

## Active

- [x] ~~**`canvas_get_missing_submissions`**~~ ✅
- [x] ~~**`canvas_get_course_competencies`**~~ ✅ — 108 competenties in 4 niveaus (HBOI)
- [x] ~~**`canvas_get_course_homepage`**~~ ✅
- [x] ~~**`canvas_list_my_groups`**~~ ✅ — 5 groepen over 3 cursussen
- [x] ~~**`canvas_get_activity_stream`**~~ ✅ — 24 items
- [x] ~~**`canvas_get_todo`**~~ ✅ — 3 openstaande items
- [x] ~~**`canvas_get_submission_feedback`**~~ — overgeslagen, al gedekt door bestaande `canvas_get_submission`
- [x] ~~**`canvas_get_assignment_groups`**~~ ✅

- [x] ~~**Portflow MCP tools implementeren**~~ (17 sep 2026) — `portflow_list_snapshots`, `portflow_get_snapshot`, `portflow_submit_snapshot` + LTI auth module + Portflow API client
- [x] ~~**Portflow write-tools toevoegen**~~ (18 sep 2026) — `portflow_add_evidence` (bewijs aanmaken + koppelen), `portflow_update_collection` (description/subtitle/color bijwerken via sectie+collectienaam), PATCH/204-fix in client

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
- [x] ~~Portflow API onderzoeken~~ (17 sep 2026) — heeft WEL een REST API! Authenticatie via LTI 1.3 OIDC, Bearer JWT (8u geldig), endpoints voor snapshots, freeze en Canvas assessment submission gedocumenteerd
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
- **FeedPulse**: aanwezig als cursus-tab (LTI ID 1067), maar géén publieke REST API — extern platform
- **Portflow**: LTI tool ID 23360, `portfolio.drieam.app` — heeft WEL een REST API (zie onderzoek hieronder)

---

## Portflow API Onderzoek (17 sep 2026)

### Authenticatie
Portflow gebruikt LTI 1.3 (OIDC). De volgende flow werkt programmatisch:
1. `GET /api/v1/courses/{courseId}/external_tools/sessionless_launch?id=23360` → Canvas geeft session_token URL
2. `GET` die URL (met cookies) → HTML met LTI form (iss, login_hint, client_id, lti_message_hint etc.)
3. `POST portfolio.drieam.app/lti/open_id` met die form params → redirect naar Canvas `/api/lti/authorize`
4. Canvas redirects terug met HTML-form met `id_token` JWT
5. `POST portfolio.drieam.app/lti/launches` met `id_token` + `state` → Portflow rendert de SPA
6. De SPA HTML bevat `data-session="<JWT>"` — dit is het **Bearer token** voor alle API calls
7. JWT bevat: `current_launch_id`, `current_user_id: 8784`, `tenant: fhict_instructure_com` — verloopt in 8 uur

### Beschikbare API Endpoints
Base URL: `https://portfolio.drieam.app` | Header: `Authorization: Bearer <session_jwt>`

| Endpoint | Methode | Beschrijving |
|----------|---------|--------------|
| `/api/v1/users/current` | GET | Huidige gebruiker (id: 8784, name, lms_id) |
| `/api/v1/frozen-portfolios` | GET | Alle snapshots (17 stuks) |
| `/api/v1/frozen-portfolios/{id}` | GET | Snapshot details incl. `snapshot_code` |
| `/api/v1/frozen-portfolios/{id}` | DELETE | Snapshot verwijderen |
| `/api/v1/frozen-portfolios/{id}/assessment` | **POST** | **Snapshot inleveren bij Canvas assignment** |
| `/api/v1/frozen-portfolios/{id}/showcase` | POST/DELETE | Publieke showcase URL aan/uitzetten |
| `/api/v1/portfolios/{id}/freeze` | **POST** | **Nieuwe snapshot aanmaken** (body: JSON) |
| `/api/v1/portfolios/{id}/freeze-summary` | POST | Snapshot samenvatting aanmaken |
| `/api/v1/portfolios/{id}/sections` | GET/POST | Secties ophalen/aanmaken |
| `/api/v1/portfolios/{id}/sections/{id}` | PATCH/DELETE | Sectie bijwerken/verwijderen |
| `/api/v1/portfolios/{id}/collections/{id}/evidence` | GET | Bewijs in een collectie |
| `/api/v1/portfolios/{id}/portfolio-freezes/sections` | GET | Secties voor snapshot-selectie |

### Belangrijke Bevindingen
- **Assessment endpoint heeft GEEN body** — de Canvas-context (cursus + opdracht) zit in het JWT (via de LTI launch)
- **JWT moet per opdracht worden aangevraagd**: launch `external_tools/sessionless_launch?id=23360` vanuit de juiste cursus
- **Live portfolio ID** is nog niet gevonden (SPA laadt het via React context, niet via een directe /api endpoint)
- **Snapshots**: 17 aangemaakt, nieuwste: "Personal Project Pitch" (ID: 82998, code: SNAP8ZJPH9DB)

### Volgende Stap voor Implementatie
1. Sessionless launch uitvoeren vanuit de specifieke Canvas-opdracht (bijv. `assignment_id=275053`)
2. LTI flow afhandelen → Bearer JWT ophalen
3. `POST /api/v1/frozen-portfolios/{snapshotId}/assessment` → Canvas submission

**⚠️ Beperking**: de LTI JWT is 8 uur geldig — moet elke keer opnieuw worden aangevraagd via Canvas. Dit is complex om als MCP tool te implementeren (vereist multi-step LTI handshake + cookie state).
