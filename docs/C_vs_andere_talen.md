# C vs Python voor dit project — Eerlijke Argumentatie

## Mijn positie

Ik ben het **gedeeltelijk oneens** met C kiezen voor dit project.
Niet omdat C een slechte taal is — juist het tegenovergestelde.
Maar omdat de keuze afhangt van *welk onderdeel* van het systeem je schrijft.

---

## Waar C BETER is dan Python voor dit project

### 1. Serieel port / AT-commando's (USB GSM-modem)

C is de *standaardtaal* voor seriële communicatie met hardware. Vrijwel alle
documentatie, voorbeelden en drivers zijn geschreven met C in gedachten.

```c
// In C: directe POSIX seriële communicatie — géén externe libraries
int fd = open("/dev/ttyUSB0", O_RDWR | O_NOCTTY);
struct termios tty;
cfsetispeed(&tty, B115200);
write(fd, "AT+CMGS=\"+31612345678\"\r", 22);
```

In Python doe je hetzelfde, maar met een library (`pyserial`) die dit voor
je verbergt. Dat is makkelijker, maar je leert er minder van.

### 2. ADB-commando's aansturen

ADB-commando's aanroepen vanuit C met `popen()` en `system()` is éducatief:
je leert hoe processen werken, hoe je output leest van een subprocess,
en hoe het OS processen aanmaakt.

### 3. Timer-logica met `time.h`

De kern van dit programma — wachten en rekenen met tijd — is in C
uitermate overzichtelijk:

```c
time_t now = time(NULL);
time_t reset = now + (5 * 3600);   // 5 uur later
double resterende_seconden = difftime(reset, time(NULL));
sleep((unsigned int)resterende_seconden);
```

Python heeft `datetime` en `asyncio.sleep`, maar `time.h` is compacter
en dwingt je na te denken over wat een `time_t` eigenlijk is (epoch-seconden).

### 4. Geen runtime nodig

Een gecompileerd C-binary draait direct, zonder Python-installatie,
zonder virtual environment, zonder dependencies. Eén bestand.

---

## Waar Python BETER is dan C voor dit project

### 1. HTTPS-requests (SMS-API aanroepen)

Voor TextBee of Twilio heb je HTTP/TLS nodig. In C vereist dit `libcurl`:

```c
// C met libcurl — 30+ regels voor één POST-request
CURL *curl = curl_easy_init();
curl_easy_setopt(curl, CURLOPT_URL, "https://api.textbee.dev/...");
struct curl_slist *headers = curl_slist_append(NULL, "x-api-key: xxx");
curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
// ... nog 20 regels ...
curl_easy_perform(curl);
curl_easy_cleanup(curl);
```

In Python:
```python
import urllib.request
urllib.request.urlopen(req)  # 2 regels
```

### 2. JSON verwerken

Claude.ai stuurt JSON. In Python is dat triviaal:
```python
data = json.loads(response)
usage = data["usage"]["percent"]
```

In C moet je òf een library gebruiken (cJSON, Jansson) òf zelf parsen met
`strstr`, `sscanf` etc. — foutgevoelig en tijdrovend.

### 3. Browser automation (Playwright)

Dit bestaat simpelweg niet in C. Playwright heeft C-bindings: **nee**.
Puppeteer: **nee**. Selenium: **nee**.

Als je de usage-pagina wilt scrapen, heb je Python (of Node.js) nodig.

### 4. String-manipulatie

```c
// C: SMS-tekst samenstellen
char msg[256];
snprintf(msg, sizeof(msg),
    "Claude credits hersteld! Tijd: %s", tijdstring);
// vergeet je de null-terminator? buffer overflow.
```

```python
# Python:
msg = f"Claude credits hersteld! Tijd: {tijdstring}"
```

---

## Conclusie: wat gebruik ik voor welk deel?

| Onderdeel              | Beste taal | Reden                                    |
|------------------------|------------|------------------------------------------|
| Timer-logica           | **C** ✓    | `time.h` is ideaal, leerwaarde hoog      |
| AT-commando's (modem)  | **C** ✓    | C is standaard voor seriële hardware     |
| ADB-aanroepen          | **C** ✓    | `popen()` is educatief                   |
| HTTP API (SMS-dienst)  | Python ✓   | TLS/JSON in C is onnodig complex         |
| Browser scraping       | Python ✓   | Onmogelijk in C                          |
| String-manipulatie     | Python ✓   | C is error-prone zonder voordeel         |

### Mijn aanbeveling

**Schrijf het SMS-systeem in C.** De timer + ADB/AT-commands is een
*perfecte* C-oefening: je leert:
- `time.h` (epoch-tijd, `difftime`, `localtime`)
- `popen()` en `system()` (processen aanmaken)
- Seriële poorten openen en configureren (`termios.h`)
- `struct` gebruiken voor configuratie
- Makefile schrijven
- Header files en `.h`/`.c` opsplitsen

En voor de browser-scraping? Die laten we weg — we gebruiken de
**timer-methode**: jij drukt één commando als je de limiet bereikt,
en het C-programma wacht 5 uur en stuurt dan een SMS.
Dat is eerlijker, betrouwbaarder én 100% in C te schrijven.

---

## Gratis SMS van je eigen nummer — opties vergeleken

### Optie 1: ADB + je Android-telefoon ⭐ (AANBEVOLEN, gratis)

- Verbind je telefoon via USB met je PC
- Zet "USB-foutopsporing" aan (Developer opties)
- C-programma roept `adb shell service call isms ...` aan
- SMS komt van jouw eigen nummer
- Kosten: €0 (je betaalt al voor je abonnement)

### Optie 2: USB GSM-modem + AT-commando's

- USB-modem met je eigen SIM-kaart (SIM tijdelijk uit je telefoon)
- C-programma praat direct via `/dev/ttyUSB0`
- Kosten: €0 per SMS, modem €5-15 tweedehands (Huawei E173, ZTE MF180)
- Puur C, geen API, geen internet nodig

### Optie 3: TextBee (Android app, HTTP API)

- App op je Android, HTTP-call in C met libcurl
- Gratis: 300 SMS/maand
- Meer C-code nodig (libcurl + JSON)

### Voor dit project: Optie 1 (ADB)

ADB is ideaal: geen extra hardware, gratis, je eigen nummer, en
de C-code die adb aanroept is een mooie `popen()`-oefening.
