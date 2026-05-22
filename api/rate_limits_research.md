# Claude API Rate Limits - Technisch Onderzoek

## Officiële API (api.anthropic.com)

### Rate limit response headers
Elke API-response bevat deze headers:

```
anthropic-ratelimit-requests-limit: 5
anthropic-ratelimit-requests-remaining: 4
anthropic-ratelimit-requests-reset: 2023-08-28T18:42:00Z
anthropic-ratelimit-tokens-limit: 10000
anthropic-ratelimit-tokens-remaining: 8000
anthropic-ratelimit-tokens-reset: 2023-08-28T18:42:00Z
retry-after: 10   (alleen bij 429-response)
```

### Rate Limits API (Admin, gelanceerd april 2026)
- Endpoint: `GET https://api.anthropic.com/v1/rate_limits`
- Vereist: Admin API key
- Bevat: requests/tokens limieten per tijdvenster in JSON
- **NIET beschikbaar** voor consumer-plans (Pro/Max)

### Usage Report API (Enterprise)
- Endpoint: `GET https://api.anthropic.com/v1/organizations/usage_report/claude_code`
- Vereist: Admin API key voor organisaties
- **NIET beschikbaar** voor individuele Pro/Max-gebruikers

---

## Claude.ai Web Interface (consumer)

### Sessie-authenticatie
Claude.ai gebruikt waarschijnlijk een session-cookie of JWT-token.
Te vinden via: Chrome DevTools → Application → Cookies → claude.ai

Veelgebruikte cookie-namen:
- `__session`
- `sessionKey`
- `auth-token`
- `_claude_session`

### Verborgen API endpoints (te onderzoeken via DevTools)

Open claude.ai/settings/usage in Chrome, ga naar DevTools → Network.
Filter op XHR/Fetch. Zoek naar:

```
GET /api/account/usage
GET /api/organizations/{id}/limits
GET /api/me/usage  
GET /api/billing/usage
```

**Hoe te onderzoeken:**
1. Open Chrome DevTools (F12)
2. Ga naar Network tab
3. Filter: XHR
4. Navigeer naar claude.ai/settings/usage
5. Zoek in de requests naar JSON-responses met usage-data

### Verwachte JSON-structuur (hypothetisch)
```json
{
  "usage": {
    "messages_used": 45,
    "messages_limit": 100,
    "usage_percent": 45.0,
    "reset_at": "2026-05-22T18:30:00Z",
    "window_hours": 5
  }
}
```

---

## Websocket analyse

Claude.ai gebruikt websockets voor:
- Streaming responses (tokens één voor één)
- Real-time status updates

**Websocket URL patroon** (te vinden via DevTools → WS):
```
wss://claude.ai/api/ws/...
```

De usage-data wordt waarschijnlijk NIET via websockets verstuurd
maar via normale HTTP-requests bij paginabezoek.

---

## Berekende reset-tijd methode

Als je weet wanneer je de limiet hebt bereikt:

```python
from datetime import datetime, timedelta

def calculate_reset_time(limit_hit_at: datetime) -> datetime:
    """
    Claude's 5-uur window reset.
    De reset varieert met ±30-60 minuten.
    We berekenen een conservatieve schatting.
    """
    # Basis: 5 uur na het raken van de limiet
    base_reset = limit_hit_at + timedelta(hours=5)
    
    # Buffer: stuur SMS 5 minuten voor verwachte reset
    alert_time = base_reset - timedelta(minutes=5)
    
    return base_reset, alert_time

# Voorbeeld:
limit_at = datetime(2026, 5, 22, 13, 30)
reset, alert = calculate_reset_time(limit_at)
print(f"Verwachte reset: {reset.strftime('%H:%M')}")
print(f"SMS-alert om:   {alert.strftime('%H:%M')}")
```

---

## Conclusie

Voor **consumer Claude.ai** (Pro/Max):
- Geen officiële API voor usage-data
- Enige beschikbare methode: browser scraping van claude.ai/settings/usage
- Of: handmatig reset-tijd berekenen op basis van limiet-tijdstip

Voor **Anthropic API** (api.anthropic.com):
- Rate limit headers in elke response
- Rate Limits API (admin-only)
- Beschikbaar in SDK: `response.headers`
