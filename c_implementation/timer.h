#ifndef TIMER_H
#define TIMER_H

/*
 * timer.h — Reset-timer berekening en countdown
 *
 * Dit module leert je:
 *  - time_t: hoe Linux tijd opslaat als "seconden sinds 1 jan 1970"
 *  - difftime(): veilig twee tijdstippen vergelijken
 *  - localtime(): epoch-tijd omzetten naar uur/minuut/seconde
 *  - struct tm: de C-structuur voor datum en tijd
 */

#include <time.h>

/* Aantal uren dat Claude's reset-venster duurt */
#define CLAUDE_RESET_HOURS 5

/*
 * Bereken het tijdstip waarop Claude's credits resetten.
 *
 * Param:  limit_hit_at  — tijdstip (epoch-seconden) waarop je de limiet raakte
 * Return: tijdstip van verwachte reset
 */
time_t timer_calculate_reset(time_t limit_hit_at);

/*
 * Wacht tot het opgegeven tijdstip en toon een live afteller.
 * Geeft elke 30 minuten een update op stdout.
 *
 * Param:  reset_at — tijdstip om op te wachten
 * Return: 0 bij succes, -1 als reset_at al verstreken is
 */
int timer_wait_until(time_t reset_at);

/*
 * Sla het tijdstip van de limiet op in een bestand.
 * Zodat het programma herstartbaar is na een crash.
 *
 * Return: 0 bij succes, -1 bij schrijffout
 */
int timer_save_state(time_t limit_hit_at, const char *state_file);

/*
 * Laad een eerder opgeslagen staat.
 *
 * Return: het opgeslagen tijdstip, of 0 als het bestand niet bestaat
 */
time_t timer_load_state(const char *state_file);

/*
 * Druk een tijdstip af als leesbare string, bijv. "14:32:07".
 * Schrijft naar buf, max buf_len tekens.
 */
void timer_format_time(time_t t, char *buf, size_t buf_len);

/*
 * Druk een duur af in leesbaar formaat, bijv. "3u 42m 15s".
 * Schrijft naar buf, max buf_len tekens.
 */
void timer_format_duration(double seconds, char *buf, size_t buf_len);

#endif /* TIMER_H */
