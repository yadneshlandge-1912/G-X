# G-X — GuardianX
### Smart Underground Coal Mine Safety & Monitoring System

Real-time LoRa sensor network · AI-powered anomaly detection · DGMS-aligned alerts · Offline-first

---

## Project Structure

```
G-X/
├── frontend/          React dashboard (Vite + Tailwind)
├── backend/           Python API + AI agents + SQLite database
│   ├── agents/        Signal Agent (Kalman) + Location Agent (Particle Filter)
│   ├── models/        SQLite database layer
│   ├── routes/        FastAPI REST endpoints
│   ├── services/      Alert engine, Serial bridge, Supabase syncer
│   ├── data/          SQLite .db files (gitignored)
│   ├── server.py      FastAPI entry point
│   ├── config.py      All configuration constants
│   ├── seed.py        Demo data seeder
│   └── .env           Local secrets (gitignored)
└── firmware/
    ├── node/          ESP32 miner node firmware (Arduino)
    └── gateway/       ESP32 gateway firmware (Arduino)
```

---

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
python server.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev -- --host
```

### Seed demo data (optional)
```bash
cd backend
python seed.py
```

---

## Login Credentials

| Role       | Username       | Password      |
|------------|---------------|---------------|
| Admin      | admin         | admin@mine1   |
| Supervisor | vikas.sharma  | super123      |
| Rescue     | arjun.rescue  | rescue123     |
| Miner      | rajan.kumar   | miner123      |

---

## Hardware

- **Node:** Heltec WiFi LoRa 32 v2 + DHT22 + MQ-2 + NEO-6M GPS + PIR + Microphone + SOS button
- **Gateway:** Heltec WiFi LoRa 32 v2 + 5dBi antenna → USB → PC/Raspberry Pi
- **Radio:** LoRa 915 MHz · SF12 · BW125 · CR4/8 · 20 dBm

---

## Tech Stack

| Layer    | Technology                    |
|----------|-------------------------------|
| Frontend | React 18, Vite, Tailwind CSS  |
| Backend  | Python, FastAPI, Uvicorn      |
| Database | SQLite (local) + Supabase     |
| AI       | Kalman Filter + Particle Filter|
| Radio    | LoRa SX1276 @ 915 MHz         |
| Firmware | Arduino C++ (ESP32)           |
