# Student Token — Rechten en Beperkingen

## Bronnen

- https://itconnect.uw.edu/tools-services-support/teaching-learning/canvas/canvas-policies/integration-development-data-access/api-access-tokens/ — UW-IT uitleg over Canvas tokens
- https://learn.canvas.cornell.edu/canvas-api-access-tokens/ — Cornell University uitleg
- https://community.canvaslms.com/t5/Student-Guide/How-do-I-manage-API-access-tokens-as-a-student/ta-p/273 — officiële Canvas student guide
- https://community.instructure.com/t5/Canvas-Developers-Group/Student-access-token-privileges/td-p/119560 — community discussie (503 tijdens onderzoek)

---

## De kernregel

> Een student access token heeft exact dezelfde rechten als de student heeft
> wanneer die zelf inlogt op Canvas via de browser. Niet meer, niet minder.

Dit betekent: als je iets niet kunt doen in de Canvas web-interface, kun je het
ook niet via de API doen met jouw token. De API is alleen een andere manier om
hetzelfde te doen — geen manier om rechten te omzeilen.

---

## Wat een student-token wél kan

### Lezen (GET) — altijd toegestaan

| Endpoint | Wat |
|----------|-----|
| `/api/v1/courses` | Eigen cursussen |
| `/api/v1/courses/:id/assignments` | Opdrachten per cursus |
| `/api/v1/courses/:id/assignments/:id` | Opdrachtdetails |
| `/api/v1/planner/items` | Planner/deadlines |
| `/api/v1/announcements` | Mededelingen |
| `/api/v1/courses/:id/modules` | Modules |
| `/api/v1/courses/:id/pages` | Gepubliceerde pagina's |
| `/api/v1/users/self` | Eigen profiel |
| `/api/v1/users/self/files` | Eigen bestanden |
| `/api/v1/users/:id/eportfolios` | Eigen ePortfolios |
| `/api/v1/courses/:id/assignments/:id/submissions/self` | Eigen submissions |

### Schrijven (POST/PUT) — beperkt toegestaan

| Actie | Endpoint | Voorwaarde |
|-------|----------|------------|
| Bestand uploaden naar eigen opslag | `POST /api/v1/users/self/files` | Altijd |
| Submission-bestand uploaden (stap 1) | `POST .../submissions/self/files` | Actieve inschrijving |
| Opdracht inleveren | `POST .../submissions` | Actieve inschrijving, deadline niet verstreken |
| Tekst inleveren | `POST .../submissions` (type: `online_text_entry`) | Zelfde |
| URL inleveren | `POST .../submissions` (type: `online_url`) | Zelfde |
| Pagina bewerken | `PUT /api/v1/courses/:id/pages/:url` | Alleen als docent `editing_roles=students` heeft ingesteld |
| Submission-commentaar toevoegen | `PUT .../submissions/:id` | Alleen op eigen submission |

---

## Wat een student-token niet kan

| Actie | Waarom niet |
|-------|------------|
| Cijfers aanpassen | Docent-recht vereist |
| Cursuspagina's aanmaken (standaard) | Teacher-recht vereist |
| Andere studenten' submissions zien | Privacy — alleen eigen submissions |
| ePortfolio aanmaken via API | Endpoint bestaat niet in REST API |
| ePortfolio-inhoud bewerken via API | Endpoint bestaat niet in REST API |
| Cursussen aanmaken of aanpassen | Admin-recht vereist |
| Gebruikers aanmaken | Admin-recht vereist |
| Inschrijvingen aanpassen | Admin/docent-recht vereist |
| Submission intrekken | Niet mogelijk via API |
| Bestanden van de cursus verwijderen | Docent-recht vereist |
| ePortfolio modereren (spam-status) | Admin-recht vereist |

---

## Wat er gebeurt bij een verboden actie

Canvas retourneert:

```json
HTTP 401 Unauthorized   → token ongeldig of verlopen
HTTP 403 Forbidden      → token geldig, maar geen rechten voor deze actie
HTTP 404 Not Found      → resource bestaat niet of je hebt geen leesrecht
```

Bij een 403 ziet de response er zo uit:

```json
{
  "status": "unauthorized",
  "errors": [
    { "message": "user not authorized to perform that action" }
  ]
}
```

---

## Token aanmaken als student

1. Log in op Canvas
2. Ga naar **Account → Instellingen**
3. Scroll naar **Toegangstokens**
4. Klik **Token toevoegen**
5. Geef een beschrijvende naam: `canvas-claude-mcp`
6. Stel eventueel een vervaldatum in (aanbevolen voor veiligheid)
7. Kopieer het token direct — het wordt maar één keer getoond

---

## Aanbeveling voor deze MCP server

Voor het portfolio-workflow zijn de relevante student-acties:

1. **`canvas_list_courses`** → courseId ophalen
2. **`canvas_list_assignments`** → assignmentId ophalen
3. **`canvas_get_assignment_details`** → controleren of het een `online_upload` opdracht is
4. *(toekomstig)* **`canvas_submit_assignment`** → in drie stappen indienen

Stap 4 vereist menselijke bevestiging voordat de API-aanroep plaatsvindt.
