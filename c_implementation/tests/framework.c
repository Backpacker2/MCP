/*
 * framework.c — Definities van de globale tellers
 *
 * LEERPUNT: extern vs definitie
 *   - In framework.h staat "extern int g_tests_run;" → dit is een DECLARATIE
 *     (vertelt de compiler dat de variabele ergens bestaat)
 *   - In dit bestand staat de definitie (de variabele wordt hier aangemaakt)
 *   - Alle .c bestanden die framework.h includen, zien dezelfde tellers
 */

#include "framework.h"

int g_tests_run    = 0;
int g_tests_passed = 0;
int g_tests_failed = 0;
