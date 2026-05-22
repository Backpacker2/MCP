"""
Claude.ai Usage Scraper - Browser Analysis Module
==================================================
Gebruikt Playwright om in te loggen op claude.ai en de usage-status te lezen.

INSTALLATIE:
    pip install playwright
    playwright install chromium

GEBRUIK:
    python scraper.py                    # Interactief inloggen + test scrape
    python scraper.py --headless         # Headless mode (na sessieopslag)
    python scraper.py --save-session     # Login en sla sessie op
"""

import asyncio
import json
import re
import sys
import argparse
from pathlib import Path
from datetime import datetime

SESSION_FILE = Path(__file__).parent / "session.json"
USAGE_URL = "https://claude.ai/settings/usage"
CLAUDE_HOME = "https://claude.ai"


async def save_session(context):
    """Sla browser-sessie (cookies + storage) op naar bestand."""
    storage = await context.storage_state()
    SESSION_FILE.write_text(json.dumps(storage, indent=2))
    print(f"[SESSION] Sessie opgeslagen → {SESSION_FILE}")


async def load_session_context(playwright):
    """
    Maak een browser context met opgeslagen sessie (indien beschikbaar),
    anders een verse context voor handmatig inloggen.
    """
    from playwright.async_api import async_playwright

    browser = await playwright.chromium.launch(
        headless="--headless" in sys.argv,
        args=["--no-sandbox", "--disable-dev-shm-usage"],
    )

    if SESSION_FILE.exists():
        print("[SESSION] Bestaande sessie geladen.")
        context = await browser.new_context(storage_state=str(SESSION_FILE))
    else:
        print("[SESSION] Geen sessie gevonden. Handmatig inloggen vereist.")
        context = await browser.new_context()

    return browser, context


def parse_usage_from_html(html: str) -> dict:
    """
    Extraheer usage-percentage en reset-tijd uit de HTML van claude.ai/settings/usage.

    Geeft terug:
        {
            "usage_percent": float (0-100),
            "is_full": bool,
            "reset_time": str of None,
            "reset_datetime": datetime of None,
            "raw_text": str
        }
    """
    result = {
        "usage_percent": None,
        "is_full": False,
        "reset_time": None,
        "reset_datetime": None,
        "raw_text": "",
    }

    # Zoek naar percentage in tekst
    percent_patterns = [
        r"(\d+(?:\.\d+)?)\s*%",
        r"(\d+)\s*of\s*100",
        r"usage[^0-9]*(\d+)",
    ]
    for pattern in percent_patterns:
        match = re.search(pattern, html, re.IGNORECASE)
        if match:
            result["usage_percent"] = float(match.group(1))
            result["is_full"] = result["usage_percent"] >= 99.0
            break

    # Zoek naar reset-tijd in verschillende formaten
    time_patterns = [
        r"resets?\s+(?:in\s+)?(\d+)\s+hour",
        r"resets?\s+(?:in\s+)?(\d+)\s+minute",
        r"available\s+(?:again\s+)?(?:in\s+)?(\d+[^<\"]*)",
        r"(\d{1,2}:\d{2}\s*(?:AM|PM)?)",
        r"reset[^\"<]*(\d{1,2}:\d{2})",
    ]
    for pattern in time_patterns:
        match = re.search(pattern, html, re.IGNORECASE)
        if match:
            result["reset_time"] = match.group(1)
            break

    result["raw_text"] = re.sub(r"<[^>]+>", " ", html)[:500]
    return result


async def intercept_usage_api(page) -> dict | None:
    """
    Onderschep netwerkrequests op claude.ai/settings/usage om
    verborgen API-endpoints te ontdekken die usage-data teruggeven.
    """
    api_responses = []

    async def handle_response(response):
        url = response.url
        # Filter op interessante endpoints
        if any(k in url for k in ["usage", "limit", "quota", "account", "organization"]):
            try:
                if "json" in (response.headers.get("content-type", "")):
                    body = await response.json()
                    api_responses.append({"url": url, "data": body})
                    print(f"[API] Gevonden endpoint: {url}")
                    print(f"[API] Response: {json.dumps(body, indent=2)[:500]}")
            except Exception:
                pass

    page.on("response", handle_response)
    return api_responses


async def scrape_usage(headless: bool = True) -> dict:
    """
    Hoofd-scrapefunctie. Opent claude.ai/settings/usage en leest usage-data.

    Geeft terug:
        {
            "success": bool,
            "usage_percent": float of None,
            "is_full": bool,
            "reset_time": str of None,
            "api_endpoints": list,
            "error": str of None,
            "timestamp": str
        }
    }
    """
    from playwright.async_api import async_playwright

    result = {
        "success": False,
        "usage_percent": None,
        "is_full": False,
        "reset_time": None,
        "api_endpoints": [],
        "error": None,
        "timestamp": datetime.now().isoformat(),
    }

    async with async_playwright() as pw:
        browser, context = await load_session_context(pw)

        try:
            page = await context.new_page()

            # Stel user-agent in als echte browser
            await page.set_extra_http_headers({
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                )
            })

            # Onderschep API-responses
            api_responses = await intercept_usage_api(page)

            print(f"[SCRAPER] Navigeer naar {USAGE_URL}")
            response = await page.goto(USAGE_URL, wait_until="networkidle", timeout=30000)

            # Check of we uitgelogd zijn
            current_url = page.url
            if "login" in current_url or "sign" in current_url:
                result["error"] = "Niet ingelogd - sessie verlopen of niet aanwezig"
                print("[SCRAPER] FOUT: Niet ingelogd!")
                return result

            # Wacht tot pagina geladen is
            await page.wait_for_timeout(3000)

            # Haal paginatekst op
            content = await page.content()

            # Probeer specifieke selectors
            usage_selectors = [
                '[data-testid="usage-meter"]',
                '.usage-indicator',
                '[class*="usage"]',
                '[class*="limit"]',
                '[class*="quota"]',
                'progress',
                '[role="progressbar"]',
            ]

            usage_text = ""
            for selector in usage_selectors:
                try:
                    elements = await page.query_selector_all(selector)
                    for el in elements:
                        text = await el.inner_text()
                        if text.strip():
                            usage_text += f" | {selector}: {text.strip()}"
                            print(f"[DOM] {selector}: {text.strip()[:100]}")
                except Exception:
                    pass

            # Aria-labels en data-attributen checken
            try:
                aria_elements = await page.query_selector_all("[aria-valuenow]")
                for el in aria_elements:
                    value = await el.get_attribute("aria-valuenow")
                    max_val = await el.get_attribute("aria-valuemax")
                    print(f"[DOM] aria-progressbar: {value}/{max_val}")
                    if value and max_val:
                        pct = float(value) / float(max_val) * 100
                        result["usage_percent"] = pct
                        result["is_full"] = pct >= 99.0
            except Exception as e:
                print(f"[DOM] aria scan fout: {e}")

            # Screenshot voor debug
            screenshot_path = Path(__file__).parent / "usage_screenshot.png"
            await page.screenshot(path=str(screenshot_path))
            print(f"[SCRAPER] Screenshot opgeslagen: {screenshot_path}")

            # Parse HTML als fallback
            parsed = parse_usage_from_html(content)
            if parsed["usage_percent"] is not None and result["usage_percent"] is None:
                result["usage_percent"] = parsed["usage_percent"]
                result["is_full"] = parsed["is_full"]
            if parsed["reset_time"]:
                result["reset_time"] = parsed["reset_time"]

            result["api_endpoints"] = api_responses
            result["success"] = True

            # Sla sessie op na succesvol bezoek
            await save_session(context)

        except Exception as e:
            result["error"] = str(e)
            print(f"[SCRAPER] Fout: {e}")
        finally:
            await browser.close()

    return result


async def interactive_login():
    """
    Open een zichtbare browser voor handmatig inloggen op Claude.ai.
    Sla sessie op na inloggen zodat volgende runs headless kunnen.
    """
    from playwright.async_api import async_playwright

    print("\n[LOGIN] Browservenster wordt geopend voor handmatig inloggen...")
    print("[LOGIN] Log in op Claude.ai en druk daarna op ENTER in dit venster.\n")

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()

        await page.goto(CLAUDE_HOME)

        # Wacht op gebruikersinput
        input(">>> Druk ENTER nadat je ingelogd bent op Claude.ai...\n")

        await save_session(context)
        print("[LOGIN] Sessie opgeslagen! Je kunt de browser nu sluiten.")
        await browser.close()


async def main():
    parser = argparse.ArgumentParser(description="Claude.ai Usage Scraper")
    parser.add_argument("--headless", action="store_true", help="Headless mode")
    parser.add_argument("--save-session", action="store_true", help="Interactief inloggen")
    parser.add_argument("--check", action="store_true", help="Eenmalige usage check")
    args = parser.parse_args()

    if args.save_session:
        await interactive_login()
        return

    result = await scrape_usage(headless=args.headless or SESSION_FILE.exists())

    print("\n" + "=" * 50)
    print("SCRAPE RESULTAAT")
    print("=" * 50)
    print(json.dumps(result, indent=2, default=str))

    if result["usage_percent"] is not None:
        bar_filled = int(result["usage_percent"] / 5)
        bar = "█" * bar_filled + "░" * (20 - bar_filled)
        print(f"\nUsage: [{bar}] {result['usage_percent']:.1f}%")
        if result["is_full"]:
            print("✅ CREDITS ZIJN VOLLEDIG BESCHIKBAAR!")
        else:
            print(f"⏳ Reset verwacht: {result['reset_time'] or 'onbekend'}")


if __name__ == "__main__":
    asyncio.run(main())
