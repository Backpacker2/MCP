#!/bin/bash
# ──────────────────────────────────────────────────────────────────────
# Claude Credits Monitor - Service Setup Script
# Werkt op Linux (Raspberry Pi, VPS, Ubuntu desktop)
# ──────────────────────────────────────────────────────────────────────
# Gebruik: chmod +x run_as_service.sh && ./run_as_service.sh
# ──────────────────────────────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOLUTION_DIR="$SCRIPT_DIR/../recommended-solution"
PYTHON=$(which python3)
SERVICE_NAME="claude-monitor"
LOG_DIR="$SOLUTION_DIR/logs"

echo "═══════════════════════════════════════════════"
echo "  Claude Credits Monitor - Service Installer"
echo "═══════════════════════════════════════════════"

mkdir -p "$LOG_DIR"

# ── Optie 1: systemd service (Linux servers/Raspberry Pi) ──────────────
install_systemd_service() {
    echo ""
    echo "[1/3] Systemd service aanmaken..."

    SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
    sudo tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=Claude Credits Monitor
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$SOLUTION_DIR
ExecStart=$PYTHON claude_monitor.py
Restart=on-failure
RestartSec=30
StandardOutput=append:$LOG_DIR/stdout.log
StandardError=append:$LOG_DIR/stderr.log
EnvironmentFile=$SOLUTION_DIR/.env

[Install]
WantedBy=multi-user.target
EOF

    echo "[2/3] Service activeren..."
    sudo systemctl daemon-reload
    sudo systemctl enable "$SERVICE_NAME"
    sudo systemctl start "$SERVICE_NAME"

    echo "[3/3] Status:"
    sudo systemctl status "$SERVICE_NAME" --no-pager

    echo ""
    echo "✅ Service geïnstalleerd!"
    echo ""
    echo "Beheercommando's:"
    echo "  sudo systemctl status $SERVICE_NAME"
    echo "  sudo systemctl stop $SERVICE_NAME"
    echo "  sudo systemctl restart $SERVICE_NAME"
    echo "  sudo journalctl -u $SERVICE_NAME -f"
}

# ── Optie 2: Cron job ──────────────────────────────────────────────────
install_cron() {
    echo ""
    echo "Cron job toevoegen (elke 10 minuten)..."

    CRON_CMD="*/10 * * * * cd $SOLUTION_DIR && $PYTHON claude_monitor.py --check-once >> $LOG_DIR/cron.log 2>&1"

    # Check of cron job al bestaat
    if crontab -l 2>/dev/null | grep -q "claude_monitor"; then
        echo "Cron job bestaat al."
    else
        (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
        echo "✅ Cron job toegevoegd!"
    fi

    echo ""
    echo "Huidige cron jobs:"
    crontab -l | grep -E "claude|#" || echo "(geen)"
}

# ── Optie 3: Screen sessie (snelste optie) ─────────────────────────────
run_in_screen() {
    if ! command -v screen &> /dev/null; then
        echo "Screen niet gevonden. Installeren..."
        sudo apt-get install -y screen 2>/dev/null || brew install screen 2>/dev/null || true
    fi

    screen -dmS claude-monitor bash -c "cd '$SOLUTION_DIR' && $PYTHON claude_monitor.py"
    echo "✅ Monitor draait in screen sessie 'claude-monitor'"
    echo "   Bekijk met: screen -r claude-monitor"
    echo "   Sluit met:  Ctrl+A, dan D"
}

# ── Menu ──────────────────────────────────────────────────────────────
echo ""
echo "Kies installatiemethode:"
echo "  1) systemd service  (aanbevolen voor servers/Raspberry Pi)"
echo "  2) Cron job         (eenvoudig, elke 10 min)"
echo "  3) Screen sessie    (snel, maar niet persistent na reboot)"
echo ""
read -r -p "Keuze [1/2/3]: " choice

case $choice in
    1) install_systemd_service ;;
    2) install_cron ;;
    3) run_in_screen ;;
    *) echo "Ongeldige keuze"; exit 1 ;;
esac

echo ""
echo "Log bekijken: tail -f $LOG_DIR/stdout.log"
