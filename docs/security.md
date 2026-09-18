# Security

Dit document beschrijft de **werkafspraken**: hoe je met tokens omgaat en wat je
controleert voordat code de deur uit gaat.

Voor de **risicoanalyse** — wat er concreet mis kan gaan, wat daartegen is
gedaan en welk restrisico blijft bestaan — zie [`gevaren.md`](gevaren.md).

## Waarom tokens geheim moeten blijven

Een Canvas Access Token geeft volledige toegang tot je Canvas account — alles wat jij zelf kunt doen, kan ook met dit token. Als iemand anders jouw token heeft, kunnen ze:

- Al je cursusinformatie lezen
- Opdrachten inleveren namens jou
- Berichten sturen namens jou
- Bestanden uploaden of verwijderen

**Behandel een Canvas token als een wachtwoord.**

## Waarom .env niet in Git mag

Git bewaart de volledige history van bestanden. Als je een token één keer commit, blijft het zichtbaar in de git log — ook als je het bestand later verwijdert. Iedereen met toegang tot de repository kan het token terugvinden.

Regels:
- `.env` staat altijd in `.gitignore`
- `.env.example` bevat alleen placeholders (`<CANVAS_ACCESS_TOKEN>`)
- Nooit een echte token in code, documentatie, logs of comments

## Waarom de server standaard read-only draait

Write-acties hebben onomkeerbare gevolgen (een portfolio is ingeleverd, een
bericht is verstuurd). Daarom staan ze standaard uit.

> **Let op — dit is veranderd.** Een eerdere versie van dit document stelde dat
> de server uitsluitend GET-requests doet. Dat klopt niet meer sinds
> `portflow_submit_snapshot` is toegevoegd: dat is een POST die werk inlevert
> bij een Canvas-opdracht. De bescherming zit nu niet meer in "er zijn geen
> write-acties", maar in twee sloten eromheen.

**Slot 1 — de kill-switch.** Write-acties werken alleen als
`CANVAS_ALLOW_WRITES=true` in je omgeving staat. Standaard staat hij uit en
weigert de server onvoorwaardelijk. Bij het opstarten meldt de server in welke
modus hij draait, zodat je het niet per ongeluk aan laat staan.

**Slot 2 — bevestiging op naam.** Inleveren vereist dat de exacte naam van het
snapshot wordt meegegeven via `bevestigNaam`. Die moet letterlijk overeenkomen
met wat er in Portflow staat. Het model moet het snapshot dus eerst opzoeken en
aan jou tonen voordat er iets kan gebeuren.

Waarom twee sloten en niet één: alles wat deze server teruggeeft — discussies,
inbox, paginateksten — is tekst die iemand anders heeft geschreven en die een
instructie voor het model kan bevatten. Zie gevaar 6 in
[`gevaren.md`](gevaren.md).

## Welke acties menselijke toestemming vereisen

De volgende acties mogen **nooit automatisch** gebeuren, dus ook niet omdat het
model het een goed idee vond of omdat het ergens in cursustekst stond:

- Een portfolio of opdracht inleveren
- Berichten sturen
- Bestanden uploaden of verwijderen
- Canvas-instellingen aanpassen
- Inschrijvingen wijzigen

Van deze lijst is alleen inleveren technisch mogelijk, en alleen achter de twee
sloten hierboven. De rest is niet geïmplementeerd.

## Wat wel en niet in scope is

**Wel — lezen:** cursussen, opdrachten, pagina's, modules, bestanden-lijsten,
discussies, aankondigingen, agenda, planner, inleveringen en cijfers, groepen,
eportfolio's, Portflow-snapshots, en de Canvas Inbox (`canvas_list_inbox`,
`canvas_get_conversation`).

> Een eerdere versie noemde de Inbox buiten scope. Lezen is inmiddels wel
> geïmplementeerd. Berichten *versturen* is dat niet.

**Wel — schrijven, achter twee sloten:** `portflow_submit_snapshot`.

**Niet:** berichten versturen, bestanden uploaden of verwijderen, opdrachten
aanmaken, kalender-items aanmaken, profielwijzigingen, en elke andere PUT,
PATCH of DELETE.

Houd er rekening mee dat het Canvas-token zelf géén read-only token is: Canvas
biedt die niet. Er is dus geen technische garantie dat het token niet meer kán
dan dit — alleen dat deze code niet meer doet.

## Wat te doen als een token per ongeluk gedeeld is

1. Ga direct naar **Canvas → Account → Instellingen → Toegangstokens**
2. Verwijder het gelekte token onmiddellijk
3. Genereer een nieuw token
4. Update je `.env` bestand met het nieuwe token
5. Controleer of het token ergens anders opgeslagen is (clipboard, logs, chat)
6. Als je het token in een GitHub-commit hebt gezet: verwijder de commit history of maak de repo private en neem contact op met GitHub support

## Checklist veilig testen

- [ ] `.env` staat in `.gitignore` en is nooit gecommit
- [ ] `.env` heeft rechten 600 (`chmod 600 .env`) — anders leest elk proces op je machine je token
- [ ] `CANVAS_BASE_URL` begint met `https://` (de server weigert nu iets anders, maar controleer het bewust)
- [ ] `CANVAS_ALLOW_WRITES` staat uit, tenzij je op dit moment bewust iets inlevert
- [ ] Token is alleen aanwezig in `.env` (nooit in code)
- [ ] MCP Inspector wordt alleen lokaal gebruikt
- [ ] Je test met een testaccount als dat mogelijk is
- [ ] Je controleert logs op onbedoelde token-output (alles gaat door `redact()` in `src/utils/redact.ts`)

## Checklist voordat code naar GitHub gaat

- [ ] Voer `git diff HEAD` uit — staat er een token in?
- [ ] Staat `.env` in `.gitignore`?
- [ ] Bevat `.env.example` alleen `<CANVAS_ACCESS_TOKEN>` en nooit een echte waarde?
- [ ] Staat er nergens een token in README, docs, comments of testbestanden?
- [ ] Zijn alle `console.log` statements die headers of tokens kunnen bevatten verwijderd?
- [ ] Draait `npm run build` zonder fouten?
- [ ] Draaien tests zonder echte Canvas-verbinding (mocks)?
- [ ] Geeft `npm audit` nog steeds 0 kwetsbaarheden?
- [ ] Draaien de beveiligingstests (`npx jest tests/security.test.ts`) groen?

## Token aanmaken in Canvas

1. Log in op Canvas
2. Ga naar **Account → Instellingen**
3. Scroll naar **Toegangstokens**
4. Klik **Token toevoegen**
5. Geef een duidelijke naam: `canvas-claude-mcp-lokaal`
6. Stel eventueel een vervaldatum in
7. Kopieer het token direct — het wordt maar één keer getoond
8. Plak het in `.env` als `CANVAS_ACCESS_TOKEN=<jouw token>`
