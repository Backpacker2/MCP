/*
 * test_timer.c — Unittests voor timer.c
 * =======================================
 * Getest:
 *  - timer_calculate_reset()
 *  - timer_format_duration()
 *  - timer_format_time()
 *  - timer_save_state() + timer_load_state()
 *  - timer_wait_until() (alleen foutpad — we wachten niet echt 5 uur)
 *
 * Happy paths: normale, geldige invoer
 * Edge cases:  ongeldige/extreme invoer
 */

#include "framework.h"
#include "../timer.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>   /* unlink() — bestand verwijderen */
#include <time.h>

/* Tijdelijk bestand voor file I/O tests */
#define TEMP_STATE_FILE "/tmp/claude_test_state.txt"

/* ═══════════════════════════════════════════════════════════════════
 * timer_calculate_reset()
 * ═══════════════════════════════════════════════════════════════════ */

/* Happy path: normale waarde → exact 5 uur erbij */
static int test_calculate_reset_vijf_uur(void)
{
    time_t basis = 1000000;                          /* willekeurig tijdstip */
    time_t verwacht = basis + (5 * 3600);            /* + 5 uur in seconden */
    time_t resultaat = timer_calculate_reset(basis);

    TEST_ASSERT_EQ(verwacht, resultaat);
    return PASS;
}

/* Happy path: recenter tijdstip */
static int test_calculate_reset_recent(void)
{
    time_t nu = time(NULL);
    time_t reset = timer_calculate_reset(nu);

    /* Reset moet PRECIES 18000 seconden (5 uur) in de toekomst liggen */
    TEST_ASSERT_EQ(18000, (long)difftime(reset, nu));
    return PASS;
}

/* Edge case: epoch-nulpunt (1 jan 1970 00:00:00 UTC) */
static int test_calculate_reset_epoch_nul(void)
{
    time_t resultaat = timer_calculate_reset(0);
    TEST_ASSERT_EQ(18000, (long)resultaat);   /* 0 + 5*3600 */
    return PASS;
}

/* Edge case: grote waarde (ver in de toekomst) */
static int test_calculate_reset_grote_waarde(void)
{
    time_t basis = 2000000000L;   /* ~ jan 2033 */
    time_t resultaat = timer_calculate_reset(basis);
    TEST_ASSERT_EQ(basis + 18000, resultaat);
    return PASS;
}

/* ═══════════════════════════════════════════════════════════════════
 * timer_format_duration()
 * ═══════════════════════════════════════════════════════════════════ */

/* Happy path: gemixte waarde */
static int test_format_duration_gemengd(void)
{
    char buf[64];
    timer_format_duration(7265.0, buf, sizeof(buf));   /* 2u 1m 5s */
    TEST_ASSERT_STR_EQ("2u 1m 5s", buf);
    return PASS;
}

/* Happy path: exact 1 uur */
static int test_format_duration_een_uur(void)
{
    char buf[64];
    timer_format_duration(3600.0, buf, sizeof(buf));
    TEST_ASSERT_STR_EQ("1u 0m 0s", buf);
    return PASS;
}

/* Happy path: exact 1 minuut */
static int test_format_duration_een_minuut(void)
{
    char buf[64];
    timer_format_duration(60.0, buf, sizeof(buf));
    TEST_ASSERT_STR_EQ("0u 1m 0s", buf);
    return PASS;
}

/* Happy path: exact 1 seconde */
static int test_format_duration_een_seconde(void)
{
    char buf[64];
    timer_format_duration(1.0, buf, sizeof(buf));
    TEST_ASSERT_STR_EQ("0u 0m 1s", buf);
    return PASS;
}

/* Edge case: nul seconden */
static int test_format_duration_nul(void)
{
    char buf[64];
    timer_format_duration(0.0, buf, sizeof(buf));
    TEST_ASSERT_STR_EQ("0u 0m 0s", buf);
    return PASS;
}

/* Edge case: volledige 5-uurs reset-periode */
static int test_format_duration_vijf_uur(void)
{
    char buf[64];
    timer_format_duration(5.0 * 3600.0, buf, sizeof(buf));
    TEST_ASSERT_STR_EQ("5u 0m 0s", buf);
    return PASS;
}

/* Edge case: grote waarde (meer dan 24 uur) */
static int test_format_duration_groot(void)
{
    char buf[64];
    timer_format_duration(90061.0, buf, sizeof(buf));   /* 25u 1m 1s */
    TEST_ASSERT_STR_EQ("25u 1m 1s", buf);
    return PASS;
}

/* Edge case: buffer te klein (1 byte — alleen null-terminator) */
static int test_format_duration_buffer_te_klein(void)
{
    char buf[1] = {0xFF};   /* Sla een opzettelijk "vuile" waarde op */
    timer_format_duration(3661.0, buf, 1);

    /*
     * snprintf() met buf_len=1 schrijft alleen de null-terminator.
     * De buffer moet leeg zijn (lege string), NIET crashen.
     */
    TEST_ASSERT_EQ(0, (int)strlen(buf));   /* Lege string verwacht */
    return PASS;
}

/* Edge case: buffer van 5 bytes (trunctie) */
static int test_format_duration_buffer_vijf_bytes(void)
{
    char buf[5];
    timer_format_duration(3661.0, buf, 5);

    /* "1u 1m 1s" wordt afgekapt naar "1u 1" (4 tekens + null) */
    TEST_ASSERT_EQ(4, (int)strlen(buf));
    return PASS;
}

/* Edge case: negatieve waarde (implementatiegedrag documenteren) */
static int test_format_duration_negatief(void)
{
    char buf[64];
    /*
     * timer_format_duration cast naar int. Negatieve waarden
     * zijn undefined behavior als int overflow optreedt, maar
     * voor kleine negatieve waarden (cast van -1.0 → -1):
     * -1 / 3600 = 0, -1 % 3600 = -1, -1 / 60 = 0, -1 % 60 = -1
     * Resultaat: "0u 0m -1s"
     *
     * We testen dat de functie NIET crasht — exact format is secondary.
     */
    timer_format_duration(-1.0, buf, sizeof(buf));
    TEST_ASSERT_TRUE(strlen(buf) > 0);   /* Niet gecrasht, iets teruggegeven */
    return PASS;
}

/* ═══════════════════════════════════════════════════════════════════
 * timer_format_time()
 *
 * BELANGRIJK: We zetten TZ=UTC zodat localtime_r() een deterministische
 * uitvoer geeft, onafhankelijk van de tijdzone van de computer.
 * ═══════════════════════════════════════════════════════════════════ */

/* Hulpfunctie: zet timezone op UTC voor deterministische tests */
static void zet_utc(void)
{
    setenv("TZ", "UTC", 1);
    tzset();   /* Past de interne timezone-data aan */
}

/* Happy path: epoch = 00:00:00 UTC */
static int test_format_time_epoch(void)
{
    zet_utc();
    char buf[32];
    timer_format_time(0, buf, sizeof(buf));
    TEST_ASSERT_STR_EQ("00:00:00", buf);
    return PASS;
}

/* Happy path: 1 uur na epoch = 01:00:00 UTC */
static int test_format_time_een_uur(void)
{
    zet_utc();
    char buf[32];
    timer_format_time(3600, buf, sizeof(buf));
    TEST_ASSERT_STR_EQ("01:00:00", buf);
    return PASS;
}

/* Happy path: 13:37:42 UTC */
static int test_format_time_middag(void)
{
    zet_utc();
    char buf[32];
    /* 13*3600 + 37*60 + 42 = 49062 seconden na middernacht */
    timer_format_time(49062, buf, sizeof(buf));
    TEST_ASSERT_STR_EQ("13:37:42", buf);
    return PASS;
}

/* Happy path: een seconde voor middernacht */
static int test_format_time_voor_middernacht(void)
{
    zet_utc();
    char buf[32];
    timer_format_time(86399, buf, sizeof(buf));   /* 23:59:59 */
    TEST_ASSERT_STR_EQ("23:59:59", buf);
    return PASS;
}

/* Edge case: buffer precies groot genoeg voor "HH:MM:SS\0" (9 bytes) */
static int test_format_time_buffer_exact(void)
{
    zet_utc();
    char buf[9];
    timer_format_time(0, buf, 9);
    TEST_ASSERT_STR_EQ("00:00:00", buf);
    return PASS;
}

/* Edge case: buffer te klein → getrunceerd maar geen crash */
static int test_format_time_buffer_te_klein(void)
{
    zet_utc();
    char buf[4];   /* Kan slechts "00:\0" bevatten */
    timer_format_time(0, buf, sizeof(buf));

    /* strftime met kleine buffer moet null-termineren */
    TEST_ASSERT_TRUE(strlen(buf) <= 3);   /* max 3 tekens + null */
    return PASS;
}

/* Edge case: buffer van 1 byte → lege string door defensieve null-terminatie */
static int test_format_time_buffer_een_byte(void)
{
    zet_utc();
    char buf[1] = {0xFF};
    timer_format_time(0, buf, 1);
    /*
     * BUG GEVONDEN EN GEFIXT:
     * De C-standaard laat de buffer "unspecified" als strftime() 0 teruggeeft.
     * Op Linux schreef strftime(buf, 1, ...) de 0xFF niet weg.
     * Fix in timer_format_time(): defensief buf[0]='\0' vóór strftime().
     * Verwachting na fix: lege string (buf[0] == '\0').
     */
    TEST_ASSERT_EQ('\0', buf[0]);
    return PASS;
}

/* ═══════════════════════════════════════════════════════════════════
 * timer_save_state() + timer_load_state()
 * ═══════════════════════════════════════════════════════════════════ */

/* Happy path: opslaan en opnieuw inladen geeft hetzelfde tijdstip */
static int test_state_roundtrip(void)
{
    unlink(TEMP_STATE_FILE);   /* Verwijder eventueel oud bestand */

    time_t oorspronkelijk = 1716380000L;   /* Willekeurig tijdstip */
    int save_result = timer_save_state(oorspronkelijk, TEMP_STATE_FILE);
    TEST_ASSERT_EQ(0, save_result);

    time_t geladen = timer_load_state(TEMP_STATE_FILE);
    TEST_ASSERT_EQ(oorspronkelijk, geladen);

    unlink(TEMP_STATE_FILE);   /* Opruimen */
    return PASS;
}

/* Happy path: epoch-nulpunt opslaan */
static int test_state_roundtrip_nul(void)
{
    unlink(TEMP_STATE_FILE);
    timer_save_state(0, TEMP_STATE_FILE);
    time_t geladen = timer_load_state(TEMP_STATE_FILE);
    TEST_ASSERT_EQ(0, geladen);
    unlink(TEMP_STATE_FILE);
    return PASS;
}

/* Happy path: huidig tijdstip opslaan en teruglezen */
static int test_state_roundtrip_nu(void)
{
    unlink(TEMP_STATE_FILE);
    time_t nu = time(NULL);
    timer_save_state(nu, TEMP_STATE_FILE);
    time_t geladen = timer_load_state(TEMP_STATE_FILE);

    /*
     * Laat een tolerantie van 1 seconde toe: tussen save en load
     * kan een seconde verstrijken als we pech hebben met de klok.
     */
    long verschil = (long)geladen - (long)nu;
    TEST_ASSERT_IN_RANGE(0, 1, verschil);

    unlink(TEMP_STATE_FILE);
    return PASS;
}

/* Edge case: bestand bestaat niet → load geeft 0 */
static int test_load_bestand_bestaat_niet(void)
{
    unlink("/tmp/claude_test_bestaat_niet_abc.txt");
    time_t resultaat = timer_load_state("/tmp/claude_test_bestaat_niet_abc.txt");
    TEST_ASSERT_EQ(0, resultaat);
    return PASS;
}

/* Edge case: ongeldig pad → save geeft -1 */
static int test_save_ongeldig_pad(void)
{
    int resultaat = timer_save_state(12345, "/ongeldig/pad/dat/niet/bestaat.txt");
    TEST_ASSERT_EQ(-1, resultaat);
    return PASS;
}

/* Edge case: state-bestand bevat geen getal → load geeft 0 */
static int test_load_ongeldig_bestand(void)
{
    /* Schrijf rommel in het bestand */
    FILE *f = fopen(TEMP_STATE_FILE, "w");
    TEST_ASSERT_NOT_NULL(f);
    fprintf(f, "dit is geen getal\n");
    fclose(f);

    time_t resultaat = timer_load_state(TEMP_STATE_FILE);
    TEST_ASSERT_EQ(0, resultaat);

    unlink(TEMP_STATE_FILE);
    return PASS;
}

/* Edge case: state-bestand is leeg */
static int test_load_leeg_bestand(void)
{
    FILE *f = fopen(TEMP_STATE_FILE, "w");
    TEST_ASSERT_NOT_NULL(f);
    fclose(f);   /* Schrijf niets — leeg bestand */

    time_t resultaat = timer_load_state(TEMP_STATE_FILE);
    TEST_ASSERT_EQ(0, resultaat);

    unlink(TEMP_STATE_FILE);
    return PASS;
}

/* Edge case: state-bestand bevat een negatief getal */
static int test_load_negatief_getal(void)
{
    FILE *f = fopen(TEMP_STATE_FILE, "w");
    TEST_ASSERT_NOT_NULL(f);
    fprintf(f, "-100\n");
    fclose(f);

    time_t resultaat = timer_load_state(TEMP_STATE_FILE);
    /*
     * Het bestand bevat een geldig getal (-100), dus fscanf slaagt.
     * time_t is gesigned op Linux, dus -100 is een geldige waarde.
     * We testen dat de functie dit doorgeeft zonder te crashen.
     */
    TEST_ASSERT_EQ(-100, (long)resultaat);

    unlink(TEMP_STATE_FILE);
    return PASS;
}

/* ═══════════════════════════════════════════════════════════════════
 * timer_wait_until()
 * ═══════════════════════════════════════════════════════════════════ */

/* Edge case: tijd in het verleden → onmiddellijk -1, geen wachttijd */
static int test_wait_until_verleden(void)
{
    time_t verleden = time(NULL) - 3600;   /* 1 uur geleden */
    int resultaat = timer_wait_until(verleden);
    TEST_ASSERT_EQ(-1, resultaat);
    return PASS;
}

/* Edge case: epoch-nulpunt is altijd in het verleden */
static int test_wait_until_epoch_nul(void)
{
    int resultaat = timer_wait_until(0);
    TEST_ASSERT_EQ(-1, resultaat);
    return PASS;
}

/* Edge case: exact nu → in de praktijk ook in het verleden door verwerking */
static int test_wait_until_net_nu(void)
{
    /*
     * time(NULL) kan gelijk zijn aan of kleiner zijn dan het tijdstip
     * waarop we controleren. difftime <= 0 → return -1.
     * Dit test dat de grenswaarde correct behandeld wordt.
     */
    time_t net_nu = time(NULL);
    int resultaat = timer_wait_until(net_nu);
    /* Accepteer zowel -1 (verleden) als 0 (toekomst door klokprecisie) */
    TEST_ASSERT_IN_RANGE(-1, 0, resultaat);
    return PASS;
}

/* ═══════════════════════════════════════════════════════════════════
 * main() voor timer-tests
 * ═══════════════════════════════════════════════════════════════════ */

int main(void)
{
    printf("╔══════════════════════════════════════════════╗\n");
    printf("║   Timer Module Tests                         ║\n");
    printf("╚══════════════════════════════════════════════╝\n");

    TEST_SECTION("timer_calculate_reset — happy paths");
    RUN_TEST(test_calculate_reset_vijf_uur);
    RUN_TEST(test_calculate_reset_recent);
    RUN_TEST(test_calculate_reset_epoch_nul);
    RUN_TEST(test_calculate_reset_grote_waarde);

    TEST_SECTION("timer_format_duration — happy paths");
    RUN_TEST(test_format_duration_gemengd);
    RUN_TEST(test_format_duration_een_uur);
    RUN_TEST(test_format_duration_een_minuut);
    RUN_TEST(test_format_duration_een_seconde);
    RUN_TEST(test_format_duration_vijf_uur);
    RUN_TEST(test_format_duration_groot);

    TEST_SECTION("timer_format_duration — edge cases");
    RUN_TEST(test_format_duration_nul);
    RUN_TEST(test_format_duration_buffer_te_klein);
    RUN_TEST(test_format_duration_buffer_vijf_bytes);
    RUN_TEST(test_format_duration_negatief);

    TEST_SECTION("timer_format_time — happy paths");
    RUN_TEST(test_format_time_epoch);
    RUN_TEST(test_format_time_een_uur);
    RUN_TEST(test_format_time_middag);
    RUN_TEST(test_format_time_voor_middernacht);
    RUN_TEST(test_format_time_buffer_exact);

    TEST_SECTION("timer_format_time — edge cases");
    RUN_TEST(test_format_time_buffer_te_klein);
    RUN_TEST(test_format_time_buffer_een_byte);

    TEST_SECTION("timer_save_state + timer_load_state — happy paths");
    RUN_TEST(test_state_roundtrip);
    RUN_TEST(test_state_roundtrip_nul);
    RUN_TEST(test_state_roundtrip_nu);

    TEST_SECTION("timer_save_state + timer_load_state — edge cases");
    RUN_TEST(test_load_bestand_bestaat_niet);
    RUN_TEST(test_save_ongeldig_pad);
    RUN_TEST(test_load_ongeldig_bestand);
    RUN_TEST(test_load_leeg_bestand);
    RUN_TEST(test_load_negatief_getal);

    TEST_SECTION("timer_wait_until — edge cases (geen wachttijd)");
    RUN_TEST(test_wait_until_verleden);
    RUN_TEST(test_wait_until_epoch_nul);
    RUN_TEST(test_wait_until_net_nu);

    PRINT_TEST_REPORT();

    return (g_tests_failed > 0) ? 1 : 0;
}
