# Claude Credits Monitor - Docker Container
# Gebruik: docker-compose up -d
FROM python:3.12-slim

# Systeemdependencies voor Playwright/Chromium
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libxcursor1 \
    libgtk-3-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Playwright installeren
RUN playwright install chromium --with-deps

# App-code kopiëren
COPY claude_monitor.py .
COPY .env .env

# Volume voor sessie en state persistentie
VOLUME ["/app/data"]

ENV SESSION_FILE=/app/data/session.json
ENV STATE_FILE=/app/data/state.json

# Gezondheidscheck
HEALTHCHECK --interval=15m --timeout=30s --start-period=60s --retries=3 \
    CMD python claude_monitor.py --check-once || exit 1

CMD ["python", "claude_monitor.py"]
