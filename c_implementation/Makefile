# Makefile — Claude Credits Monitor (C)
#
# LEERPUNTEN:
#  - CC: de C-compiler (gcc of clang)
#  - CFLAGS: compiler-opties
#  - Targets: regels die make kan uitvoeren
#  - Automatische variabelen: $@, $<, $^
#
# Gebruik:
#   make          Compileer het programma
#   make clean    Verwijder gecompileerde bestanden
#   make install  Installeer naar /usr/local/bin
#   make debug    Compileer met debug-informatie (voor GDB)

CC      = gcc
TARGET  = claude_monitor
SRCS    = main.c timer.c sms.c
OBJS    = $(SRCS:.c=.o)   # Vervang .c door .o voor elk bronbestand

# Compiler-opties uitgelegd:
#  -Wall          Toon ALLE waarschuwingen (gebruik dit altijd!)
#  -Wextra        Nog meer waarschuwingen
#  -std=c11       Gebruik C11 standaard (2011)
#  -D_GNU_SOURCE  Schakel GNU-extensies in (voor localtime_r etc.)
CFLAGS  = -Wall -Wextra -std=c11 -D_GNU_SOURCE

# Release build (geoptimaliseerd)
CFLAGS_RELEASE = $(CFLAGS) -O2

# Debug build (voor GDB)
CFLAGS_DEBUG = $(CFLAGS) -g -O0 -DDEBUG

# ── Standaard target: compileer release versie ─────────────────────

all: $(TARGET)

# Link de object-bestanden samen tot één executable
# $@ = naam van het target (claude_monitor)
# $^ = alle dependencies (alle .o bestanden)
$(TARGET): $(OBJS)
	$(CC) $(CFLAGS_RELEASE) -o $@ $^
	@echo ""
	@echo "✓ Gecompileerd: ./$(TARGET)"
	@echo "  Gebruik: ./$(TARGET) --help"

# Compileer één .c bestand naar een .o bestand
# $< = het eerste dependency (het .c bestand)
# $@ = naam van het target (het .o bestand)
%.o: %.c
	$(CC) $(CFLAGS_RELEASE) -c -o $@ $<

# ── Debug build ────────────────────────────────────────────────────

debug: CFLAGS_RELEASE = $(CFLAGS_DEBUG)
debug: $(TARGET)
	@echo "  (debug build met GDB-symbolen)"

# ── Schoonmaken ────────────────────────────────────────────────────

clean:
	rm -f $(OBJS) $(TARGET)
	@echo "✓ Opgeruimd"

# ── Installeren ────────────────────────────────────────────────────

install: $(TARGET)
	install -m 755 $(TARGET) /usr/local/bin/
	@echo "✓ Geïnstalleerd: /usr/local/bin/$(TARGET)"

uninstall:
	rm -f /usr/local/bin/$(TARGET)

# ── Info ───────────────────────────────────────────────────────────

info:
	@echo "Bronbestanden:   $(SRCS)"
	@echo "Object bestanden: $(OBJS)"
	@echo "Executable:      $(TARGET)"
	@which adb > /dev/null 2>&1 && echo "ADB: gevonden ✓" || echo "ADB: niet gevonden"
	@ls /dev/ttyUSB* 2>/dev/null && echo "USB modem: gevonden ✓" || echo "USB modem: niet gevonden"

# .PHONY vertelt make dat dit geen bestandsnamen zijn
# (anders zou make denken dat "clean" een bestand is dat gemaakt moet worden)
.PHONY: all debug clean install uninstall info
