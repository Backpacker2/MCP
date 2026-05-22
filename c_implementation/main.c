/*
 * main.c — Claude Credits Monitor (C implementatie)
 *
 * GEBRUIK:
 *   ./claude_monitor --help
 *   ./claude_monitor --setup "+31612345678"   (eenmalig: nummer opslaan)
 *   ./claude_monitor --hit                    (limiet bereikt, start timer)
 *   ./claude_monitor --hit --at "14:30"       (limiet was om 14:30)
 *   ./claude_monitor --status                 (huidige timer-status)
 *   ./claude_monitor --test                   (test-SMS sturen)
 *   ./claude_monitor --list-devices           (zoek USB GSM-modem)
 *
 * LEERPUNTEN:
 *  - argc / argv: command-line argumenten verwerken
 *  - strcmp() / strncmp(): strings vergelijken in C
 *  - EXIT_SUCCESS / EXIT_FAILURE: gestandaardiseerde exit-codes
 *  - config bestand lezen/schrijven
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <time.h>
#include <unistd.h>

#include "timer.h"
#include "sms.h"

/* ------------------------------------------------------------------ */
/* Configuratie                                                        */
/* ------------------------------------------------------------------ */

/* Standaardpaden voor state- en config-bestanden */
#define DEFAULT_STATE_FILE  "/tmp/claude_monitor_state.txt"
#define DEFAULT_CONFIG_FILE "./claude_monitor.conf"

/*
 * Eenvoudige configuratiestructuur voor het hele programma.
 * In C gebruik je structs als "naamruimte" voor gerelateerde variabelen.
 */
typedef struct {
    char phone_number[SMS_MAX_NUMBER_LEN];
    char state_file[128];
    char config_file[128];
    int  use_adb;          /* 1 = ADB, 0 = seriële poort */
    int  android_version;  /* voor ADB-methode */
    char serial_device[64];
    int  baud_rate;
} AppConfig;

/* ------------------------------------------------------------------ */
/* Config bestand lezen/schrijven                                      */
/* ------------------------------------------------------------------ */

static int config_save(const AppConfig *cfg)
{
    FILE *f = fopen(cfg->config_file, "w");
    if (f == NULL) {
        fprintf(stderr, "Kan config niet opslaan: %s\n", strerror(errno));
        return -1;
    }
    fprintf(f, "phone=%s\n", cfg->phone_number);
    fprintf(f, "use_adb=%d\n", cfg->use_adb);
    fprintf(f, "android_version=%d\n", cfg->android_version);
    fprintf(f, "serial_device=%s\n", cfg->serial_device);
    fprintf(f, "baud_rate=%d\n", cfg->baud_rate);
    fclose(f);
    printf("Config opgeslagen in %s\n", cfg->config_file);
    return 0;
}

static int config_load(AppConfig *cfg)
{
    FILE *f = fopen(cfg->config_file, "r");
    if (f == NULL) return -1;   /* Bestand bestaat niet — geen fout */

    char regel[256];
    while (fgets(regel, sizeof(regel), f) != NULL) {
        /*
         * sscanf() leest geformatteerde data uit een string.
         * Werkt als scanf() maar vanuit een string i.p.v. stdin.
         *
         * "%[^\n]" = lees alles tot het einde van de regel (geen newline)
         */
        char sleutel[64] = {0};
        char waarde[20]  = {0};

        /*
         * De sscanf-breedte limiteert hoeveel tekens worden gelezen.
         * %19[^\n] = max 19 tekens (past in phone_number[20])
         * %63[^\n] = max 63 tekens (past in serial_device[64])
         * We lezen sleutel en waarde apart met aangepaste limieten.
         */
        char phone_val[SMS_MAX_NUMBER_LEN];
        char device_val[64];
        char int_val[16];

        if (sscanf(regel, "phone=%19[^\n]", phone_val) == 1) {
            snprintf(cfg->phone_number, sizeof(cfg->phone_number), "%s", phone_val);
        } else if (sscanf(regel, "use_adb=%15[^\n]", int_val) == 1) {
            cfg->use_adb = atoi(int_val);
        } else if (sscanf(regel, "android_version=%15[^\n]", int_val) == 1) {
            cfg->android_version = atoi(int_val);
        } else if (sscanf(regel, "serial_device=%63[^\n]", device_val) == 1) {
            snprintf(cfg->serial_device, sizeof(cfg->serial_device), "%s", device_val);
        } else if (sscanf(regel, "baud_rate=%15[^\n]", int_val) == 1) {
            cfg->baud_rate = atoi(int_val);
        }
        (void)sleutel; (void)waarde;   /* Vermijd unused-variable warning */
    }

    fclose(f);
    return 0;
}

/* ------------------------------------------------------------------ */
/* SMS sturen via geconfigureerde methode                             */
/* ------------------------------------------------------------------ */

static int stuur_sms(const AppConfig *app_cfg, const char *bericht)
{
    SmsConfig sms_cfg;
    sms_config_init(&sms_cfg);

    /* Kopieer instellingen van AppConfig naar SmsConfig */
    snprintf(sms_cfg.recipient, sizeof(sms_cfg.recipient), "%s", app_cfg->phone_number);
    sms_cfg.use_adb       = app_cfg->use_adb;
    sms_cfg.android_version = app_cfg->android_version;
    sms_cfg.use_serial    = !app_cfg->use_adb;
    snprintf(sms_cfg.serial_device, sizeof(sms_cfg.serial_device), "%s",
             app_cfg->serial_device);
    sms_cfg.baud_rate = app_cfg->baud_rate;

    if (app_cfg->use_adb) {
        return sms_send_adb(&sms_cfg, bericht);
    } else {
        return sms_send_serial(&sms_cfg, bericht);
    }
}

/* ------------------------------------------------------------------ */
/* Help weergeven                                                      */
/* ------------------------------------------------------------------ */

static void print_help(const char *programmanaam)
{
    printf("\n");
    printf("Claude Credits Monitor — C implementatie\n");
    printf("==========================================\n\n");
    printf("Gebruik:\n");
    printf("  %s --setup \"+31612345678\"  Telefoon instellen\n", programmanaam);
    printf("  %s --setup --serial        Gebruik USB GSM-modem i.p.v. ADB\n", programmanaam);
    printf("  %s --hit                   Limiet nu bereikt, timer starten\n", programmanaam);
    printf("  %s --hit --at \"14:30\"      Limiet was om 14:30 bereikt\n", programmanaam);
    printf("  %s --status                Timer-status weergeven\n", programmanaam);
    printf("  %s --test                  Test-SMS sturen\n", programmanaam);
    printf("  %s --list-devices          Zoek USB GSM-modem\n", programmanaam);
    printf("  %s --help                  Dit scherm\n\n", programmanaam);
    printf("Gratis SMS van je eigen nummer:\n");
    printf("  ADB methode   : Android + USB + USB-foutopsporing aan\n");
    printf("  Serieel methode: USB GSM-modem met je eigen SIM\n\n");
}

/* ------------------------------------------------------------------ */
/* --status commando                                                   */
/* ------------------------------------------------------------------ */

static void toon_status(const AppConfig *cfg)
{
    time_t opgeslagen = timer_load_state(cfg->state_file);

    if (opgeslagen == 0) {
        printf("Geen actieve timer.\n");
        printf("Gebruik '%s --hit' wanneer je de Claude-limiet bereikt.\n",
               "claude_monitor");
        return;
    }

    time_t reset_at = timer_calculate_reset(opgeslagen);
    time_t now = time(NULL);
    double resterend = difftime(reset_at, now);

    char limiet_str[32];
    char reset_str[32];
    timer_format_time(opgeslagen, limiet_str, sizeof(limiet_str));
    timer_format_time(reset_at,   reset_str,  sizeof(reset_str));

    printf("\n");
    printf("╔══════════════════════════════════════╗\n");
    printf("║   Claude Monitor — Status            ║\n");
    printf("╠══════════════════════════════════════╣\n");
    printf("║  Limiet bereikt : %-18s ║\n", limiet_str);
    printf("║  Verwachte reset: %-18s ║\n", reset_str);

    if (resterend <= 0.0) {
        printf("║  Status: ✓ Reset zou klaar moeten zijn ║\n");
    } else {
        char nog_str[32];
        timer_format_duration(resterend, nog_str, sizeof(nog_str));
        printf("║  Nog te gaan: %-22s ║\n", nog_str);

        /* Voortgangsbalk: 20 blokjes voor 5 uur */
        double voortgang = 1.0 - (resterend / (CLAUDE_RESET_HOURS * 3600.0));
        if (voortgang < 0.0) voortgang = 0.0;
        if (voortgang > 1.0) voortgang = 1.0;
        int gevuld = (int)(voortgang * 20);
        printf("║  [");
        for (int i = 0; i < 20; i++) putchar(i < gevuld ? '#' : '-');
        printf("] %.0f%%     ║\n", voortgang * 100);
    }

    printf("║  Nummer: %-27s ║\n", cfg->phone_number[0] ? cfg->phone_number : "(niet ingesteld)");
    printf("║  Methode: %-26s ║\n", cfg->use_adb ? "ADB (Android)" : "Serieel (USB modem)");
    printf("╚══════════════════════════════════════╝\n\n");
}

/* ------------------------------------------------------------------ */
/* --hit commando: tijdstip parsen en timer starten                   */
/* ------------------------------------------------------------------ */

static time_t parse_time_arg(const char *tijdstring)
{
    /*
     * Parseer een "HH:MM" string naar een time_t voor vandaag.
     *
     * Stappenplan:
     *  1. Haal huidige tijd op als struct tm (voor datum)
     *  2. Vervang uur en minuut door de opgegeven waarden
     *  3. Converteer terug naar time_t met mktime()
     */
    int uur, minuut;

    /* sscanf() met "%d:%d" leest twee integers gescheiden door ":" */
    if (sscanf(tijdstring, "%d:%d", &uur, &minuut) != 2) {
        fprintf(stderr, "Ongeldig tijdformaat: '%s'. Gebruik HH:MM\n", tijdstring);
        return (time_t)-1;
    }

    if (uur < 0 || uur > 23 || minuut < 0 || minuut > 59) {
        fprintf(stderr, "Ongeldig tijdstip: %02d:%02d\n", uur, minuut);
        return (time_t)-1;
    }

    /* Haal huidige tijd op als struct tm */
    time_t now = time(NULL);
    struct tm tm_local;
    localtime_r(&now, &tm_local);

    /* Overschrijf uur en minuut */
    tm_local.tm_hour = uur;
    tm_local.tm_min  = minuut;
    tm_local.tm_sec  = 0;

    /*
     * mktime() converteert een struct tm terug naar time_t.
     * Normaliseert ook automatisch: bijv. tm_hour=25 wordt volgende dag 1:00.
     */
    time_t resultaat = mktime(&tm_local);

    /* Als het tijdstip in de toekomst ligt, gebruik gisteren */
    if (resultaat > now) {
        resultaat -= 24 * 3600;   /* Trek 24 uur af */
    }

    return resultaat;
}

/* ------------------------------------------------------------------ */
/* main()                                                              */
/* ------------------------------------------------------------------ */

int main(int argc, char *argv[])
{
    /*
     * argc = aantal argumenten (inclusief de programmanaam zelf)
     * argv = array van strings: argv[0]=programmanaam, argv[1]=eerste arg, etc.
     *
     * Voorbeeld: ./claude_monitor --hit --at "14:30"
     *   argc = 4
     *   argv[0] = "./claude_monitor"
     *   argv[1] = "--hit"
     *   argv[2] = "--at"
     *   argv[3] = "14:30"
     */

    /* Initialiseer AppConfig met nulwaarden */
    AppConfig cfg;
    memset(&cfg, 0, sizeof(cfg));
    strncpy(cfg.state_file, DEFAULT_STATE_FILE, sizeof(cfg.state_file) - 1);
    strncpy(cfg.config_file, DEFAULT_CONFIG_FILE, sizeof(cfg.config_file) - 1);
    cfg.use_adb = 1;
    cfg.android_version = 11;
    cfg.baud_rate = 115200;
    strncpy(cfg.serial_device, "/dev/ttyUSB0", sizeof(cfg.serial_device) - 1);

    /* Laad opgeslagen configuratie (als die bestaat) */
    config_load(&cfg);

    /* Geen argumenten: toon help */
    if (argc < 2) {
        print_help(argv[0]);
        toon_status(&cfg);
        return EXIT_SUCCESS;
    }

    /* ── Argumenten verwerken ────────────────────────────────── */

    /* --help */
    if (strcmp(argv[1], "--help") == 0 || strcmp(argv[1], "-h") == 0) {
        print_help(argv[0]);
        return EXIT_SUCCESS;
    }

    /* --list-devices */
    if (strcmp(argv[1], "--list-devices") == 0) {
        char device[64];
        printf("Zoeken naar USB GSM-modem...\n");
        if (sms_find_serial_device(device, sizeof(device))) {
            printf("Gevonden: %s\n", device);
            printf("ADB beschikbaar: %s\n", sms_adb_available() ? "ja" : "nee");
        } else {
            printf("Geen USB GSM-modem gevonden op /dev/ttyUSB* of /dev/ttyACM*\n");
            printf("ADB beschikbaar: %s\n", sms_adb_available() ? "ja" : "nee");
        }
        return EXIT_SUCCESS;
    }

    /* --status */
    if (strcmp(argv[1], "--status") == 0) {
        toon_status(&cfg);
        return EXIT_SUCCESS;
    }

    /* --setup */
    if (strcmp(argv[1], "--setup") == 0) {
        printf("\n=== Claude Monitor Setup ===\n\n");

        /* Telefoonnummer uit argumenten of interactief vragen */
        int nummer_gevonden = 0;
        for (int i = 2; i < argc; i++) {
            if (argv[i][0] == '+' || argv[i][0] == '0') {
                strncpy(cfg.phone_number, argv[i], sizeof(cfg.phone_number) - 1);
                nummer_gevonden = 1;
            } else if (strcmp(argv[i], "--serial") == 0) {
                cfg.use_adb = 0;
                char device[64];
                if (sms_find_serial_device(device, sizeof(device))) {
                    snprintf(cfg.serial_device, sizeof(cfg.serial_device), "%s", device);
                }
            } else if (strcmp(argv[i], "--android") == 0 && i + 1 < argc) {
                cfg.android_version = atoi(argv[++i]);
            }
        }

        if (!nummer_gevonden) {
            printf("Jouw telefoonnummer (met landcode, bijv. +31612345678): ");
            if (fgets(cfg.phone_number, sizeof(cfg.phone_number), stdin) == NULL) {
                fprintf(stderr, "Invoerfout\n");
                return EXIT_FAILURE;
            }
            /* Verwijder newline aan het einde */
            cfg.phone_number[strcspn(cfg.phone_number, "\n")] = '\0';
        }

        if (cfg.use_adb) {
            printf("Android-versie (bijv. 11, 12, 13, 14): ");
            char versbuf[8];
            if (fgets(versbuf, sizeof(versbuf), stdin) != NULL) {
                int v = atoi(versbuf);
                if (v >= 9) cfg.android_version = v;
            }
        }

        printf("\nInstellingen:\n");
        printf("  Telefoonnummer: %s\n", cfg.phone_number);
        printf("  Methode: %s\n", cfg.use_adb
               ? "ADB (Android-telefoon via USB)"
               : "Serieel (USB GSM-modem)");
        if (cfg.use_adb)
            printf("  Android-versie: %d\n", cfg.android_version);
        else
            printf("  Apparaat: %s\n", cfg.serial_device);

        return config_save(&cfg) == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
    }

    /* --test */
    if (strcmp(argv[1], "--test") == 0) {
        if (cfg.phone_number[0] == '\0') {
            fprintf(stderr, "Geen telefoonnummer geconfigureerd.\n");
            fprintf(stderr, "Voer eerst: %s --setup\n", argv[0]);
            return EXIT_FAILURE;
        }

        char bericht[SMS_MAX_LENGTH];
        char tijdstr[32];
        timer_format_time(time(NULL), tijdstr, sizeof(tijdstr));
        snprintf(bericht, sizeof(bericht),
                 "Claude Monitor test! Alles werkt. Tijd: %s", tijdstr);

        printf("Test-SMS sturen naar %s...\n", cfg.phone_number);
        return stuur_sms(&cfg, bericht) == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
    }

    /* --hit [--at HH:MM] */
    if (strcmp(argv[1], "--hit") == 0) {
        if (cfg.phone_number[0] == '\0') {
            fprintf(stderr, "Geen telefoonnummer geconfigureerd.\n");
            fprintf(stderr, "Voer eerst: %s --setup\n", argv[0]);
            return EXIT_FAILURE;
        }

        /* Bepaal het tijdstip van de limiet */
        time_t limiet_tijdstip = time(NULL);   /* Standaard: nu */

        for (int i = 2; i < argc; i++) {
            if (strcmp(argv[i], "--at") == 0 && i + 1 < argc) {
                limiet_tijdstip = parse_time_arg(argv[i + 1]);
                if (limiet_tijdstip == (time_t)-1) return EXIT_FAILURE;
                i++;   /* Sla het volgende argument over (de tijdstring) */
            }
        }

        /* Sla op zodat we kunnen herstarten na een crash */
        timer_save_state(limiet_tijdstip, cfg.state_file);

        /* Bereken reset-tijdstip */
        time_t reset_at = timer_calculate_reset(limiet_tijdstip);

        /* Wacht tot de reset */
        int wacht_resultaat = timer_wait_until(reset_at);

        if (wacht_resultaat == 0) {
            /* Reset bereikt! SMS sturen. */
            char bericht[SMS_MAX_LENGTH];
            char reset_str[32];
            timer_format_time(reset_at, reset_str, sizeof(reset_str));
            snprintf(bericht, sizeof(bericht),
                     "Claude credits hersteld! Reset was om %s. "
                     "Je kunt weer aan de slag!", reset_str);

            printf("\n🎉 Reset bereikt! SMS sturen...\n");
            int sms_ok = stuur_sms(&cfg, bericht);

            if (sms_ok == 0) {
                printf("✓ SMS verstuurd naar %s\n", cfg.phone_number);
            } else {
                fprintf(stderr, "✗ SMS versturen mislukt\n");
                return EXIT_FAILURE;
            }
        }

        return EXIT_SUCCESS;
    }

    /* Onbekend argument */
    fprintf(stderr, "Onbekend argument: %s\n", argv[1]);
    fprintf(stderr, "Gebruik '%s --help' voor een overzicht.\n", argv[0]);
    return EXIT_FAILURE;
}
