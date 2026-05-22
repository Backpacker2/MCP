"""
Claude Credits Monitor - Prototype
====================================
Monitort claude.ai/settings/usage en stuurt een SMS/notificatie
zodra de credits weer op 100% staan.

INSTALLATIE:
    pip install playwright python-dotenv
    playwright install chromium

CONFIGURATIE (.env bestand):
    NOTIFICATION_PROVIDER=pushover   # of telegram, textbee, twilio
    PUSHOVER_TOKEN=xxx
    PUSHOVER_USER=xxx
    CHECK_INTERVAL=600               # seconden tussen checks (standaard: 10 min)
    STATE_FILE=./state.json          # waar de status opgeslagen wordt

GEBRUIK:
    # Stap 1: eenmalig inloggen en sessie opslaan
    python monitor.py --setup

    # Stap 2: monitor starten
    python monitor.py

    # Handmatige check
    python monitor.py --check-once
"""

import asyncio
import json
import logging
import os
import sys
import argparse
import time
from datetime import datetime, timedelta
from pathlib import Path

# Dotenv laden (optioneel)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv niet geïnstalleerd, gebruik directe env vars

# Zorg dat sibling-modules vindbaar zijn
sys.path.insert(0, str(Path(__file__).parent.parent))
from browser_analysis.scraper import scrape_usage, interactive_login, SESSION_FILE
from sms.providers import get_provider

# Logging instellen
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("claude_monitor.log"),
    ],
)
logger = logging.getLogger(__name__)

# Configuratie
CHECK_INTERVAL = int(os.environ.get("CHECK_INTERVAL", 600))  # 10 min standaard
STATE_FILE = Path(os.environ.get("STATE_FILE", "./monitor_state.json"))


def load_state() -> dict:
    """Laad opgeslagen monitoringstatus."""
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {
        "last_usage_percent": None,
        "last_check": None,
        "was_limited": False,
        "notification_sent_at": None,
        "checks_total": 0,
        "notifications_sent": 0,
    }


def save_state(state: dict):
    """Sla monitoringstatus op."""
    state["last_check"] = datetime.now().isoformat()
    STATE_FILE.write_text(json.dumps(state, indent=2, default=str))


def should_send_notification(state: dict, usage_percent: float) -> bool:
    """
    Bepaal of we een notificatie moeten sturen.

    Logica:
    - We sturen een notificatie als usage >= 99% EN
    - De vorige check had een lagere waarde (was gelimiteerd) OF
    - Er is nog nooit een notificatie gestuurd voor deze reset-cyclus
    """
    if usage_percent < 99.0:
        return False

    # Voorkom dubbele notificaties: wacht minimaal 30 minuten tussen berichten
    if state.get("notification_sent_at"):
        last_sent = datetime.fromisoformat(state["notification_sent_at"])
        if datetime.now() - last_sent < timedelta(minutes=30):
            logger.debug(f"Notificatie al verstuurd {datetime.now() - last_sent} geleden, overslaan")
            return False

    # Stuur als de vorige check gelimiteerd was
    if state.get("was_limited"):
        return True

    # Stuur als vorige usage lager was (van beperkt naar vol)
    prev = state.get("last_usage_percent")
    if prev is not None and prev < 99.0:
        return True

    # Eerste check ooit en usage is vol - stuur ter bevestiging
    if state.get("last_usage_percent") is None:
        return True

    return False


async def check_once(state: dict) -> dict:
    """
    Voer één usage-check uit en stuur eventueel een notificatie.
    Geeft de bijgewerkte state terug.
    """
    state["checks_total"] = state.get("checks_total", 0) + 1
    logger.info(f"Check #{state['checks_total']} gestart...")

    try:
        result = await scrape_usage(headless=True)
    except Exception as e:
        logger.error(f"Scrape-fout: {e}")
        return state

    if not result["success"]:
        logger.warning(f"Scrape mislukt: {result.get('error')}")
        return state

    usage = result.get("usage_percent")
    reset_time = result.get("reset_time", "onbekend")

    if usage is None:
        logger.warning("Kon usage-percentage niet lezen. Zie screenshot voor debug.")
        return state

    # Log huidige status
    filled = int(usage / 5)
    bar = "█" * filled + "░" * (20 - filled)
    status_icon = "✅" if usage >= 99 else "⏳"
    logger.info(f"{status_icon} Usage: [{bar}] {usage:.1f}% | Reset: {reset_time}")

    # Notificatie sturen?
    if should_send_notification(state, usage):
        logger.info("🎉 Credits terug op 100%! Notificatie versturen...")
        try:
            provider = get_provider()
            sent = provider.send(
                title="✅ Claude Credits Hersteld!",
                message=(
                    f"Je Claude-credits staan weer op {usage:.0f}%.\n"
                    f"Je kunt weer aan de slag! 🚀\n"
                    f"Tijd: {datetime.now().strftime('%H:%M:%S')}"
                ),
            )
            if sent:
                state["notification_sent_at"] = datetime.now().isoformat()
                state["notifications_sent"] = state.get("notifications_sent", 0) + 1
                logger.info("📱 Notificatie succesvol verstuurd!")
            else:
                logger.error("❌ Notificatie versturen mislukt!")
        except Exception as e:
            logger.error(f"Fout bij sturen notificatie: {e}")

    # State updaten
    state["was_limited"] = usage < 99.0
    state["last_usage_percent"] = usage

    return state


async def monitor_loop():
    """Hoofdmonitoringslus. Draait continu tot gestopt."""
    state = load_state()

    logger.info("=" * 60)
    logger.info("Claude Credits Monitor gestart")
    logger.info(f"Check-interval: {CHECK_INTERVAL}s ({CHECK_INTERVAL // 60} min)")
    logger.info(f"Sessiebestand: {SESSION_FILE}")
    logger.info(f"Statebestand: {STATE_FILE}")
    logger.info("=" * 60)

    if not SESSION_FILE.exists():
        logger.error("Geen sessie gevonden! Voer eerst 'python monitor.py --setup' uit.")
        sys.exit(1)

    while True:
        try:
            state = await check_once(state)
            save_state(state)

            next_check = datetime.now() + timedelta(seconds=CHECK_INTERVAL)
            logger.info(f"Volgende check: {next_check.strftime('%H:%M:%S')} "
                       f"(over {CHECK_INTERVAL // 60} min)")

        except KeyboardInterrupt:
            logger.info("\nMonitor gestopt door gebruiker.")
            break
        except Exception as e:
            logger.error(f"Onverwachte fout: {e}", exc_info=True)

        try:
            await asyncio.sleep(CHECK_INTERVAL)
        except asyncio.CancelledError:
            break

    logger.info(f"Monitor beëindigd. Totaal checks: {state['checks_total']}, "
               f"notificaties: {state.get('notifications_sent', 0)}")


async def main():
    parser = argparse.ArgumentParser(
        description="Claude Credits Monitor",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Voorbeelden:
  python monitor.py --setup          # Eenmalig inloggen (browser opent)
  python monitor.py                  # Monitor starten
  python monitor.py --check-once     # Eénmalige check
  python monitor.py --test-sms       # Test SMS sturen
        """,
    )
    parser.add_argument("--setup", action="store_true",
                        help="Interactief inloggen en sessie opslaan")
    parser.add_argument("--check-once", action="store_true",
                        help="Eénmalige check uitvoeren")
    parser.add_argument("--test-sms", action="store_true",
                        help="Test SMS/notificatie sturen")
    parser.add_argument("--status", action="store_true",
                        help="Huidige status tonen")
    args = parser.parse_args()

    if args.setup:
        await interactive_login()
        print("\n✅ Setup voltooid! Voer nu 'python monitor.py' uit om te starten.")
        return

    if args.test_sms:
        try:
            provider = get_provider()
            provider.send(
                title="Claude Monitor - Test",
                message=f"Test bericht! Monitor werkt correct. Tijd: {datetime.now().strftime('%H:%M')}",
            )
        except Exception as e:
            logger.error(f"SMS test mislukt: {e}")
        return

    if args.status:
        state = load_state()
        print(json.dumps(state, indent=2, default=str))
        return

    if args.check_once:
        state = load_state()
        state = await check_once(state)
        save_state(state)
        return

    await monitor_loop()


if __name__ == "__main__":
    asyncio.run(main())
