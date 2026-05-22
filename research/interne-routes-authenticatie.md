# Canvas Interne Routes — Authenticatie en Beperkingen

Datum: 21 mei 2026

## Bronnen

- https://raw.githubusercontent.com/instructure/canvas-lms/master/lib/authentication_methods.rb
- https://raw.githubusercontent.com/instructure/canvas-lms/master/app/controllers/application_controller.rb
- https://raw.githubusercontent.com/instructure/canvas-lms/master/app/models/eportfolio_entry.rb
- https://raw.githubusercontent.com/instructure/canvas-lms/master/app/controllers/eportfolios_controller.rb
- https://raw.githubusercontent.com/instructure/canvas-lms/master/app/controllers/eportfolio_entries_controller.rb
- https://raw.githubusercontent.com/instructure/canvas-lms/master/app/controllers/eportfolio_categories_controller.rb
- https://raw.githubusercontent.com/instructure/canvas-lms/master/config/routes.rb

---

## Kritieke bevinding: Bearer tokens werken NIET voor interne routes

Canvas detecteert API-requests via deze exacte code:

```ruby
API_REQUEST_REGEX = %r{\A/api/}

def api_request?
  @api_request ||= !!request.path.match(API_REQUEST_REGEX)
end
```

En de token-authenticatie laadt alleen een gebruiker als:

```ruby
return unless api_request? || tokens_allowed
```

**Conclusie:** Een Bearer token (`Authorization: Bearer <token>`) wordt alleen
geaccepteerd op routes die beginnen met `/api/`. De interne ePortfolio routes
(`/eportfolios/...`) beginnen daar niet mee — dus een Bearer token geeft daar
een 401 of redirect naar de loginpagina, geen 403.

---

## Wat wél werkt: sessie-gebaseerde authenticatie

De interne routes werken met de normale browser-sessie:
- Een sessie-cookie (`_normandy_session` of vergelijkbaar)
- Een CSRF-token (`X-CSRF-Token` header of `authenticity_token` in de body)

Deze krijg je automatisch als je ingelogd bent in de browser. Via Playwright
of Puppeteer (die verbinding maken met een bestaande browser-sessie) zijn
beide aanwezig zonder extra stappen.

---

## CSRF-bescherming op interne routes

Canvas gebruikt:

```ruby
protect_from_forgery with: :exception
```

Dit betekent: elke POST, PUT, DELETE op een interne route vereist een
geldig CSRF-token. Zonder dit token gooit Canvas een
`ActionController::InvalidAuthenticityToken` exception (HTTP 422).

Het CSRF-token is op te halen via:
```
GET /api/v1/users/self   → response header: X-CSRF-Token
of
GET /eportfolios         → HTML <meta name="csrf-token" content="...">
```

---

## Volledige parameter-structuur voor entries bijwerken

```http
PUT /eportfolios/:eportfolio_id/entries/:entry_id
Cookie: <sessie-cookie>
X-CSRF-Token: <csrf-token>
Content-Type: application/x-www-form-urlencoded

section_count=2
section_1[section_type]=rich_text
section_1[content]=<h1>Mijn portfolio</h1><p>Projectbeschrijving</p>
section_2[section_type]=attachment
section_2[attachment_id]=99999
```

### Section types

| Type | Inhoud | Extra veld |
|------|--------|-----------|
| `rich_text` | HTML (gesaniteerd) | `content` |
| `html` | Ruwe HTML (gesaniteerd) | `content` |
| `submission` | Link naar eigen submission | `submission_id` |
| `attachment` | Bestand uit eigen Canvas-opslag | `attachment_id` |

---

## Toegestane parameters per controller

### Portfolio (`eportfolios_controller`)
- `eportfolio[name]` — naam van het portfolio
- `eportfolio[public]` — boolean: publiek of privé

### Pagina/entry (`eportfolio_entries_controller`)
- `name` — naam van de pagina
- `allow_comments` — boolean
- `show_comments` — boolean
- `section_count` + `section_X[...]` — inhoud (via `parse_content()`)

### Map/categorie (`eportfolio_categories_controller`)
- `name` — naam van de map

---

## Samenvatting: wanneer werkt welke aanpak?

| Aanpak | Werkt voor interne routes? | Reden |
|--------|--------------------------|-------|
| Bearer token alleen | ❌ | Niet-API route, token wordt genegeerd |
| Sessie-cookie + CSRF | ✅ | Standaard browser-authenticatie |
| Playwright via CDP | ✅ | Gebruikt bestaande browser-sessie automatisch |
| HTTP client met cookie + CSRF | ✅ | Mogelijk maar complex — token ophalen, CSRF ophalen, dan request |
