/*
 * test_sms.c — Unittests voor sms.c
 * ===================================
 * Getest:
 *  - sms_config_init()          — struct initialisatie
 *  - sms_find_serial_device()   — USB-modem zoeken
 *  - sms_adb_available()        — ADB detectie
 *  - sms_send_adb()             — ADB SMS (foutpaden zonder hardware)
 *  - sms_send_serial()          — Serieel SMS (foutpaden zonder modem)
 *
 * OPMERKING over hardware-afhankelijke tests:
 *  Functies die ADB of een echte modem nodig hebben kunnen we testen
 *  op foutpaden (wat doet de code als ADB niet beschikbaar is?)
 *  maar niet op de happy path zonder hardware.
 *  Die tests zijn gemarkeerd met [HARDWARE_VEREIST].
 */

#include "framework.h"
#include "../sms.h"

#include <stdio.h>
#include <string.h>

/* ═══════════════════════════════════════════════════════════════════
 * sms_config_init()
 * ═══════════════════════════════════════════════════════════════════ */

/* Happy path: struct correct genulleerd en defaults gezet */
static int test_config_init_defaults(void)
{
    SmsConfig cfg;

    /* Vul struct met troep om te bewijzen dat init het opruimt */
    memset(&cfg, 0xFF, sizeof(cfg));

    sms_config_init(&cfg);

    TEST_ASSERT_EQ(1,      cfg.use_adb);
    TEST_ASSERT_EQ(11,     cfg.android_version);
    TEST_ASSERT_EQ(0,      cfg.use_serial);
    TEST_ASSERT_EQ(115200, cfg.baud_rate);
    TEST_ASSERT_STR_EQ("/dev/ttyUSB0", cfg.serial_device);
    return PASS;
}

/* Happy path: recipient is na init een lege string */
static int test_config_init_recipient_leeg(void)
{
    SmsConfig cfg;
    memset(&cfg, 0xFF, sizeof(cfg));
    sms_config_init(&cfg);

    /*
     * memset(0) zet alle bytes op 0x00.
     * De eerste byte van een char-array 0x00 betekent: lege string.
     */
    TEST_ASSERT_EQ('\0', cfg.recipient[0]);
    return PASS;
}

/* Happy path: twee init-aanroepen geven hetzelfde resultaat */
static int test_config_init_idempotent(void)
{
    SmsConfig cfg1, cfg2;
    memset(&cfg1, 0xAA, sizeof(cfg1));
    memset(&cfg2, 0xBB, sizeof(cfg2));

    sms_config_init(&cfg1);
    sms_config_init(&cfg2);

    TEST_ASSERT_EQ(cfg1.use_adb,         cfg2.use_adb);
    TEST_ASSERT_EQ(cfg1.android_version,  cfg2.android_version);
    TEST_ASSERT_EQ(cfg1.baud_rate,        cfg2.baud_rate);
    TEST_ASSERT_EQ(cfg1.use_serial,       cfg2.use_serial);
    TEST_ASSERT_STR_EQ(cfg1.serial_device, cfg2.serial_device);
    return PASS;
}

/* Edge case: recipient niet te lang kunnen zetten (buffergrens) */
static int test_config_recipient_maximale_lengte(void)
{
    SmsConfig cfg;
    sms_config_init(&cfg);

    /*
     * SMS_MAX_NUMBER_LEN = 20 (inclusief null-terminator).
     * Maximaal 19 tekens passen erin.
     * We schrijven een veilig nummer en controleren dat het past.
     */
    const char *lang_nummer = "+31612345678901234";   /* 18 tekens */
    strncpy(cfg.recipient, lang_nummer, sizeof(cfg.recipient) - 1);
    cfg.recipient[sizeof(cfg.recipient) - 1] = '\0';

    TEST_ASSERT_TRUE(strlen(cfg.recipient) <= SMS_MAX_NUMBER_LEN - 1);
    TEST_ASSERT_STR_EQ(lang_nummer, cfg.recipient);
    return PASS;
}

/* Edge case: struct-grootte controleren (leerpunt: sizeof(struct)) */
static int test_config_struct_grootte(void)
{
    /*
     * sizeof(SmsConfig) moet > 0 zijn en redelijk groot (minstens de
     * velden die we kennen: ~100 bytes).
     * Als iemand per ongeluk een veld verwijdert, valt dit op.
     */
    TEST_ASSERT_TRUE(sizeof(SmsConfig) >= 50);
    return PASS;
}

/* ═══════════════════════════════════════════════════════════════════
 * sms_find_serial_device()
 * ═══════════════════════════════════════════════════════════════════ */

/* Happy path op test-machine (geen modem): geeft 0 terug, geen crash */
static int test_find_device_geen_modem(void)
{
    char buf[64];
    int gevonden = sms_find_serial_device(buf, sizeof(buf));

    /*
     * Op deze test-machine is geen USB-modem aangesloten.
     * We verwachten 0 (niet gevonden).
     * Als er wél een modem is, is 1 ook correct.
     */
    TEST_ASSERT_IN_RANGE(0, 1, gevonden);   /* 0 of 1, niet -1 of hoger */
    return PASS;
}

/* Edge case: buffer van 1 byte — mag niet crashen */
static int test_find_device_buffer_een_byte(void)
{
    char buf[1] = {0xFF};
    int gevonden = sms_find_serial_device(buf, 1);

    /*
     * Met buf_len=1 kan strncpy maximaal 0 tekens schrijven + null.
     * De functie mag niet overschrijven voorbij de buffer.
     * Gevonden is 0 (geen modem) of 1 (modem, path afgekapt).
     */
    TEST_ASSERT_IN_RANGE(0, 1, gevonden);
    TEST_ASSERT_EQ('\0', buf[0]);   /* Altijd null-terminator na safe copy */
    return PASS;
}

/* Edge case: buffer van 0 bytes (snprintf moet dit afhandelen) */
static int test_find_device_buffer_nul_bytes(void)
{
    /*
     * We geven buf_len=0 aan sms_find_serial_device().
     * strncpy(buf, src, 0) schrijft niets — dat is correct.
     * De functie mag niet crashen.
     *
     * OPGELET: we geven geen NULL-pointer als buf, want dat zou
     * undefined behavior zijn in strncpy(). We geven een geldig adres
     * met lengte 0.
     */
    char buf[1] = {0xAB};   /* Dummy buffer — we geven 0 door als lengte */
    int gevonden = sms_find_serial_device(buf, 0);
    TEST_ASSERT_IN_RANGE(0, 1, gevonden);
    return PASS;
}

/* Edge case: kleine buffer met modem-pad dat niet past */
static int test_find_device_buffer_te_klein_voor_pad(void)
{
    char buf[4] = {0};   /* Kan "/dev" bevatten maar niet "/dev/ttyUSB0" */

    /*
     * Als een modem gevonden wordt, wordt het pad afgesneden.
     * Als geen modem: buf blijft leeg.
     * Beide gevallen mogen niet crashen of buf overschrijden.
     */
    sms_find_serial_device(buf, sizeof(buf));
    /* Geen assert op gevonden — alleen dat het niet crasht */
    return PASS;
}

/* ═══════════════════════════════════════════════════════════════════
 * sms_adb_available()
 * ═══════════════════════════════════════════════════════════════════ */

/* Happy path: geeft 0 (niet beschikbaar) of 1 (beschikbaar) */
static int test_adb_available_geeft_bool(void)
{
    int resultaat = sms_adb_available();

    /*
     * Op deze machine verwachten we 0 (ADB niet geïnstalleerd).
     * Maar als ADB wél geïnstalleerd is, is 1 ook correct.
     * Wat we NIET verwachten: -1, 42, of een crash.
     */
    TEST_ASSERT_IN_RANGE(0, 1, resultaat);
    return PASS;
}

/* Twee keer aanroepen geeft consistent resultaat */
static int test_adb_available_consistent(void)
{
    int eerste  = sms_adb_available();
    int tweede  = sms_adb_available();
    TEST_ASSERT_EQ(eerste, tweede);
    return PASS;
}

/* ═══════════════════════════════════════════════════════════════════
 * sms_send_adb() — foutpaden
 *
 * Op deze test-machine is geen Android-telefoon aangesloten,
 * dus de happy path is niet testbaar. We testen het foutpad:
 * de functie moet -1 teruggeven en niet crashen.
 * ═══════════════════════════════════════════════════════════════════ */

/* Foutpad: ADB niet beschikbaar → -1 */
static int test_send_adb_geen_adb(void)
{
    SmsConfig cfg;
    sms_config_init(&cfg);
    strncpy(cfg.recipient, "+31612345678", sizeof(cfg.recipient) - 1);

    int resultaat = sms_send_adb(&cfg, "Test bericht");

    /*
     * ADB is niet geïnstalleerd op de test-machine.
     * De functie roept popen("adb shell ...") aan — dat mislukt.
     * Verwacht: -1
     */
    TEST_ASSERT_EQ(-1, resultaat);
    return PASS;
}

/* Foutpad: leeg telefoonnummer */
static int test_send_adb_leeg_nummer(void)
{
    SmsConfig cfg;
    sms_config_init(&cfg);
    cfg.recipient[0] = '\0';   /* Leeg nummer */

    int resultaat = sms_send_adb(&cfg, "Test");
    TEST_ASSERT_EQ(-1, resultaat);
    return PASS;
}

/* Foutpad: leeg bericht */
static int test_send_adb_leeg_bericht(void)
{
    SmsConfig cfg;
    sms_config_init(&cfg);
    strncpy(cfg.recipient, "+31612345678", sizeof(cfg.recipient) - 1);

    int resultaat = sms_send_adb(&cfg, "");
    TEST_ASSERT_EQ(-1, resultaat);   /* Geen ADB → -1 */
    return PASS;
}

/* Edge case: zeer lang bericht (snprintf afkapping testen) */
static int test_send_adb_heel_lang_bericht(void)
{
    SmsConfig cfg;
    sms_config_init(&cfg);
    strncpy(cfg.recipient, "+31612345678", sizeof(cfg.recipient) - 1);

    /*
     * Het ADB-commando wordt samengesteld in een char cmd[1024].
     * Een bericht van 2000 tekens zou de buffer kunnen overschrijden
     * als snprintf niet gebruikt werd. Maar snprintf begrenst op 1024.
     * We testen dat de functie niet crasht.
     */
    char lang_bericht[2000];
    memset(lang_bericht, 'A', sizeof(lang_bericht) - 1);
    lang_bericht[sizeof(lang_bericht) - 1] = '\0';

    int resultaat = sms_send_adb(&cfg, lang_bericht);
    /* Geen ADB: -1 verwacht, maar geen crash/segfault */
    TEST_ASSERT_EQ(-1, resultaat);
    return PASS;
}

/* Edge case: Android-versie 9 (ander commandoformaat) */
static int test_send_adb_android_versie_9(void)
{
    SmsConfig cfg;
    sms_config_init(&cfg);
    cfg.android_version = 9;
    strncpy(cfg.recipient, "+31612345678", sizeof(cfg.recipient) - 1);

    int resultaat = sms_send_adb(&cfg, "Test Android 9");
    TEST_ASSERT_EQ(-1, resultaat);   /* Geen ADB → -1 */
    return PASS;
}

/* ═══════════════════════════════════════════════════════════════════
 * sms_send_serial() — foutpaden
 * ═══════════════════════════════════════════════════════════════════ */

/* Foutpad: apparaat bestaat niet */
static int test_send_serial_apparaat_bestaat_niet(void)
{
    SmsConfig cfg;
    sms_config_init(&cfg);
    cfg.use_serial = 1;
    cfg.use_adb    = 0;
    strncpy(cfg.serial_device, "/dev/ttyUSB_BESTAAT_NIET_99",
            sizeof(cfg.serial_device) - 1);
    strncpy(cfg.recipient, "+31612345678", sizeof(cfg.recipient) - 1);

    int resultaat = sms_send_serial(&cfg, "Test");
    TEST_ASSERT_EQ(-1, resultaat);   /* open() mislukt → -1 */
    return PASS;
}

/* Foutpad: lege apparaatnaam */
static int test_send_serial_leeg_apparaat(void)
{
    SmsConfig cfg;
    sms_config_init(&cfg);
    cfg.use_serial = 1;
    cfg.serial_device[0] = '\0';

    int resultaat = sms_send_serial(&cfg, "Test");
    TEST_ASSERT_EQ(-1, resultaat);
    return PASS;
}

/* Foutpad: /dev/null is geen serieel apparaat */
static int test_send_serial_dev_null(void)
{
    SmsConfig cfg;
    sms_config_init(&cfg);
    cfg.use_serial = 1;
    strncpy(cfg.serial_device, "/dev/null", sizeof(cfg.serial_device) - 1);
    strncpy(cfg.recipient, "+31612345678", sizeof(cfg.recipient) - 1);

    /*
     * /dev/null is een geldig apparaatbestand dat altijd te openen is,
     * maar tcgetattr() zal mislukken omdat het geen serieel apparaat is.
     * Verwacht: -1
     */
    int resultaat = sms_send_serial(&cfg, "Test");
    TEST_ASSERT_EQ(-1, resultaat);
    return PASS;
}

/* ═══════════════════════════════════════════════════════════════════
 * main() voor SMS-tests
 * ═══════════════════════════════════════════════════════════════════ */

int main(void)
{
    printf("╔══════════════════════════════════════════════╗\n");
    printf("║   SMS Module Tests                           ║\n");
    printf("╚══════════════════════════════════════════════╝\n");

    TEST_SECTION("sms_config_init — happy paths");
    RUN_TEST(test_config_init_defaults);
    RUN_TEST(test_config_init_recipient_leeg);
    RUN_TEST(test_config_init_idempotent);
    RUN_TEST(test_config_struct_grootte);

    TEST_SECTION("sms_config_init — edge cases");
    RUN_TEST(test_config_recipient_maximale_lengte);

    TEST_SECTION("sms_find_serial_device — happy paths");
    RUN_TEST(test_find_device_geen_modem);
    RUN_TEST(test_adb_available_geeft_bool);
    RUN_TEST(test_adb_available_consistent);

    TEST_SECTION("sms_find_serial_device — edge cases");
    RUN_TEST(test_find_device_buffer_een_byte);
    RUN_TEST(test_find_device_buffer_nul_bytes);
    RUN_TEST(test_find_device_buffer_te_klein_voor_pad);

    TEST_SECTION("sms_send_adb — foutpaden (geen hardware)");
    RUN_TEST(test_send_adb_geen_adb);
    RUN_TEST(test_send_adb_leeg_nummer);
    RUN_TEST(test_send_adb_leeg_bericht);
    RUN_TEST(test_send_adb_heel_lang_bericht);
    RUN_TEST(test_send_adb_android_versie_9);

    TEST_SECTION("sms_send_serial — foutpaden (geen hardware)");
    RUN_TEST(test_send_serial_apparaat_bestaat_niet);
    RUN_TEST(test_send_serial_leeg_apparaat);
    RUN_TEST(test_send_serial_dev_null);

    PRINT_TEST_REPORT();

    return (g_tests_failed > 0) ? 1 : 0;
}
