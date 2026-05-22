# Claude Credits Monitor

Automatische SMS/push-notificatie zodra je Claude-credits weer op 100% staan.

## Hoe het werkt

1. Een Python-script opent claude.ai/settings/usage in een headless browser (Playwright)
2. Het leest de usage-percentage en reset-tijd
3. Zodra usage terugkeert naar ~100%, stuurt het een notificatie via je gekozen dienst
4. Elke 10 minuten een check (instelbaar)

---

## Vereisten

- Python 3.10+
- pip (Python package manager)
- Een Claude.ai account (Pro of Max)
- Een notificatieprovider (Pushover aanbevolen)

---

## Installatie (5 minuten)

### Stap 1: Dependencies installeren

```bash
pip install playwright python-dotenv
playwright install chromium
```

### Stap 2: Configuratiebestand aanmaken

```bash
cp .env.example .env
```

Bewerk `.env` met je gegevens. Kies één provider:

#### Optie A: Pushover (aanbevolen)
1. Download de Pushover app (iOS/Android): https://pushover.net/ — €4.99 eenmalig
2. Maak een account aan op pushover.net
3. Noteer je **User Key** (op de homepage na login)
4. Maak een nieuwe applicatie aan: https://pushover.net/apps/build
5. Noteer het **API Token**
6. Vul in `.env`:
   ```
   NOTIFICATION_PROVIDER=pushover
   PUSHOVER_TOKEN=jouw_api_token
   PUSHOVER_USER=jouw_user_key
   ```

#### Optie B: Telegram (gratis)
1. Zoek @BotFather op Telegram en stuur `/newbot`
2. Volg de stappen en noteer het **bot token**
3. Stuur een bericht naar je nieuwe bot
4. Haal je chat ID op:
   ```bash
   python claude_monitor.py --telegram-id
   ```
5. Vul in `.env`:
   ```
   NOTIFICATION_PROVIDER=telegram
   TELEGRAM_BOT_TOKEN=1234567890:ABCDEFGH
   TELEGRAM_CHAT_ID=123456789
   ```

#### Optie C: TextBee (echte SMS, gratis 300/mnd)
1. Download TextBee op je Android-telefoon: https://textbee.dev/
2. Registreer op textbee.dev
3. Scan de QR code in de app
4. Noteer je **API Key** en **Device ID** uit het dashboard
5. Vul in `.env`:
   ```
   NOTIFICATION_PROVIDER=textbee
   TEXTBEE_API_KEY=jouw_api_key
   TEXTBEE_DEVICE_ID=jouw_device_id
   TEXTBEE_RECIPIENT=+31612345678
   ```

#### Optie D: Twilio (meest betrouwbaar, kleine kosten)
1. Maak een account aan op twilio.com ($15 free trial)
2. Koop een telefoonnummer
3. Vul in `.env`:
   ```
   NOTIFICATION_PROVIDER=twilio
   TWILIO_ACCOUNT_SID=ACxxxxxx
   TWILIO_AUTH_TOKEN=jouw_auth_token
   TWILIO_FROM=+1xxxxxxxxxx
   TWILIO_TO=+31612345678
   ```

### Stap 3: Inloggen op Claude.ai (eenmalig)

```bash
python claude_monitor.py --setup
```

Er opent een browservenster. Log in op Claude.ai. Druk daarna ENTER in de terminal.
Je sessie wordt opgeslagen in `session.json`.

### Stap 4: Notificatie testen

```bash
python claude_monitor.py --test-sms
```

Je zou een testbericht moeten ontvangen.

### Stap 5: Monitor starten

```bash
python claude_monitor.py
```

---

## Continu draaien (achtergrond)

### Linux/Mac: screen

```bash
screen -dmS claude-monitor python claude_monitor.py
# Bekijk output:
screen -r claude-monitor
# Detach: Ctrl+A, D
```

### Linux: systemd service (automatisch starten bij boot)

```bash
# Kopieer service-bestand
sudo cp ../automation/claude-monitor.service /etc/systemd/system/
sudo systemctl enable claude-monitor
sudo systemctl start claude-monitor
sudo systemctl status claude-monitor
```

### Docker

```bash
# Zorg dat .env ingevuld is en session.json aanwezig
cd ../automation
docker-compose up -d
docker-compose logs -f
```

### Windows: Taakplanner

1. Open Taakplanner (taskschd.msc)
2. Nieuwe taak aanmaken
3. Trigger: bij aanmelden
4. Actie: `python C:\pad\naar\claude_monitor.py`

---

## Commando's

```bash
python claude_monitor.py              # Monitor starten (hoofdlus)
python claude_monitor.py --setup      # Inloggen en sessie opslaan
python claude_monitor.py --check-once # Eénmalige check
python claude_monitor.py --test-sms   # Test-notificatie sturen
python claude_monitor.py --status     # Opgeslagen status tonen
```

---

## Bestanden

```
claude_monitor.py    ← hoofdscript (alles-in-één)
.env                 ← jouw configuratie (niet in git!)
.env.example         ← voorbeeld configuratie
session.json         ← browser-sessie (automatisch aangemaakt)
state.json           ← monitorstatus (automatisch aangemaakt)
claude_monitor.log   ← logbestand
last_check.png       ← screenshot van laatste check (debug)
```

---

## Troubleshooting

### "Niet ingelogd - voer --setup opnieuw uit"
Je sessie is verlopen. Voer `--setup` opnieuw uit.

### "usage-percentage niet gevonden"
Open `last_check.png` om te zien wat de scraper zag.
De paginastructuur van Claude.ai kan zijn veranderd.
Maak een issue aan in het project.

### Notificatie komt niet aan
```bash
python claude_monitor.py --test-sms
```
Controleer je `.env` configuratie.

### Browser opent niet bij --setup
```bash
playwright install chromium
```

---

## Privacy & Veiligheid

- Je Claude-sessiecookies worden lokaal opgeslagen in `session.json`
- Voeg `session.json` en `.env` toe aan `.gitignore`
- Het script maakt maximaal 1 request per 10 minuten naar Claude.ai
- Geen data wordt gedeeld met derden (behalve je gekozen SMS-provider)

---

## Kosten overzicht

| Onderdeel          | Kosten              |
|--------------------|---------------------|
| Script zelf        | Gratis              |
| Pushover app       | €4.99 eenmalig      |
| Pushover berichten | Gratis (10k/mnd)    |
| Telegram           | Volledig gratis     |
| TextBee (gratis)   | Gratis (300/mnd)    |
| Twilio SMS         | ~€0.008 per bericht |
| Hosting (lokaal)   | Gratis              |
| Hosting (VPS)      | ~€4/mnd optioneel   |

**Meest goedkoop**: Telegram (gratis) of Pushover (€4.99 eenmalig)
**Echte SMS gratis**: TextBee (eigen Android als gateway)
