# Makefile — Testsuite voor Claude Credits Monitor
#
# Gebruik:
#   make              Compileer alle tests
#   make run          Compileer + voer alle tests uit
#   make run-timer    Alleen timer-tests
#   make run-sms      Alleen SMS-tests
#   make run-integration  Alleen integratietests
#   make clean        Verwijder gecompileerde bestanden
#   make valgrind     Voer tests uit met geheugencontrole (vereist valgrind)

CC     = gcc
CFLAGS = -Wall -Wextra -std=c11 -D_GNU_SOURCE -g

# Bronbestanden van de modules die we testen
MODULE_SRCS = ../timer.c ../sms.c

# Framework-bronbestand
FRAMEWORK = framework.c

# Test-executables
TEST_TIMER       = test_timer
TEST_SMS         = test_sms
TEST_INTEGRATION = test_integration

ALL_TESTS = $(TEST_TIMER) $(TEST_SMS) $(TEST_INTEGRATION)

# ── Compileren ─────────────────────────────────────────────────────

all: $(ALL_TESTS)
	@echo ""
	@echo "✓ Alle tests gecompileerd. Voer 'make run' uit."

$(TEST_TIMER): test_timer.c $(FRAMEWORK) $(MODULE_SRCS)
	$(CC) $(CFLAGS) -o $@ $^ -I..
	@echo "✓ $(TEST_TIMER) gecompileerd"

$(TEST_SMS): test_sms.c $(FRAMEWORK) $(MODULE_SRCS)
	$(CC) $(CFLAGS) -o $@ $^ -I..
	@echo "✓ $(TEST_SMS) gecompileerd"

$(TEST_INTEGRATION): test_integration.c $(FRAMEWORK)
	$(CC) $(CFLAGS) -o $@ test_integration.c $(FRAMEWORK) -I..
	@echo "✓ $(TEST_INTEGRATION) gecompileerd"

# ── Tests uitvoeren ────────────────────────────────────────────────

run: all run-timer run-sms run-integration
	@echo ""
	@echo "══════════════════════════════════════════════"
	@echo "  Alle testsuites voltooid."
	@echo "══════════════════════════════════════════════"

run-timer: $(TEST_TIMER)
	@echo ""
	./$(TEST_TIMER)

run-sms: $(TEST_SMS)
	@echo ""
	./$(TEST_SMS)

run-integration: $(TEST_INTEGRATION)
	@echo ""
	./$(TEST_INTEGRATION)

# ── Valgrind geheugencheck ─────────────────────────────────────────

valgrind: all
	@echo "\n── Valgrind: timer tests ──"
	valgrind --error-exitcode=1 --leak-check=full ./$(TEST_TIMER) 2>&1 | tail -20
	@echo "\n── Valgrind: SMS tests ──"
	valgrind --error-exitcode=1 --leak-check=full ./$(TEST_SMS) 2>&1 | tail -20

# ── Opruimen ──────────────────────────────────────────────────────

clean:
	rm -f $(ALL_TESTS) *.o
	rm -f /tmp/claude_test_*.txt
	@echo "✓ Opgeruimd"

.PHONY: all run run-timer run-sms run-integration valgrind clean
