# Automatisering

> **Belangrijk:** In versie 1 mag Claude alleen lezen, rapporten maken en suggesties opslaan als bestanden. Claude mag niets automatisch aanpassen in Canvas. Alle output is read-only.

---

## Deadlines rapport

| Eigenschap | Beschrijving |
|-----------|-------------|
| **Doel** | Overzicht van alle aankomende deadlines, gesorteerd op datum |
| **Trigger** | Handmatig of dagelijks |
| **Input** | `canvas_get_upcoming_deadlines` |
| **Output** | `reports/deadlines-<datum>.md` |
| **Risico** | Laag — alleen lezen en opslaan |
| **Menselijke controle** | Niet vereist voor het genereren, wel voor acties |

**Voorbeeldvraag aan Claude:**
> "Maak een overzicht van al mijn aankomende deadlines en sla het op als deadlines-rapport."

---

## Nieuwe mededelingen samenvatten

| Eigenschap | Beschrijving |
|-----------|-------------|
| **Doel** | Samenvatting van nieuwe Canvas-mededelingen per cursus |
| **Trigger** | Handmatig, bijv. elke ochtend |
| **Input** | `canvas_list_courses` + `canvas_get_announcements` per cursus |
| **Output** | `reports/mededelingen-<datum>.md` |
| **Risico** | Laag |
| **Menselijke controle** | Niet vereist |

**Voorbeeldvraag:**
> "Zijn er nieuwe mededelingen van vandaag? Vat ze samen."

---

## Open opdrachten overzicht

| Eigenschap | Beschrijving |
|-----------|-------------|
| **Doel** | Welke opdrachten staan er nog open (niet ingeleverd)? |
| **Trigger** | Handmatig |
| **Input** | `canvas_list_courses` + `canvas_list_assignments` per cursus |
| **Output** | `reports/open-opdrachten-<datum>.md` |
| **Risico** | Laag |
| **Menselijke controle** | Niet vereist |

**Voorbeeldvraag:**
> "Welke opdrachten moet ik nog inleveren? Maak er een lijst van."

---

## Projectdocumentatie check

| Eigenschap | Beschrijving |
|-----------|-------------|
| **Doel** | Controleer of de projectdocumentatie compleet is aan de hand van Canvas-opdrachten |
| **Trigger** | Handmatig voor inleverdeadline |
| **Input** | `canvas_get_assignment_details` + bestandssysteem (lokale bestanden) |
| **Output** | `reports/doc-check-<datum>.md` met ontbrekende onderdelen |
| **Risico** | Laag |
| **Menselijke controle** | Ja — gebruiker bepaalt of actie nodig is |

---

## Code review rapport

| Eigenschap | Beschrijving |
|-----------|-------------|
| **Doel** | Claude reviewt je code aan de hand van de opdrachtomschrijving uit Canvas |
| **Trigger** | Handmatig vóór inleveren |
| **Input** | `canvas_get_assignment_details` + lokale broncode |
| **Output** | `reports/code-review-<datum>.md` |
| **Risico** | Laag |
| **Menselijke controle** | Ja — gebruiker beslist wat hij aanpast |

---

## Security check rapport

| Eigenschap | Beschrijving |
|-----------|-------------|
| **Doel** | Controleer of tokens of gevoelige data niet in code of logs staan |
| **Trigger** | Handmatig vóór GitHub push |
| **Input** | Lokale bestanden + `.gitignore` controle |
| **Output** | `reports/security-check-<datum>.md` |
| **Risico** | Laag |
| **Menselijke controle** | Ja — gebruiker keurt goed voor push |

---

## Portfolio evidence suggesties

| Eigenschap | Beschrijving |
|-----------|-------------|
| **Doel** | Claude suggereert welke Canvas-opdrachten als portfolio-bewijs kunnen dienen |
| **Trigger** | Handmatig |
| **Input** | `canvas_list_assignments` + `canvas_get_assignment_details` |
| **Output** | `reports/portfolio-suggesties-<datum>.md` |
| **Risico** | Laag |
| **Menselijke controle** | Ja — gebruiker kiest wat in portfolio gaat |

---

## Planning voor morgen

| Eigenschap | Beschrijving |
|-----------|-------------|
| **Doel** | Overzicht van wat er morgen op de planning staat |
| **Trigger** | Handmatig, bijv. elke avond |
| **Input** | `canvas_get_upcoming_deadlines` |
| **Output** | Tekst in chat of `reports/planning-morgen.md` |
| **Risico** | Laag |
| **Menselijke controle** | Niet vereist |

**Voorbeeldvraag:**
> "Wat staat er morgen op mijn Canvas-planning? Geef me een overzicht."

---

## Notities

- Alle rapporten worden lokaal opgeslagen als Markdown bestanden
- Claude schrijft nooit direct terug naar Canvas
- De `reports/` map kan worden toegevoegd aan `.gitignore` als je rapporten privé wilt houden
- In versie 3 kan Claude rapporten automatisch genereren op basis van een schedule
