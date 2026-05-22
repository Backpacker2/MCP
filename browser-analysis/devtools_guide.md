# Browser DevTools Analyse - Claude.ai

## Doel
Verborgen API-endpoints en session-data vinden op claude.ai
die usage-informatie bevatten.

---

## Stap-voor-stap: DevTools Analyse

### 1. Open Chrome DevTools
- Ga naar claude.ai/settings/usage
- Druk F12 (of Ctrl+Shift+I op Windows/Linux, Cmd+Option+I op Mac)

### 2. Network Tab
- Klik op "Network" tab
- Selecteer "Fetch/XHR" filter
- Ververs de pagina (F5)
- Zoek naar requests met "usage", "limit", "account" in de URL

### 3. Application Tab - Cookies
- Klik op "Application" tab
- Links: Storage → Cookies → https://claude.ai
- Noteer de cookie-namen en -waarden (i.h.b. session-gerelateerde)

### 4. Application Tab - Local Storage
- Links: Storage → Local Storage → https://claude.ai
- Kijk of er usage-data in localStorage staat

### 5. WebSocket Monitoring
- Terug naar Network tab
- Selecteer "WS" filter
- Bekijk berichten die binnenkomen

---

## JavaScript Console - Directe Uitvoering

Open de console (Ctrl+Shift+J) en voer dit uit om usage-data te zoeken:

```javascript
// Zoek in localStorage
Object.entries(localStorage)
  .filter(([k, v]) => k.includes('usage') || k.includes('limit') || k.includes('credit'))
  .forEach(([k, v]) => console.log(k, ':', v));

// Zoek in sessionStorage
Object.entries(sessionStorage)
  .filter(([k, v]) => k.includes('usage') || k.includes('limit'))
  .forEach(([k, v]) => console.log(k, ':', v));

// Haal alle cookies op
document.cookie.split(';').forEach(c => console.log(c.trim()));
```

### Usage via React/Redux state (als het een React app is)
```javascript
// Zoek naar React root
const root = document.getElementById('root') || document.getElementById('__next');
if (root && root._reactInternals) {
  // Traverse fiber tree (experimenteel)
  console.log('React fiber gevonden');
}

// Zoek naar Next.js data
if (window.__NEXT_DATA__) {
  console.log(JSON.stringify(window.__NEXT_DATA__, null, 2));
}
```

---

## Fetch Interceptor - Alle API Calls Loggen

Plak dit in de console om alle fetch-requests te onderscheppen:

```javascript
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const url = args[0];
  if (typeof url === 'string' && 
      (url.includes('usage') || url.includes('limit') || url.includes('account'))) {
    console.group('📡 Interessant request: ' + url);
    originalFetch.apply(this, args).then(r => {
      r.clone().json().then(data => {
        console.log('Response:', JSON.stringify(data, null, 2));
      }).catch(() => {});
    });
    console.groupEnd();
  }
  return originalFetch.apply(this, args);
};
console.log('✅ Fetch interceptor actief! Navigeer nu naar settings/usage.');
```

---

## XHR Interceptor (voor oudere requests)

```javascript
const origOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url, ...rest) {
  if (url.includes('usage') || url.includes('limit')) {
    console.log(`XHR: ${method} ${url}`);
    this.addEventListener('load', function() {
      try {
        console.log('XHR Response:', JSON.parse(this.responseText));
      } catch(e) {}
    });
  }
  return origOpen.call(this, method, url, ...rest);
};
```

---

## Verwachte bevindingen

Op basis van typische Next.js SaaS-applicaties verwachten we:

1. **Session cookie**: `__session` of `sb-xxx-auth-token`
2. **API endpoint**: mogelijk `/api/auth/session` voor account-info
3. **Usage endpoint**: `/api/account/usage` of vergelijkbaar
4. **GraphQL**: sommige apps gebruiken één `/api/graphql` endpoint voor alles

---

## Hoe de gevonden cookie gebruiken in Python

```python
import requests

# Kopieer je session cookie uit DevTools
cookies = {
    "__session": "JOUW_SESSION_WAARDE_HIER",
}

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
    "Referer": "https://claude.ai/settings/usage",
}

# Test endpoints
endpoints = [
    "https://claude.ai/api/account/usage",
    "https://claude.ai/api/organizations/me/limits",
    "https://claude.ai/api/me",
]

for url in endpoints:
    r = requests.get(url, cookies=cookies, headers=headers)
    print(f"\n{url}")
    print(f"Status: {r.status_code}")
    if r.status_code == 200:
        try:
            print(r.json())
        except:
            print(r.text[:200])
```

---

## Tampermonkey Script

Dit script draait in je browser en stuurt de usage-data naar je eigen endpoint:

```javascript
// ==UserScript==
// @name         Claude Usage Monitor
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Monitor Claude.ai usage en stuur data naar webhook
// @author       jij
// @match        https://claude.ai/settings/usage
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const WEBHOOK_URL = 'http://localhost:8080/usage'; // Jouw lokale server

    function extractUsage() {
        // Probeer percentage te vinden in DOM
        const progressBars = document.querySelectorAll('[aria-valuenow]');
        let usagePercent = null;

        progressBars.forEach(bar => {
            const now = parseFloat(bar.getAttribute('aria-valuenow'));
            const max = parseFloat(bar.getAttribute('aria-valuemax') || '100');
            if (!isNaN(now) && !isNaN(max)) {
                usagePercent = (now / max) * 100;
            }
        });

        // Zoek in tekst
        if (usagePercent === null) {
            const text = document.body.innerText;
            const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
            if (match) usagePercent = parseFloat(match[1]);
        }

        return usagePercent;
    }

    function sendToWebhook(usagePercent) {
        GM_xmlhttpRequest({
            method: 'POST',
            url: WEBHOOK_URL,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({
                usage_percent: usagePercent,
                timestamp: new Date().toISOString(),
                url: window.location.href,
            }),
            onload: (r) => console.log('[Claude Monitor] Webhook:', r.status),
            onerror: (e) => console.error('[Claude Monitor] Webhook fout:', e),
        });
    }

    // Wacht tot pagina geladen is
    setTimeout(() => {
        const usage = extractUsage();
        console.log(`[Claude Monitor] Usage: ${usage}%`);
        if (usage !== null) {
            sendToWebhook(usage);
        }
    }, 3000);

})();
```
