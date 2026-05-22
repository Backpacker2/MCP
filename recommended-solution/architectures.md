# Architecturen - Vergelijking

## Architectuur A: Lokale PC (Eenvoudigst)

```
┌─────────────────────────────────────────────┐
│  Jouw PC                                     │
│                                              │
│  python claude_monitor.py                   │
│       │                                      │
│       ▼                                      │
│  Playwright Browser ──► claude.ai/settings  │
│       │                                      │
│       ▼                                      │
│  Usage gelezen (bijv. 73%)                  │
│       │                                      │
│       ▼ (als 100%)                           │
│  SMS Provider API ──────────────────────────┼──► 📱 Jouw telefoon
└─────────────────────────────────────────────┘
```

- **Moeilijkheid**: ⭐ Eenvoudig
- **Stabiliteit**: ⚠️ PC moet aan staan
- **Kosten**: Gratis
- **Kans op werken**: Hoog
- **Aanbevolen voor**: Testen en dagelijks gebruik thuis

---

## Architectuur B: Raspberry Pi (Best voor thuis, 24/7)

```
┌─────────────────────────────────────────────┐
│  Raspberry Pi (€40 hardware)                │
│  Altijd aan, energiezuinig (3W)             │
│                                              │
│  systemd service → claude_monitor.py        │
│       │                                      │
│       ▼                                      │
│  Headless Playwright ──► claude.ai          │
│       │                                      │
│       ▼ (als 100%)                           │
│  SMS/Pushover API ──────────────────────────┼──► 📱 SMS
└─────────────────────────────────────────────┘
```

- **Moeilijkheid**: ⭐⭐ Matig (eenmalige setup)
- **Stabiliteit**: ✅ Uitstekend (24/7)
- **Kosten**: ~€40 hardware + €3/jaar stroom
- **Kans op werken**: Hoog
- **Aanbevolen voor**: Set-and-forget thuis oplossing

---

## Architectuur C: VPS/Server (Meest professioneel)

```
┌─────────────────────────────────────────────┐
│  Hetzner/DigitalOcean VPS (€4-5/mnd)       │
│                                              │
│  Docker container                           │
│  ├── claude_monitor.py                      │
│  ├── session.json (volume)                  │
│  └── state.json (volume)                    │
│       │                                      │
│       ▼                                      │
│  Headless Playwright ──► claude.ai          │
│       │                                      │
│       ▼ (als 100%)                           │
│  SMS API ───────────────────────────────────┼──► 📱 SMS
└─────────────────────────────────────────────┘
```

- **Moeilijkheid**: ⭐⭐⭐ Vereist server-kennis
- **Stabiliteit**: ✅ Excellent (99.9% uptime)
- **Kosten**: €4-5/maand
- **Kans op werken**: Hoog
- **Aanbevolen voor**: Als je al een VPS hebt

---

## Architectuur D: Timer-methode (Eenvoudigste, geen scraping)

```
Jij bereikt Claude-limiet
         │
         ▼
python alternative_timer_method.py --hit-limit-now
         │
         ▼
Script wacht 5 uur (slaapstand timer)
         │
         ▼ (na 5 uur)
SMS sturen via provider
         │
         ▼
📱 Jij ontvangt SMS
```

- **Moeilijkheid**: ⭐ Allereenvoudigst
- **Stabiliteit**: ✅ Heel betrouwbaar (geen scraping)
- **Kosten**: Gratis
- **Nadeel**: Handmatige actie vereist bij elke limiet
- **Aanbevolen voor**: Als scraping niet lukt of te complex is

---

## Architectuur E: Tampermonkey Browser Extension

```
Browser (Chrome/Firefox)
├── claude.ai/settings/usage (tab open)
├── Tampermonkey script
│     ├── Leest DOM elke 5 min
│     ├── Detecteert usage%
│     └── POST naar localhost:8080/usage
│                    │
│                    ▼
│           Python webhook-server
│                    │
│                    ▼ (als 100%)
│           SMS API ──► 📱 SMS
└─────────────────────────────────────────────
```

- **Moeilijkheid**: ⭐⭐⭐ Vereist extension-kennis
- **Stabiliteit**: ⚠️ Browser moet open zijn
- **Kosten**: Gratis
- **Voordeel**: Directe DOM-toegang, meest betrouwbaar voor usage-detectie
- **Aanbevolen voor**: Als Playwright-sessie steeds verloopt

---

## Vergelijkingstabel

| Architectuur    | Setup   | Kosten/mnd | Uptime | Betrouwbaarheid |
|-----------------|---------|------------|--------|-----------------|
| A: Lokale PC    | 10 min  | €0         | ⚠️     | ★★★☆☆          |
| B: Raspberry Pi | 30 min  | <€0.50     | ✅     | ★★★★☆          |
| C: VPS Docker   | 1 uur   | €4-5       | ✅     | ★★★★★          |
| D: Timer only   | 5 min   | €0         | N/A    | ★★★★☆          |
| E: Extension    | 45 min  | €0         | ⚠️     | ★★★☆☆          |

---

## Aanbeveling

**Voor beginners**: Start met Architectuur D (timer-methode)
→ Geen scraping, geen browser-sessie, gewoon `python alternative_timer_method.py --hit-limit-now`

**Voor dagelijks gebruik**: Architectuur A (lokale PC) met screen/Task Scheduler
→ Draait op je eigen machine, gratis

**Voor 24/7 betrouwbaarheid**: Architectuur B (Raspberry Pi)
→ €40 eenmalig, daarna vrijwel geen kosten
