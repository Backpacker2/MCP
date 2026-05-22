/*
 * test_integration.c — Integratietests via de gecompileerde binary
 * ==================================================================
 * Deze tests roepen het echte programma aan via system() en popen()
 * en controleren de exit-code en/of output.
 *
 * LEERPUNT: integratietests vs unittests
 *   - Unittests testen één functie in isolatie
 *   - Integratietests testen het volledige programma van buitenaf
 *   - Integratietests vinden bugs die unittests missen (bijv. argument-parsing)
 */

#include "framework.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

/* Pad naar de gecompileerde binary */
#define BINARY "../claude_monitor"

/* ──────────────────────────────────────────────────────────────────
 * Hulpfuncties
 * ────────────────────────────────────────────────────────────────── */

/*
 * Voer een commando uit en geef de exit-code terug.
 * stdout en stderr worden onderdrukt zodat de testoutput leesbaar blijft.
 */
static int run_cmd(const char *cmd)
{
    char onderdrukt[512];
    snprintf(onderdrukt, sizeof(onderdrukt), "%s > /dev/null 2>&1", cmd);
    return system(onderdrukt);
}

/* ═══════════════════════════════════════════════════════════════════
 * --help vlag
 * ═══════════════════════════════════════════════════════════════════ */

/* Happy path: --help geeft exit-code 0 */
static int test_help_exit_nul(void)
{
    int code = run_cmd(BINARY " --help");
    TEST_ASSERT_EQ(0, code);
    return PASS;
}

/* Happy path: -h is alias voor --help */
static int test_help_korte_vlag(void)
{
    int code = run_cmd(BINARY " -h");
    TEST_ASSERT_EQ(0, code);
    return PASS;
}

/* ═══════════════════════════════════════════════════════════════════
 * --list-devices vlag
 * ═══════════════════════════════════════════════════════════════════ */

/* Happy path: --list-devices geeft exit-code 0 (ook zonder modem) */
static int test_list_devices_exit_nul(void)
{
    int code = run_cmd(BINARY " --list-devices");
    TEST_ASSERT_EQ(0, code);
    return PASS;
}

/* ═══════════════════════════════════════════════════════════════════
 * --status vlag
 * ═══════════════════════════════════════════════════════════════════ */

/* Happy path: --status zonder config geeft exit 0 (informatiever bericht) */
static int test_status_zonder_config(void)
{
    int code = run_cmd(BINARY " --status");
    TEST_ASSERT_EQ(0, code);
    return PASS;
}

/* ═══════════════════════════════════════════════════════════════════
 * Ongeldige argumenten
 * ═══════════════════════════════════════════════════════════════════ */

/* Edge case: onbekende vlag → exit-code niet-nul */
static int test_onbekende_vlag(void)
{
    int code = run_cmd(BINARY " --bestaat-niet");
    TEST_ASSERT_TRUE(code != 0);
    return PASS;
}

/* Edge case: -- als enige argument → exit-code niet-nul */
static int test_double_dash_alleen(void)
{
    int code = run_cmd(BINARY " --");
    TEST_ASSERT_TRUE(code != 0);
    return PASS;
}

/* Edge case: spatie als argument */
static int test_spatie_als_argument(void)
{
    int code = run_cmd(BINARY " \" \"");
    TEST_ASSERT_TRUE(code != 0);
    return PASS;
}

/* Edge case: --hit zonder config (geen telefoonnummer) → exit niet-nul */
static int test_hit_zonder_config(void)
{
    /*
     * We verwijderen het config-bestand zodat er geen nummer geconfigureerd is.
     * --hit moet dan mislukken met een foutmelding.
     */
    system("rm -f ./claude_monitor.conf");
    int code = run_cmd(BINARY " --hit");
    TEST_ASSERT_TRUE(code != 0);
    return PASS;
}

/* Edge case: --test zonder config → exit niet-nul */
static int test_test_zonder_config(void)
{
    system("rm -f ./claude_monitor.conf");
    int code = run_cmd(BINARY " --test");
    TEST_ASSERT_TRUE(code != 0);
    return PASS;
}

/* Edge case: --hit --at met ongeldig tijdformaat */
static int test_hit_at_ongeldig_formaat(void)
{
    /* Maak een config-bestand zodat het nummer-check passeert */
    system("echo 'phone=+31612345678' > ./claude_monitor.conf");
    system("echo 'use_adb=1' >> ./claude_monitor.conf");
    system("echo 'android_version=11' >> ./claude_monitor.conf");
    system("echo 'baud_rate=115200' >> ./claude_monitor.conf");
    system("echo 'serial_device=/dev/ttyUSB0' >> ./claude_monitor.conf");

    int code = run_cmd(BINARY " --hit --at \"geen-tijdstip\"");
    TEST_ASSERT_TRUE(code != 0);   /* Ongeldige tijd → fout */

    system("rm -f ./claude_monitor.conf");
    return PASS;
}

/* Edge case: --hit --at met uur > 23 */
static int test_hit_at_uur_te_groot(void)
{
    system("echo 'phone=+31612345678' > ./claude_monitor.conf");
    system("echo 'use_adb=1' >> ./claude_monitor.conf");
    system("echo 'android_version=11' >> ./claude_monitor.conf");
    system("echo 'baud_rate=115200' >> ./claude_monitor.conf");
    system("echo 'serial_device=/dev/ttyUSB0' >> ./claude_monitor.conf");

    int code = run_cmd(BINARY " --hit --at \"25:00\"");
    TEST_ASSERT_TRUE(code != 0);

    system("rm -f ./claude_monitor.conf");
    return PASS;
}

/* Edge case: --hit --at met minuut > 59 */
static int test_hit_at_minuut_te_groot(void)
{
    system("echo 'phone=+31612345678' > ./claude_monitor.conf");
    system("echo 'use_adb=1' >> ./claude_monitor.conf");
    system("echo 'android_version=11' >> ./claude_monitor.conf");
    system("echo 'baud_rate=115200' >> ./claude_monitor.conf");
    system("echo 'serial_device=/dev/ttyUSB0' >> ./claude_monitor.conf");

    int code = run_cmd(BINARY " --hit --at \"12:99\"");
    TEST_ASSERT_TRUE(code != 0);

    system("rm -f ./claude_monitor.conf");
    return PASS;
}

/* Edge case: --hit --at met negatief uur */
static int test_hit_at_negatief_uur(void)
{
    system("echo 'phone=+31612345678' > ./claude_monitor.conf");
    system("echo 'use_adb=1' >> ./claude_monitor.conf");
    system("echo 'android_version=11' >> ./claude_monitor.conf");
    system("echo 'baud_rate=115200' >> ./claude_monitor.conf");
    system("echo 'serial_device=/dev/ttyUSB0' >> ./claude_monitor.conf");

    int code = run_cmd(BINARY " --hit --at \"-1:00\"");
    TEST_ASSERT_TRUE(code != 0);

    system("rm -f ./claude_monitor.conf");
    return PASS;
}

/* Happy path: --hit --at met geldig tijdstip in het verleden */
static int test_hit_at_geldig_tijdstip_verleden(void)
{
    /*
     * "01:00" is waarschijnlijk in het verleden (tenzij je dit om 01:00 uitvoert).
     * Het programma:
     *  1. Berekent reset = 01:00 + 5 uur = 06:00
     *  2. Als 06:00 ook al verstreken is: timer_wait_until(-1) → onmiddellijk klaar
     *  3. Probeert SMS te sturen → ADB niet beschikbaar → exit niet-nul
     *
     * We testen dat het programma NIET hangt (binnen 5 seconden klaar is).
     */
    system("echo 'phone=+31612345678' > ./claude_monitor.conf");
    system("echo 'use_adb=1' >> ./claude_monitor.conf");
    system("echo 'android_version=11' >> ./claude_monitor.conf");
    system("echo 'baud_rate=115200' >> ./claude_monitor.conf");
    system("echo 'serial_device=/dev/ttyUSB0' >> ./claude_monitor.conf");

    /*
     * timeout(1) stopt het programma na 1 seconde als het hangt.
     * Als het programma normaal in <1s klaar is, slaagt de test.
     */
    int code = system(
        "timeout 5 " BINARY " --hit --at \"01:00\" > /dev/null 2>&1"
    );

    /*
     * exit-code van timeout:
     *  - 0  = programma klaar vóór timeout, exit 0
     *  - 1  = programma klaar vóór timeout, exit niet-nul (ADB mislukt)
     *  - 124 = programma te langzaam (timeout getriggerd) → FOUT
     */
    TEST_ASSERT_TRUE(code != 124 * 256);   /* Geen timeout */

    system("rm -f ./claude_monitor.conf");
    system("rm -f /tmp/claude_monitor_state.txt");
    return PASS;
}

/* ═══════════════════════════════════════════════════════════════════
 * Geen argumenten
 * ═══════════════════════════════════════════════════════════════════ */

/* Happy path: zonder argumenten toont help en status, exit 0 */
static int test_geen_argumenten_exit_nul(void)
{
    int code = run_cmd(BINARY);
    TEST_ASSERT_EQ(0, code);
    return PASS;
}

/* ═══════════════════════════════════════════════════════════════════
 * Binary aanwezig?
 * ═══════════════════════════════════════════════════════════════════ */

/* Sanity check: binary bestaat en is uitvoerbaar */
static int test_binary_bestaat(void)
{
    int code = run_cmd("test -x " BINARY);
    TEST_ASSERT_EQ(0, code);
    return PASS;
}

/* ═══════════════════════════════════════════════════════════════════
 * main() voor integratietests
 * ═══════════════════════════════════════════════════════════════════ */

int main(void)
{
    printf("╔══════════════════════════════════════════════╗\n");
    printf("║   Integratietests (binary aanroepen)         ║\n");
    printf("╚══════════════════════════════════════════════╝\n");

    TEST_SECTION("Sanity checks");
    RUN_TEST(test_binary_bestaat);

    TEST_SECTION("Vlaggen — happy paths");
    RUN_TEST(test_geen_argumenten_exit_nul);
    RUN_TEST(test_help_exit_nul);
    RUN_TEST(test_help_korte_vlag);
    RUN_TEST(test_list_devices_exit_nul);
    RUN_TEST(test_status_zonder_config);

    TEST_SECTION("Ongeldige argumenten — edge cases");
    RUN_TEST(test_onbekende_vlag);
    RUN_TEST(test_double_dash_alleen);
    RUN_TEST(test_spatie_als_argument);

    TEST_SECTION("--hit zonder config — edge cases");
    RUN_TEST(test_hit_zonder_config);
    RUN_TEST(test_test_zonder_config);

    TEST_SECTION("--hit --at tijdformaat — edge cases");
    RUN_TEST(test_hit_at_ongeldig_formaat);
    RUN_TEST(test_hit_at_uur_te_groot);
    RUN_TEST(test_hit_at_minuut_te_groot);
    RUN_TEST(test_hit_at_negatief_uur);
    RUN_TEST(test_hit_at_geldig_tijdstip_verleden);

    PRINT_TEST_REPORT();

    return (g_tests_failed > 0) ? 1 : 0;
}
