/**
 * ============================================================
 *  COAL MINE LORA GATEWAY FIRMWARE — ESP32
 * ============================================================
 *  Hardware:
 *    - Heltec LoRa 32 v2 (ESP32 + SX1276 + OLED built-in)
 *    - USB to PC running the backend server
 *    - Optional: SD card module for local packet buffering
 *    - Optional: RTC DS3231 for timestamps without internet
 *
 *  The gateway:
 *    1. Listens for LoRa packets from up to 5 miner nodes
 *    2. Sends ACK back to the sender node
 *    3. Forwards raw JSON packets to the PC backend via Serial
 *    4. Tracks last-seen time and RSSI per node
 *    5. Displays per-node status on its own OLED
 *    6. Buffers packets in PSRAM/flash if Serial link is down
 * ============================================================
 */

#include <SPI.h>
#include <LoRa.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <WiFi.h>

// ─── WIFI CREDENTIALS ──────────────────────────────────────
// Change these to your WiFi name and password
#define WIFI_SSID  "YourWiFiName"
#define WIFI_PASS  "YourWiFiPassword"

// ─── PIN DEFINITIONS ───────────────────────────────────────
#define LORA_SCK       5
#define LORA_MISO      19
#define LORA_MOSI      27
#define LORA_SS        18
#define LORA_RST       14
#define LORA_DIO0      26
#define LORA_BAND      915E6

#define OLED_SDA       4
#define OLED_SCL       15
#define OLED_RST       16
#define OLED_WIDTH     128
#define OLED_HEIGHT    64

#define LED_ACTIVITY   2
#define MAX_NODES      5

// ─── OFFLINE BUFFER ────────────────────────────────────────
#define BUFFER_SIZE    50         // store last 50 packets if serial is down
String packetBuffer[BUFFER_SIZE];
int    bufHead = 0, bufTail = 0, bufCount = 0;

// ─── NODE TRACKING ─────────────────────────────────────────
struct NodeState {
  int   nodeId;
  float temperature;
  float humidity;
  int   gasPPM;
  int   rssi;
  int   snr;
  bool  sosActive;
  unsigned long lastSeen;  // millis()
  int   rxCount;
};

NodeState nodes[MAX_NODES + 1];  // index 1–5
int activeNodes = 0;

// ─── OBJECTS ───────────────────────────────────────────────
Adafruit_SSD1306 display(OLED_WIDTH, OLED_HEIGHT, &Wire, OLED_RST);

uint8_t oledPage = 0;
unsigned long lastOledSwitch = 0;
unsigned long totalPackets = 0;
unsigned long lastSerialFlush = 0;

// ================================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(LED_ACTIVITY, OUTPUT);

  // ── OLED ──
  Wire.begin(OLED_SDA, OLED_SCL);
  Wire.setClock(400000);   // Fast mode 400kHz I2C — eliminates slow bus lag
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("[OLED] FAIL"));
  }
  showSplash();

  // ── Show dashboard link on OLED ──
  // Shows the PC backend IP so anyone can open the dashboard
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("== DASHBOARD ==");
  display.println("");
  display.println("Open in browser:");
  display.println("");
  display.println("http://");
  display.setTextSize(1);

  // Try WiFi first, fall back to known PC IP
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 14) {
    delay(500);
    tries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    // Show gateway's own IP (same subnet as PC)
    display.println(WiFi.localIP().toString());
    display.println(":5173");
    Serial.print("[WiFi] IP: ");
    Serial.println(WiFi.localIP());
  } else {
    // Fallback — show PC's known local IP
    display.println("10.92.227.119:5173");
    Serial.println("[WiFi] Not connected — showing fallback IP");
  }
  display.display();
  delay(5000);

  // ── LoRa ──
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_SS);
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  if (!LoRa.begin(LORA_BAND)) {
    Serial.println(F("[LoRa] GATEWAY INIT FAIL"));
    while (true);
  }

  // Must match node settings exactly
  LoRa.setSpreadingFactor(12);
  LoRa.setSignalBandwidth(125E3);
  LoRa.setCodingRate4(8);
  LoRa.setTxPower(20);
  LoRa.setSyncWord(0xF3);

  // Init node states
  for (int i = 1; i <= MAX_NODES; i++) {
    nodes[i] = {i, 0.0f, 0.0f, 0, 0, 0, false, 0, 0};
  }

  Serial.println(F("[GW] Gateway online — waiting for nodes"));
}

// ================================================================
void loop() {
  int packetSize = LoRa.parsePacket();

  if (packetSize > 0) {
    String raw = "";
    while (LoRa.available()) raw += (char)LoRa.read();

    int rssi = LoRa.packetRssi();
    float snr = LoRa.packetSnr();

    handleIncomingPacket(raw, rssi, (int)snr);
  }

  // Flush offline buffer to serial periodically
  if (millis() - lastSerialFlush > 200) {
    lastSerialFlush = millis();
    flushBuffer();
  }

  // OLED update — only refresh periodically, never on every loop iteration
  if (millis() - lastOledSwitch > 2000) {
    lastOledSwitch = millis();
    oledPage = (oledPage + 1) % (MAX_NODES + 1);
    updateOLED();
  }

  delay(5);
}

// ================================================================
void handleIncomingPacket(const String& raw, int rssi, int snr) {
  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, raw);
  if (err) {
    Serial.printf("[GW] JSON parse error: %s | raw: %s\n", err.c_str(), raw.c_str());
    return;
  }

  int nid = doc["nid"] | 0;
  if (nid < 1 || nid > MAX_NODES) {
    Serial.printf("[GW] Unknown node ID: %d\n", nid);
    return;
  }

  // Update node state
  nodes[nid].temperature = doc["t"]   | 0.0f;
  nodes[nid].humidity    = doc["h"]   | 0.0f;
  nodes[nid].gasPPM      = doc["gas"] | 0;
  nodes[nid].sosActive   = (doc["sos"] | 0) == 1;
  nodes[nid].rssi        = rssi;
  nodes[nid].snr         = snr;
  nodes[nid].lastSeen    = millis();
  nodes[nid].rxCount++;
  totalPackets++;

  // Send ACK back to node
  delay(10);  // brief delay before TX
  LoRa.beginPacket();
  LoRa.printf("ACK:N%d:GW", nid);
  LoRa.endPacket();

  // Blink activity LED
  digitalWrite(LED_ACTIVITY, HIGH);
  delay(30);
  digitalWrite(LED_ACTIVITY, LOW);

  // Build enhanced packet for backend (add gateway metadata)
  StaticJsonDocument<320> fwd;
  fwd["nid"]    = nid;
  fwd["sec"]    = doc["sec"] | "UNKNOWN";
  fwd["t"]      = nodes[nid].temperature;
  fwd["h"]      = nodes[nid].humidity;
  fwd["gas"]    = nodes[nid].gasPPM;
  fwd["sos"]    = nodes[nid].sosActive;
  fwd["rssi"]   = rssi;
  fwd["snr"]    = snr;
  fwd["tx"]     = doc["tx"]  | 0;
  fwd["ts"]     = doc["ts"]  | 0;
  fwd["gw_ts"]  = millis() / 1000;
  fwd["rx"]     = nodes[nid].rxCount;

  String fwdStr;
  serializeJson(fwd, fwdStr);

  // Send to backend or buffer if backend not ready
  if (Serial.availableForWrite() > 64) {
    Serial.println("PKT:" + fwdStr);
  } else {
    bufferPacket(fwdStr);
  }

  Serial.printf("[GW] Node%d | T:%.1f H:%.0f Gas:%d SOS:%d RSSI:%d\n",
    nid, nodes[nid].temperature, nodes[nid].humidity,
    nodes[nid].gasPPM, nodes[nid].sosActive, rssi);
}

// ================================================================
void bufferPacket(const String& pkt) {
  if (bufCount >= BUFFER_SIZE) return;  // drop oldest if full (simple approach)
  packetBuffer[bufHead] = pkt;
  bufHead = (bufHead + 1) % BUFFER_SIZE;
  bufCount++;
}

void flushBuffer() {
  while (bufCount > 0 && Serial.availableForWrite() > 64) {
    Serial.println("PKT:" + packetBuffer[bufTail]);
    bufTail = (bufTail + 1) % BUFFER_SIZE;
    bufCount--;
  }
}

// ================================================================
void updateOLED() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  // Header
  display.fillRect(0, 0, 128, 10, SSD1306_WHITE);
  display.setTextColor(SSD1306_BLACK);
  display.setTextSize(1);
  display.setCursor(2, 1);
  display.printf("GATEWAY | RX:%lu", totalPackets);
  display.setTextColor(SSD1306_WHITE);

  if (oledPage == 0) {
    // Overview: all 5 nodes + IP address at bottom
    display.setCursor(0, 12);
    display.println("NODE  T    H   GAS ST");
    for (int i = 1; i <= MAX_NODES; i++) {
      bool alive = (millis() - nodes[i].lastSeen) < 15000;
      display.setCursor(0, 12 + i * 9);
      if (alive) {
        display.printf("N%d %.0fC %.0f%% %3d %s",
          i,
          nodes[i].temperature,
          nodes[i].humidity,
          nodes[i].gasPPM,
          nodes[i].sosActive ? "SOS" : "OK ");
      } else {
        display.printf("N%d --- OFFLINE ---", i);
      }
    }
    // Show IP at very bottom
    display.setCursor(0, 57);
    if (WiFi.status() == WL_CONNECTED) {
      display.setTextSize(1);
      display.print(WiFi.localIP().toString());
    } else {
      display.print("WiFi: offline");
    }
  } else {
    // Detail page for one node
    int n = oledPage;  // pages 1–5 = nodes 1–5
    bool alive = nodes[n].lastSeen > 0 && (millis() - nodes[n].lastSeen) < 15000;

    display.setCursor(0, 12);
    display.printf("--- NODE %d DETAIL ---", n);
    display.drawLine(0, 22, 128, 22, SSD1306_WHITE);

    if (!alive) {
      display.setTextSize(2);
      display.setCursor(10, 30);
      display.println("OFFLINE");
    } else {
      display.setCursor(0, 25);
      display.printf("Temp : %.1f C\n", nodes[n].temperature);
      display.setCursor(0, 35);
      display.printf("Humid: %.0f %%\n", nodes[n].humidity);
      display.setCursor(0, 45);
      display.printf("Gas  : %d PPM\n", nodes[n].gasPPM);
      display.setCursor(0, 55);
      display.printf("RSSI : %d | SNR: %d", nodes[n].rssi, nodes[n].snr);

      if (nodes[n].sosActive) {
        display.fillRect(80, 24, 48, 12, SSD1306_WHITE);
        display.setTextColor(SSD1306_BLACK);
        display.setCursor(82, 26);
        display.println("!! SOS !!");
        display.setTextColor(SSD1306_WHITE);
      }
    }
  }

  display.display();
}

// ================================================================
void showSplash() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(10, 5);
  display.println("COAL MINE MONITOR");
  display.drawLine(0, 15, 128, 15, SSD1306_WHITE);
  display.setTextSize(2);
  display.setCursor(5, 22);
  display.println("GATEWAY");
  display.setTextSize(1);
  display.setCursor(20, 44);
  display.printf("5-Node Network");
  display.setCursor(15, 54);
  display.println("LoRa 915 MHz SF12");
  display.display();
  delay(2000);
}
