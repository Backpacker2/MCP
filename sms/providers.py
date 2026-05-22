"""
SMS & Notificatie Providers Module
====================================
Ondersteunde providers:
  - Pushover (push notification, gratis 10k/mnd, €4.99 eenmalig app)
  - Telegram  (gratis, geen echte SMS maar net zo goed)
  - TextBee   (echte SMS via je eigen Android, gratis 300/mnd)
  - Twilio    (echte SMS, ~€0.008/bericht, $15 trial credit)

CONFIGURATIE (via environment variables):
    NOTIFICATION_PROVIDER=pushover|telegram|textbee|twilio

    Pushover:
        PUSHOVER_TOKEN=xxxx
        PUSHOVER_USER=xxxx

    Telegram:
        TELEGRAM_BOT_TOKEN=xxxx:xxxx
        TELEGRAM_CHAT_ID=xxxx

    TextBee:
        TEXTBEE_API_KEY=xxxx
        TEXTBEE_DEVICE_ID=xxxx
        TEXTBEE_RECIPIENT=+31612345678

    Twilio:
        TWILIO_ACCOUNT_SID=xxxx
        TWILIO_AUTH_TOKEN=xxxx
        TWILIO_FROM=+1xxxxxxxxxx
        TWILIO_TO=+31612345678
"""

import os
import json
import logging
import urllib.request
import urllib.parse
from abc import ABC, abstractmethod
from typing import Optional

logger = logging.getLogger(__name__)


class NotificationProvider(ABC):
    """Basis-interface voor alle notificatieproviders."""

    @abstractmethod
    def send(self, title: str, message: str) -> bool:
        """
        Stuur een notificatie.
        Geeft True terug bij succes, False bij fout.
        """
        ...

    def _post_json(self, url: str, data: dict, headers: dict = None) -> tuple[int, dict]:
        """Hulpfunctie: stuur HTTP POST met JSON body. Geen externe dependencies."""
        body = json.dumps(data).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=body,
            headers={"Content-Type": "application/json", **(headers or {})},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return resp.status, json.loads(resp.read())
        except urllib.error.HTTPError as e:
            return e.code, {}

    def _post_form(self, url: str, data: dict) -> tuple[int, dict]:
        """Hulpfunctie: stuur HTTP POST met form-encoded body."""
        body = urllib.parse.urlencode(data).encode("utf-8")
        req = urllib.request.Request(url, data=body, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return resp.status, json.loads(resp.read())
        except urllib.error.HTTPError as e:
            return e.code, {}


class PushoverProvider(NotificationProvider):
    """
    Pushover - Push notificaties naar telefoon
    Kosten: €4.99 eenmalig app-aankoop, 10.000 berichten/mnd gratis
    Setup: https://pushover.net/
    """

    API_URL = "https://api.pushover.net/1/messages.json"

    def __init__(
        self,
        token: str = None,
        user: str = None,
        sound: str = "cashregister",
        priority: int = 1,
    ):
        self.token = token or os.environ["PUSHOVER_TOKEN"]
        self.user = user or os.environ["PUSHOVER_USER"]
        self.sound = sound
        self.priority = priority  # 1 = hoog, 0 = normaal, -1 = stil

    def send(self, title: str, message: str) -> bool:
        status, resp = self._post_form(
            self.API_URL,
            {
                "token": self.token,
                "user": self.user,
                "title": title,
                "message": message,
                "sound": self.sound,
                "priority": self.priority,
            },
        )
        if status == 200 and resp.get("status") == 1:
            logger.info("[Pushover] Notificatie verstuurd ✓")
            return True
        logger.error(f"[Pushover] Fout {status}: {resp}")
        return False


class TelegramProvider(NotificationProvider):
    """
    Telegram Bot - Gratis berichten
    Kosten: volledig gratis
    Setup:
      1. Start @BotFather op Telegram, maak een bot, sla de token op
      2. Stuur een bericht naar je bot
      3. Haal je chat_id op: https://api.telegram.org/bot<TOKEN>/getUpdates
    """

    def __init__(self, bot_token: str = None, chat_id: str = None):
        self.bot_token = bot_token or os.environ["TELEGRAM_BOT_TOKEN"]
        self.chat_id = chat_id or os.environ["TELEGRAM_CHAT_ID"]

    @property
    def _api_url(self):
        return f"https://api.telegram.org/bot{self.bot_token}"

    def send(self, title: str, message: str) -> bool:
        text = f"*{title}*\n\n{message}"
        url = f"{self._api_url}/sendMessage"
        status, resp = self._post_json(
            url,
            {
                "chat_id": self.chat_id,
                "text": text,
                "parse_mode": "Markdown",
            },
        )
        if status == 200 and resp.get("ok"):
            logger.info("[Telegram] Bericht verstuurd ✓")
            return True
        logger.error(f"[Telegram] Fout {status}: {resp}")
        return False

    def get_chat_id(self) -> Optional[str]:
        """Hulpfunctie om je chat_id te vinden."""
        url = f"{self._api_url}/getUpdates"
        req = urllib.request.Request(url)
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
                if data.get("result"):
                    chat_id = data["result"][0]["message"]["chat"]["id"]
                    print(f"Je chat_id is: {chat_id}")
                    return str(chat_id)
                print("Geen updates gevonden. Stuur eerst een bericht naar je bot.")
        except Exception as e:
            print(f"Fout bij ophalen chat_id: {e}")
        return None


class TextBeeProvider(NotificationProvider):
    """
    TextBee - Echte SMS via eigen Android-telefoon
    Kosten: gratis (50 SMS/dag, 300/mnd) of €9.99/mnd voor meer
    Setup:
      1. Download TextBee app op Android: https://textbee.dev/
      2. Registreer op textbee.dev, genereer API key
      3. Scan QR code in app om te koppelen
    """

    API_BASE = "https://api.textbee.dev/api/v1"

    def __init__(self, api_key: str = None, device_id: str = None, recipient: str = None):
        self.api_key = api_key or os.environ["TEXTBEE_API_KEY"]
        self.device_id = device_id or os.environ["TEXTBEE_DEVICE_ID"]
        self.recipient = recipient or os.environ["TEXTBEE_RECIPIENT"]

    def send(self, title: str, message: str) -> bool:
        url = f"{self.API_BASE}/gateway/devices/{self.device_id}/sendSMS"
        full_msg = f"{title}: {message}"
        status, resp = self._post_json(
            url,
            {"recipients": [self.recipient], "message": full_msg},
            headers={"x-api-key": self.api_key},
        )
        if status in (200, 201):
            logger.info("[TextBee] SMS verstuurd ✓")
            return True
        logger.error(f"[TextBee] Fout {status}: {resp}")
        return False


class TwilioProvider(NotificationProvider):
    """
    Twilio - Professionele SMS API
    Kosten: ~€0.008/SMS + $1.15/mnd per nummer, $15 trial credit
    Setup: https://twilio.com/
    """

    def __init__(
        self,
        account_sid: str = None,
        auth_token: str = None,
        from_number: str = None,
        to_number: str = None,
    ):
        self.account_sid = account_sid or os.environ["TWILIO_ACCOUNT_SID"]
        self.auth_token = auth_token or os.environ["TWILIO_AUTH_TOKEN"]
        self.from_number = from_number or os.environ["TWILIO_FROM"]
        self.to_number = to_number or os.environ["TWILIO_TO"]

    def send(self, title: str, message: str) -> bool:
        import base64

        url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages.json"
        full_msg = f"{title}: {message}"

        credentials = base64.b64encode(
            f"{self.account_sid}:{self.auth_token}".encode()
        ).decode()

        body = urllib.parse.urlencode({
            "From": self.from_number,
            "To": self.to_number,
            "Body": full_msg,
        }).encode("utf-8")

        req = urllib.request.Request(
            url,
            data=body,
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
                if data.get("sid"):
                    logger.info(f"[Twilio] SMS verstuurd ✓ (SID: {data['sid']})")
                    return True
        except urllib.error.HTTPError as e:
            logger.error(f"[Twilio] Fout {e.code}: {e.read()}")
        return False


def get_provider() -> NotificationProvider:
    """
    Geeft de geconfigureerde notificatieprovider terug op basis van
    de NOTIFICATION_PROVIDER environment variable.
    """
    provider_name = os.environ.get("NOTIFICATION_PROVIDER", "pushover").lower()

    providers = {
        "pushover": PushoverProvider,
        "telegram": TelegramProvider,
        "textbee": TextBeeProvider,
        "twilio": TwilioProvider,
    }

    if provider_name not in providers:
        raise ValueError(
            f"Onbekende provider: '{provider_name}'. "
            f"Kies uit: {', '.join(providers.keys())}"
        )

    logger.info(f"[PROVIDER] Gebruikt: {provider_name}")
    return providers[provider_name]()


def test_provider():
    """Test de geconfigureerde provider door een testbericht te sturen."""
    from datetime import datetime

    provider = get_provider()
    success = provider.send(
        title="Claude Monitor - Test",
        message=f"Test bericht om {datetime.now().strftime('%H:%M:%S')}. Alles werkt!",
    )
    if success:
        print("✅ Testbericht succesvol verstuurd!")
    else:
        print("❌ Testbericht mislukt. Controleer je configuratie.")
    return success


if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.DEBUG)

    if "--test" in sys.argv:
        test_provider()
    elif "--telegram-get-id" in sys.argv:
        provider = TelegramProvider()
        provider.get_chat_id()
    else:
        print("Gebruik: python providers.py --test")
        print("         python providers.py --telegram-get-id")
