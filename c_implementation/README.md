# Claude Credits Monitor — C Implementatie

Stuurt een SMS naar je eigen nummer zodra Claude-credits resetten.
Gratis. Geen API. Geen kosten per SMS. Verstuurd van jouw eigen nummer.

---

## Hoe het werkt

```
Jij bereikt Claude-limiet
         │
         ▼
./claude_monitor --hit
         │
         ▼  (C programma slaapt met sleep())
Wacht 5 uur (time.h + sleep)
         │
         ▼  (C programma roept adb aan via popen())
adb shell service call isms ...
         │
         ▼
📱 SMS op jouw telefoon van jouw eigen nummer
```

---

## Vereisten

### Methode 1: ADB (aanbevolen — gratis, geen hardware)

**Op je PC:**
```bash
# Ubuntu/Debian:
sudo apt install adb

# Arch:
sudo pacman -S android-tools

# macOS:
brew install android-platform-tools
```

**Op je Android-telefoon:**
1. Ga naar **Instellingen → Over de telefoon**
2. Tik 7× op **Buildnummer** → Developer opties worden zichtbaar
3. Ga naar **Instellingen → Ontwikkelaarsopties**
4. Zet **USB-foutopsporing** aan
5. Verbind telefoon via USB
6. Bevestig de RSA-sleutel op het scherm van je telefoon

**Test:**
```bash
adb devices       # Moet je telefoon tonen
adb shell echo "verbonden"
```

### Methode 2: USB GSM-modem

1. Bestaande USB-modem aansluiten, of tweedehands kopen (Huawei E173: ~€5-10)
2. Je eigen SIM erin doen
3. Modem verschijnt als `/dev/ttyUSB0`

```bash
# Controleer:
ls /dev/ttyUSB*
# Voeg jezelf toe aan dialout-groep (eenmalig):
sudo usermod -aG dialout $USER
# Dan uitloggen en opnieuw inloggen
```

---

## Compileren

```bash
# Vereiste: GCC
sudo apt install build-essential   # Ubuntu/Debian

# Compileren:
make

# Of direct:
gcc -Wall -Wextra -std=c11 -D_GNU_SOURCE -o claude_monitor main.c timer.c sms.c
```

---

## Gebruik

### Stap 1: Eenmalige setup

```bash
# ADB methode (aanbevolen):
./claude_monitor --setup "+31612345678"

# Of seriële poort methode:
./claude_monitor --setup "+31612345678" --serial
```

### Stap 2: Test of SMS aankomt

```bash
./claude_monitor --test
```

Je ontvangt nu een test-SMS. Als het werkt, ben je klaar.

### Stap 3: Zodra je de Claude-limiet bereikt

```bash
./claude_monitor --hit
```

Het programma wacht 5 uur en stuurt dan automatisch een SMS.

Of als je de limiet eerder hebt bereikt:
```bash
./claude_monitor --hit --at "14:30"
```

### Status bekijken

```bash
./claude_monitor --status
```

---

## C Leerpunten in dit project

| Bestand   | Wat je leert |
|-----------|-------------|
| `timer.c` | `time_t`, `difftime()`, `localtime_r()`, `strftime()`, `sleep()` |
| `sms.c`   | `popen()`, `system()`, `open()`, `write()`, `termios.h` |
| `main.c`  | `argc`/`argv`, `strcmp()`, `sscanf()`, `struct`, `memset()` |
| `Makefile`| Compileren, linken, `$@`, `$<`, `$^`, `.PHONY` |

---

## Gratis SMS van je eigen nummer: Hoe werkt ADB?

ADB (Android Debug Bridge) is een tool van Google waarmee je je telefoon
kunt besturen via de command line. Met `service call isms` roep je de
interne SMS-manager van Android aan — dezelfde die de standaard SMS-app
gebruikt. Het bericht wordt verstuurd als een echte SMS, van je eigen nummer,
via je eigen abonnement (kost een SMS van je bundel).

```bash
# Wat ons C-programma intern uitvoert:
adb shell service call isms 5 i32 1 \
  s16 "com.android.mms.service" \
  s16 "null" \
  s16 "+31612345678" \
  s16 "null" \
  s16 "Claude credits hersteld!" \
  s16 "null" s16 "null" i32 1 i32 0
```

Het C-programma roept dit aan via `popen()` — een POSIX-functie die een
shell-commando start en je de output laat lezen.

---

## Troubleshooting

### "adb: command not found"
```bash
sudo apt install adb   # of: brew install android-platform-tools
```

### "no devices/emulators found"
```bash
adb devices           # Wat ziet ADB?
# Controleer USB-kabel (data-kabel, niet alleen oplaadkabel)
# Bevestig RSA-sleutel op je telefoon
```

### "Permission denied" op /dev/ttyUSB0
```bash
sudo usermod -aG dialout $USER
# Uitloggen en opnieuw inloggen vereist
```

### SMS komt niet aan (ADB geeft Parcel terug maar geen SMS)
Probeer een oudere Android-versie syntax:
```bash
./claude_monitor --setup "+31612345678" --android 10
```
