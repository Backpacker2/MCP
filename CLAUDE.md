# Canvas Claude MCP — Projectgeheugen

## Wat is dit project?

Een MCP server die Claude toegang geeft tot Canvas LMS via de Canvas REST API. Claude kan hiermee een student helpen door Canvas-data uit te lezen én op termijn het ePortfolio te begrijpen en aan te passen.

## Uiteindelijk doel

Claude heeft volledig inzicht in de studie van de student (cursussen, opdrachten, cijfers, feedback, mededelingen) én toegang tot het ePortfolio in Canvas. Daarmee kan Claude:
- Vragen beantwoorden over deadlines, opdrachten, cijfers
- Het ePortfolio begrijpen in de context van de volledige studie
- Het ePortfolio aanpassen op verzoek ("voeg bewijs van competentie X toe op basis van opdracht Y")

## Fasering

### Fase 1 — Veiligheid + volledig uitlezen (huidige fase)
Alles wat leesbaar is via de Canvas REST API implementeren, inclusief goede testdekking en beveiliging. Geen schrijfacties.

**Al geïmplementeerd:**
- `canvas_list_courses`
- `canvas_list_assignments`
- `canvas_get_assignment_details`
- `canvas_get_upcoming_deadlines`
- `canvas_get_announcements`
- `canvas_list_modules`
- `canvas_list_pages`

**Nog te implementeren (fase 1):**
- Pagina-inhoud ophalen (`canvas_get_page_content`)
- Module-items ophalen (`canvas_get_module_items`)
- Eigen indieningen bekijken (`canvas_get_my_submission`)
- Cijfers en feedback lezen
- Bestanden lijst per cursus
- Kalender events
- Discussies lezen
- Canvas Inbox berichten lezen
- ePortfolio uitlezen

**Veiligheid & stabiliteit (fase 1):**
- Rate-limit retry logic bij 429-fouten (exponential backoff)
- Tests aanvullen voor modules, pages en announcements
- Unit tests voor pagination.ts

### Fase 2 — Meer Canvas data + context opbouwen
Cijfers, feedback, submissions, bestanden en kalender volledig beschikbaar maken zodat Claude een compleet beeld heeft van de studie.

### Fase 3 — ePortfolio schrijven
Canvas ePortfolio aanpassen op verzoek van de student. Schrijfacties altijd met expliciete bevestiging. Browser-automatisering is onderzocht als fallback wanneer de Canvas ePortfolio API te beperkt is.

## Technische architectuur

```
Student (chat)
   ↕
Claude (AI)
   ↕ MCP protocol via stdio
canvas-claude-mcp (deze server, TypeScript)
   ↕ HTTPS REST API
Canvas LMS (school)
```

- **Transport:** stdio (MCP SDK)
- **HTTP client:** axios met Bearer token auth
- **Paginering:** Canvas Link-header (`rel="next"`) via `src/pagination.ts`
- **Foutafhandeling:** `CanvasApiError` en `CanvasConfigError` in `src/errors.ts`
- **Config:** `CANVAS_BASE_URL` en `CANVAS_ACCESS_TOKEN` via `.env`

## Veiligheidsregels

- Altijd volledig read-only in fase 1 — geen POST/PUT/PATCH/DELETE
- Canvas token nooit in code, logs of Git — alleen in `.env`
- `.env` staat in `.gitignore` en wordt nooit gecommit
- Write-acties (fase 3+) vereisen altijd expliciete gebruikersbevestiging

## GitHub issues (open taken)

- #2 — Tests aanvullen voor modules, pages en announcements
- #3 — `canvas_get_page_content` implementeren
- #4 — `canvas_get_module_items` implementeren
- #5 — Unit tests voor pagination.ts
- #6 — Rate-limit retry logic toevoegen
- #7 — `canvas_get_my_submission` implementeren

## Research bestanden

Relevant onderzoek staat in `/research/`:
- `eportfolio-api.md` — Canvas ePortfolio API mogelijkheden
- `eportfolio-interne-routes.md` — interne Canvas routes als API-alternatief
- `canvas-portfolio-nieuw.md` — nieuw Canvas portfolio systeem
- `browser-automatisering.md` — browser automation als fallback voor ePortfolio
- `submissions-api.md` — submissions API (al onderzocht, nog niet geïmplementeerd)
- `file-upload.md` — bestand uploaden via API
- `student-token-permissions.md` — wat een student-token wel/niet mag
