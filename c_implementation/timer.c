/*
 * timer.c — Implementatie van de reset-timer module
 *
 * LEERPUNTEN:
 *  1. time_t is gewoon een long integer: seconden na 1 jan 1970 00:00 UTC
 *  2. difftime(a, b) geeft a - b als double (seconden)
 *  3. localtime() geeft een pointer terug naar een STATISCHE struct —
 *     als je hem twee keer aanroept, overschrijft de tweede de eerste!
 *     Gebruik daarom localtime_r() op Linux (thread-safe variant).
 *  4. strftime() werkt als printf() maar voor datum/tijd
 */

#include "timer.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>   /* sleep() */
#include <errno.h>

/* Interne constante: hoe vaak we de countdown updaten (seconden) */
#define UPDATE_INTERVAL_SEC 1800   /* 30 minuten */

/* ------------------------------------------------------------------ */

time_t timer_calculate_reset(time_t limit_hit_at)
{
    /*
     * Claude's sliding window is 5 uur.
     * time_t is in seconden, dus 5 uur = 5 * 60 * 60 = 18000 seconden.
     *
     * We voegen ze gewoon op: dat werkt omdat time_t een integer is.
     */
    return limit_hit_at + (time_t)(CLAUDE_RESET_HOURS * 3600);
}

/* ------------------------------------------------------------------ */

void timer_format_time(time_t t, char *buf, size_t buf_len)
{
    /*
     * localtime_r() vult een struct tm in met uur, minuut, seconde etc.
     * struct tm heeft onder andere:
     *   tm_hour  (0-23)
     *   tm_min   (0-59)
     *   tm_sec   (0-60, inclusief schrikkelseconde)
     */
    if (buf == NULL || buf_len == 0) return;

    /*
     * Defensief: altijd null-termineren vóór strftime().
     * De C-standaard zegt dat de buffer "unspecified" is als strftime()
     * 0 teruggeeft (buffer te klein). Door vooraf te null-termineren
     * garanderen we een geldige lege string ook bij kleine buffers.
     */
    buf[0] = '\0';

    struct tm tm_local;
    localtime_r(&t, &tm_local);

    /* strftime() is printf() voor datum/tijd. %H=uur, %M=minuut, %S=seconde */
    strftime(buf, buf_len, "%H:%M:%S", &tm_local);
}

/* ------------------------------------------------------------------ */

void timer_format_duration(double seconds, char *buf, size_t buf_len)
{
    /*
     * Omreken een aantal seconden naar "Xu Ym Zs" formaat.
     * We gebruiken integer-deling en modulo — klassiek C.
     */
    int total_sec = (int)seconds;
    int uren      = total_sec / 3600;
    int minuten   = (total_sec % 3600) / 60;
    int secs      = total_sec % 60;

    snprintf(buf, buf_len, "%du %dm %ds", uren, minuten, secs);
}

/* ------------------------------------------------------------------ */

int timer_wait_until(time_t reset_at)
{
    time_t now = time(NULL);   /* Huidig tijdstip als epoch-seconden */

    double wacht_sec = difftime(reset_at, now);

    if (wacht_sec <= 0.0) {
        fprintf(stderr, "[TIMER] Reset-tijd is al verstreken.\n");
        return -1;
    }

    char reset_str[32];
    char duur_str[32];
    timer_format_time(reset_at, reset_str, sizeof(reset_str));
    timer_format_duration(wacht_sec, duur_str, sizeof(duur_str));

    printf("\n");
    printf("╔══════════════════════════════════════╗\n");
    printf("║   Claude Credits Monitor — actief    ║\n");
    printf("╠══════════════════════════════════════╣\n");
    printf("║  Verwachte reset : %-18s ║\n", reset_str);
    printf("║  Wachttijd       : %-18s ║\n", duur_str);
    printf("╚══════════════════════════════════════╝\n\n");

    /*
     * Hoofdwachtlus:
     * We slapen in blokken van UPDATE_INTERVAL_SEC seconden
     * en geven elke keer een update, zodat de gebruiker ziet dat
     * het programma nog draait.
     *
     * OPMERKING: sleep() kan vroegtijdig terugkeren bij een signaal
     * (bijv. SIGINT van Ctrl+C). De while-conditie herberekent
     * de resterende tijd zodat we nooit te vroeg stoppen.
     */
    while (1) {
        now = time(NULL);
        wacht_sec = difftime(reset_at, now);

        if (wacht_sec <= 0.0) {
            break;   /* Klaar! */
        }

        /* Slaap maximaal UPDATE_INTERVAL_SEC seconden */
        unsigned int slaap = (wacht_sec < UPDATE_INTERVAL_SEC)
                           ? (unsigned int)wacht_sec
                           : UPDATE_INTERVAL_SEC;
        sleep(slaap);

        /* Herbereken na het slapen */
        now = time(NULL);
        wacht_sec = difftime(reset_at, now);

        if (wacht_sec > 0.0) {
            char nu_str[32];
            char nog_str[32];
            timer_format_time(now, nu_str, sizeof(nu_str));
            timer_format_duration(wacht_sec, nog_str, sizeof(nog_str));
            printf("[%s] Nog %s te gaan...\n", nu_str, nog_str);
            fflush(stdout);   /* Forceer uitvoer naar terminal/logbestand */
        }
    }

    return 0;
}

/* ------------------------------------------------------------------ */

int timer_save_state(time_t limit_hit_at, const char *state_file)
{
    /*
     * We slaan de state op als een simpele tekstregel: de epoch-tijd.
     * Dit is makkelijker te debuggen dan een binair formaat.
     *
     * fopen() geeft NULL terug bij een fout — altijd checken!
     */
    FILE *f = fopen(state_file, "w");
    if (f == NULL) {
        fprintf(stderr, "[TIMER] Kan state-bestand niet openen: %s (%s)\n",
                state_file, strerror(errno));
        return -1;
    }

    /* fprintf() naar een bestand werkt net als printf() naar stdout */
    fprintf(f, "%ld\n", (long)limit_hit_at);
    fclose(f);   /* Vergeet nooit fclose()! Anders gaat data verloren. */

    char time_str[32];
    timer_format_time(limit_hit_at, time_str, sizeof(time_str));
    printf("[TIMER] State opgeslagen: limiet was om %s\n", time_str);
    return 0;
}

/* ------------------------------------------------------------------ */

time_t timer_load_state(const char *state_file)
{
    FILE *f = fopen(state_file, "r");
    if (f == NULL) {
        return 0;   /* Bestand bestaat niet — geen probleem */
    }

    long saved;
    int gelezen = fscanf(f, "%ld", &saved);
    fclose(f);

    if (gelezen != 1) {
        fprintf(stderr, "[TIMER] Ongeldig state-bestand: %s\n", state_file);
        return 0;
    }

    return (time_t)saved;
}
