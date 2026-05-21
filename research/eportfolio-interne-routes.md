# Canvas ePortfolio — Interne Routes (niet-REST)

Datum: 21 mei 2026
Conclusie: er bestaan interne server-routes voor ePortfolio-bewerkingen die wél
schrijven toestaan — maar dit zijn geen standaard REST API endpoints.

## Bronnen

- https://github.com/instructure/canvas-lms/blob/master/app/controllers/eportfolios_controller.rb
- https://github.com/instructure/canvas-lms/blob/master/app/controllers/eportfolio_entries_controller.rb
- https://github.com/instructure/canvas-lms/blob/master/app/models/eportfolio_entry.rb
- https://github.com/instructure/canvas-lms/blob/master/config/routes.rb

---

## Kernbevinding

De Canvas REST API (`/api/v1/eportfolios/...`) heeft geen write-endpoints voor inhoud.
Maar Canvas heeft ook een **aparte interne controller** (`EportfoliosController`, zonder
`/api/v1/` prefix) die wél schrijfacties ondersteunt. Dit zijn de routes die de
Canvas-browser-interface zelf gebruikt.

---

## Beschikbare interne routes

### Portfolio zelf

| Methode | Route | Actie |
|---------|-------|-------|
| `POST` | `/eportfolios` | Nieuw portfolio aanmaken |
| `PUT` | `/eportfolios/:id` | Portfolio bijwerken (naam, zichtbaarheid) |
| `DELETE` | `/eportfolios/:id` | Portfolio verwijderen |
| `POST` | `/eportfolios/:id/reorder_categories` | Mappen herordenen |

### Pagina's (entries)

| Methode | Route | Actie |
|---------|-------|-------|
| `POST` | `/eportfolios/:eportfolio_id/entries` | Nieuwe pagina aanmaken |
| `PUT` | `/eportfolios/:eportfolio_id/entries/:id` | Pagina-inhoud bijwerken |
| `DELETE` | `/eportfolios/:eportfolio_id/entries/:id` | Pagina verwijderen |
| `GET` | `/eportfolios/:eportfolio_id/entries/:id` | Pagina ophalen |

### Mappen (categories/sections)

| Methode | Route | Actie |
|---------|-------|-------|
| `POST` | `/eportfolios/:eportfolio_id/categories` | Nieuwe map aanmaken |
| `PUT` | `/eportfolios/:eportfolio_id/categories/:id` | Map bijwerken |
| `DELETE` | `/eportfolios/:eportfolio_id/categories/:id` | Map verwijderen |

### Bestanden

| Methode | Route | Actie |
|---------|-------|-------|
| `GET` | `/eportfolios/:eportfolio_id/entries/:entry_id/files/:attachment_id` | Bestand ophalen |

---

## Hoe pagina-inhoud bijwerken werkt — de parse_content() methode

De `PUT /eportfolios/:id/entries/:id` route verwerkt content via een `parse_content()`
methode. Pagina's in Canvas bestaan uit genummerde secties:

```
PUT /eportfolios/123/entries/456
Content-Type: application/x-www-form-urlencoded

section_count=2
section_1[section_type]=rich_text
section_1[content]=<h1>Mijn project</h1><p>Beschrijving hier.</p>
section_2[section_type]=attachment
section_2[attachment_id]=99999
```

### Section types

| Type | Wat het is |
|------|-----------|
| `rich_text` | Opgemaakte tekst (HTML) |
| `html` | Ruwe HTML |
| `submission` | Link naar een ingediende opdracht |
| `attachment` | Bestand dat al in Canvas staat |

Canvas sanitized de HTML-inhoud automatisch bij opslaan.

---

## Authenticatie

Deze interne routes gebruiken `authorized_action()` — dezelfde authenticatie als
de browser-sessie. Ze werken met:
- Een actieve sessie-cookie (als je ingelogd bent in de browser)
- Een student access token als Bearer header

Dit betekent: **jouw student-token kan deze routes aanroepen**.

---

## Snapshot — geen API endpoint

De "snapshot" functie (een versie van je portfolio opslaan om in te leveren) heeft
**geen eigen server-side endpoint**. De snapshot-logica zit in de JavaScript-client.
Waarschijnlijk wordt een snapshot gemaakt via een combinatie van:
1. De huidige portfolio-status vastleggen (client-side)
2. Een submission aanmaken via de standaard Submissions API

Er is geen `EportfolioSnapshotsController` in de Canvas broncode gevonden.

---

## Conclusie

| Actie | Mogelijk via student-token? |
|-------|---------------------------|
| Nieuw portfolio aanmaken | ✅ Via interne route |
| Map aanmaken | ✅ Via interne route |
| Pagina aanmaken | ✅ Via interne route |
| Pagina-inhoud bewerken | ✅ Via interne route + parse_content() |
| Bestand koppelen aan pagina | ✅ Via attachment_id in sectie |
| Snapshot maken | ❌ Geen server-side endpoint gevonden |
| Snapshot inleveren als submission | ⚠️ Mogelijk via Submissions API |
