/*
 * framework.h — Minimaal C-testframework
 * ========================================
 * LEERPUNTEN:
 *  - Macros met do { ... } while(0): waarom dit veiliger is dan gewone blokken
 *  - __FILE__ en __LINE__: ingebouwde preprocessor-variabelen
 *  - Functie-pointers: een functie doorgeven als argument
 *  - static variabelen: leven buiten de functie maar zijn niet globaal zichtbaar
 *
 * Gebruik:
 *   Elke testfunctie heeft de signatuur: int test_naam(void)
 *   Return PASS (0) of FAIL (1).
 *   Gebruik RUN_TEST() om een test te registreren en uit te voeren.
 */

#ifndef FRAMEWORK_H
#define FRAMEWORK_H

#include <stdio.h>
#include <string.h>
#include <math.h>   /* fabs() voor floating-point vergelijking */

/* Return-codes voor testfuncties */
#define PASS 0
#define FAIL 1

/* Globale tellers — extern zodat test_*.c ze allemaal kunnen zien */
extern int g_tests_run;
extern int g_tests_passed;
extern int g_tests_failed;

/* ──────────────────────────────────────────────────────────────────
 * ASSERT-macros
 *
 * do { ... } while(0) patroon:
 *   Maakt van de macro een "statement" dat je overal kunt gebruiken,
 *   ook na een if zonder accolades:
 *     if (x) TEST_ASSERT_EQ(a, b);   ← werkt correct
 *
 * __FILE__: naam van het bronbestand (string-literal)
 * __LINE__: regelnummer in het bronbestand (integer)
 * __func__: naam van de huidige functie (C99)
 * ────────────────────────────────────────────────────────────────── */

/* Vergelijk twee integers (of alles dat je met == kunt vergelijken) */
#define TEST_ASSERT_EQ(verwacht, actueel)                                    \
    do {                                                                      \
        long _v = (long)(verwacht);                                           \
        long _a = (long)(actueel);                                            \
        if (_v != _a) {                                                       \
            printf("    ✗ FAIL %s:%d\n"                                      \
                   "      Verwacht : %ld\n"                                   \
                   "      Gekregen : %ld\n",                                  \
                   __FILE__, __LINE__, _v, _a);                               \
            return FAIL;                                                      \
        }                                                                     \
    } while (0)

/* Vergelijk twee strings */
#define TEST_ASSERT_STR_EQ(verwacht, actueel)                                \
    do {                                                                      \
        if (strcmp((verwacht), (actueel)) != 0) {                             \
            printf("    ✗ FAIL %s:%d\n"                                      \
                   "      Verwacht : \"%s\"\n"                                \
                   "      Gekregen : \"%s\"\n",                               \
                   __FILE__, __LINE__, (verwacht), (actueel));                \
            return FAIL;                                                      \
        }                                                                     \
    } while (0)

/* Controleer dat een waarde 'waar' (niet-nul) is */
#define TEST_ASSERT_TRUE(conditie)                                            \
    do {                                                                      \
        if (!(conditie)) {                                                    \
            printf("    ✗ FAIL %s:%d — conditie is ONWAAR: %s\n",           \
                   __FILE__, __LINE__, #conditie);                            \
            return FAIL;                                                      \
        }                                                                     \
    } while (0)

/* Controleer dat een waarde ONWAAR (nul) is */
#define TEST_ASSERT_FALSE(conditie)                                           \
    do {                                                                      \
        if ((conditie)) {                                                     \
            printf("    ✗ FAIL %s:%d — conditie is WAAR: %s\n",             \
                   __FILE__, __LINE__, #conditie);                            \
            return FAIL;                                                      \
        }                                                                     \
    } while (0)

/* Controleer dat een pointer NULL is */
#define TEST_ASSERT_NULL(ptr)                                                 \
    do {                                                                      \
        if ((ptr) != NULL) {                                                  \
            printf("    ✗ FAIL %s:%d — verwacht NULL maar was niet NULL\n",  \
                   __FILE__, __LINE__);                                       \
            return FAIL;                                                      \
        }                                                                     \
    } while (0)

/* Controleer dat een pointer NIET NULL is */
#define TEST_ASSERT_NOT_NULL(ptr)                                             \
    do {                                                                      \
        if ((ptr) == NULL) {                                                  \
            printf("    ✗ FAIL %s:%d — onverwacht NULL\n",                   \
                   __FILE__, __LINE__);                                       \
            return FAIL;                                                      \
        }                                                                     \
    } while (0)

/* Controleer dat twee strings beginnen met dezelfde prefix */
#define TEST_ASSERT_STR_STARTS(prefix, actueel)                              \
    do {                                                                      \
        size_t _len = strlen(prefix);                                         \
        if (strncmp((prefix), (actueel), _len) != 0) {                        \
            printf("    ✗ FAIL %s:%d\n"                                      \
                   "      Verwacht prefix : \"%s\"\n"                         \
                   "      Gekregen       : \"%s\"\n",                         \
                   __FILE__, __LINE__, (prefix), (actueel));                  \
            return FAIL;                                                      \
        }                                                                     \
    } while (0)

/* Controleer dat een return-waarde in [min, max] valt */
#define TEST_ASSERT_IN_RANGE(min, max, actueel)                              \
    do {                                                                      \
        long _a = (long)(actueel);                                            \
        if (_a < (long)(min) || _a > (long)(max)) {                           \
            printf("    ✗ FAIL %s:%d\n"                                      \
                   "      Verwacht bereik: [%ld, %ld]\n"                      \
                   "      Gekregen       : %ld\n",                            \
                   __FILE__, __LINE__, (long)(min), (long)(max), _a);         \
            return FAIL;                                                      \
        }                                                                     \
    } while (0)

/* ──────────────────────────────────────────────────────────────────
 * RUN_TEST macro
 * Voert een testfunctie uit en registreert het resultaat.
 *
 * LEERPUNT: #testfn zet de naam van de functie om naar een string
 * (stringificatie via de # operator)
 * ────────────────────────────────────────────────────────────────── */
#define RUN_TEST(testfn)                                                      \
    do {                                                                      \
        g_tests_run++;                                                        \
        int _resultaat = testfn();                                            \
        if (_resultaat == PASS) {                                             \
            printf("  ✓ %-55s PASS\n", #testfn);                            \
            g_tests_passed++;                                                 \
        } else {                                                              \
            printf("  ✗ %-55s FAIL\n", #testfn);                            \
            g_tests_failed++;                                                 \
        }                                                                     \
    } while (0)

/* Sectiekop afdrukken */
#define TEST_SECTION(naam)                                                    \
    printf("\n── %s ──\n", naam)

/* Eindrapport afdrukken — roep aan in main() */
#define PRINT_TEST_REPORT()                                                   \
    do {                                                                      \
        printf("\n══════════════════════════════════════════════\n");         \
        printf("  Resultaten: %d/%d tests geslaagd",                         \
               g_tests_passed, g_tests_run);                                  \
        if (g_tests_failed > 0) {                                             \
            printf("  (%d MISLUKT)", g_tests_failed);                         \
        }                                                                     \
        printf("\n══════════════════════════════════════════════\n");         \
    } while (0)

#endif /* FRAMEWORK_H */
