#!/usr/bin/env python3
"""
Alternatieve methode: Reset-Timer (geen scraping nodig)
=========================================================
Als je weet WANNEER je de limiet hebt bereikt, kun je exact berekenen
wanneer de credits resetten — zonder continu te scrapen.

GEBRUIK:
    python alternative_timer_method.py --hit-limit-now
    python alternative_timer_method.py --hit-limit-at "14:30"
    python alternative_timer_method.py --status

HOE HET WERKT:
    1. Je bereikt de Claude-limiet
    2. Je draait dit script met --hit-limit-now
    3. Het script wacht precies 5 uur en stuurt dan een notificatie
    4. Geen browser-scraping nodig!
"""

import asyncio
import json
import os
import sys
import argparse
import time
from datetime import datetime, timedelta
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

STATE_FILE = Path(__file__).parent / "timer_state.json"
RESET_HOURS = 5  # Claude reset-venster in uren


def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {"limit_hit_at": None, "notified": False}


def save_state(state: dict):
    STATE_FILE.write_text(json.dumps(state, indent=2, default=str))


def calculate_reset(limit_hit_at: datetime) -> datetime:
    """Bereken wanneer credits resetten (5 uur na limiet)."""
    return limit_hit_at + timedelta(hours=RESET_HOURS)


def send_notification(provider_name: str, reset_time: datetime):
    """Stuur notificatie via geconfigureerde provider."""
    try:
        from claude_monitor import get_provider
        provider = get_provider()
        provider.send(
            title="✅ Claude Credits Hersteld!",
            message=(
                f"Je Claude-credits zijn hersteld!\n"
                f"Reset was om {reset_time.strftime('%H:%M:%S')}\n"
                f"Je kunt weer aan de slag! 🚀"
            ),
        )
        print("📱 Notificatie verstuurd!")
    except Exception as e:
        print(f"Notificatie-fout: {e}")
        # Fallback: print naar console
        print("\n" + "=" * 50)
        print("✅ CLAUDE CREDITS HERSTELD!")
        print(f"Reset was om {reset_time.strftime('%H:%M:%S')}")
        print("=" * 50)


async def wait_and_notify(limit_hit_at: datetime, early_minutes: int = 0):
    """
    Wacht tot de reset-tijd en stuur dan een notificatie.

    Args:
        limit_hit_at: Tijdstip waarop de limiet werd bereikt
        early_minutes: Stuur de notificatie N minuten eerder (buffer)
    """
    reset_time = calculate_reset(limit_hit_at)
    notify_time = reset_time - timedelta(minutes=early_minutes)
    now = datetime.now()

    if notify_time <= now:
        print(f"Reset-tijd ({reset_time.strftime('%H:%M')}) is al verstreken.")
        print("Credits zouden al beschikbaar moeten zijn.")
        send_notification(os.environ.get("NOTIFICATION_PROVIDER", "pushover"), reset_time)
        return

    wait_seconds = (notify_time - now).total_seconds()
    wait_td = timedelta(seconds=int(wait_seconds))

    print(f"\nLimiet bereikt om: {limit_hit_at.strftime('%H:%M:%S')}")
    print(f"Verwachte reset:   {reset_time.strftime('%H:%M:%S')}")
    if early_minutes:
        print(f"Notificatie om:    {notify_time.strftime('%H:%M:%S')} ({early_minutes} min eerder)")
    print(f"Wachttijd:         {wait_td}")
    print("\nWachtend... (Druk Ctrl+C om te stoppen)")

    # Voortgangsupdates elke 30 minuten
    interval = 30 * 60  # 30 min in seconden
    while wait_seconds > 0:
        sleep_time = min(interval, wait_seconds)
        await asyncio.sleep(sleep_time)
        wait_seconds -= sleep_time

        if wait_seconds > 0:
            remaining = timedelta(seconds=int(wait_seconds))
            now_str = datetime.now().strftime("%H:%M:%S")
            print(f"[{now_str}] Nog {remaining} te gaan...")

    print(f"\n🎉 Reset-tijd bereikt!")
    send_notification(
        os.environ.get("NOTIFICATION_PROVIDER", "pushover"),
        reset_time,
    )

    # State bijwerken
    state = load_state()
    state["notified"] = True
    save_state(state)


def status():
    """Toon huidige timer-status."""
    state = load_state()

    if not state.get("limit_hit_at"):
        print("Geen actieve timer. Gebruik --hit-limit-now om te starten.")
        return

    limit_at = datetime.fromisoformat(state["limit_hit_at"])
    reset_at = calculate_reset(limit_at)
    now = datetime.now()

    print(f"\n{'=' * 45}")
    print(f"  Claude Reset Timer Status")
    print(f"{'=' * 45}")
    print(f"  Limiet bereikt: {limit_at.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Verwachte reset: {reset_at.strftime('%Y-%m-%d %H:%M:%S')}")

    if reset_at <= now:
        print(f"  Status: ✅ Reset zou voltooid moeten zijn")
    else:
        remaining = reset_at - now
        print(f"  Nog te gaan: {remaining}")
        pct_done = (now - limit_at).total_seconds() / (RESET_HOURS * 3600) * 100
        bar_done = int(pct_done / 5)
        bar = "█" * bar_done + "░" * (20 - bar_done)
        print(f"  Voortgang: [{bar}] {pct_done:.0f}%")

    print(f"  Notificatie verstuurd: {'Ja' if state.get('notified') else 'Nee'}")
    print()


async def main():
    parser = argparse.ArgumentParser(
        description="Claude Reset Timer - Alternatieve methode (geen scraping)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Voorbeelden:
  python alternative_timer_method.py --hit-limit-now
  python alternative_timer_method.py --hit-limit-at "14:30"
  python alternative_timer_method.py --status
  python alternative_timer_method.py --early 5   (notificatie 5 min vroeger)
        """,
    )
    parser.add_argument("--hit-limit-now", action="store_true",
                        help="Markeer dat je NU de limiet hebt bereikt")
    parser.add_argument("--hit-limit-at", type=str, metavar="HH:MM",
                        help="Tijdstip waarop je de limiet hebt bereikt (bijv. 14:30)")
    parser.add_argument("--early", type=int, default=0, metavar="MINUTEN",
                        help="Stuur notificatie N minuten eerder dan de reset")
    parser.add_argument("--status", action="store_true",
                        help="Toon timer-status")
    parser.add_argument("--test-sms", action="store_true",
                        help="Stuur een test-notificatie")
    args = parser.parse_args()

    if args.status:
        status()
        return

    if args.test_sms:
        send_notification(
            os.environ.get("NOTIFICATION_PROVIDER", "pushover"),
            datetime.now(),
        )
        return

    limit_hit_at = None

    if args.hit_limit_now:
        limit_hit_at = datetime.now()
        print(f"Limiet gemarkeerd op {limit_hit_at.strftime('%H:%M:%S')}")

    elif args.hit_limit_at:
        try:
            t = datetime.strptime(args.hit_limit_at, "%H:%M")
            limit_hit_at = datetime.now().replace(
                hour=t.hour, minute=t.minute, second=0, microsecond=0
            )
            # Als tijdstip in de toekomst ligt, gebruik gisteren
            if limit_hit_at > datetime.now():
                limit_hit_at -= timedelta(days=1)
        except ValueError:
            print(f"Ongeldig tijdformaat: {args.hit_limit_at}. Gebruik HH:MM (bijv. 14:30)")
            sys.exit(1)

    else:
        parser.print_help()
        return

    # Sla op
    state = load_state()
    state["limit_hit_at"] = limit_hit_at.isoformat()
    state["notified"] = False
    save_state(state)

    try:
        await wait_and_notify(limit_hit_at, early_minutes=args.early)
    except KeyboardInterrupt:
        print("\nTimer gestopt.")


if __name__ == "__main__":
    asyncio.run(main())
