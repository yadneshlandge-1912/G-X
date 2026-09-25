"""
config.py — Central Configuration for CoalMine LoRa+AI Platform
================================================================
ALL tuneable constants live here.  No other file should hard-code
numbers or strings that an operator might need to change on-site.

How to override any value:
    1. Create a file called  .env  inside backend_py/
    2. Add lines like:  SERIAL_PORT=COM4
    3. python-dotenv reads that file automatically at import time.
    Alternatively, set real environment variables in your shell.

Sections in this file:
    A. Server           — host / port for FastAPI
    B. Serial / Gateway — USB serial port to the gateway ESP32
    C. Database         — path to the SQLite file
    D. LoRa / Radio     — RF parameters mirrored from the firmware
    E. Agent 1 config   — Kalman filter window sizes, heartbeat
    F. Agent 2 config   — particle filter sizing, noise levels
    G. Mine Layout      — surveyed anchor positions in metres
    H. Alert Thresholds — DGMS-aligned safety limits
    I. Alert Cooldowns  — deduplication windows per alert type
"""

import os
from dotenv import load_dotenv  # reads .env file if present; no error if missing

# Load .env from the same directory as this file.
# override=False means real environment variables take priority over .env.
load_dotenv(override=False)


# ── A. SERVER ────────────────────────────────────────────────────────────────
# HOST="0.0.0.0" means the server listens on ALL network interfaces,
# so both localhost and the machine's LAN IP reach it.
# Change to "127.0.0.1" to restrict to localhost only (more secure for dev).
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "3001"))   # int() because os.getenv always returns str


# ── B. SERIAL / GATEWAY ──────────────────────────────────────────────────────
# The gateway ESP32 connects to the PC via USB and appears as a virtual COM
# port.  On Windows this is typically "COM3" or "COM4"; on Linux/Raspberry Pi
# it is "/dev/ttyUSB0" or "/dev/ttyACM0".
#
# If SERIAL_PORT is None (the default), serial_bridge.py switches to
# SIMULATION MODE automatically — all five nodes generate synthetic data.
# This lets the entire stack run without any hardware for demos and testing.
SERIAL_PORT = os.getenv("SERIAL_PORT", None)   # e.g. "COM3" or "/dev/ttyUSB0"
BAUD_RATE   = int(os.getenv("BAUD_RATE", "115200"))  # must match gateway firmware

# SIMULATION_MODE controls whether fake data is generated when no hardware
# is connected. Set to "true" in .env to enable simulation for demos/testing.
# Default is FALSE — the backend stays silent until a real receiver is plugged in.
SIMULATION_MODE = os.getenv("SIMULATION_MODE", "false").lower() == "true"


# ── C. DATABASE ───────────────────────────────────────────────────────────────
# Relative path from backend_py/.  The data/ directory is created automatically
# by db.py on first run.  Do NOT put the DB file inside a cloud-synced folder
# (OneDrive, Dropbox) because SQLite WAL mode writes multiple temp files and
# cloud sync can corrupt them.
DB_PATH = os.getenv("DB_PATH", "data/coalmine.db")


# ── D. LoRa / RADIO ──────────────────────────────────────────────────────────
# These must match the values flashed into the node and gateway firmware.
# Changing any of these without reflashing the firmware breaks communication.

LORA_FREQ_MHZ = 915   # 915 MHz — licensed for ISM band use in India (check local regs)
LORA_SF       = 12    # Spreading Factor 12 = maximum range, slowest data rate (~250 bps)
                      # SF12 + BW125 + CR4/8 gives ~15-20 dB extra link budget vs SF7.
                      # This is what allows signals to travel 300-500 m around tunnel bends.
TX_POWER_DBM  = 20    # Maximum allowed TX power for SX1276 module (20 dBm = 100 mW)

# ── Path-loss model parameters (used by Agent 2 for distance estimation) ────
# The log-distance path-loss model:
#     PL(d) = PL(d0) + 10 * n * log10(d / d0)
# where:
#     d0 = REF_DISTANCE_M   — reference distance (1 m)
#     n  = PATH_LOSS_EXP    — path-loss exponent
#     PL(d0) = -RSSI_AT_1M_DBM (measured on-site)
#
# Underground mine tunnels have n ≈ 2.0–3.5 depending on tunnel geometry,
# rock type, and how many bends are between transmitter and receiver.
# Start with 2.5 and calibrate by measuring RSSI at 10 m, 50 m, 100 m.
PATH_LOSS_EXP   = 2.5    # n — CALIBRATE THIS ON-SITE before deployment
RSSI_AT_1M_DBM  = -40    # measured RSSI at exactly 1 m; update after on-site test
REF_DISTANCE_M  = 1.0    # d0 — do not change; always measure reference at 1 m


# ── E. AGENT 1 — SIGNAL RECEIVER ─────────────────────────────────────────────
# How long a node can go without sending a packet before Agent 1 considers
# it "lost" and fires a node_lost event → alert engine → operator notification.
HEARTBEAT_TIMEOUT_S = 30   # seconds.  Nodes transmit every 5 s, so 30 s = 6 missed packets.

# How many historical readings per node to keep in the rolling window.
# Used for trend analysis (RISING / STABLE / FALLING) and anomaly detection.
# 20 readings × 5 s interval = 100 s of history in RAM per node.
WINDOW_SIZE = 20


# ── F. AGENT 2 — LOCATION (PARTICLE FILTER) ──────────────────────────────────
# Number of particles in the Sequential Importance Resampling (SIR) filter.
# More particles → more accurate position estimates but higher CPU cost.
# 200 particles runs comfortably on a Raspberry Pi 4 with headroom to spare.
NUM_PARTICLES = 200

# Standard deviation of the random-walk motion model (metres).
# This represents "how far could a miner move between two consecutive readings?"
# 5 s interval × typical walking speed 0.5 m/s ≈ 2.5 m.  Use 3.0 for safety margin.
MOTION_NOISE_M = 3.0

# Standard deviation of the RSSI measurement noise (dBm).
# Real underground RSSI measurements fluctuate ±3-7 dBm due to multipath fading.
# 5.0 dBm is a conservative estimate; lower it after calibration for better accuracy.
RSSI_NOISE_DBM = 5.0


# ── G. MINE LAYOUT — ANCHOR POSITIONS ────────────────────────────────────────
# These are the FIXED, SURVEYED positions of each LoRa node anchor in metres.
# Coordinate system:
#     x = distance along the main tunnel heading (0 = gateway at pit head)
#     y = lateral distance from the main tunnel centreline
#     depth = depth below surface in metres (used for display only)
#
# HOW TO MEASURE: Use a surveyor's tape or laser rangefinder from the gateway.
# Update these values before deployment with your actual mine survey data.
# The particle filter accuracy depends directly on how accurate these are.
#
# Current values represent the SEC-A prototype layout:
#
#   [GW]──────[N1]──────[N2]──────[N4]
#                  └───[N3]
#                          └───[N5]
ANCHOR_MAP: dict = {
    "GW": {"id": "GW", "x": 0,   "y": 0,  "label": "Gateway / Pit Head",  "depth": 0},
    "N1": {"id": "N1", "x": 50,  "y": 0,  "label": "Main Tunnel 50m",     "depth": 10},
    "N2": {"id": "N2", "x": 100, "y": 0,  "label": "Main Tunnel 100m",    "depth": 20},
    "N3": {"id": "N3", "x": 75,  "y": 40, "label": "East Branch 40m",     "depth": 18},
    "N4": {"id": "N4", "x": 150, "y": 30, "label": "Deep Face East",      "depth": 35},
    "N5": {"id": "N5", "x": 90,  "y": 80, "label": "South Branch 80m",    "depth": 25},
}

# Adjacency list for the tunnel graph.
# Only connected tunnels are listed — a miner cannot teleport between
# non-adjacent anchors.  The BFS path-finder in Agent 2 uses this to
# report realistic routes (e.g. GW → N1 → N3 → N5, not GW → N5 directly).
TUNNEL_GRAPH: dict = {
    "GW": ["N1"],           # Gateway connects only to the main tunnel entrance
    "N1": ["GW", "N2", "N3"],  # Junction: main tunnel + east branch
    "N2": ["N1", "N4"],     # Main tunnel continues to deep face
    "N3": ["N1", "N5"],     # East branch continues south
    "N4": ["N2"],           # Dead-end at deep face
    "N5": ["N3"],           # Dead-end at south branch
}


# ── H. ALERT THRESHOLDS ───────────────────────────────────────────────────────
# These thresholds are aligned with the Directorate General of Mines Safety
# (DGMS) regulations — specifically Coal Mines Regulations 2017, Regulation 167
# for methane (CH4) and CO levels.
#
# DGMS mandatory action levels (CH4 in % vol → converted to PPM here):
#   0.25% (2500 PPM) — reduce workforce
#   0.5%  (5000 PPM) — stop work, increase ventilation
#   1.25% (12500 PPM) — evacuate immediately
#
# We use LOWER thresholds (300/600/1000 PPM) to give early warning before
# reaching the statutory DGMS limits.  Adjust upward only with DGMS approval.
GAS_THRESHOLDS: dict = {
    "CAUTION": 300,   # PPM — elevated but manageable; increase monitoring
    "WARNING": 600,   # PPM — check ventilation fans; prepare for evacuation
    "DANGER":  1000,  # PPM — evacuate the section immediately
}

# Temperature thresholds in °C.
# DGMS Regulation 89 prohibits work in wet-bulb temperature above 33.5°C.
# We approximate wet-bulb with dry-bulb temperature + humidity logic.
TEMP_THRESHOLDS: dict = {
    "CAUTION":  33,   # °C — advisory: increase hydration breaks
    "WARNING":  37,   # °C — reduce work intensity; deploy cooling misters
    "CRITICAL": 40,   # °C — stop all work; evacuate section
}

# Humidity threshold in % relative humidity.
# High humidity combined with high temperature creates dangerous heat-stress
# conditions even at lower temperatures than the temp thresholds above.
HUMIDITY_HIGH: int = 90   # % RH — triggers a WARNING-level alert


# ── J. SUPABASE (CLOUD SYNC) ─────────────────────────────────────────────────
# Optional cloud sync target.  If SUPABASE_URL / SUPABASE_KEY are empty the
# SupabaseSyncer starts in disabled mode and does nothing — the system runs
# fully offline.  Set them in .env once you have a Supabase project.
SUPABASE_URL           = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY           = os.getenv("SUPABASE_KEY", "")   # service_role secret key
SUPABASE_SYNC_INTERVAL = int(os.getenv("SUPABASE_SYNC_INTERVAL", "30"))  # seconds
DEVICE_ID              = os.getenv("DEVICE_ID", "SEC-A-GW1")


# ── I. ALERT COOLDOWNS ────────────────────────────────────────────────────────
# How long (in seconds) must pass before the SAME alert type fires AGAIN
# for the SAME node.  Without cooldowns, a gas reading of 1100 PPM would
# generate a new DANGER alert every 5 seconds, flooding the dashboard and
# making it unusable.
#
# Key design decisions:
#   - GAS_DANGER and TEMP_CRITICAL have SHORT cooldowns (10 s) because
#     the situation can escalate rapidly and operators need fresh reminders.
#   - NODE_SILENT_CRITICAL has a SHORT cooldown (30 s) for the same reason —
#     a trapped miner must be checked on frequently.
#   - HUMIDITY_HIGH has a LONG cooldown (600 s) because humidity changes slowly
#     and a 10-minute reminder interval is sufficient.
#   - SOS has a SHORT cooldown (30 s) — it should keep alarming until acknowledged.
ALERT_COOLDOWN: dict = {
    "SOS":                   30,   # s — re-alarm every 30 s until acknowledged
    "GAS_CAUTION":          120,   # s — re-alert every 2 minutes
    "GAS_WARNING":           60,   # s — re-alert every minute
    "GAS_DANGER":            10,   # s — re-alert every 10 s (imminent danger)
    "TEMP_CAUTION":         300,   # s — re-alert every 5 minutes
    "TEMP_WARNING":         120,   # s — re-alert every 2 minutes
    "TEMP_CRITICAL":         10,   # s — re-alert every 10 s (imminent danger)
    "HUMIDITY_HIGH":        600,   # s — re-alert every 10 minutes
    "NODE_SILENT_WARN":      60,   # s — re-alert every minute
    "NODE_SILENT_CRITICAL":  30,   # s — re-alert every 30 s (possible entrapment)
    "ANOMALY":               60,   # s — sensor anomalies re-alerted every minute
}
