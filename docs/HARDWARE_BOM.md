# Hardware Bill of Materials — CoalMine LoRa+AI MVP
## SEC-A: 5 Miner Nodes + 1 Gateway

---

## Per Miner Node (×5)

| # | Component | Part / Model | Qty | Notes |
|---|-----------|-------------|-----|-------|
| 1 | Microcontroller + LoRa | **Heltec WiFi LoRa 32 v2** (ESP32 + SX1278 + OLED built-in) | 1 | 915 MHz version for India. Includes OLED, saves wiring |
| 2 | Temp + Humidity sensor | **DHT22** (AM2302) | 1 | ±0.5°C accuracy; better than DHT11 for mine humidity |
| 3 | Gas sensor | **MQ-2** or **MQ-135** | 1 | MQ-2 detects CH4/LPG/CO. Calibrate R0 in fresh air first |
| 4 | SOS button | 12mm momentary push-button (N/O) | 1 | Mount on miner helmet strap or belt |
| 5 | LED indicators | 5mm LED Red + Green | 2 | Red=alert, Green=TX OK |
| 6 | Current-limiting resistors | 220Ω | 2 | For LEDs |
| 7 | Pull-up resistor | 10kΩ | 1 | For DHT22 data line |
| 8 | Power bank | 10,000 mAh Li-ion, 5V USB | 1 | ~72h runtime at 5V/80mA average |
| 9 | Enclosure | IP65 ABS junction box 120×80×50mm | 1 | Flame-retardant; drill for sensor ports + antenna |
| 10 | LoRa antenna | 915 MHz 3dBi rubber duck SMA | 1 | Run coax through gland to outside enclosure |
| 11 | Wiring | 26 AWG stranded, 30cm jumpers | — | |
| 12 | Velcro + cable ties | — | — | Mounting inside enclosure |

**Node unit cost estimate: ₹2,800–₹3,500**

---

## Gateway (×1)

| # | Component | Part / Model | Qty | Notes |
|---|-----------|-------------|-----|-------|
| 1 | Microcontroller + LoRa | **Heltec WiFi LoRa 32 v2** | 1 | Same board — consistent firmware base |
| 2 | Higher-gain antenna | 915 MHz 5dBi fiberglass, N-type to SMA adapter | 1 | Mount at tunnel entrance for max coverage |
| 3 | USB cable | USB-A to USB-C, 3m | 1 | Connects to PC running backend |
| 4 | PC / SBC | Raspberry Pi 4 (4GB) or any laptop | 1 | Runs Node.js backend + SQLite, serves dashboard |
| 5 | Power supply | 5V 3A USB-C adapter | 1 | For gateway ESP32 |
| 6 | UPS / battery backup | 12V 7Ah SLA battery + 5V regulator | 1 | Keeps gateway alive during power cuts |
| 7 | Enclosure | IP54 metal enclosure | 1 | Near pit-head / mine entrance |
| 8 | Optional: SD card | 32GB microSD (Class 10) | 1 | For extended local logging on the Pi |

**Gateway unit cost estimate: ₹8,000–₹12,000 (with Pi)**

---

## Wiring Diagrams

### Miner Node Wiring (Heltec LoRa 32 v2)

```
Heltec LoRa 32 v2 Pin    →  Component
─────────────────────────────────────────────
GPIO 23 (DATA)           →  DHT22 Pin 2 (DATA) [10kΩ pullup to 3.3V]
3.3V                     →  DHT22 Pin 1 (VCC)
GND                      →  DHT22 Pin 4 (GND)

GPIO 34 (ADC1_CH6)       →  MQ-2 AOUT (analog out)
5V (Vin)                 →  MQ-2 VCC  [MQ-2 heater needs 5V!]
GND                      →  MQ-2 GND
[MQ-2 DOUT not used — we read analog for PPM]

GPIO 0 (BOOT button)     →  SOS button → GND  [built-in pullup used]

GPIO 25                  →  220Ω → LED Red → GND
GPIO 2                   →  220Ω → LED Green → GND

LoRa (built-in SX1276):
  SCK  = GPIO 5
  MISO = GPIO 19
  MOSI = GPIO 27
  SS   = GPIO 18
  RST  = GPIO 14
  DIO0 = GPIO 26

OLED (built-in SSD1306 128×64):
  SDA  = GPIO 4
  SCL  = GPIO 15
  RST  = GPIO 16
  I2C addr: 0x3C
```

### Gateway Wiring

```
Heltec LoRa 32 v2  →  USB cable  →  Raspberry Pi 4 / PC
(Same LoRa + OLED pin assignments as node)
Serial: 115200 baud, gateway sends "PKT:{json}" lines
Backend reads /dev/ttyUSB0 (Linux) or COM3 (Windows)
```

---

## Radio Coverage Notes

- **SF12 + 125kHz + CR4/8** gives ~15–20 dB extra link budget vs SF7
- Underground mine tunnels act as waveguides: signal can travel 200–500m around bends
- Typical underground RSSI range: -70 dBm (10m) → -120 dBm (300m+)
- Use 5dBi directional Yagi at gateway for long straight tunnels
- Test RSSI at each anchor position and update `RSSI_AT_1M` in locationAgent.js

---

## Total BOM Cost Estimate

| Item | Cost (INR) |
|------|-----------|
| 5× Miner Nodes | ₹15,000 – ₹17,500 |
| 1× Gateway + Pi | ₹8,000 – ₹12,000 |
| Tools + misc hardware | ₹2,000 |
| **Total MVP** | **₹25,000 – ₹31,500** |
