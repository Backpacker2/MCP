# Bezochte bronnen — Canvas API onderzoek

Datum: 21 mei 2026
Onderwerp: Canvas API write-mogelijkheden met een student access token

---

## Officiële Canvas documentatie

| URL | Beschrijving | Status tijdens onderzoek |
|-----|-------------|------------------------|
| https://canvas.instructure.com/doc/api/ | Canvas REST API hoofdpagina | 503 Service Unavailable |
| https://canvas.instructure.com/doc/api/e_portfolios.html | ePortfolio API endpoints | 503 Service Unavailable |
| https://canvas.instructure.com/doc/api/file.file_uploads.html | Bestandsupload workflow | 503 Service Unavailable |
| https://www.canvas.instructure.com/doc/api/pages.html | Pages API | 503 Service Unavailable |
| https://www.canvas.instructure.com/doc/api/all_resources.html | Alle API resources | 503 Service Unavailable |
| https://www.canvas.instructure.com/doc/api/submissions.html | Submissions API | 503 Service Unavailable |

> Noot: de officiële Canvas docs draaide op 503 tijdens het onderzoek.
> Alle informatie is geverifieerd via mirrors en de developer portal.

---

## Instructure Developer Portal (werkte wel)

| URL | Beschrijving | Status |
|-----|-------------|--------|
| https://developerdocs.instructure.com/services/canvas/resources/e_portfolios | ePortfolio endpoints developer portal | ✅ Beschikbaar |
| https://developerdocs.instructure.com/services/canvas/resources/submissions | Submissions API developer portal | ✅ Beschikbaar |
| https://developerdocs.instructure.com/services/canvas/basics/file.file_uploads | Bestandsupload workflow developer portal | ✅ Beschikbaar |
| https://developerdocs.instructure.com/services/canvas/resources/pages | Pages API developer portal | ✅ Gedeeltelijk (student-rechten niet expliciet gedocumenteerd) |

---

## GitHub — Canvas broncode

| URL | Beschrijving | Status |
|-----|-------------|--------|
| https://github.com/instructure/canvas-lms/blob/master/app/controllers/eportfolios_api_controller.rb | Ruby controller voor ePortfolio API — toont alle routes en rechten | ✅ Beschikbaar |
| https://github.com/instructure/canvas-lms/blob/master/doc/api/jwt_access_tokens.md | JWT access tokens documentatie | Gevonden via zoekresultaat |

---

## University mirrors van Canvas docs

| URL | Beschrijving | Status |
|-----|-------------|--------|
| https://bcourses.berkeley.edu/doc/api/pages.html | Berkeley mirror van Pages API — volledig beschikbaar | ✅ Beschikbaar — uitgebreide info over editing_roles |
| https://lms.au.af.edu/doc/api/submissions.html | Air Force University mirror van Submissions API | Gevonden via zoekresultaat |
| https://canvas.krsu.kg/doc/api/submissions.html | Kyrgyzstan University mirror | Gevonden via zoekresultaat |
| https://lms.au.af.edu/doc/api/all_resources.html | Air Force University — alle resources | Gevonden via zoekresultaat |

---

## Canvas Community / Instructure Community

| URL | Beschrijving | Status |
|-----|-------------|--------|
| https://community.canvaslms.com/t5/Canvas-Developers-Group/Student-access-token-privileges/td-p/119560 | Discussie over student token rechten | Redirect naar community.instructure.com → 503 |
| https://community.instructure.com/t5/Canvas-Developers-Group/Student-access-token-privileges/td-p/119560 | Zelfde discussie na redirect | 503 Service Unavailable |
| https://community.canvaslms.com/t5/Developers-Group/Canvas-APIs-Getting-started-the-practical-ins-and-outs-gotchas/ba-p/263685 | Praktische API gids voor developers | Gevonden via zoekresultaat |
| https://community.canvaslms.com/t5/Developers-Group/Submit-Assignment-via-API/m-p/112982 | Discussie: opdracht inleveren via API | Redirect naar community.instructure.com |
| https://community.instructure.com/t5/Developers-Group/Submit-Assignment-via-API/m-p/112982 | Zelfde na redirect | 503 Service Unavailable |
| https://community.canvaslms.com/t5/Student-Guide/How-do-I-manage-API-access-tokens-as-a-student/ta-p/273 | Student guide voor tokens | Gevonden via zoekresultaat |
| https://community.canvaslms.com/t5/Canvas-Question-Forum/Im-a-student-and-I-generated-an-access-token-Im-having-issues/m-p/655340 | Student met 403-problemen | Redirect → 503 |
| https://community.canvaslms.com/t5/Canvas-Basics-Guide/How-do-I-create-a-new-page-in-my-ePortfolio-section/ta-p/616173 | Handleiding ePortfolio pagina aanmaken (via browser) | Gevonden via zoekresultaat |

---

## Universiteits- en instituutsbeleid pagina's

| URL | Beschrijving | Status |
|-----|-------------|--------|
| https://itconnect.uw.edu/tools-services-support/teaching-learning/canvas/canvas-policies/integration-development-data-access/api-access-tokens/ | University of Washington — Canvas API token beleid | Gevonden via zoekresultaat |
| https://learn.canvas.cornell.edu/canvas-api-access-tokens/ | Cornell University — Canvas API tokens | Gevonden via zoekresultaat |
| https://lms.tamu.edu/support/canvas-api | Texas A&M University — Canvas API beleid | Gevonden via zoekresultaat |
| https://lms.unimelb.edu.au/staff/guides/canvas/administration-of-the-lms/canvas-access-tokens | University of Melbourne — Canvas tokens | Gevonden via zoekresultaat |
| https://support.cmts.jhu.edu/hc/en-us/articles/37824528760717-Canvas-API-Quickstart-Guide-for-Instructors | Johns Hopkins — API quickstart voor docenten | Gevonden via zoekresultaat |

---

## Overige tools en bibliotheken

| URL | Beschrijving |
|-----|-------------|
| https://canvasapi.readthedocs.io/en/stable/canvas-ref.html | Python canvasapi bibliotheek documentatie |
| https://pypi.org/project/canvas-lms-api/ | canvas-lms-api Python pakket op PyPI |
| https://github.com/KTH/canvas-api | Node.js Canvas API client van KTH Stockholm |
| https://cwickham.github.io/cnvs/ | R package voor Canvas API |

---

## Zoekopdrachten uitgevoerd

1. `Canvas LMS REST API ePortfolio endpoints PUT POST write operations 2024`
2. `Canvas LMS API submissions create file upload pages update REST API reference`
3. `Canvas API eportfolio pages create update PUT POST body parameters student access token`
4. `Canvas LMS student token API write permissions what can students do POST PUT pages submissions eportfolio`
5. `Canvas API student token "submit assignment" "online_upload" file upload submission steps curl example`
