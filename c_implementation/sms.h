#ifndef SMS_H
#define SMS_H

/*
 * sms.h — SMS-verzending via ADB of seriële AT-commando's
 *
 * Dit module leert je:
 *  - popen(): een subproces starten en zijn stdout lezen
 *  - open() / read() / write(): low-level bestandsoperaties (voor seriële poort)
 *  - termios.h: seriële poort configureren (baud rate, stop bits etc.)
 *  - struct gebruiken voor configuratie doorgeven
 */

#include <stddef.h>   /* size_t */

/* Maximum lengte van een SMS-bericht (GSM standaard: 160 tekens) */
#define SMS_MAX_LENGTH 160

/* Maximum lengte van een telefoonnummer (inclusief landcode) */
#define SMS_MAX_NUMBER_LEN 20

/*
 * Configuratiestructuur voor SMS-verzending.
 *
 * LEERPUNT: In C gebruik je structs om gerelateerde data samen te bundelen.
 * Dit is het equivalent van een klasse zonder methoden in OOP-talen.
 */
typedef struct {
    char recipient[SMS_MAX_NUMBER_LEN]; /* Bestemmingsnummer, bijv. "+31612345678" */

    /* Methode 1: ADB (Android-telefoon via USB) */
    int use_adb;                        /* 1 = gebruik ADB, 0 = niet */
    int android_version;                /* 9, 10, 11, 12, 13, 14 */

    /* Methode 2: Seriële poort / USB GSM-modem */
    int use_serial;                     /* 1 = gebruik seriële poort, 0 = niet */
    char serial_device[64];             /* bijv. "/dev/ttyUSB0" */
    int baud_rate;                      /* bijv. 115200 of 9600 */

} SmsConfig;

/*
 * Initialiseer een SmsConfig met standaardwaarden.
 * Altijd aanroepen vóór je een SmsConfig gebruikt!
 *
 * Param: cfg — pointer naar de te initialiseren struct
 */
void sms_config_init(SmsConfig *cfg);

/*
 * Stuur een SMS via ADB (Android Debug Bridge).
 *
 * Vereisten:
 *  - ADB geïnstalleerd (onderdeel van Android SDK platform-tools)
 *  - Android-telefoon via USB verbonden
 *  - "USB-foutopsporing" ingeschakeld op de telefoon
 *
 * Werking:
 *  Roept `adb shell service call isms ...` aan via popen().
 *  popen() start een subproces en geeft je toegang tot zijn stdout.
 *
 * Return: 0 bij succes, -1 bij fout
 */
int sms_send_adb(const SmsConfig *cfg, const char *message);

/*
 * Stuur een SMS via een USB GSM-modem met AT-commando's.
 *
 * Vereisten:
 *  - USB GSM-modem aangesloten (bijv. Huawei E173, ZTE MF180)
 *  - SIM-kaart in de modem
 *  - Modem verschijnt als /dev/ttyUSB0 op Linux
 *
 * AT-commando's die verstuurd worden:
 *  AT          — ping (modem wakker maken)
 *  AT+CMGF=1   — schakel over naar Text Mode (i.p.v. PDU Mode)
 *  AT+CMGS="<nummer>"  — begin SMS naar dit nummer
 *  <bericht>\x1A       — de tekst, afgesloten met Ctrl+Z (0x1A)
 *
 * Return: 0 bij succes, -1 bij fout
 */
int sms_send_serial(const SmsConfig *cfg, const char *message);

/*
 * Hulpfunctie: controleer of ADB beschikbaar is op dit systeem.
 * Return: 1 als ADB gevonden is, 0 als niet.
 */
int sms_adb_available(void);

/*
 * Hulpfunctie: zoek automatisch naar een USB GSM-modem op Linux.
 * Schrijft het apparaatpad (bijv. "/dev/ttyUSB0") naar device_buf.
 *
 * Return: 1 als een modem gevonden is, 0 als niet.
 */
int sms_find_serial_device(char *device_buf, size_t buf_len);

#endif /* SMS_H */
