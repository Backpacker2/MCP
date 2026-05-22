# Canvas Submissions API

## Bronnen

- https://developerdocs.instructure.com/services/canvas/resources/submissions — developer portal (werkte)
- https://lms.au.af.edu/doc/api/submissions.html — Air Force University mirror
- https://canvas.krsu.kg/doc/api/submissions.html — Kyrgyzstan University mirror
- https://community.instructure.com/t5/Developers-Group/Submit-Assignment-via-API/m-p/112982 — community discussie (503 tijdens onderzoek)

---

## Submission aanmaken — het kernendpoint voor studenten

```
POST /api/v1/courses/:course_id/assignments/:assignment_id/submissions
POST /api/v1/sections/:section_id/assignments/:assignment_id/submissions
```

**Vereiste:** student moet actief ingeschreven zijn in de cursus.
Verlopen of afgesloten inschrijvingen geven een 403.

### Parameters

| Parameter | Type | Verplicht | Beschrijving |
|-----------|------|-----------|-------------|
| `submission[submission_type]` | string | ✅ Ja | Type inlevering (zie hieronder) |
| `submission[body]` | string | Soms | HTML-tekst voor `online_text_entry` |
| `submission[url]` | string | Soms | URL voor `online_url` |
| `submission[file_ids][]` | integer | Soms | Eerder geüploade file IDs voor `online_upload` |
| `submission[media_comment_id]` | string | Soms | Media ID voor `media_recording` |
| `submission[media_comment_type]` | string | Soms | `audio` of `video` |
| `comment[text_comment]` | string | Nee | Optionele toelichting bij inlevering |
| `submission[group_comment]` | boolean | Nee | Commentaar naar hele groep sturen |

### Submission types

| Type | Wat het is |
|------|-----------|
| `online_text_entry` | Tekst direct in Canvas typen |
| `online_url` | Een URL inleveren |
| `online_upload` | Bestand(en) uploaden (meest gebruikt voor portfolio) |
| `media_recording` | Audio of video opname |
| `basic_lti_launch` | Via een externe tool (LTI) |
| `student_annotation` | Aantekeningen op een Canvas-document |

---

## Submission bijwerken

```
PUT /api/v1/courses/:course_id/assignments/:assignment_id/submissions/:user_id
```

**Opgelet:** studenten kunnen hiermee alleen commentaar toevoegen of rubric-items markeren als gelezen.
Cijfers aanpassen vereist docent-rechten.

---

## Submission ophalen

```
GET /api/v1/courses/:course_id/assignments/:assignment_id/submissions/self
GET /api/v1/courses/:course_id/assignments/:assignment_id/submissions/:user_id
```

Studenten kunnen alleen hun **eigen** submission opvragen, niet die van anderen.

---

## Voorbeeld: portfolio PDF inleveren

Na het uploaden van het bestand (zie `file-upload.md`) stuur je:

```http
POST /api/v1/courses/1234/assignments/5678/submissions
Authorization: Bearer <student-token>
Content-Type: application/json

{
  "submission": {
    "submission_type": "online_upload",
    "file_ids": [99999]
  },
  "comment": {
    "text_comment": "Hierbij mijn portfolio voor periode 3."
  }
}
```

### Verwacht antwoord (200 OK)

```json
{
  "id": 112233,
  "assignment_id": 5678,
  "user_id": 42,
  "submission_type": "online_upload",
  "submitted_at": "2026-05-21T10:30:00Z",
  "workflow_state": "submitted",
  "attachments": [
    {
      "id": 99999,
      "filename": "portfolio.pdf",
      "size": 2048000
    }
  ]
}
```

---

## Bekende beperkingen

| Beperking | Details |
|-----------|---------|
| Deadline | Weigert na deadline tenzij docent late submissions toestaat |
| Meerdere submissions | Canvas staat dit toe — de laatste telt. Geen waarschuwing. |
| Bestandstype | Opdracht-instelling bepaalt welke bestandstypen toegestaan zijn |
| Intrekken | Niet mogelijk via de API — eenmaal ingeleverd is ingeleverd |
| Groepsopdrachten | Bij groepsopdrachten levert één student in namens de groep |
