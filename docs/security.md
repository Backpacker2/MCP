# Security

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

## Waarom versie 1 read-only is

Write-acties hebben onomkeerbare gevolgen (een bericht is verstuurd, een bestand is verwijderd). Door in versie 1 alleen GET-requests toe te staan:

- Kan Claude geen schade aanrichten, ook niet bij bugs
- Wordt het vertrouwen in het systeem opgebouwd
- Zijn de risico's minimaal bij testen en ontwikkeling

Write-acties worden pas toegevoegd als er een bevestigingsmechanisme is.

## Welke acties menselijke toestemming vereisen

De volgende acties mogen **nooit automatisch** uitgevoerd worden:

- Opdrachten inleveren
- Berichten sturen
- Bestanden uploaden of verwijderen
- Canvas-instellingen aanpassen
- Inschrijvingen wijzigen

Zelfs in toekomstige versies moet de gebruiker elke write-actie expliciet bevestigen.

## Wat buiten scope is voor versie 1

- POST, PUT, PATCH, DELETE requests
- Canvas Inbox (berichten)
- Submissions aanmaken
- Bestanden uploaden
- Kalender events aanmaken
- Profielwijzigingen

## Wat te doen als een token per ongeluk gedeeld is

1. Ga direct naar **Canvas → Account → Instellingen → Toegangstokens**
2. Verwijder het gelekte token onmiddellijk
3. Genereer een nieuw token
4. Update je `.env` bestand met het nieuwe token
5. Controleer of het token ergens anders opgeslagen is (clipboard, logs, chat)
6. Als je het token in een GitHub-commit hebt gezet: verwijder de commit history of maak de repo private en neem contact op met GitHub support

## Checklist veilig testen

- [ ] `.env` staat in `.gitignore` en is nooit gecommit
- [ ] Token is alleen aanwezig in `.env` (nooit in code)
- [ ] MCP Inspector wordt alleen lokaal gebruikt
- [ ] Canvas token heeft minimale rechten (alleen lezen)
- [ ] Je test met een testaccount als dat mogelijk is
- [ ] Je controleert logs op onbedoelde token-output (zie `canvasClient.ts`)

## Checklist voordat code naar GitHub gaat

- [ ] Voer `git diff HEAD` uit — staat er een token in?
- [ ] Staat `.env` in `.gitignore`?
- [ ] Bevat `.env.example` alleen `<CANVAS_ACCESS_TOKEN>` en nooit een echte waarde?
- [ ] Staat er nergens een token in README, docs, comments of testbestanden?
- [ ] Zijn alle `console.log` statements die headers of tokens kunnen bevatten verwijderd?
- [ ] Draait `npm run build` zonder fouten?
- [ ] Draaien tests zonder echte Canvas-verbinding (mocks)?

## Token aanmaken in Canvas

1. Log in op Canvas
2. Ga naar **Account → Instellingen**
3. Scroll naar **Toegangstokens**
4. Klik **Token toevoegen**
5. Geef een duidelijke naam: `canvas-claude-mcp-lokaal`
6. Stel eventueel een vervaldatum in
7. Kopieer het token direct — het wordt maar één keer getoond
8. Plak het in `.env` als `CANVAS_ACCESS_TOKEN=<jouw token>`
