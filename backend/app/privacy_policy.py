"""Privacy policy text served by GET /users/privacy-policy.

Schweizer revDSG (in Kraft seit 1.9.2023) und EU-DSGVO konforme Fassung.
Im EasyBewerbung-Pilotbetrieb verarbeitete Daten gehen an externe LLM-Anbieter
in den USA (OpenAI, Anthropic, Google), daher sind Drittland-Transfer und
Auftragsverarbeiter-Setup explizit ausgewiesen. Die Fassung beschreibt nur den
tatsaechlichen Datenfluss; sie ist keine Rechtsberatung. Konkrete Verantwortlichen-
Daten werden zur Inbetriebnahme durch den Betreiber befuellt.
"""

PRIVACY_POLICY_VERSION = "2026.04.26"

PRIVACY_POLICY_TEXT = """
DATENSCHUTZERKLAERUNG — EasyBewerbung

Stand: 26. April 2026 (Version 2026.04.26)

1. VERANTWORTLICHE STELLE

Verantwortlich fuer die Datenverarbeitung im Sinne von Art. 5 lit. j revDSG
und Art. 4 Abs. 7 DSGVO ist:

  EasyBewerbung — Betreiber
  app.easybewerbung.ch
  Schweiz

  Kontakt fuer Datenschutzanfragen: privacy@easybewerbung.ch

Die in dieser Erklaerung genannten Rechte koennen Sie jederzeit unter dieser
Kontaktadresse oder ueber die Selbstbedienungs-Funktionen im Konto-Menue
geltend machen (siehe Abschnitt 9).

2. UMFANG DER VERARBEITUNG

Im Rahmen der Nutzung erheben und verarbeiten wir die folgenden Kategorien
personenbezogener Daten:

(a) Konto-Daten: E-Mail-Adresse, Name, gewaehlte Sprache, Passwort-Hash,
    OAuth-Verknuepfung (falls Anmeldung via Google), Profilbild-URL.
(b) Bewerbungsprofil: Anstellungsstatus, Ausbildungsart, optionaler Kontext-
    Freitext, hochgeladene Lebenslaeufe inklusive der darin enthaltenen
    Informationen (z.B. Geburtsdatum, Adresse, beruflicher Werdegang,
    Sprachkenntnisse, Zeugnisinhalte).
(c) Stelleninserate, die Sie in das System einlesen, einschliesslich der
    URL, des Originaltexts, der gespeicherten PDF-Kopie und der von uns
    generierten Auswertungen.
(d) Generierte Bewerbungsunterlagen (Anschreiben, Lebenslaeufe, Firmen-
    portraits, Interview-Vorbereitungen, Match-Score-Berichte etc.).
(e) Aktivitaetsprotokoll: Login-/Logout-Zeitpunkte, IP-Adresse,
    Konten-Sperrungen, Aenderungen sicherheitsrelevanter Felder.
(f) Technische Daten: Browser-Identifikation, Cookies fuer Sitzungs-
    erhaltung, REST-API-Aufrufe.

Wir erheben KEINE Tracking-Cookies und nutzen keine Werbe-Netzwerke.

3. ZWECKE UND RECHTSGRUNDLAGEN

(a) Kernfunktion: Erstellung individualisierter Bewerbungsunterlagen mit
    Hilfe von Sprachmodellen (LLMs). Rechtsgrundlage: Vertragserfuellung
    (Art. 31 Abs. 2 lit. a revDSG / Art. 6 Abs. 1 lit. b DSGVO) sowie Ihre
    explizite Einwilligung in den Drittland-Transfer (siehe Abschnitt 4)
    nach Art. 31 Abs. 1 revDSG / Art. 49 Abs. 1 lit. a DSGVO.

(b) Konto-Verwaltung, Authentifizierung, Sicherheit gegen Brute-Force-
    Angriffe, Fehlersuche, Abwehr von Missbrauch. Rechtsgrundlage:
    berechtigtes Interesse (Art. 31 Abs. 1 revDSG / Art. 6 Abs. 1 lit. f
    DSGVO).

(c) Erfuellung gesetzlicher Pflichten (Buchhaltung, Anfragen von Behoerden):
    Art. 6 Abs. 1 lit. c DSGVO.

4. EINSATZ KUENSTLICHER INTELLIGENZ — DRITTLAND-TRANSFER

EasyBewerbung verwendet Sprachmodelle der folgenden Anbieter, die ihre
Verarbeitung in den USA durchfuehren:

  - OpenAI, L.L.C. (USA)
  - Anthropic PBC (USA)
  - Google LLC / Google Cloud (USA)

Bei jeder Generierung wird der Inhalt Ihres Lebenslaufs sowie das
Stelleninserat an einen dieser Anbieter uebermittelt. Die Auswahl des
Anbieters und des Modells erfolgt admin-seitig pro Dokumenttyp und ist
in der Anwendung sichtbar.

(a) Rechtsgrundlage des Transfers:
    Schweiz: Art. 16 Abs. 1 revDSG i.V.m. dem Angemessenheits-Beschluss des
    EDOEB fuer USA-Empfaenger, sofern unter dem Swiss-US Data Privacy
    Framework zertifiziert; sonst Standardvertragsklauseln nach Art. 16
    Abs. 2 lit. d revDSG.
    EU: Art. 46 Abs. 2 lit. c DSGVO (Standardvertragsklauseln) bzw.
    Art. 45 DSGVO (EU-US Data Privacy Framework, soweit anwendbar).

(b) Auftragsverarbeitung: Wir haben mit jedem dieser Anbieter einen
    Auftragsverarbeitungsvertrag (Data Processing Addendum, DPA)
    abgeschlossen, in dem Zweckbindung, Sicherheits-Standards und
    Speicherfristen festgelegt sind. Soweit verfuegbar, ist die
    Zero-Data-Retention-Option aktiviert: die Anbieter loeschen Ihre
    Daten unmittelbar nach der Generierung und nutzen sie weder zu
    Trainingszwecken noch zur Modellverbesserung.

(c) Hinweis nach EU-KI-VO: Saemtliche von der Plattform erstellten
    Texte sind KI-generiert. Sie sollten sie vor dem Versand an
    Arbeitgeber pruefen und ggf. anpassen. Diese Plattform trifft
    KEINE eigenstaendigen Personalentscheidungen — sie erstellt nur
    Hilfs-Dokumente fuer den Bewerbungsprozess.

5. SPEICHERDAUER

(a) Konto-Daten: bis zur Loeschung des Kontos (Sie koennen das Konto
    jederzeit selbst loeschen, siehe Abschnitt 9).
(b) Bewerbungen, generierte Dokumente, hochgeladene Lebenslaeufe:
    bis zur Loeschung des Kontos oder bis Sie den Datensatz manuell
    entfernen.
(c) Aktivitaetsprotokoll mit IP-Adresse: 90 Tage rollierend.
(d) Backup-Kopien (verschluesselt): bis zu 30 Tage nach Loeschung
    werden Ihre Daten in inkrementellen Backup-Snapshots ueberschrieben.

6. EMPFAENGER

Innerhalb des Betreiber-Teams haben nur Personen Zugriff, die diesen fuer
Betrieb und Wartung benoetigen. Daneben werden Daten an die folgenden
Auftragsverarbeiter weitergegeben:

  - LLM-Anbieter (siehe Abschnitt 4): zur Generierung Ihrer Dokumente.
  - Hosting-Provider in der Schweiz: Datenbank, Worker, Backups.
  - E-Mail-Versand-Provider: nur fuer transaktionale E-Mails (Bestaetigung,
    Passwort-Zuruecksetzen).

Eine Weitergabe Ihrer Daten zu Werbe-Zwecken oder an Datenhaendler findet
nicht statt.

7. SICHERHEIT

Wir setzen technische und organisatorische Schutzmassnahmen ein:

  - TLS 1.2+ fuer alle Datenuebertragungen.
  - Bcrypt-Passwort-Hashing mit SHA256-Vorvermischung gegen die 72-Byte-
    Truncierung.
  - JWT-basierte Authentifizierung mit serverseitigem Revocation-Stempel
    (Logout, Passwort-Aenderung und Admin-Demotion entwerten alle bisherigen
    Tokens).
  - Account-Lockout nach mehrfacher Fehlanmeldung.
  - Rate-Limits auf saemtlichen Schreib-Endpunkten.
  - Tagesbackups mit Verschluesselung im Ruhezustand.

Eine ABSOLUTE Sicherheit gibt es nicht — Sie sollten besonders sensible
Informationen (z.B. Sozialversicherungsnummern, Bankdaten) NICHT in Ihren
Lebenslauf oder das Kontext-Feld eingeben.

8. COOKIES UND LOKALE SPEICHERUNG

Wir verwenden ausschliesslich technisch notwendige Cookies bzw.
Local-Storage-Eintraege:

  - Sitzungs-JWT (Browser-Local-Storage)
  - Sprachpraeferenz und Theme (Local-Storage)

Es findet kein Tracking via Cookies statt. Eine Einwilligung im Sinne der
ePrivacy-Verordnung ist daher nicht erforderlich.

9. IHRE RECHTE

Sie haben gemaess revDSG / DSGVO das Recht auf:

  (a) Auskunft (Art. 25 revDSG / Art. 15 DSGVO):
      Konto-Menue → "Meine Daten exportieren". Liefert eine vollstaendige
      JSON-Datei mit allen ueber Sie gespeicherten Daten.

  (b) Berichtigung (Art. 32 Abs. 1 revDSG / Art. 16 DSGVO):
      Profil-Einstellungen erlauben die Korrektur direkt in der Anwendung.

  (c) Loeschung (Art. 32 Abs. 2 lit. c revDSG / Art. 17 DSGVO):
      Konto-Menue → "Konto loeschen". Loescht Ihr Konto und alle
      verknuepften Datensaetze hart aus der Datenbank. Backup-Kopien
      werden im Lauf von 30 Tagen ueberschrieben.

  (d) Einschraenkung (Art. 18 DSGVO) und Widerspruch (Art. 21 DSGVO):
      per E-Mail an die in Abschnitt 1 genannte Adresse.

  (e) Datenuebertragbarkeit (Art. 28 revDSG / Art. 20 DSGVO):
      Der JSON-Export aus Ziffer (a) erfuellt diese Anforderung.

  (f) Beschwerderecht bei der Aufsichtsbehoerde:
      EDOEB (CH): https://www.edoeb.admin.ch
      Im EU-Raum: jeweilige nationale Datenschutzbehoerde.

10. AENDERUNGEN DIESER ERKLAERUNG

Wir behalten uns vor, diese Datenschutzerklaerung anzupassen, wenn sich
die Verarbeitung aendert. Bei substanziellen Aenderungen werden Sie beim
naechsten Login informiert. Die jeweils gueltige Version-Nummer steht im
Kopf dieses Dokuments.

11. KONTAKT

Datenschutzanfragen: privacy@easybewerbung.ch

Mit der Registrierung bestaetigen Sie, dass Sie diese Datenschutzerklaerung
gelesen haben und insbesondere mit dem in Abschnitt 4 beschriebenen
Drittland-Transfer Ihrer Bewerbungsdaten an LLM-Anbieter in den USA
einverstanden sind.
"""
