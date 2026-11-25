# Hardware · v0.4.0 (Laborstand)

## Original SSC Communication Board
ZSC31010 / ZSC31015: Original Renesas SSC-CB, 19200 8N1, CR. Connect reads firmware only. Enter button explicitly requires confirmation of adapter-powered sensor and voltage; trigger KS5V only (t01000), 30 ms off, then Start CM (5090). Read EEPROM twice via 0000; exact lengths 14/20 bytes including A5. ZSC31010 fields decoded; ZSC31015 raw dump. NOM command can return NACK as the sensor changes its output; verify externally. No automatic retries after timeout. No permanent write command is sent by connection or reading. ZSC31010 has an explicit experimental Gain_B/Offset_B expert write path: download and verify original backup, manually enter native codes, preview, consent including temperature <85°C, typed confirmation, compare fresh double-read against backup, issue only changed documented commands, require A5 per command and exact full-dump double-read afterwards. No auto retry or rollback; power failure can leave a partial write. Factory trims, communication and other fields are not targeted. Hardware validation required.

## ESP32-C3 ZSC31014
SDA GPIO4, SCL GPIO5, GPIO10 controls external active-high load switch. 3.3 V compatible I2C lines with external pull-ups; use level conversion where required. Never connect 5V directly to GPIO. Avoid back-power through I2C pullups; use appropriately switched supply/level translator. Arduino sketch in firmware/esp32c3_renesas_i2c. USB CDC 115200, I2C 100 kHz. Default 7-bit address 0x28; verify actual address. Startup A0, read 00–13, expect 5A, then NOM 80 and DF4. Timing and power sequence must be verified with oscilloscope on real hardware. Sketch not compiled or tested physically in this session. No EEPROM writes for ZSC31014.

## Limits
ZSC31010 raw mode needs unity gain and may require direct EEPROM changes; no native raw capture implemented yet. ZSC31014 DF4 reads output values, not raw ADC. Native compensation, AFE programming, alarm and output registers, automatic RAM/NVM calibration and other EEPROM fields, remaining models and DIY ZACwire not implemented. Offline regression is not a chip coefficient algorithm. Do not use for production.

## Public sources
- https://www.renesas.com/en/document/dst/zsc31010-datasheet (sections 3.1, 3.3, 3.4, 3.7)
- https://www.renesas.com/en/document/mat/zsc31010zsc31015zssc3015-zacwire-ssc-modular-evaluation-kit-manual (section 7)
- https://www.renesas.com/en/document/dst/zsc31014-datasheet (sections 3.2, 3.5, 3.6)
- https://www.mouser.com/datasheet/2/464/IDT_SSC-Comm-Board-Datasheet-160330_DST_20160416-1102180.pdf (section 6)

## v0.5.0 · I²C bridge v2
New firmware is incompatible with v1 handshake. ZSC31050 (72, CF, 30–4F EEPROM, 10–2F RAM) and ZSC31150 (72 D1, C372 response, 30–43 EEPROM, 10–1E RAM, checksum and command echo) are supported experimentally. The default primary I2C address 0x78 is intentionally allowed only for these families. D8/D9 read auto-zero-corrected raw pressure and temperature words. Capture is sequential, not synchronized, and raw word representation depends on ADC configuration; unsigned/signed display is explicitly selectable. No native coefficient encoding. ZSC31014 DF status is validated and stale values retried once. OFF powers the sensor down on explicit request or normal disconnect. Sources: https://dtsheet.com/doc/1381384/functional-description (sections 4.3–4.5) and https://dtsheet.com/doc/1381355/functional-description (sections 4.1–4.5). Physical electrical and timing validation required; no claim of completed hardware qualification.
