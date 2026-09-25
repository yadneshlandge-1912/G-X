# CoalMine LoRa+AI Monitoring Platform
### Underground Mine Safety — MVP v1.0

> **Solves the real constraint**: 70%+ of underground coal mines have zero mobile coverage.  
> This system works entirely on LoRa radio + local offline processing — no SIM card, no internet, no cloud required.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  UNDERGROUND (Zero Coverage Zone)                                   │
│                                                                     │
│  [Node 1]──┐                                                        │
│  [Node 2]──┤                                                        │
│  [Node 3]──┼──── LoRa 915MHz SF12 ────► [GATEWAY ESP32]             │
│  [Node 4]──┤     (500m+ range)          OLED + LED                  │
│  [Node 5]──┘                            USB Serial ↓                │
│                                                                     │
└────────────────────────────────────────────────────────────┬────────┘
                                                             │
┌────────────────────────────────────────────────────────────▼────────┐
│  PIT HEAD / SURFACE (Gateway PC —  Laptop)                          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Backend (Node.js + SQLite)                                  │    │
│  │                                                             │    │
│  │  SerialBridge ──► Agent 1 (Signal) ──► Agent 2 (Location)  │     │
│  │                        │                      │            │     │
│  │                   AlertEngine            LocationDB        │     │
│  │                        │                                   │     │
│  │                   SQLite DB ◄──────────────────────────────┘     │
│  │                        │                                         │
│  │                   WebSocket ──► React Dashboard                  │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## What's Built

### Firmware
| File | Description |
|------|-------------|
| `firmware/node/node.ino` | Miner node: DHT22 + MQ-2 + LoRa TX + OLED 4-screen UI + SOS button |
| `firmware/gateway/gateway.ino` | Gateway: receives all 5 nodes, ACKs, forwards via Serial, OLED overview |

### Backend
| File | Description |
|------|-------------|
| `backend/src/agents/signalAgent.js` | **AI Agent 1** — Kalman filter, anomaly detection, signal quality, heartbeat watchdog |
| `backend/src/agents/locationAgent.js` | **AI Agent 2** — RSSI path-loss model, particle filter, tunnel BFS pathfinding |
| `backend/src/models/db.js` | SQLite schema, WAL mode, prepared statements, saveReadingTransaction |
| `backend/src/services/alertEngine.js` | DGMS-aligned thresholds, severity 1–3, cooldown dedup, broadcast |
| `backend/src/services/serialBridge.js` | Serial→backend bridge with realistic 5-node simulation fallback |
| `backend/src/routes/api.js` | REST API: nodes, history, alerts, map, stats, inject, sync |
| `backend/src/server.js` | Express + WebSocket server, wires all agents + serial + alerts |

### Dashboard (React)
| File | Description |
|------|-------------|
| `dashboard/src/store/useMineStore.js` | Zustand store: WS connection, live node state, rolling history |
| `dashboard/src/components/NodeCard.jsx` | Per-node card: temp, humidity, gas, RSSI bars, location strip |
| `dashboard/src/components/NodeDetail.jsx` | Expandable detail: live charts, location, anomalies |
| `dashboard/src/components/MineMap.jsx` | Canvas mine map with live node positions + tunnel graph |
| `dashboard/src/components/GatewayStatus.jsx` | Gateway health, LoRa config, node count |
| `dashboard/src/components/AlertsPanel.jsx` | Live alerts with severity colours + acknowledge |
| `dashboard/src/pages/Dashboard.jsx` | Main view: 5 cards + map + gateway + alerts |
| `dashboard/src/pages/MapPage.jsx` | Full mine map + position table |
| `dashboard/src/pages/AlertsPage.jsx` | Alert center with acknowledge-all |
| `dashboard/src/pages/HistoryPage.jsx` | Multi-node trend charts, per-node mini sparklines |

### Docs
| File | Description |
|------|-------------|
| `docs/HARDWARE_BOM.md` | Full BOM with part numbers, costs, wiring diagrams |
| `docs/DEPLOYMENT_GUIDE.md` | Step-by-step flash, install, calibrate, API reference |

---

## OLED Node Screens (cycles every 3s)

```
Screen 0          Screen 1          Screen 2          Screen 3
┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────┐
│NODE 1 SEC-A│   │NODE 1 SEC-A│   │NODE 1 SEC-A│   │NODE 1 SEC-A│
│ENVIRONMENT │   │GAS/AIR QUA │   │LORA SIGNAL │   │NODE STATUS │
│────────────│   │────────────│   │────────────│   │────────────│
│28.5   TEMP │   │  342       │   │RSSI: -82dBm│   │T:28.5 H:67%│
│     C      │   │        PPM │   │TX: 45|ACK:4│   │GAS: 342 PPM│
│67   HUM    │   │  SAFE LEVEL│   │SIG: ████░░ │   │RSSI: -82dBm│
│   %        │   │            │   │LAST:-82dBm │   │TX:45 ACK:43│
└────────────┘   └────────────┘   └────────────┘   └────────────┘

SOS Override (all screens):
┌────────────┐
│NODE 1 SEC-A│
│██████████  │
│  ! SOS !   │
│EMERGENCY TX│
└────────────┘
```

---

## Quick Start (Demo — No Hardware)

```powershell
# Backend (simulation mode auto-activates without serial port)
cd backend
npm install
npm start

# Dashboard (new terminal)
cd dashboard
npm install
npm run dev

# Open http://localhost:5173
# All 5 nodes simulate live data with realistic drift + occasional alerts
```

---

## Key Design Decisions

| Constraint | Solution |
|------------|----------|
| Zero mobile coverage underground | LoRa 915MHz SF12 — 500m+ range through rock/bends |
| No internet at pit head | SQLite offline-first DB, sync queue for cloud upload later |
| Noisy RSSI readings | Kalman filter (Agent 1) + median filter (Agent 2) |
| No GPS underground | RSSI path-loss model + particle filter in tunnel graph |
| Sensor failures | Flatline detection + spike detection in Agent 1 |
| Miner entrapment | 30s/120s heartbeat watchdog + SOS button on each node |
| DGMS compliance | Thresholds match Coal Mines Regulations 2017 (Reg. 167) |
| Power cuts | UPS on gateway, 72h battery on each miner node |

---

## Scalability Path

- Add more mine sections: deploy additional gateways, each with their own section ID
- Multiple gateways = true trilateration (Agent 2 improves from 1-anchor to 3-anchor)
- Cloud sync: implement `sync_queue` flush to any REST endpoint (BSNL, AWS, GovCloud)
- Multilingual OLED: swap English labels for Hindi transliteration in firmware
- Blockchain audit trail: hash each `readings` row and publish to permissioned chain
