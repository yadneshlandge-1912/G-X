# Deployment Guide — CoalMine LoRa+AI Platform

## Prerequisites

- Node.js ≥ 18 on the gateway PC/Pi
- Arduino IDE 2.x with ESP32 board support installed
- Required Arduino libraries (install via Library Manager):
  - `LoRa` by Sandeep Mistry (0.8.0)
  - `Adafruit SSD1306` (2.5.7)
  - `Adafruit GFX Library` (1.11.9)
  - `DHT sensor library` by Adafruit (1.4.4)
  - `ArduinoJson` by Benoît Blanchon (6.x)

---

## Step 1 — Flash Node Firmware

1. Open `firmware/node/node.ino` in Arduino IDE
2. Select board: **Heltec WiFi LoRa 32(V2)**
3. **Change `#define NODE_ID 1`** to match each physical node (1–5)
4. Optionally update `MINE_SECTION` string to your section label
5. Upload to each ESP32. The OLED splash screen confirms boot.
6. Repeat for all 5 nodes with their respective NODE_IDs.

---

## Step 2 — Flash Gateway Firmware

1. Open `firmware/gateway/gateway.ino`
2. Same board selection as above
3. Upload once — no node-specific changes needed
4. Gateway OLED will show "GATEWAY | RX:0" when ready

---

## Step 3 — Install Backend

```powershell
cd G-X\backend
npm install
```

Find your gateway's COM port (Windows):
```powershell
# In Device Manager look for "USB-SERIAL CH340" or "CP210x"
# Common: COM3, COM4, COM5
```

Set the port in an `.env` file (optional — falls back to simulation):
```
# backend\.env
PORT=3001
SERIAL_PORT=COM3
```

Start the server:
```powershell
npm start
```

You should see:
```
═══════════════════════════════════════════════════════
  COAL MINE LoRa+AI BACKEND
  API  : http://localhost:3001/api
  WS   : ws://localhost:3001/ws
  DB   : data/coalmine.db (SQLite — offline-first)
═══════════════════════════════════════════════════════
[Agent1] Signal Receiver Agent started
[Agent2] Location Agent started
[SerialBridge] Connected to COM3 @ 115200
```

If no serial port is found, it automatically enters **SIMULATION MODE** — full demo data for all 5 nodes, no hardware required.

---

## Step 4 — Install & Run Dashboard

```powershell
cd G-X\dashboard
npm install
npm run dev
```

Open browser: **http://localhost:5173**

For production build (served by backend):
```powershell
npm run build
# built files go to dashboard/dist, served by backend on :3001
```

---

## Step 5 — Calibrate RSSI (On-site)

1. Place a node at exactly **1 metre** from the gateway
2. Check backend logs for the received RSSI
3. Update `RSSI_AT_1M` in `backend/src/agents/locationAgent.js`
4. Similarly, measure RSSI at 10m, 50m, 100m and use curve-fitting
   to refine `PATH_LOSS_EXP` (typically 2.0–3.5 underground)

---

## Step 6 — Mine Section Layout

Edit `ANCHOR_MAP` in `locationAgent.js` with your actual surveyed positions:

```js
const ANCHOR_MAP = {
  GW: { id: 'GW', x: 0,   y: 0,  label: 'Pit Head' },
  N1: { id: 'N1', x: 50,  y: 0,  label: '50m Main Tunnel' },
  // ... update x,y in metres from the gateway position
};
```

Update `TUNNEL_GRAPH` to match your actual tunnel connections.

---

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Gateway + agent health |
| `/api/nodes` | GET | Latest reading per node |
| `/api/nodes/:id/history` | GET | Node reading history |
| `/api/alerts` | GET | Unacknowledged alerts |
| `/api/alerts/:id/ack` | POST | Acknowledge alert |
| `/api/stats` | GET | 1-hour aggregated stats |
| `/api/map` | GET | Anchor positions + locations |
| `/api/inject` | POST | Inject test packet |
| `/api/sync/pending` | GET | Offline sync queue status |

---

## Alert Thresholds (DGMS-aligned)

| Parameter | Caution | Warning | Danger |
|-----------|---------|---------|--------|
| Gas PPM (CH4/CO) | 300 | 600 | 1000 |
| Temperature | 33°C | 37°C | 40°C |
| Humidity | — | 90% | — |
| Node silence | 30s | — | 120s |

All thresholds configurable in `backend/src/services/alertEngine.js`.

---

## Offline-First Behaviour

- All data written to **SQLite** (`data/coalmine.db`) before anything else
- Dashboard works entirely from local backend — zero internet required
- `sync_queue` table accumulates records for future cloud upload
- If serial port drops, gateway buffers last 50 packets in ESP32 RAM
- If Wi-Fi/network drops on Pi, dashboard reconnects automatically (3s retry)

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Nodes not appearing | Wrong sync word | Both firmware files must have `LoRa.setSyncWord(0xF3)` |
| RSSI = -120 always | LoRa init failed | Check SPI wiring / board selection in Arduino IDE |
| Gas PPM stuck at 0 | MQ-2 needs warmup | Allow 2–5 min warmup after power-on |
| OLED blank | Wrong I2C pins | Verify SDA=4, SCL=15, RST=16 match your board |
| Backend crashes on start | SQLite missing | Run `npm install` in backend folder |
| Dashboard shows no data | Backend not running | Start backend first, then dashboard |
