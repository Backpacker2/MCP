# Canvas Bestandsupload — Drie-stappen Proces

## Bronnen

- https://developerdocs.instructure.com/services/canvas/basics/file.file_uploads — developer portal (werkte)
- https://canvas.instructure.com/doc/api/file.file_uploads.html — officiële docs (503 tijdens onderzoek)
- http://www.humandesigncollege.org/doc/api/file.file_uploads.html — mirror

---

## Overzicht

Canvas gebruikt een **drie-stappen upload-proces** voor alle bestandsuploads.
Dit geldt zowel voor submissions als voor uploads naar je eigen bestandsruimte.
De stappen moeten snel na elkaar uitgevoerd worden — de upload-URL verloopt.

---

## Stap 1 — Bestand registreren bij Canvas

**Doel:** Canvas reserveert ruimte en geeft een ondertekende upload-URL terug.

### Voor een submission-bestand:
```http
POST /api/v1/courses/:course_id/assignments/:assignment_id/submissions/self/files
Authorization: Bearer <student-token>
Content-Type: application/json

{
  "name": "portfolio.pdf",
  "size": 2048000,
  "content_type": "application/pdf"
}
```

### Voor een bestand in je eigen Canvas-opslag:
```http
POST /api/v1/users/self/files
Authorization: Bearer <student-token>

{
  "name": "portfolio.pdf",
  "size": 2048000,
  "content_type": "application/pdf",
  "parent_folder_path": "my_files/portfolio"
}
```

### Parameters stap 1

| Parameter | Type | Verplicht | Beschrijving |
|-----------|------|-----------|-------------|
| `name` | string | ✅ Ja | Bestandsnaam inclusief extensie |
| `size` | integer | Aanbevolen | Grootte in bytes |
| `content_type` | string | Nee | MIME-type (bijv. `application/pdf`) |
| `parent_folder_id` | integer | Nee | Map-ID (alternatief voor path) |
| `parent_folder_path` | string | Nee | Mappad (bijv. `my_files/portfolio`) |
| `on_duplicate` | string | Nee | `"overwrite"` of `"rename"` (standaard: overwrite) |

### Antwoord stap 1

```json
{
  "upload_url": "https://s3.amazonaws.com/...",
  "upload_params": {
    "key": "/users/42/files/portfolio.pdf",
    "AWSAccessKeyId": "...",
    "acl": "private",
    "Policy": "...",
    "Signature": "...",
    "Content-Type": "application/pdf"
  }
}
```

---

## Stap 2 — Bestand uploaden naar de upload-URL

**Doel:** het bestand zelf versturen. Let op: **geen Authorization-header** in deze stap.

```http
POST <upload_url uit stap 1>
Content-Type: multipart/form-data

[alle upload_params als form-velden]
file=@portfolio.pdf   ← het bestand zelf, altijd als laatste veld
```

**Kritieke regels:**
- Alle `upload_params` moeten exact worden meegestuurd — geen toevoegingen, geen weglating
- De `file` parameter moet als **laatste** worden toegevoegd
- Geen Authorization-header (de URL is al ondertekend)

### Antwoord stap 2

Canvas stuurt een **3xx redirect** of een **201 Created** terug.
Bij een 3xx redirect moet je de `Location`-header volgen — mét je Authorization-header.

---

## Stap 3 — Upload bevestigen

**Doel:** Canvas bevestigt de upload en geeft het `file_id` terug.

```http
GET <Location-header uit stap 2>
Authorization: Bearer <student-token>
```

### Antwoord stap 3

```json
{
  "id": 99999,
  "uuid": "abc123",
  "folder_id": 456,
  "display_name": "portfolio.pdf",
  "filename": "portfolio.pdf",
  "content-type": "application/pdf",
  "size": 2048000,
  "created_at": "2026-05-21T10:15:00Z",
  "url": "https://school.instructure.com/files/99999/download"
}
```

Het `id` (hier `99999`) gebruik je in stap 3 van de submission als `file_ids[]`.

---

## Upload via publieke URL (alternatief)

Als het bestand al online staat, kan Canvas het zelf downloaden:

```http
POST /api/v1/users/self/files
Authorization: Bearer <student-token>

{
  "name": "portfolio.pdf",
  "url": "https://mijn-site.nl/portfolio.pdf"
}
```

Canvas downloadt asynchroon. Je kunt de voortgang volgen via de Progress API
(`/api/v1/progress/:id`).

---

## Veelvoorkomende fouten

| Fout | Oorzaak | Oplossing |
|------|---------|-----------|
| `SignatureDoesNotMatch` | Upload-params gewijzigd in stap 2 | Stuur exact de params mee zoals ontvangen |
| `403 Forbidden` | Upload-URL verlopen | Herhaal vanaf stap 1 |
| `Quota exceeded` | Bestandsruimte vol | Verwijder bestanden of vraag meer ruimte |
| `422 Unprocessable` | Bestandstype niet toegestaan | Controleer opdracht-instellingen |
| Redirect niet gevolgd | Stap 3 overgeslagen | Volg altijd de 3xx redirect met Authorization-header |
