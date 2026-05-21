# Canvas API — Onderzoeksnotities

Onderzoek uitgevoerd op 21 mei 2026 naar de mogelijkheden van de Canvas REST API
voor het aanpassen van een portfolio via een student access token.

## Bestanden in deze map

| Bestand | Inhoud |
|---------|--------|
| `eportfolio-api.md` | Canvas ePortfolio API — endpoints, beperkingen, bronnen |
| `pages-api.md` | Canvas Pages API — volledige CRUD, rechten per rol |
| `submissions-api.md` | Opdrachten inleveren via API — stappen en parameters |
| `file-upload.md` | Bestandsupload workflow — drie-stappen proces |
| `student-token-permissions.md` | Wat een student-token wel en niet kan |
| `bronnen.md` | Alle bezochte URLs met beschrijving en status |

## Kernbevinding

Met een student access token is **opdrachten inleveren (submissions) volledig mogelijk**
via de API, inclusief bestandsupload. De Canvas ePortfolio-tool is via de REST API
**niet aanpasbaar** — die interface leeft buiten het standaard REST-systeem.
Cursuspagina's bewerken kan alleen als de docent dat expliciet toestaat.
