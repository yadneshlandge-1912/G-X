/*
 * ============================================================
 *  COAL MINE MINER NODE FIRMWARE — ESP32
 * ============================================================
 *  Components:
 *    - ESP32 (38-pin devkit)
 *    - SX1278 LoRa module (SPI)
 *    - DHT22 temperature + humidity sensor
 *    - NEO-6M / NEO-8M GPS module (UART2)
 *    - SSD1306 OLED display 128x64 (I2C)
 *    - PIR motion sensor (HC-SR501)
 *    - Active buzzer
 *    - Analog microphone (MAX4466)
 *    - SOS push button
 *
 *  Pin assignments (DO NOT CHANGE):
 *    LoRa SCK   = 18   LoRa MISO  = 19
 *    LoRa MOSI  = 23   LoRa CS    = 5
 *    LoRa RST   = 14   LoRa DIO0  = 26
 *    DHT22      = 4    (10k pullup to 3.3V)
 *    GPS RX2    = 16   GPS TX2    = 17
 *    OLED SDA   = 21   OLED SCL   = 22
 *    PIR        = 27
 *    BUZZER     = 25
 *    MIC (ADC)  = 34
 *    SOS BUTTON = 0    (active LOW, uses internal pullup)
 *
 *  Libraries needed (Tools > Manage Libraries):
 *    - LoRa                  by Sandeep Mistry
 *    - DHT sensor library    by Adafruit
 *    - Adafruit Unified Sensor
 *    - TinyGPSPlus           by Mikal Hart
 *    - Adafruit SSD1306      by Adafruit
 *    - Adafruit GFX Library  by Adafruit
 *    - ArduinoJson           by Benoit Blanchon  (version 6.x)
 * ============================================================
 */

#include <SPI.h>
#include <LoRa.h>
#include <Wire.h>
#include <DHT.h>
#include <TinyGPSPlus.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>

// ============================================================
// NODE IDENTITY — change NODE_ID for each miner board (1-5)
// ============================================================
#define NODE_ID   1
#define SECTION   "SEC-A"

// ============================================================
// PIN DEFINITIONS — do not change
// ============================================================
#define LORA_SCK    18
#define LORA_MISO   19
#define LORA_MOSI   23
#define LORA_CS     5
#define LORA_RST    14
#define LORA_DIO0   26
#define LORA_BAND   915E6

#define DHT_PIN     4
#define DHT_TYPE    DHT22

#define GPS_RX_PIN  16
#define GPS_TX_PIN  17
#define GPS_BAUD    9600

#define OLED_SDA    21
#define OLED_SCL    22
#define OLED_WIDTH  128
#define OLED_HEIGHT 64
#define OLED_ADDR   0x3C

#define PIR_PIN     27
#define BUZZER_PIN  25
#define MIC_PIN     34
#define SOS_PIN     0

// ============================================================
// TIMING
// ============================================================
#define TX_INTERVAL    5000   // ms between LoRa transmissions
#define OLED_INTERVAL  1000   // ms between OLED refreshes
#define MIC_SAMPLES    32     // ADC samples to average
#define MIC_THRESHOLD  2800   // ADC level = loud noise alert

// ============================================================
// OBJECTS
// ============================================================
DHT              dht(DHT_PIN, DHT_TYPE);
TinyGPSPlus      gps;
HardwareSerial   gpsSerial(2);                          // UART2
Adafruit_SSD1306 display(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);

// ============================================================
// GLOBAL STATE
// ============================================================
float    temperature    = 0.0f;
float    humidity       = 0.0f;
bool     motionDetected = false;
bool     sosActive      = false;
bool     noiseAlert     = false;
int      noiseLevel     = 0;
double   gpsLat         = 0.0;
double   gpsLon         = 0.0;
bool     gpsValid       = false;
uint32_t txCount        = 0;
uint32_t rxCount        = 0;
int      lastRSSI       = 0;
bool     loraOk         = false;

unsigned long lastTxMs   = 0;
unsigned long lastOledMs = 0;

// ============================================================
// FORWARD DECLARATIONS
// ============================================================
void showSplash();
void updateOLED();
void sendPacket();
void beep(int times, int durationMs);
int  readNoiseLevel();

// ============================================================
// SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  // Output pins
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // Input pins
  pinMode(PIR_PIN, INPUT);
  pinMode(SOS_PIN, INPUT_PULLUP);   // active LOW

  // ── OLED ──────────────────────────────────────────────────
  Wire.begin(OLED_SDA, OLED_SCL);
  Wire.setClock(400000);   // Fast I2C mode 400kHz
  if (display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    showSplash();
  } else {
    Serial.println("[OLED] Init failed — check wiring");
  }

  // ── DHT22 ─────────────────────────────────────────────────
  dht.begin();
  Serial.println("[DHT] OK");

  // ── GPS on UART2 ──────────────────────────────────────────
  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  Serial.println("[GPS] Started UART2");

  // ── LoRa ──────────────────────────────────────────────────
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);
  LoRa.setPins(LORA_CS, LORA_RST, LORA_DIO0);

  if (!LoRa.begin(LORA_BAND)) {
    Serial.println("[LoRa] INIT FAILED — check wiring");
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(4, 20);
    display.println("LoRa INIT FAILED");
    display.setCursor(4, 32);
    display.println("Check SPI wiring:");
    display.setCursor(4, 42);
    display.println("SCK=18 MISO=19");
    display.setCursor(4, 52);
    display.println("MOSI=23 CS=5");
    display.display();
    loraOk = false;
  } else {
    LoRa.setSpreadingFactor(12);
    LoRa.setSignalBandwidth(125E3);
    LoRa.setCodingRate4(8);
    LoRa.setTxPower(20);
    LoRa.setSyncWord(0xF3);
    loraOk = true;
    Serial.printf("[LoRa] OK — Node %d | 915 MHz | SF12\n", NODE_ID);
    beep(2, 80);   // 2 short beeps = ready
  }
}

// ============================================================
// MAIN LOOP
// ============================================================
void loop() {

  // Feed GPS sentences into the parser
  while (gpsSerial.available() > 0) {
    if (gps.encode(gpsSerial.read())) {
      if (gps.location.isValid() && gps.location.age() < 3000) {
        gpsLat  = gps.location.lat();
        gpsLon  = gps.location.lng();
        gpsValid = true;
      }
    }
  }

  // PIR
  motionDetected = (digitalRead(PIR_PIN) == HIGH);

  // SOS button (active LOW)
  sosActive = (digitalRead(SOS_PIN) == LOW);
  static unsigned long lastSosBeep = 0;
  if (sosActive && (millis() - lastSosBeep > 2500)) {
    lastSosBeep = millis();
    beep(2, 100);
  }

  // Microphone
  noiseLevel = readNoiseLevel();
  noiseAlert = (noiseLevel > MIC_THRESHOLD);

  // DHT22 — only read every ~2s (sensor limitation)
  static unsigned long lastDhtMs = 0;
  if (millis() - lastDhtMs > 2000) {
    lastDhtMs = millis();
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t)) temperature = t;
    if (!isnan(h)) humidity    = h;
  }

  // Transmit LoRa packet
  if (loraOk && (millis() - lastTxMs >= TX_INTERVAL)) {
    lastTxMs = millis();
    sendPacket();
  }

  // Listen for ACK from gateway
  if (loraOk) {
    int pkt = LoRa.parsePacket();
    if (pkt > 0) {
      String ack = "";
      while (LoRa.available()) {
        ack += (char)LoRa.read();
      }
      lastRSSI = LoRa.packetRssi();
      if (ack.startsWith("ACK")) {
        rxCount++;
        Serial.printf("[ACK] %s | RSSI:%d\n", ack.c_str(), lastRSSI);
      }
    }
  }

  // Refresh OLED
  if (millis() - lastOledMs >= OLED_INTERVAL) {
    lastOledMs = millis();
    updateOLED();
  }
}

// ============================================================
// SEND LORA PACKET
// ============================================================
void sendPacket() {
  txCount++;

  // Use JsonDocument (ArduinoJson v7) or StaticJsonDocument (v6)
  // This works for both versions:
  StaticJsonDocument<400> doc;

  doc["nid"]   = NODE_ID;
  doc["sec"]   = SECTION;
  doc["t"]     = (float)((int)(temperature * 10)) / 10.0;
  doc["h"]     = (int)humidity;
  doc["gas"]   = 0;
  doc["sos"]   = sosActive ? 1 : 0;
  doc["mot"]   = motionDetected ? 1 : 0;
  doc["noise"] = noiseAlert ? 1 : 0;
  doc["nlvl"]  = noiseLevel;
  doc["tx"]    = txCount;
  doc["ts"]    = (uint32_t)(millis() / 1000);
  doc["rssi"]  = lastRSSI;

  if (gpsValid) {
    doc["lat"]  = serialized(String(gpsLat,  6));
    doc["lon"]  = serialized(String(gpsLon, 6));
  }

  String payload;
  serializeJson(doc, payload);

  LoRa.beginPacket();
  LoRa.print(payload);
  LoRa.endPacket(false);   // false = blocking, waits for TX done

  Serial.printf("[TX#%lu] T:%.1f H:%.0f SOS:%d MOT:%d NOISE:%d\n",
    txCount, temperature, humidity,
    (int)sosActive, (int)motionDetected, (int)noiseAlert);
}

// ============================================================
// OLED
// ============================================================
void updateOLED() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  // Header
  display.fillRect(0, 0, 128, 11, SSD1306_WHITE);
  display.setTextColor(SSD1306_BLACK);
  display.setTextSize(1);
  display.setCursor(2, 2);
  display.print("NODE ");
  display.print(NODE_ID);
  display.print("  TX:");
  display.print(txCount);
  display.setTextColor(SSD1306_WHITE);

  // Row 1 — temperature
  display.setCursor(0, 14);
  display.print("Temp : ");
  display.print(temperature, 1);
  display.print(" C");

  // Row 2 — humidity
  display.setCursor(0, 24);
  display.print("Humid: ");
  display.print((int)humidity);
  display.print(" %");

  // Row 3 — RSSI
  display.setCursor(0, 34);
  display.print("RSSI : ");
  display.print(lastRSSI);
  display.print(" dBm");

  // Row 4 — GPS
  display.setCursor(0, 44);
  if (gpsValid) {
    display.print(gpsLat, 4);
    display.print(",");
    display.print(gpsLon, 4);
  } else {
    display.print("GPS: searching...");
  }

  // Row 5 — status
  display.setCursor(0, 55);
  if (sosActive) {
    display.fillRect(0, 54, 128, 10, SSD1306_WHITE);
    display.setTextColor(SSD1306_BLACK);
    display.setCursor(18, 55);
    display.print("!! SOS ACTIVE !!");
    display.setTextColor(SSD1306_WHITE);
  } else {
    if (motionDetected) display.print("MOT ");
    if (noiseAlert)     display.print("NOISE ");
    if (!loraOk)        display.print("LORA-ERR");
    if (!motionDetected && !noiseAlert && loraOk) display.print("OK");
  }

  display.display();
}

// ============================================================
// SPLASH SCREEN
// ============================================================
void showSplash() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(10, 2);
  display.print("COALMINE MONITOR");
  display.drawLine(0, 12, 128, 12, SSD1306_WHITE);
  display.setTextSize(2);
  display.setCursor(20, 18);
  display.print("NODE ");
  display.print(NODE_ID);
  display.setTextSize(1);
  display.setCursor(15, 40);
  display.print("LoRa 915MHz SF12");
  display.setCursor(25, 52);
  display.print("Starting up...");
  display.display();
  delay(2000);
}

// ============================================================
// BUZZER
// ============================================================
void beep(int times, int durationMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(durationMs);
    digitalWrite(BUZZER_PIN, LOW);
    if (i < times - 1) delay(100);
  }
}

// ============================================================
// MICROPHONE — average ADC reading
// ============================================================
int readNoiseLevel() {
  long total = 0;
  for (int i = 0; i < MIC_SAMPLES; i++) {
    total += analogRead(MIC_PIN);
    delayMicroseconds(100);
  }
  return (int)(total / MIC_SAMPLES);
}
