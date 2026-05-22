# Canvas API Map

## Overzicht van Canvas API endpoints

| Canvas onderdeel | Endpoint | MCP tool | Read/Write | Prioriteit | Risico | Versie |
|-----------------|----------|----------|------------|------------|--------|--------|
| Cursuslijst | `GET /api/v1/courses` | `canvas_list_courses` | Read | Hoog | Laag | v1 |
| Opdrachtenlijst | `GET /api/v1/courses/:id/assignments` | `canvas_list_assignments` | Read | Hoog | Laag | v1 |
| Opdrachtdetails | `GET /api/v1/courses/:id/assignments/:id` | `canvas_get_assignment_details` | Read | Hoog | Laag | v1 |
| Planner items | `GET /api/v1/planner/items` | `canvas_get_upcoming_deadlines` | Read | Hoog | Laag | v1 |
| Mededelingen | `GET /api/v1/announcements` | `canvas_get_announcements` | Read | Hoog | Laag | v1 |
| Modules | `GET /api/v1/courses/:id/modules` | `canvas_list_modules` | Read | Hoog | Laag | v1 |
| Pagina's | `GET /api/v1/courses/:id/pages` | `canvas_list_pages` | Read | Hoog | Laag | v1 |
| Module items | `GET /api/v1/courses/:id/modules/:id/items` | — | Read | Middel | Laag | v2 |
| Bestanden | `GET /api/v1/courses/:id/files` | — | Read | Middel | Middel | v2 |
| Bestand downloaden | `GET /api/v1/files/:id/download` | — | Read | Laag | Middel | v2 |
| Inschrijvingen | `GET /api/v1/courses/:id/enrollments` | — | Read | Laag | Laag | v2 |
| Kalender events | `GET /api/v1/calendar_events` | — | Read | Middel | Laag | v2 |
| Cijfers/scores | `GET /api/v1/courses/:id/students/submissions` | — | Read | Middel | Middel | v2 |
| Submission feedback | `GET /api/v1/courses/:id/assignments/:id/submissions/:id` | — | Read | Middel | Middel | v2 |
| Discussies | `GET /api/v1/courses/:id/discussion_topics` | — | Read | Laag | Laag | v2 |
| Quiz informatie | `GET /api/v1/courses/:id/quizzes` | — | Read | Laag | Laag | v3 |

## Buiten scope voor versie 1 (write-acties)

> ⚠️ De onderstaande acties **wijzigen Canvas**. Ze zijn bewust buiten scope gehouden voor versie 1.

| Actie | Endpoint | Reden buiten scope |
|-------|----------|-------------------|
| Opdracht inleveren | `POST /api/v1/courses/:id/assignments/:id/submissions` | Write — vereist menselijke bevestiging |
| Bericht sturen (Inbox) | `POST /api/v1/conversations` | Write — kan niet ongedaan worden gemaakt |
| Bestand uploaden | `POST /api/v1/courses/:id/files` | Write — vereist menselijke bevestiging |
| Bestand verwijderen | `DELETE /api/v1/files/:id` | Destructief |
| Discussiebericht plaatsen | `POST /api/v1/courses/:id/discussion_topics/:id/entries` | Write |
| Profiel aanpassen | `PUT /api/v1/users/:id` | Write |
| Kalender event aanmaken | `POST /api/v1/calendar_events` | Write |

## Notities over pagination

Canvas retourneert standaard 10 items per pagina. De `pagination.ts` helper volgt de `Link: <url>; rel="next"` header automatisch totdat alle pagina's opgehaald zijn. Gebruik altijd `per_page=100` om het aantal API-calls te minimaliseren.

## Notities over Canvas API versioning

Alle endpoints gebruiken `/api/v1/`. Canvas heeft deze versie al jaren stabiel gehouden. Controleer de [Canvas API Changelog](https://canvas.instructure.com/doc/api/changelog.html) voor updates.
