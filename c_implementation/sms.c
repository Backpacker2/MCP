/*
 * sms.c — SMS-verzending via ADB en seriële AT-commando's
 *
 * LEERPUNTEN:
 *  1. popen() / pclose(): subprocessen aanmaken en output lezen
 *  2. snprintf(): veilige string-opmaak (buffer overflow vermijden)
 *  3. open() / write() / read(): low-level I/O (POSIX)
 *  4. termios: seriële poort instellen (baud rate, pariteit, stop bits)
 *  5. usleep(): wachten in microseconden (voor modem-responstijd)
 */

#include "sms.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <unistd.h>

/* Voor seriële poort (USB modem) */
#include <fcntl.h>
#include <termios.h>
#include <sys/stat.h>

/* ------------------------------------------------------------------ */

void sms_config_init(SmsConfig *cfg)
{
    /*
     * memset() vult een geheugenblok met een waarde.
     * Hier zetten we alles op 0, zodat we zeker zijn dat er geen
     * "garbage values" (willekeurige bits) in de struct zitten.
     *
     * ALTIJD doen bij een struct in C — anders krijg je onduidelijke bugs!
     */
    memset(cfg, 0, sizeof(SmsConfig));

    /* Standaardwaarden */
    cfg->use_adb      = 1;        /* Probeer ADB standaard */
    cfg->android_version = 11;    /* Android 11+ formaat */
    cfg->use_serial   = 0;
    cfg->baud_rate    = 115200;
    strncpy(cfg->serial_device, "/dev/ttyUSB0", sizeof(cfg->serial_device) - 1);
}

/* ------------------------------------------------------------------ */
/* ADB METHODE                                                         */
/* ------------------------------------------------------------------ */

int sms_adb_available(void)
{
    /*
     * system() voert een shell-commando uit en geeft de exit-code terug.
     * "adb version > /dev/null 2>&1" slaagt (exit 0) als ADB gevonden is.
     *
     * > /dev/null   →  stdout negeren
     * 2>&1          →  stderr ook negeren
     */
    int ret = system("adb version > /dev/null 2>&1");
    return (ret == 0) ? 1 : 0;
}

int sms_send_adb(const SmsConfig *cfg, const char *message)
{
    char cmd[1024];
    char output[512];

    printf("[ADB] SMS sturen naar %s...\n", cfg->recipient);

    /*
     * Het ADB-commando voor SMS verschilt per Android-versie.
     *
     * Android < 11:
     *   service call isms 7 ...
     * Android 11+:
     *   service call isms 5 i32 1 ...
     *
     * De service call gaat naar het "isms" (Internal SMS Manager) systeem.
     * Dit is de interne Android-API voor SMS zonder UI.
     */
    if (cfg->android_version >= 11) {
        snprintf(cmd, sizeof(cmd),
            "adb shell service call isms 5 i32 1 "
            "s16 \"com.android.mms.service\" "
            "s16 \"null\" "
            "s16 \"%s\" "       /* telefoonnummer */
            "s16 \"null\" "
            "s16 \"%s\" "       /* bericht */
            "s16 \"null\" "
            "s16 \"null\" "
            "i32 1 i32 0 "
            "2>&1",             /* stderr samenvoegen met stdout */
            cfg->recipient,
            message
        );
    } else {
        /* Android 9/10 */
        snprintf(cmd, sizeof(cmd),
            "adb shell service call isms 7 "
            "i32 0 "
            "s16 \"com.android.mms.service\" "
            "s16 \"null\" "
            "s16 \"%s\" "
            "s16 \"null\" "
            "s16 \"%s\" "
            "s16 \"null\" "
            "s16 \"null\" "
            "2>&1",
            cfg->recipient,
            message
        );
    }

    printf("[ADB] Commando: %s\n", cmd);

    /*
     * popen() start het commando als subproces en geeft een FILE*
     * terug waarmee je de stdout van dat proces kunt lezen.
     *
     * "r" = read mode (we lezen de output van het subproces)
     *
     * Verschil met system():
     *  - system() wacht tot het klaar is, gooit de output weg
     *  - popen() laat ons de output lezen
     */
    FILE *pipe = popen(cmd, "r");
    if (pipe == NULL) {
        fprintf(stderr, "[ADB] popen() mislukt: %s\n", strerror(errno));
        return -1;
    }

    /* Lees de output van ADB */
    int succes = 0;
    while (fgets(output, sizeof(output), pipe) != NULL) {
        printf("[ADB] Output: %s", output);

        /*
         * De ADB-service call geeft "Result: Parcel" terug bij succes.
         * strstr() zoekt een substring — geeft NULL als niet gevonden.
         */
        if (strstr(output, "Parcel") != NULL ||
            strstr(output, "Result") != NULL) {
            succes = 1;
        }
    }

    /*
     * pclose() wacht tot het subproces klaar is en geeft de exit-code
     * terug. Vergeet dit nooit — anders lekken we processen!
     */
    int exit_code = pclose(pipe);

    if (exit_code == 0 || succes) {
        printf("[ADB] ✓ SMS succesvol verstuurd!\n");
        return 0;
    } else {
        fprintf(stderr, "[ADB] ✗ SMS mislukt (exit: %d)\n", exit_code);
        fprintf(stderr, "[ADB] Controleer: adb devices (telefoon verbonden?)\n");
        fprintf(stderr, "[ADB] Controleer: USB-foutopsporing ingeschakeld?\n");
        return -1;
    }
}

/* ------------------------------------------------------------------ */
/* SERIËLE POORT / USB GSM-MODEM METHODE                              */
/* ------------------------------------------------------------------ */

int sms_find_serial_device(char *device_buf, size_t buf_len)
{
    /*
     * Op Linux verschijnen USB GSM-modems als /dev/ttyUSB0, ttyUSB1 etc.
     * We proberen ze één voor één totdat we er een vinden die bestaat.
     *
     * stat() geeft informatie over een bestand. Als het slaagt, bestaat het.
     */
    const char *kandidaten[] = {
        "/dev/ttyUSB0", "/dev/ttyUSB1", "/dev/ttyUSB2",
        "/dev/ttyACM0", "/dev/ttyACM1",
        NULL   /* sentinelwaarde: markeer einde van de array */
    };

    struct stat st;

    for (int i = 0; kandidaten[i] != NULL; i++) {
        if (stat(kandidaten[i], &st) == 0) {
            strncpy(device_buf, kandidaten[i], buf_len - 1);
            device_buf[buf_len - 1] = '\0';   /* Altijd null-termineren! */
            printf("[SERIAL] Apparaat gevonden: %s\n", device_buf);
            return 1;
        }
    }

    return 0;
}

/* Hulpfunctie: schrijf bytes naar seriële poort met foutafhandeling */
static int serial_write(int fd, const char *data, size_t len)
{
    ssize_t geschreven = write(fd, data, len);
    if (geschreven < 0) {
        fprintf(stderr, "[SERIAL] write() fout: %s\n", strerror(errno));
        return -1;
    }
    if ((size_t)geschreven != len) {
        fprintf(stderr, "[SERIAL] Onvolledig schrijven: %zd van %zu bytes\n",
                geschreven, len);
        return -1;
    }
    return 0;
}

/* Hulpfunctie: lees respons van modem (wacht max timeout_ms milliseconden) */
static int serial_read_response(int fd, char *buf, size_t buf_len,
                                 int timeout_ms)
{
    /*
     * usleep() wacht in microseconden (1 ms = 1000 µs).
     * We wachten in kleine stapjes zodat we snel reageren als data klaar is.
     */
    int geread = 0;
    int gewacht = 0;
    const int stap_ms = 50;   /* 50 ms per iteratie */

    memset(buf, 0, buf_len);

    while (gewacht < timeout_ms && (size_t)geread < buf_len - 1) {
        usleep(stap_ms * 1000);   /* usleep() verwacht microseconden */
        gewacht += stap_ms;

        ssize_t n = read(fd, buf + geread, buf_len - 1 - geread);
        if (n > 0) {
            geread += (int)n;
            /* Stop als we "OK" of "ERROR" zien — modem is klaar */
            if (strstr(buf, "\r\nOK\r\n") || strstr(buf, "\r\nERROR\r\n"))
                break;
        }
    }

    return geread;
}

int sms_send_serial(const SmsConfig *cfg, const char *message)
{
    char respons[512];
    char at_cmd[256];

    printf("[SERIAL] Modem openen: %s\n", cfg->serial_device);

    /*
     * open() opent een apparaatbestand (of gewoon bestand).
     *
     * Flags:
     *  O_RDWR    = lezen én schrijven
     *  O_NOCTTY  = maak dit NIET de "controlling terminal" van het proces
     *              (zonder dit kun je signalen ontvangen van de modem — ongewenst)
     *  O_NDELAY  = niet blokkeren als de poort niet open is
     */
    int fd = open(cfg->serial_device, O_RDWR | O_NOCTTY | O_NDELAY);
    if (fd < 0) {
        fprintf(stderr, "[SERIAL] Kan %s niet openen: %s\n",
                cfg->serial_device, strerror(errno));
        fprintf(stderr, "[SERIAL] Tip: probeer 'sudo usermod -aG dialout $USER'\n");
        return -1;
    }

    /*
     * termios: seriële poort configuratie.
     *
     * De termios-struct heeft velden voor:
     *  c_cflag: control flags (baud rate, data bits, stop bits, pariteit)
     *  c_iflag: input flags (flow control, conversies)
     *  c_oflag: output flags
     *  c_lflag: local flags (echo, canonical mode)
     *  c_cc:    control characters (timeouts)
     *
     * GSM-modems gebruiken typisch: 8N1 = 8 databits, geen pariteit, 1 stop bit
     */
    struct termios tty;
    memset(&tty, 0, sizeof(tty));

    /* Lees huidige instellingen (als startpunt) */
    if (tcgetattr(fd, &tty) != 0) {
        fprintf(stderr, "[SERIAL] tcgetattr fout: %s\n", strerror(errno));
        close(fd);
        return -1;
    }

    /* Baud rate instellen (115200 of 9600) */
    speed_t baud = (cfg->baud_rate == 9600) ? B9600 : B115200;
    cfsetispeed(&tty, baud);   /* input speed */
    cfsetospeed(&tty, baud);   /* output speed */

    /* 8 databits, geen pariteit, 1 stop bit (8N1) */
    tty.c_cflag &= ~PARENB;    /* Geen pariteitsbit */
    tty.c_cflag &= ~CSTOPB;    /* 1 stop bit (niet 2) */
    tty.c_cflag &= ~CSIZE;     /* Wis data-bit veld */
    tty.c_cflag |=  CS8;       /* 8 databits */

    /* Hardware flow control uitschakelen */
    tty.c_cflag &= ~CRTSCTS;

    /* Ontvanger activeren, modem-signals negeren */
    tty.c_cflag |= (CLOCAL | CREAD);

    /* Raw mode: geen speciale verwerking van tekens */
    tty.c_lflag &= ~(ICANON | ECHO | ECHOE | ISIG);
    tty.c_iflag &= ~(IXON | IXOFF | IXANY);   /* Software flow control uit */
    tty.c_oflag &= ~OPOST;   /* Geen output-conversie */

    /* Timeout: wacht max 1 seconde op data, minimaal 0 tekens */
    tty.c_cc[VTIME] = 10;   /* 10 × 0.1s = 1 seconde timeout */
    tty.c_cc[VMIN]  = 0;

    /* Instellingen toepassen */
    if (tcsetattr(fd, TCSANOW, &tty) != 0) {
        fprintf(stderr, "[SERIAL] tcsetattr fout: %s\n", strerror(errno));
        close(fd);
        return -1;
    }

    /* Buffers legen (gooi oude data weg) */
    tcflush(fd, TCIOFLUSH);

    /* ── AT-commando's sturen ───────────────────────────────── */

    /* 1. Ping: controleer of modem reageert */
    printf("[SERIAL] AT ping...\n");
    if (serial_write(fd, "AT\r", 3) < 0) goto fout;
    serial_read_response(fd, respons, sizeof(respons), 2000);
    printf("[SERIAL] Respons: %s\n", respons);
    if (strstr(respons, "OK") == NULL) {
        fprintf(stderr, "[SERIAL] Modem reageert niet op AT\n");
        goto fout;
    }

    /* 2. Schakel over naar Text Mode (AT+CMGF=1) */
    printf("[SERIAL] Tekst-modus instellen...\n");
    if (serial_write(fd, "AT+CMGF=1\r", 10) < 0) goto fout;
    serial_read_response(fd, respons, sizeof(respons), 2000);
    if (strstr(respons, "OK") == NULL) {
        fprintf(stderr, "[SERIAL] AT+CMGF=1 mislukt\n");
        goto fout;
    }

    /* 3. Geef bestemmingsnummer op */
    snprintf(at_cmd, sizeof(at_cmd), "AT+CMGS=\"%s\"\r", cfg->recipient);
    printf("[SERIAL] SMS-bericht adresseren naar %s...\n", cfg->recipient);
    if (serial_write(fd, at_cmd, strlen(at_cmd)) < 0) goto fout;

    /* Wacht op ">" prompt van de modem */
    serial_read_response(fd, respons, sizeof(respons), 3000);
    if (strstr(respons, ">") == NULL) {
        fprintf(stderr, "[SERIAL] Geen '>' prompt ontvangen\n");
        goto fout;
    }

    /* 4. Stuur berichttekst, afgesloten met Ctrl+Z (ASCII 26 / 0x1A) */
    printf("[SERIAL] Berichttekst sturen...\n");
    if (serial_write(fd, message, strlen(message)) < 0) goto fout;
    if (serial_write(fd, "\x1A", 1) < 0) goto fout;   /* Ctrl+Z = verzenden */

    /* Wacht op "+CMGS:" bevestiging (kan 10-30 seconden duren!) */
    printf("[SERIAL] Wachten op modem-bevestiging...\n");
    serial_read_response(fd, respons, sizeof(respons), 30000);
    printf("[SERIAL] Respons: %s\n", respons);

    if (strstr(respons, "+CMGS:") != NULL) {
        printf("[SERIAL] ✓ SMS succesvol verstuurd!\n");
        close(fd);
        return 0;
    }

    fprintf(stderr, "[SERIAL] ✗ SMS-verzending mislukt\n");

fout:
    close(fd);   /* Altijd sluiten, ook bij fout (via goto) */
    return -1;
}
