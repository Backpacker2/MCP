# Canvas Pages API

## Bronnen

- https://www.canvas.instructure.com/doc/api/pages.html — officiële docs (503 tijdens onderzoek)
- https://bcourses.berkeley.edu/doc/api/pages.html — Berkeley mirror, volledig beschikbaar
- https://developerdocs.instructure.com/services/canvas/resources/pages — developer portal

---

## Alle endpoints

### GET — Lezen

| Endpoint | Wat het doet | Parameters |
|----------|-------------|------------|
| `GET /api/v1/courses/:course_id/pages` | Lijst van alle pagina's in een cursus | `sort` (title/created_at/updated_at), `order` (asc/desc), `search_term`, `published`, `include[]=body` |
| `GET /api/v1/courses/:course_id/pages/:url_or_id` | Eén pagina ophalen | — |
| `GET /api/v1/courses/:course_id/front_page` | De voorpagina van de cursus | — |
| `GET /api/v1/courses/:course_id/pages/:url_or_id/revisions` | Revisiegeschiedenis | Vereist update-rechten op de pagina |
| `GET /api/v1/courses/:course_id/pages/:url_or_id/revisions/latest` | Laatste revisie | `summary` (boolean) |

### POST — Aanmaken

| Endpoint | Wat het doet | Parameters |
|----------|-------------|------------|
| `POST /api/v1/courses/:course_id/pages` | Nieuwe pagina aanmaken | `wiki_page[title]` (verplicht), `wiki_page[body]`, `wiki_page[editing_roles]`, `wiki_page[notify_of_update]`, `wiki_page[published]`, `wiki_page[front_page]`, `wiki_page[publish_at]` |
| `POST /api/v1/courses/:course_id/pages/:url_or_id/duplicate` | Pagina dupliceren | — |
| `POST /api/v1/courses/:course_id/pages/:url_or_id/revisions/:revision_id` | Revisie terugdraaien | `revision_id` (verplicht) |

### PUT — Bijwerken

| Endpoint | Wat het doet | Parameters |
|----------|-------------|------------|
| `PUT /api/v1/courses/:course_id/pages/:url_or_id` | Pagina bijwerken | Dezelfde als POST, plus `wiki_page[publish_at]` |
| `PUT /api/v1/courses/:course_id/front_page` | Voorpagina bijwerken | `wiki_page[title]`, `wiki_page[body]`, `wiki_page[editing_roles]`, `wiki_page[notify_of_update]`, `wiki_page[published]` |

### DELETE

| Endpoint | Wat het doet |
|----------|-------------|
| `DELETE /api/v1/courses/:course_id/pages/:url_or_id` | Pagina verwijderen |

---

## editing_roles — wie mag een pagina bewerken?

Dit is de cruciale instelling die bepaalt of een student via de API een pagina kan aanpassen:

| Waarde | Wie mag bewerken |
|--------|----------------|
| `teachers` | Alleen docenten (standaard) |
| `students` | Studenten én docenten |
| `members` | Groepsleden (alleen in groepswiki's) |
| `public` | Iedereen, ook niet-ingelogd |

De docent stelt dit in per pagina. Als `editing_roles` niet `students` bevat,
krijgt een student altijd een **403 Forbidden** bij een PUT of POST.

---

## Rechten voor studenten — samenvatting

| Actie | Student kan dit? | Voorwaarde |
|-------|-----------------|------------|
| Pagina's uitlezen (GET) | ✅ Altijd | Pagina moet gepubliceerd zijn |
| Pagina aanmaken (POST) | ⚠️ Soms | Alleen als cursus-instelling dit toestaat |
| Pagina bewerken (PUT) | ⚠️ Soms | Alleen als `editing_roles` de student toestaat |
| Pagina verwijderen (DELETE) | ❌ Nooit | Alleen docenten |
| Revisiegeschiedenis zien | ⚠️ Soms | Vereist update-rechten |

---

## Voorbeeld: pagina bijwerken als student

```http
PUT /api/v1/courses/1234/pages/mijn-portfolio-pagina
Authorization: Bearer <student-token>
Content-Type: application/json

{
  "wiki_page": {
    "body": "<h1>Portfolio update</h1><p>Nieuw project toegevoegd.</p>"
  }
}
```

**Verwacht resultaat als `editing_roles=students`:** 200 OK met bijgewerkt pagina-object
**Verwacht resultaat als `editing_roles=teachers`:** 403 Forbidden

---

## Notitie over groepspagina's

Dezelfde endpoints bestaan ook voor groepen:
- `GET /api/v1/groups/:group_id/pages`
- `PUT /api/v1/groups/:group_id/pages/:url_or_id`

In groepen hebben leden standaard meer schrijfrechten dan in cursussen.
Als jouw portfolio een groeps-wiki is, is de kans groter dat aanpassen werkt.
