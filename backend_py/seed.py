"""
seed.py — Demo Database Seeder
================================
PURPOSE
-------
Populates the SQLite database with one hour of realistic historical data
so the dashboard History page, trend charts, and stats strip show meaningful
content the first time the system is started — without waiting for real
hardware to generate data over time.

WHY SEEDING MATTERS
-------------------
The dashboard's History page needs at least a few dozen readings per node
before its charts render anything useful.  At 5 nodes × one reading every
30 seconds, that takes ~5 minutes of live operation to accumulate.

During a mine safety demo or a hackathon presentation, you do not want to
wait 5 minutes.  Run `python seed.py` once before starting the server and
the history charts are populated immediately.

WHAT IS GENERATED
-----------------
• 60 minutes × 2 readings per minute × 5 nodes = 600 raw reading rows
• Matching enriched_readings rows with signal quality and gas labels
• Matching locations rows with estimated positions
• Two scripted events to make demos compelling:
    – Gas spike on Node 4 at minute 30  (DANGER level alert)
    – SOS event on Node 3 at minute 45  (critical alert)

HOW TO RUN
----------
From the backend_py/ directory:

    python seed.py

The script is idempotent in the sense that running it twice appends more
rows rather than failing — but the DB will contain duplicate data.
Delete data/coalmine.db before re-seeding to get a clean state.

SENSOR DRIFT MODEL
------------------
Each sensor uses random.gauss() with a small standard deviation so values
drift naturally instead of jumping randomly.  This produces the smooth
curves you would see on a real mine sensor over an hour.
"""
from __future__ import annotations

import json
import math
import random
import sys
import time
from pathlib import Path

# ── Path setup ────────────────────────────────────────────────────────────────
# Add the backend_py/ directory to sys.path so imports work when this script
# is run directly with `python seed.py` (not as part of a package).
sys.path.insert(0, str(Path(__file__).parent))

# Import after path setup
from models.db import init_db, get_conn
from config    import DB_PATH

# ── Seed parameters ───────────────────────────────────────────────────────────
NODES           = 5      # number of miner nodes in SEC-A
DURATION_MIN    = 60     # how many minutes of history to generate
READINGS_PER_MIN = 2     # readings per node per minute (every 30 s)

# Minutes at which scripted events occur
GAS_SPIKE_MIN = 30       # Node 4 gas level rises sharply at minute 30
SOS_MIN       = 45       # Node 3 SOS button pressed at minute 45

# Realistic baseline sensor values per node.
# Deeper nodes (higher IDs) are hotter, more humid, and have weaker signal —
# this matches the SEC-A mine layout where N4/N5 are furthest from the gateway.
BASELINES = {
    1: {"temp": 24.0, "humid": 68.0, "gas":  80.0, "rssi":  -72},
    2: {"temp": 26.5, "humid": 72.0, "gas": 120.0, "rssi":  -82},
    3: {"temp": 28.0, "humid": 75.0, "gas": 160.0, "rssi":  -90},
    4: {"temp": 30.0, "humid": 80.0, "gas": 200.0, "rssi":  -98},
    5: {"temp": 27.0, "humid": 77.0, "gas": 140.0, "rssi":  -95},
}

# Anchor x-coordinates for each node (index = node_id, index 0 = GW)
# These come from config.ANCHOR_MAP and are duplicated here to avoid a
# circular import in the seed script.
ANCHOR_X     = [0,  50, 100,  75, 150,  90]   # index 0=GW, 1-5=nodes
ANCHOR_Y     = [0,   0,   0,  40,  30,  80]
ANCHOR_DEPTH = [0,  10,  20,  18,  35,  25]


# ── Utility functions ─────────────────────────────────────────────────────────

def gauss(mu: float, sigma: float) -> float:
    """Return one Gaussian random sample — thin wrapper for readability."""
    return random.gauss(mu, sigma)


def clamp(v: float, lo: float, hi: float) -> float:
    """Clamp v to the range [lo, hi]."""
    return max(lo, min(hi, v))


def classify_signal(rssi: int) -> str:
    """
    Map an RSSI value to a quality label string.

    Mirrors signal_agent._classify_signal() but without importing the agent
    (the agent is a singleton that starts background tasks on import).
    """
    if rssi >= -70:  return "EXCELLENT"
    if rssi >= -85:  return "GOOD"
    if rssi >= -100: return "FAIR"
    if rssi >= -115: return "WEAK"
    return "CRITICAL"


def classify_gas(ppm: int) -> tuple[str, int]:
    """
    Map a gas PPM value to (label, severity) tuple.

    Severity 0-3 mirrors the scale used in alert_engine.py and config.py.
    """
    if ppm < 300:  return "SAFE",    0
    if ppm < 600:  return "CAUTION", 1
    if ppm < 1000: return "WARNING", 2
    return "DANGER", 3


# ── Main seed function ────────────────────────────────────────────────────────

def seed():
    """
    Generate and insert one hour of demo data for all five nodes.

    Execution flow:
        1. Initialise the DB schema (safe to call on existing DB)
        2. Get a SQLite connection
        3. For each minute × reading × node:
            a. Apply Gaussian drift to each sensor value
            b. Inject scripted events (gas spike, SOS) at the right minute
            c. Insert into readings, enriched_readings, locations tables
        4. Insert demo alerts for the scripted events
        5. Insert one sync_queue placeholder row
        6. Commit everything in one transaction
    """
    # ── Step 1: Ensure schema exists ─────────────────────────────────────────
    init_db()

    conn = get_conn()

    # Unix timestamp for one hour ago — oldest reading will be at this time
    now = int(time.time())

    # Running totals for progress output
    total_steps = DURATION_MIN * READINGS_PER_MIN * NODES
    inserted    = 0

    print(f"\nSeeding {total_steps} readings into {DB_PATH} ...")
    print(f"  Gas spike: Node 4 at t={GAS_SPIKE_MIN} min")
    print(f"  SOS event: Node 3 at t={SOS_MIN} min\n")

    # ── Step 2: Initialise running sensor state for each node ────────────────
    # We use a copy of BASELINES so drift accumulates over the loop
    # (each iteration builds on the previous iteration's values).
    states = {n: dict(b) for n, b in BASELINES.items()}

    # ── Step 3: Main generation loop ─────────────────────────────────────────
    for minute in range(DURATION_MIN):
        for step in range(READINGS_PER_MIN):
            # Calculate the Unix timestamp for this reading.
            # Readings go from DURATION_MIN minutes ago up to now.
            ts = (
                now
                - (DURATION_MIN - minute) * 60   # offset back in time
                + step * (60 // READINGS_PER_MIN)  # spread within the minute
            )

            for nid in range(1, NODES + 1):
                s = states[nid]

                # ── Apply sensor drift ────────────────────────────────────────
                # Small sigma keeps adjacent readings close — realistic smooth curves.
                # Boundaries prevent physically impossible values.
                s["temp"]  = clamp(gauss(s["temp"],  0.15), 18.0, 45.0)
                s["humid"] = clamp(gauss(s["humid"],  0.3),  40.0, 98.0)
                s["gas"]   = clamp(gauss(s["gas"],   10.0),   0.0, 1500.0)
                s["rssi"]  = clamp(gauss(s["rssi"],   2.0), -130.0, -50.0)

                # ── Gas spike: Node 4 around minute 30 ───────────────────────
                # Within 3 minutes of GAS_SPIKE_MIN, push gas toward DANGER.
                # abs(minute - GAS_SPIKE_MIN) <= 3 creates a 6-minute spike window.
                if nid == 4 and abs(minute - GAS_SPIKE_MIN) <= 3:
                    # Add a large upward drift centred on 80 PPM per reading
                    s["gas"] = clamp(s["gas"] + gauss(80, 20), 400.0, 1200.0)

                # ── SOS: Node 3 for 2 minutes around minute 45 ───────────────
                sos = 1 if (nid == 3 and abs(minute - SOS_MIN) <= 1) else 0

                # Round values to match what real firmware would produce
                temp = round(s["temp"],  1)
                hum  = round(s["humid"], 1)
                gas  = int(s["gas"])
                rssi = int(s["rssi"])
                snr  = round(gauss(6.0, 2.0), 1)   # realistic SNR noise

                # ── Insert raw reading row ─────────────────────────────────────
                # tx_count and rx_count increment with each reading as they
                # would on real hardware.
                tx_rx = minute * READINGS_PER_MIN + step
                cur   = conn.execute(
                    """INSERT INTO readings
                       (node_id, section, temperature, humidity, gas_ppm,
                        rssi, snr, sos, tx_count, rx_count,
                        node_ts, gw_ts, created_at)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (nid, "SEC-A", temp, hum, gas, rssi, snr,
                     sos, tx_rx, tx_rx, ts, ts, ts),
                )
                rid = cur.lastrowid   # PK of the newly inserted reading

                # ── Insert enriched reading row ───────────────────────────────
                # Simplified version (no actual Kalman filter — seed uses raw
                # values as the "smoothed" values since the drift is already smooth).
                sig_q        = classify_signal(rssi)
                gas_label, gas_sev = classify_gas(gas)

                conn.execute(
                    """INSERT INTO enriched_readings
                       (reading_id, node_id, smooth_temp, smooth_humidity,
                        smooth_gas, signal_quality, gas_label, gas_severity,
                        temp_trend, gas_trend, anomalies, created_at)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (rid, nid,
                     temp, hum, float(gas),       # smooth = raw in seed
                     sig_q, gas_label, gas_sev,
                     "STABLE", "STABLE",           # no real trend calc in seed
                     "[]",                         # empty anomaly list
                     ts),
                )

                # ── Insert location row ────────────────────────────────────────
                # Positions drift slightly around each node's known anchor
                # so the map shows natural variation instead of a fixed dot.
                pos_x  = round(ANCHOR_X[nid] + gauss(0, 3), 1)
                pos_y  = round(ANCHOR_Y[nid] + gauss(0, 2), 1)
                depth  = ANCHOR_DEPTH[nid]
                # Euclidean distance from gateway (0,0)
                dist   = round(math.sqrt(pos_x ** 2 + pos_y ** 2), 1)
                # Distance from anchor varies slightly (~2-8 m)
                anch_d = round(abs(gauss(5, 2)), 1)

                conn.execute(
                    """INSERT INTO locations
                       (node_id, section, pos_x, pos_y, dist_from_gw,
                        nearest_anchor, anchor_dist, depth, confidence,
                        tunnel_path, created_at)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                    (nid, "SEC-A",
                     pos_x, pos_y, dist,
                     f"N{nid}",               # nearest anchor = this node's own anchor
                     anch_d,
                     depth,
                     random.randint(55, 95),  # confidence 55-95% for realism
                     json.dumps(["GW", f"N{nid}"]),   # simple two-hop path
                     ts),
                )

                inserted += 1

    # ── Step 4: Insert scripted alert rows ────────────────────────────────────
    # These are the pre-canned alerts for the gas spike and SOS events.
    # Timestamps are approximate — they match the minute the event occurred.
    gas_spike_ts = now - (DURATION_MIN - GAS_SPIKE_MIN) * 60
    sos_ts       = now - (DURATION_MIN - SOS_MIN)       * 60

    # Gas DANGER alert (Node 4, minute 30)
    conn.execute(
        """INSERT INTO alerts
           (node_id, type, severity, message, data, acknowledged, created_at)
           VALUES (?,?,?,?,?,?,?)""",
        (4, "GAS_DANGER", 3,
         "DANGER — gas exceeds safe limit, evacuate section immediately",
         json.dumps({"ppm": 1050}),   # representative PPM at spike peak
         0,        # unacknowledged — will appear in the alert panel
         gas_spike_ts),
    )

    # SOS alert (Node 3, minute 45)
    conn.execute(
        """INSERT INTO alerts
           (node_id, type, severity, message, data, acknowledged, created_at)
           VALUES (?,?,?,?,?,?,?)""",
        (3, "SOS", 3,
         "🚨 SOS from Node 3 in section SEC-A — immediate response required",
         json.dumps({"nodeId": 3, "section": "SEC-A"}),
         0,
         sos_ts),
    )

    # ── Step 5: Sync queue placeholder ───────────────────────────────────────
    # Insert one placeholder row so /api/sync/pending shows the queue exists.
    conn.execute(
        """INSERT INTO sync_queue (table_name, record_id, payload)
           VALUES ('readings', 1, '{"seeded": true}')"""
    )

    # ── Step 6: Commit all inserts atomically ─────────────────────────────────
    # A single commit at the end is much faster than committing per row
    # because SQLite only has to flush to disk once.
    conn.commit()

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"✅  Seeded {inserted} readings across {NODES} nodes")
    print(f"     Duration : {DURATION_MIN} minutes of history")
    print(f"     Gas spike: Node 4 at t={GAS_SPIKE_MIN} min (DANGER alert inserted)")
    print(f"     SOS event: Node 3 at t={SOS_MIN} min (SOS alert inserted)")
    print(f"     Database : {DB_PATH}\n")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    seed()
