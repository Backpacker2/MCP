# MCP Tools Documentatie

## canvas_list_courses

| Eigenschap | Waarde |
|-----------|--------|
| **Tool name** | `canvas_list_courses` |
| **Doel** | Haal alle actieve Canvas cursussen op waarvoor je ingeschreven bent |
| **Canvas endpoint** | `GET /api/v1/courses?enrollment_state=active` |
| **Input** | Geen |
| **Output** | Lijst met course ID, naam en cursusCode |
| **Risico** | Laag — alleen lezen |
| **Versie 1** | ✅ Ja |

**Voorbeeldvraag:**
> "Welke cursussen volg ik op Canvas?"

**Voorbeeldantwoord Claude:**
> Je hebt op dit moment 4 actieve cursussen op Canvas: Informatica (INF1, ID 1234), Wiskunde A (WIS1, ID 1235), Nederlands (NED1, ID 1236) en Engels (ENG1, ID 1237).

---

## canvas_list_assignments

| Eigenschap | Waarde |
|-----------|--------|
| **Tool name** | `canvas_list_assignments` |
| **Doel** | Haal alle opdrachten op voor een specifieke cursus |
| **Canvas endpoint** | `GET /api/v1/courses/:courseId/assignments` |
| **Input** | `courseId` (string, verplicht) |
| **Output** | Lijst met assignment ID, naam, deadline en punten |
| **Risico** | Laag — alleen lezen |
| **Versie 1** | ✅ Ja |

**Voorbeeldvraag:**
> "Welke opdrachten heb ik voor Informatica (cursus 1234)?"

**Voorbeeldantwoord Claude:**
> Voor Informatica zijn er 3 opdrachten: Opdracht 1 (deadline: maandag 2 juni, 10 punten), Portfolio (deadline: vrijdag 20 juni, 30 punten) en Eindpresentatie (deadline: woensdag 2 juli, 20 punten).

---

## canvas_get_assignment_details

| Eigenschap | Waarde |
|-----------|--------|
| **Tool name** | `canvas_get_assignment_details` |
| **Doel** | Haal de volledige details op van één opdracht |
| **Canvas endpoint** | `GET /api/v1/courses/:courseId/assignments/:assignmentId` |
| **Input** | `courseId` (string, verplicht), `assignmentId` (string, verplicht) |
| **Output** | Naam, deadline, punten, inlevertype, beschrijving, link |
| **Risico** | Laag — alleen lezen |
| **Versie 1** | ✅ Ja |

**Voorbeeldvraag:**
> "Wat staat er precies in opdracht 5678 van cursus 1234?"

**Voorbeeldantwoord Claude:**
> Opdracht "Portfolio versie 1" vraagt je om een portfolio samen te stellen met minstens 3 werkstukken. De deadline is vrijdag 20 juni om 23:59. Je kunt een PDF of ZIP uploaden. De opdracht is 30 punten waard.

---

## canvas_get_upcoming_deadlines

| Eigenschap | Waarde |
|-----------|--------|
| **Tool name** | `canvas_get_upcoming_deadlines` |
| **Doel** | Haal de aankomende deadlines op uit de Canvas planner |
| **Canvas endpoint** | `GET /api/v1/planner/items?start_date=<nu>` |
| **Input** | Geen |
| **Output** | Lijst van aankomende items gesorteerd op datum |
| **Risico** | Laag — alleen lezen |
| **Versie 1** | ✅ Ja |

**Voorbeeldvraag:**
> "Wat zijn mijn aankomende deadlines deze week?"

**Voorbeeldantwoord Claude:**
> Je hebt deze week 2 deadlines: dinsdag 3 juni — Wiskunde toets (Wiskunde A) en vrijdag 6 juni — Opdracht 1 inleveren (Informatica, al ingeleverd ✓).

---

## canvas_get_announcements

| Eigenschap | Waarde |
|-----------|--------|
| **Tool name** | `canvas_get_announcements` |
| **Doel** | Haal recente mededelingen op voor een cursus |
| **Canvas endpoint** | `GET /api/v1/announcements?context_codes[]=course_:courseId` |
| **Input** | `courseId` (string, verplicht) |
| **Output** | Lijst van mededelingen met titel, datum, auteur en tekst |
| **Risico** | Laag — alleen lezen |
| **Versie 1** | ✅ Ja |

**Voorbeeldvraag:**
> "Zijn er nieuwe mededelingen voor cursus 1234?"

**Voorbeeldantwoord Claude:**
> Er zijn 2 recente mededelingen voor Informatica. De docent heeft gisteren geplaatst dat de deadline van Opdracht 1 met een week verlengd is. Vorige week stond er een mededeling over de wijziging van het lokaal voor de presentaties.

---

## canvas_list_modules

| Eigenschap | Waarde |
|-----------|--------|
| **Tool name** | `canvas_list_modules` |
| **Doel** | Haal de modules op voor een cursus |
| **Canvas endpoint** | `GET /api/v1/courses/:courseId/modules` |
| **Input** | `courseId` (string, verplicht) |
| **Output** | Lijst van modules met naam, positie en aantal items |
| **Risico** | Laag — alleen lezen |
| **Versie 1** | ✅ Ja |

**Voorbeeldvraag:**
> "Hoe is cursus 1234 ingedeeld in modules?"

**Voorbeeldantwoord Claude:**
> Cursus Informatica heeft 4 modules: Week 1 - Introductie (5 items), Week 2 - Algoritmen (8 items), Week 3 - Datastructuren (6 items) en Week 4 - Project (3 items).

---

## canvas_list_pages

| Eigenschap | Waarde |
|-----------|--------|
| **Tool name** | `canvas_list_pages` |
| **Doel** | Haal de gepubliceerde pagina's op voor een cursus |
| **Canvas endpoint** | `GET /api/v1/courses/:courseId/pages` |
| **Input** | `courseId` (string, verplicht) |
| **Output** | Lijst van pagina's met titel, slug en datum laatste update |
| **Risico** | Laag — alleen lezen |
| **Versie 1** | ✅ Ja |

**Voorbeeldvraag:**
> "Welke informatiepagina's zijn er beschikbaar voor cursus 1234?"

**Voorbeeldantwoord Claude:**
> Cursus Informatica heeft 3 gepubliceerde pagina's: Cursushandleiding (bijgewerkt 1 september), Beoordelingscriteria (bijgewerkt 3 september) en Softwareinstallatie (bijgewerkt 5 september).

---

## canvas_get_planner_items *(versie 2)*

| Eigenschap | Waarde |
|-----------|--------|
| **Tool name** | `canvas_get_planner_items` |
| **Doel** | Uitgebreide plannerweergave met filters op datum en cursus |
| **Canvas endpoint** | `GET /api/v1/planner/items` |
| **Input** | `startDate`, `endDate`, `courseId` (optioneel) |
| **Output** | Gefilterde planneritems |
| **Risico** | Laag |
| **Versie 1** | ❌ Gepland voor v2 |
