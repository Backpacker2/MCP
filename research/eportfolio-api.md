# Canvas ePortfolio API

## Bronnen

- https://canvas.instructure.com/doc/api/e_portfolios.html — officiële docs (503 tijdens onderzoek)
- https://developerdocs.instructure.com/services/canvas/resources/e_portfolios — developer portal (werkte wel)
- https://github.com/instructure/canvas-lms/blob/master/app/controllers/eportfolios_api_controller.rb — broncode controller

---

## Beschikbare endpoints

| HTTP methode | Endpoint | Wat het doet | Vereiste rechten |
|-------------|----------|-------------|-----------------|
| `GET` | `/api/v1/users/:user_id/eportfolios` | Alle ePortfolios van een gebruiker ophalen | Eigen account, of `moderate_user_content` voor andermans portfolio |
| `GET` | `/api/v1/eportfolios/:id` | Details van één ePortfolio | `read` op het portfolio |
| `DELETE` | `/api/v1/eportfolios/:id` | Portfolio als verwijderd markeren | `delete` op het portfolio |
| `GET` | `/api/v1/eportfolios/:eportfolio_id/pages` | Pagina's van het portfolio ophalen | `read` op het portfolio |
| `PUT` | `/api/v1/eportfolios/:eportfolio_id/moderate` | Spam-status bijwerken | `moderate_user_content` (admin only) |
| `PUT` | `/api/v1/users/:user_id/eportfolios` | Alle portfolio's van een gebruiker modereren | `moderate_user_content` (admin only) |
| `PUT` | `/api/v1/eportfolios/:eportfolio_id/restore` | Verwijderd portfolio herstellen | `moderate_user_content` (admin only) |

## ePortfolio object — velden

```json
{
  "id": 1,
  "user_id": 123,
  "name": "Mijn Portfolio",
  "public": false,
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-05-01T00:00:00Z",
  "workflow_state": "active",
  "deleted_at": null
}
```

`workflow_state` is altijd `"active"` of `"deleted"`.

## Wat ontbreekt — en waarom dat belangrijk is

Er is **geen `POST` endpoint** om een nieuw ePortfolio aan te maken via de REST API.
Er is **geen `PUT` endpoint** om de inhoud van een ePortfolio-pagina te bewerken.

De ePortfolio-editor in Canvas werkt via een aparte Rails-interface (`/eportfolios/...`)
die niet via de standaard JSON REST API bereikbaar is. Dit is een bewuste keuze van
Instructure — de ePortfolio feature is ouder dan de REST API en is nooit volledig
gemigreerd naar REST.

## Conclusie voor student-token

Een student kan via de API:
- Eigen ePortfolios **uitlezen** ✅
- Eigen ePortfolios **verwijderen** ✅ (opgelet: onomkeerbaar)
- Pagina's van eigen portfolio **uitlezen** ✅

Een student kan via de API **niet**:
- Een nieuw ePortfolio aanmaken ❌
- Pagina-inhoud aanpassen ❌
- Secties of pagina's toevoegen ❌
