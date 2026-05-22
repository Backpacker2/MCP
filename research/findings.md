# Onderzoek: Claude Credits Reset SMS Alerts

## Overzicht

Dit document bevat alle bevindingen over het automatisch monitoren van Claude.ai usage
en het versturen van SMS-meldingen zodra credits weer op 100% staan.

---

## 1. Hoe Claude's usage/reset werkt

### Reset-mechanisme
- Claude Pro/Max: 5-uur sliding window (reset begint bij het eerste bericht in de sessie)
- Er is ook een 7-daags weeklijks limiet (ingevoerd augustus 2025)
- De reset-tijd varieert met 30-60 minuten door server-side verwerking

### Waar de usage zichtbaar is
- Web interface: `claude.ai/settings/usage`
- Toont huidig verbruikspercentage en geschatte reset-tijd
- Geen publieke API voor consumer-plannen (Pro/Max)

### Rate limit headers (alleen Anthropic API, niet web)
- `anthropic-ratelimit-requests-remaining`
- `anthropic-ratelimit-tokens-remaining`
- `anthropic-ratelimit-requests-reset`
- `anthropic-ratelimit-tokens-reset`
- **Belangrijk**: deze headers zijn ALLEEN beschikbaar via de developer API (api.anthropic.com),
  NIET via de claude.ai web interface

---

## 2. Methoden om usage uit te lezen

### 2A. Officiële API (niet beschikbaar voor consumenten)
- Anthropic Rate Limits API (gelanceerd april 2026) → alleen voor organisaties met Admin API key
- Consumer plans (Pro/Max) hebben GEEN toegang tot usage via API
- **Conclusie**: NIET geschikt voor ons doel

### 2B. Browser Scraping (claude.ai/settings/usage)
- **Methode**: Playwright of Puppeteer opent de pagina als ingelogde gebruiker
- **Data beschikbaar**: usage percentage, reset timestamp
- **Authenticatie**: session cookies opslaan na eenmalige login
- **Stabiliteit**: Matig - pagina-structuur kan veranderen
- **Risico**: Anthropic kan scraping blokkeren

### 2C. Netwerkrequests onderscheppen
- Claude.ai communiceert via GraphQL of REST met het Anthropic backend
- Via browser DevTools (Network tab) zijn XHR/Fetch requests zichtbaar
- Waarschijnlijk een verborgen `GET /api/account/usage` of vergelijkbaar endpoint
- Vereist dat je de session cookies/token meestuurt
- **Methode**: Playwright kan network requests onderscheppen

### 2D. Lokale opslag / Cookies
- Claude.ai slaat session token op als cookie (`__session` of vergelijkbaar)
- Dit token is nodig voor alle API calls
- Met dit token kunnen we direct hidden endpoints aanroepen

### 2E. Browser Extension (Tampermonkey/Chrome Extension)
- Meest betrouwbare methode: zit IN de browser, heeft toegang tot alle requests
- Kan de usage-data direct uit de DOM lezen
- Stuurt melding via background service worker
- **Nadeel**: vereist dat browser open is

### 2F. Berekende reset-tijd
- Wanneer je een "rate limit" bericht ziet, noteer je het tijdstip
- Reset = tijdstip + 5 uur
- Stel een timer in voor dat exacte moment
- **Voordeel**: geen continue polling nodig
- **Nadeel**: werkt alleen als je de limiet hebt bereikt, niet als je wil weten wanneer je klaar bent

---

## 3. SMS Notificatiediensten

### Vergelijking

| Dienst       | Kosten           | Gratis tier      | Python SDK | Geschikt |
|--------------|------------------|------------------|------------|----------|
| Twilio       | ~€0.008/SMS      | $15 trial credit | Ja         | Ja       |
| TextBee      | Gratis (eigen Android) | 50/dag, 300/mnd | REST API | **Beste voor gratis** |
| Pushover     | €4.99 eenmalig   | 10.000/mnd gratis | HTTP POST | **Beste waarde** |
| Telegram Bot | Gratis           | Onbeperkt        | python-telegram-bot | **Gratis maar geen SMS** |
| Vonage       | ~€0.007/SMS      | Weinig credits   | Ja         | Ja       |
| MessageBird  | ~€0.007/SMS      | Weinig credits   | Ja         | Ja       |
| Pushbullet   | Gratis           | Ja               | REST API   | Nee (onbetrouwbaar) |

### Aanbevolen volgorde
1. **Pushover** - €4.99 eenmalig, 10k msgs/mnd gratis, push notification op telefoon
2. **TextBee** - Volledig gratis (eigen Android phone als gateway), echte SMS
3. **Telegram Bot** - Volledig gratis, geen echte SMS maar werkt net zo goed
4. **Twilio** - Betrouwbaarst voor echte SMS, maar kost geld per bericht

---

## 4. Architecturen

### Architectuur A: Lokale PC
- Python script + Playwright
- Draait als achtergrondproces op je eigen PC
- Cron job (Linux/Mac) of Task Scheduler (Windows)
- **Voordeel**: gratis, volledige controle
- **Nadeel**: PC moet aan staan, slaapstand onderbreekt monitoring

### Architectuur B: Raspberry Pi
- Zelfde script, draait 24/7 op Raspberry Pi
- Kosten: ~€40 hardware eenmalig, ~€3/jaar stroom
- **Voordeel**: altijd aan, energiezuinig
- **Nadeel**: hardware investering nodig

### Architectuur C: VPS/Server
- Hetzner/DigitalOcean VPS: ~€4-5/maand
- Headless Playwright (geen monitor nodig)
- Docker container voor eenvoudige deployment
- **Voordeel**: altijd beschikbaar, betrouwbaar
- **Nadeel**: maandelijkse kosten

### Architectuur D: GitHub Actions
- Gratis voor publieke repos, 2000 min/mnd gratis voor private
- Scheduled workflow elke 10-15 minuten
- **Probleem**: GitHub Actions heeft minimum interval van 5 minuten, in praktijk vaak 15+ min
- **Groter probleem**: Playwright + browser session werkt lastig in Actions omgeving
- **Conclusie**: Niet ideaal voor dit gebruik

### Architectuur E: Chrome Extension
- Draait in de browser, heeft directe toegang tot claude.ai
- Kan usage DOM direct lezen
- Stuurt push notificatie via browser
- **Voordeel**: geen aparte server nodig, meest betrouwbaar voor usage-detectie
- **Nadeel**: browser moet open zijn, vereist extension-development kennis

---

## 5. Technische Details Claude.ai

### Websockets
Claude.ai gebruikt waarschijnlijk websockets voor streaming responses.
De usage-data wordt geüpdated via periodieke polling of na elke response.

### Verborgen endpoints (hypothetisch, te onderzoeken)
Op basis van typische Next.js/React SPA patronen:
- `GET /api/organizations/{org_id}/limits` 
- `GET /api/account/usage`
- `GET /api/me/usage`

Deze zijn te ontdekken via browser DevTools Network tab terwijl je claude.ai/settings/usage bezoekt.

### Reset-tijd berekening
Wanneer je "Usage limit reached" ziet:
1. Noteer het exacte tijdstip van de limiet
2. Reset = tijdstip + 5 uur (exacte tijd varieert)
3. Plan SMS-alert voor tijdstip + 4h55m (buffer van 5 minuten)

---

## 6. Risico-analyse

| Risico | Kans | Impact | Mitigatie |
|--------|------|--------|-----------|
| Claude.ai blokkeert scraping | Middel | Hoog | User-agent mimicry, rate limiting van eigen requests |
| Session cookie verloopt | Hoog | Middel | Automatische re-login workflow |
| Pagina-structuur verandert | Hoog | Middel | CSS selectors + fallback patterns |
| Rate limit op eigen polling | Laag | Laag | Slechts 1 request per 10 min |
| SMS-dienst downtime | Laag | Laag | Fallback naar Telegram/email |

---

## 7. Conclusie & Aanbeveling

**Aanbevolen oplossing**: Python script met Playwright + Pushover/Telegram notificaties

Zie `/recommended-solution/` voor het volledige werkende prototype.
