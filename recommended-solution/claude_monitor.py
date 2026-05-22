#!/usr/bin/env python3
"""
Claude Credits Monitor - Aanbevolen Oplossing
==============================================
Compleet werkend script. Monitort claude.ai en stuurt een notificatie
zodra je credits weer op 100% staan.

SNELSTART (5 minuten setup):

    1. pip install playwright python-dotenv
       playwright install chromium

    2. Kopieer .env.example naar .env en vul je gegevens in

    3. python claude_monitor.py --setup    (browser opent, log in)

    4. python claude_monitor.py            (monitor starten)

Zie README.md voor uitgebreide uitleg.
"""

import asyncio
import json
import logging
import os
import sys
import argparse
import time
import re
import urllib.request
import urllib.parse
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

# python-dotenv (optioneel maar aanbevolen)
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

# ─────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────

LOG_FILE = Path(__file__).parent / "claude_monitor.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
    ],
)
logger = logging.getLogger("claude_monitor")

# ─────────────────────────────────────────────
# Configuratie
# ─────────────────────────────────────────────

SESSION_FILE = Path(__file__).parent / "session.json"
STATE_FILE = Path(__file__).parent / "state.json"
CHECK_INTERVAL = int(os.environ.get("CHECK_INTERVAL", "600"))  # standaard 10 min
USAGE_URL = "https://claude.ai/settings/usage"
CLAUDE_HOME = "https://claude.ai"


# ─────────────────────────────────────────────
# Notificatieproviders
# ─────────────────────────────────────────────

class NotificationProvider(ABC):
    @abstractmethod
    def send(self, title: str, message: str) -> bool: ...

    def _http_post(self, url: str, data: dict, json_body: bool = False,
                   headers: dict = None) -> tuple[int, dict]:
        if json_body:
            body = json.dumps(data).encode("utf-8")
            ct = "application/json"
        else:
            body = urllib.parse.urlencode(data).encode("utf-8")
            ct = "application/x-www-form-urlencoded"
        req = urllib.request.Request(
            url, data=body,
            headers={"Content-Type": ct, **(headers or {})},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                return r.status, json.loads(r.read() or "{}")
        except urllib.error.HTTPError as e:
            return e.code, {}
        except Exception as e:
            logger.error(f"HTTP fout: {e}")
            return 0, {}


class PushoverProvider(NotificationProvider):
    """Pushover push notification. €4.99 eenmalig, 10k msgs/mnd gratis."""

    URL = "https://api.pushover.net/1/messages.json"

    def __init__(self):
        self.token = os.environ["PUSHOVER_TOKEN"]
        self.user = os.environ["PUSHOVER_USER"]

    def send(self, title: str, message: str) -> bool:
        code, resp = self._http_post(self.URL, {
            "token": self.token,
            "user": self.user,
            "title": title,
            "message": message,
            "sound": "cashregister",
            "priority": 1,
        })
        ok = code == 200 and resp.get("status") == 1
        logger.info(f"[Pushover] {'✓' if ok else '✗'} code={code}")
        return ok


class TelegramProvider(NotificationProvider):
    """Telegram bot. Volledig gratis."""

    def __init__(self):
        self.token = os.environ["TELEGRAM_BOT_TOKEN"]
        self.chat_id = os.environ["TELEGRAM_CHAT_ID"]

    def send(self, title: str, message: str) -> bool:
        url = f"https://api.telegram.org/bot{self.token}/sendMessage"
        code, resp = self._http_post(url, {
            "chat_id": self.chat_id,
            "text": f"*{title}*\n\n{message}",
            "parse_mode": "Markdown",
        }, json_body=True)
        ok = code == 200 and resp.get("ok") is True
        logger.info(f"[Telegram] {'✓' if ok else '✗'} code={code}")
        return ok


class TextBeeProvider(NotificationProvider):
    """TextBee SMS via eigen Android-telefoon. Gratis 300 msgs/mnd."""

    BASE = "https://api.textbee.dev/api/v1"

    def __init__(self):
        self.api_key = os.environ["TEXTBEE_API_KEY"]
        self.device_id = os.environ["TEXTBEE_DEVICE_ID"]
        self.recipient = os.environ["TEXTBEE_RECIPIENT"]

    def send(self, title: str, message: str) -> bool:
        url = f"{self.BASE}/gateway/devices/{self.device_id}/sendSMS"
        code, resp = self._http_post(
            url,
            {"recipients": [self.recipient], "message": f"{title}: {message}"},
            json_body=True,
            headers={"x-api-key": self.api_key},
        )
        ok = code in (200, 201)
        logger.info(f"[TextBee] {'✓' if ok else '✗'} code={code}")
        return ok


class TwilioProvider(NotificationProvider):
    """Twilio SMS. ~€0.008/SMS, $15 trial credit."""

    def __init__(self):
        import base64
        self.sid = os.environ["TWILIO_ACCOUNT_SID"]
        self.token = os.environ["TWILIO_AUTH_TOKEN"]
        self.from_ = os.environ["TWILIO_FROM"]
        self.to = os.environ["TWILIO_TO"]
        creds = f"{self.sid}:{self.token}".encode()
        self._auth = "Basic " + base64.b64encode(creds).decode()

    def send(self, title: str, message: str) -> bool:
        url = f"https://api.twilio.com/2010-04-01/Accounts/{self.sid}/Messages.json"
        code, resp = self._http_post(
            url,
            {"From": self.from_, "To": self.to, "Body": f"{title}: {message}"},
            headers={"Authorization": self._auth},
        )
        ok = code in (200, 201) and bool(resp.get("sid"))
        logger.info(f"[Twilio] {'✓' if ok else '✗'} code={code}")
        return ok


PROVIDERS = {
    "pushover": PushoverProvider,
    "telegram": TelegramProvider,
    "textbee": TextBeeProvider,
    "twilio": TwilioProvider,
}


def get_provider() -> NotificationProvider:
    name = os.environ.get("NOTIFICATION_PROVIDER", "pushover").lower()
    if name not in PROVIDERS:
        raise ValueError(f"Onbekende provider '{name}'. Kies: {', '.join(PROVIDERS)}")
    return PROVIDERS[name]()


# ─────────────────────────────────────────────
# Usage Scraper
# ─────────────────────────────────────────────

async def save_session(context):
    storage = await context.storage_state()
    SESSION_FILE.write_text(json.dumps(storage, indent=2))
    logger.info(f"Sessie opgeslagen → {SESSION_FILE}")


async def get_browser_context(pw, headless: bool = True):
    browser = await pw.chromium.launch(
        headless=headless,
        args=["--no-sandbox", "--disable-dev-shm-usage"],
    )
    if SESSION_FILE.exists():
        context = await browser.new_context(storage_state=str(SESSION_FILE))
    else:
        context = await browser.new_context()
    return browser, context


def _extract_usage(html: str) -> Optional[float]:
    """
    Extraheer usage-percentage uit HTML.
    Probeert meerdere patronen voor robuustheid.
    """
    # Directe percentage-patronen
    patterns = [
        r'"usagePercent"\s*:\s*(\d+(?:\.\d+)?)',
        r'"usage_percent"\s*:\s*(\d+(?:\.\d+)?)',
        r'(\d+(?:\.\d+)?)\s*%\s*(?:used|usage|verbruikt)',
        r'(\d+(?:\.\d+)?)\s*%',
    ]
    for p in patterns:
        m = re.search(p, html, re.IGNORECASE)
        if m:
            val = float(m.group(1))
            if 0 <= val <= 100:
                return val
    return None


def _extract_reset_time(html: str) -> Optional[str]:
    """Extraheer reset-tijd uit HTML."""
    patterns = [
        r'"resetAt"\s*:\s*"([^"]+)"',
        r'"reset_at"\s*:\s*"([^"]+)"',
        r'resets?\s+(?:at|in|op|om)\s+([^<\n"]{3,30})',
        r'available\s+(?:again\s+)?(?:in|at)\s+([^<\n"]{3,30})',
    ]
    for p in patterns:
        m = re.search(p, html, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return None


async def scrape_usage() -> dict:
    """
    Scrape claude.ai/settings/usage en geeft usage-data terug.

    Return:
        {
            success: bool,
            usage_percent: float | None,
            is_full: bool,
            reset_time: str | None,
            api_data: list,   # onderschepte API responses
            error: str | None
        }
    """
    from playwright.async_api import async_playwright

    result = {
        "success": False,
        "usage_percent": None,
        "is_full": False,
        "reset_time": None,
        "api_data": [],
        "error": None,
    }

    async with async_playwright() as pw:
        browser, context = await get_browser_context(pw, headless=True)
        try:
            page = await context.new_page()

            # Realistischere user-agent
            await page.set_extra_http_headers({
                "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
            })

            # ── API-responses onderscheppen ──────────────
            intercepted = []

            async def on_response(resp):
                url = resp.url
                ct = resp.headers.get("content-type", "")
                if ("json" in ct and
                        any(k in url for k in ["usage", "limit", "quota", "account"])):
                    try:
                        body = await resp.json()
                        intercepted.append({"url": url, "data": body})
                        logger.debug(f"API onderschept: {url}")
                    except Exception:
                        pass

            page.on("response", on_response)
            # ────────────────────────────────────────────

            logger.info(f"Navigeren naar {USAGE_URL}...")
            await page.goto(USAGE_URL, wait_until="networkidle", timeout=30000)

            # Uitgelogd?
            if "login" in page.url or "sign" in page.url:
                result["error"] = "Niet ingelogd - voer --setup opnieuw uit"
                return result

            await page.wait_for_timeout(2000)

            # Kijk of er API-data is onderschept met usage-info
            for item in intercepted:
                data = item["data"]
                # Zoek in JSON-structuur naar usage-veld
                flat = json.dumps(data)
                pct = _extract_usage(flat)
                if pct is not None:
                    result["usage_percent"] = pct
                    result["is_full"] = pct >= 99.0
                    logger.info(f"Usage gevonden via API: {pct}%")
                reset = _extract_reset_time(flat)
                if reset:
                    result["reset_time"] = reset
            result["api_data"] = intercepted

            # Aria progressbar in DOM
            if result["usage_percent"] is None:
                try:
                    bars = await page.query_selector_all("[aria-valuenow]")
                    for bar in bars:
                        now = await bar.get_attribute("aria-valuenow")
                        max_ = await bar.get_attribute("aria-valuemax")
                        if now and max_ and float(max_) > 0:
                            pct = float(now) / float(max_) * 100
                            result["usage_percent"] = pct
                            result["is_full"] = pct >= 99.0
                            logger.info(f"Usage gevonden via aria: {pct:.1f}%")
                            break
                except Exception as e:
                    logger.debug(f"Aria scan: {e}")

            # HTML-parsing als laatste redmiddel
            if result["usage_percent"] is None:
                html = await page.content()
                pct = _extract_usage(html)
                if pct is not None:
                    result["usage_percent"] = pct
                    result["is_full"] = pct >= 99.0
                if result["reset_time"] is None:
                    result["reset_time"] = _extract_reset_time(html)

            # Screenshot altijd opslaan voor debug
            shot = Path(__file__).parent / "last_check.png"
            await page.screenshot(path=str(shot), full_page=False)

            await save_session(context)
            result["success"] = True

        except Exception as e:
            result["error"] = str(e)
            logger.error(f"Scrape fout: {e}", exc_info=True)
        finally:
            await browser.close()

    return result


async def interactive_login():
    """Open browser voor handmatig inloggen. Sla sessie op."""
    from playwright.async_api import async_playwright

    print("\n" + "=" * 55)
    print("  CLAUDE MONITOR - SETUP")
    print("=" * 55)
    print("\nEen browser wordt geopend. Log in op Claude.ai.")
    print("Druk ENTER nadat je bent ingelogd.\n")

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        await page.goto(CLAUDE_HOME)

        input(">>> Druk ENTER na het inloggen...\n")

        await save_session(context)
        print("\n✅ Sessie opgeslagen! Je kunt de browser sluiten.")
        await browser.close()


# ─────────────────────────────────────────────
# State Management
# ─────────────────────────────────────────────

def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {
        "last_usage_percent": None,
        "was_limited": False,
        "notification_sent_at": None,
        "checks_total": 0,
        "notifications_sent": 0,
    }


def save_state(state: dict):
    state["last_check"] = datetime.now().isoformat()
    STATE_FILE.write_text(json.dumps(state, indent=2, default=str))


def should_notify(state: dict, usage: float) -> bool:
    """Bepaal of een notificatie verstuurd moet worden."""
    if usage < 99.0:
        return False

    # Wacht minimaal 30 min tussen meldingen (voorkom spam bij elke check)
    last = state.get("notification_sent_at")
    if last:
        elapsed = datetime.now() - datetime.fromisoformat(last)
        if elapsed < timedelta(minutes=30):
            return False

    # Stuur als vorige check gelimiteerd was
    if state.get("was_limited"):
        return True

    # Stuur als usage gestegen is naar 100%
    prev = state.get("last_usage_percent")
    if prev is not None and prev < 99.0:
        return True

    return False


# ─────────────────────────────────────────────
# Monitoring Loop
# ─────────────────────────────────────────────

async def run_check(state: dict) -> dict:
    """Voer één check uit en verwerk het resultaat."""
    state["checks_total"] = state.get("checks_total", 0) + 1
    n = state["checks_total"]

    result = await scrape_usage()

    if not result["success"]:
        logger.warning(f"Check #{n} mislukt: {result.get('error')}")
        return state

    usage = result.get("usage_percent")
    reset = result.get("reset_time", "onbekend")

    if usage is None:
        logger.warning(f"Check #{n}: usage-percentage niet gevonden")
        logger.warning("Tip: controleer last_check.png voor debug info")
        return state

    # Visuele statusbalk
    filled = int(usage / 5)
    bar = "█" * filled + "░" * (20 - filled)
    icon = "✅" if usage >= 99 else ("🔴" if usage >= 90 else "⏳")
    logger.info(f"{icon} [{bar}] {usage:.1f}% | reset: {reset} (check #{n})")

    # Notificatie?
    if should_notify(state, usage):
        logger.info("🎉 Credits volledig hersteld! Notificatie versturen...")
        try:
            provider = get_provider()
            sent = provider.send(
                title="✅ Claude Credits Hersteld!",
                message=(
                    f"Credits: {usage:.0f}%\n"
                    f"Je kunt weer aan de slag! 🚀\n"
                    f"Tijd: {datetime.now().strftime('%H:%M')}"
                ),
            )
            if sent:
                state["notification_sent_at"] = datetime.now().isoformat()
                state["notifications_sent"] = state.get("notifications_sent", 0) + 1
                logger.info("📱 Notificatie verstuurd!")
            else:
                logger.error("❌ Notificatie mislukt!")
        except Exception as e:
            logger.error(f"Provider fout: {e}")

    state["was_limited"] = usage < 99.0
    state["last_usage_percent"] = usage
    return state


async def monitor_loop():
    """Hoofdlus. Draait tot Ctrl+C."""
    if not SESSION_FILE.exists():
        logger.error("Geen sessie! Voer eerst: python claude_monitor.py --setup")
        sys.exit(1)

    state = load_state()

    logger.info("=" * 55)
    logger.info("  Claude Credits Monitor — Actief")
    logger.info(f"  Interval : {CHECK_INTERVAL}s ({CHECK_INTERVAL // 60} min)")
    logger.info(f"  Provider : {os.environ.get('NOTIFICATION_PROVIDER', 'pushover')}")
    logger.info(f"  Log      : {LOG_FILE}")
    logger.info("  Druk Ctrl+C om te stoppen")
    logger.info("=" * 55)

    while True:
        try:
            state = await run_check(state)
            save_state(state)
        except KeyboardInterrupt:
            break
        except Exception as e:
            logger.error(f"Loop fout: {e}", exc_info=True)

        next_t = datetime.now() + timedelta(seconds=CHECK_INTERVAL)
        logger.info(f"Volgende check: {next_t.strftime('%H:%M:%S')}")

        try:
            await asyncio.sleep(CHECK_INTERVAL)
        except (asyncio.CancelledError, KeyboardInterrupt):
            break

    logger.info(f"Gestopt. Checks: {state['checks_total']}, "
               f"meldingen: {state.get('notifications_sent', 0)}")


# ─────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(
        description="Claude Credits Monitor",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Stappen:
  1. python claude_monitor.py --setup      Browser opent, log in
  2. python claude_monitor.py --test-sms   Test notificatie sturen
  3. python claude_monitor.py              Monitor starten

Overige opties:
  --check-once    Één check uitvoeren en stoppen
  --status        Opgeslagen status tonen
        """,
    )
    parser.add_argument("--setup", action="store_true",
                        help="Interactief inloggen, sessie opslaan")
    parser.add_argument("--check-once", action="store_true",
                        help="Eénmalige check")
    parser.add_argument("--test-sms", action="store_true",
                        help="Test-notificatie sturen")
    parser.add_argument("--status", action="store_true",
                        help="Status weergeven")
    args = parser.parse_args()

    if args.setup:
        await interactive_login()
        print("\nVolgende stap: python claude_monitor.py --test-sms")
        return

    if args.test_sms:
        try:
            p = get_provider()
            ok = p.send(
                "Claude Monitor - Test",
                f"Alles werkt! Tijd: {datetime.now().strftime('%H:%M:%S')}",
            )
            print("✅ Test geslaagd!" if ok else "❌ Test mislukt.")
        except Exception as e:
            print(f"Fout: {e}")
            print("Controleer je .env bestand.")
        return

    if args.status:
        state = load_state()
        print(json.dumps(state, indent=2, default=str))
        return

    if args.check_once:
        state = load_state()
        state = await run_check(state)
        save_state(state)
        return

    await monitor_loop()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nGestopt.")
