# Renesas / IDT SSC Calibration Web App

[Web-App](https://vadergit.github.io/Renesas-IDT-SSC-Calibration-Web-App/?model=zsc31010) · [SSC Calibration Studio](https://vadergit.github.io/SSC-Calibration-Studio/)

## v0.2.0 – Master-aligned Offline-Arbeitsplatz

Die Oberfläche übernimmt die Basisstile und die Schrittstruktur des ELMOS E703.11 Masters (v0.7.173), ohne ELMOS-Registerbefehle zu verwenden. Unterstützt werden acht Modellprofile mit öffentlichen Herstellerlinks, geführte Aufgabenauswahl, klassische und kompakte Ansicht, Hell/Dunkel, manuelle und synthetische Messpunkte, lineare/quadratische/temperaturabhängige Offline-Regression, unabhängige Nachmessung, Ausgangsskalierung, idealisierter Brückenrechner, Rohdaten-Viewer, Logging, JSON/CSV und druckbarer Bericht sowie lokales Archiv. USB Web Serial öffnet den gewählten Port und zeigt passiv empfangene Bytes; es gibt keinen Nachweis einer SSC-Verbindung.

## Grenzen und Freigabe

Alle acht Modelle sind **offline**, nicht hardwarefreigegeben. Die Koeffizienten sind allgemeine mathematische Modelle, keine Renesas-DLL- oder Registerkoeffizienten. Keine AFE-, RAM-, EEPROM-/NVM-, Alarm- oder Ausgangsregister werden geschrieben. Es gibt keine Adapter-Firmware in diesem Stand. Die private SSC-Bibliothek enthält wichtige Originalunterlagen, deren Git-LFS-Inhalte über den aktuellen Zugriff nicht verfügbar waren. Keine privaten Dateien in dieses öffentliche Repository kopieren. Vor Freigabe je Modell: Datenblattrevision/Errata, elektrisches Interface und Startup-Sequenz, Adaptertreiber, Rohwertformat, Registerlayout, Kalibrierformel und Quantisierung, Backup/Readback, Hardwaretest mit Referenzsoftware, unabhängige Verifikation und kontrollierte permanente Programmierung. ZACwire und OWI sind nicht pauschal austauschbar.

## Lokal starten und prüfen

`python3 -m http.server 8000 --bind 127.0.0.1` und http://127.0.0.1:8000 öffnen. `node --test tests/calibration.test.mjs` testet die Offline-Mathematik. Die öffentlichen Herstellerquellen sind in catalog.mjs verlinkt. USB-Diagnose erfordert Web Serial (Chrome/Edge).

### ZSC31010: gerätespezifischer Offline-Viewer

Die 14-Byte-Lesereihenfolge, der A5-Abschluss, das Offset-Duplikat sowie Gain-, Offset-, Temperatur-, AFE- und Ausgangsfelder werden gemäss öffentlichem ZSC31010-Datenblatt vom 20.01.2016 (Tabellen 3.6, 3.8–3.12) dekodiert. Der Viewer prüft nicht die ursprünglichen Signal-Paritätsbits und schreibt nichts. Das Beispiel nutzt die Fabrikwerte ab KW48/2008 mit Platzhaltern für individuelle Trims. Keine Aussage über die Gültigkeit eines physischen EEPROMs allein anhand des Dumps.
