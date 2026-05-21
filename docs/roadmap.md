# Roadmap

## Versie 1 — Read-only basis *(nu)*

**Doel:** Veilig Canvas uitlezen via Claude.

| Onderdeel | Waarde | Moeilijkheid | Risico | Tools nodig | Bewijs voor school |
|-----------|--------|-------------|--------|-------------|-------------------|
| `canvas_list_courses` | Hoog | Laag | Laag | MCP SDK, axios | Ja — toont technisch begrip |
| `canvas_list_assignments` | Hoog | Laag | Laag | MCP SDK, axios | Ja |
| `canvas_get_assignment_details` | Hoog | Laag | Laag | MCP SDK, axios | Ja |
| `canvas_get_upcoming_deadlines` | Hoog | Middel | Laag | MCP SDK, axios | Ja |
| `canvas_get_announcements` | Middel | Laag | Laag | MCP SDK, axios | Ja |
| `canvas_list_modules` | Middel | Laag | Laag | MCP SDK, axios | Ja |
| `canvas_list_pages` | Middel | Laag | Laag | MCP SDK, axios | Ja |
| Documentatie & testplan | Hoog | Middel | Laag | — | Ja — professioneel portfolio |

---

## Versie 2 — Meer Canvas onderdelen uitlezen

**Doel:** Dieper inzicht in cursusinhoud en eigen voortgang.

| Onderdeel | Waarde | Moeilijkheid | Risico | Tools nodig |
|-----------|--------|-------------|--------|-------------|
| Module-items ophalen | Middel | Laag | Laag | Bestaande client |
| Bestanden lijst per cursus | Middel | Laag | Laag | Bestaande client |
| Bestand metadata (niet downloaden) | Middel | Laag | Laag | Bestaande client |
| Eigen indieningen/submissions uitlezen | Hoog | Middel | Middel | Bestaande client |
| Feedback op eigen indieningen | Hoog | Middel | Middel | Bestaande client |
| Cijfers uitlezen | Hoog | Middel | Middel | Bestaande client |
| Kalender events | Middel | Laag | Laag | Bestaande client |
| Discussies uitlezen | Laag | Laag | Laag | Bestaande client |
| Pagina-inhoud ophalen | Middel | Laag | Laag | cleanHtml utility |

---

## Versie 3 — Planning en rapportages

**Doel:** Claude helpt actief met plannen en overzicht houden.

| Onderdeel | Waarde | Moeilijkheid | Risico | Output |
|-----------|--------|-------------|--------|--------|
| Weekoverzicht genereren | Hoog | Middel | Laag | Markdown rapport |
| Deadline-burndown berekenen | Middel | Middel | Laag | Rapport bestand |
| Automatisch deadlines rapport | Hoog | Middel | Laag | Bestand in project |
| Portfolio evidence suggesties | Hoog | Hoog | Laag | Markdown suggesties |
| Security check rapport | Middel | Middel | Laag | Rapport bestand |
| Voortgangsrapportage per cursus | Hoog | Hoog | Laag | Rapport bestand |

---

## Later — Veilige write-acties met menselijke goedkeuring

> ⚠️ Write-acties worden pas toegevoegd als er een bevestigingsmechanisme is. Claude voert nooit automatisch een write-actie uit.

| Onderdeel | Waarde | Moeilijkheid | Risico | Vereiste goedkeuring |
|-----------|--------|-------------|--------|---------------------|
| Opdracht inleveren (bevestigd) | Hoog | Hoog | Hoog | Expliciete gebruikersbevestiging |
| Canvas Inbox berichten lezen | Middel | Laag | Laag | — (read only) |
| Bericht sturen (bevestigd) | Middel | Hoog | Hoog | Expliciete gebruikersbevestiging |
| Kalender event aanmaken (bevestigd) | Middel | Middel | Middel | Expliciete gebruikersbevestiging |

---

## Aandachtspunten per versie

- Versie 2: Voeg rate-limit retry logic toe (exponential backoff)
- Versie 2: Overweeg caching van cursuslijst (verandert zelden)
- Versie 3: Gebruik `fs` om rapporten als bestanden op te slaan
- Later: Nooit een write-actie zonder `confirmation: true` parameter in de tool
