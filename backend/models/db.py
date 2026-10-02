"""
models/db.py — SQLite Database Layer (Offline-First)
=====================================================
Why SQLite?
-----------
Underground mines have zero internet connectivity.  SQLite runs entirely
inside the Python process — no database server to install, no network
socket, no credentials.  A single .db file on the Raspberry Pi's SD card
IS the database.  WAL (Write-Ahead Logging) mode allows simultaneous
reads from the dashboard API and writes from the agents without blocking.

Why thread-local connections?
------------------------------
FastAPI's default executor runs request handlers in worker threads.
SQLite connections are NOT safe to share between threads.  Using
threading.local() gives each thread its own connection object that is
created once and reused for the lifetime of that thread.

Table overview:
    readings          — every raw sensor packet received from the gateway
    enriched_readings — Agent 1's smoothed + classified version of each reading
    locations         — Agent 2's position estimate per reading
    alerts            — every alert that fired (acknowledged or not)
    sync_queue        — records waiting to be uploaded when internet arrives

The sync_queue implements the "offline-first" contract:
    data is always written locally first, then opportunistically synced.
"""

import sqlite3       # built-in — no pip install needed
import json          # for serialising lists/dicts into TEXT columns
import threading     # for thread-local connection storage
from pathlib import Path

from config import DB_PATH   # single source of truth for the file path

# ── Thread-local storage ──────────────────────────────────────────────────────
# _local is a threading.local() instance.  Each OS thread that calls
# get_conn() gets its own private `conn` attribute on this object.
_local = threading.local()


def get_conn() -> sqlite3.Connection:
    """
    Return the SQLite connection for the CURRENT thread.

    Creates a new connection on first call from a given thread, then
    re-uses it on every subsequent call from the same thread.  This
    avoids the overhead of opening/closing a connection on each request.

    WAL journal mode is set once per connection because it persists for
    the lifetime of the file and only needs to be activated, not repeated.
    """
    if not hasattr(_local, "conn") or _local.conn is None:
        conn = sqlite3.connect(DB_PATH, check_same_thread=False)

        # row_factory makes each row behave like a dict: row["node_id"]
        # instead of the default tuple access: row[0]
        conn.row_factory = sqlite3.Row

        # WAL mode: readers never block writers, writers never block readers.
        # Without WAL, a long-running SELECT from the API would block Agent 1's
        # INSERT, causing packet loss during a dashboard page load.
        conn.execute("PRAGMA journal_mode=WAL")

        # NORMAL sync: flush to OS on every commit but not to disk hardware.
        # This is safe (no corruption on crash) but faster than FULL.
        conn.execute("PRAGMA synchronous=NORMAL")

        # Enforce foreign key constraints (SQLite ignores them by default).
        conn.execute("PRAGMA foreign_keys=ON")

        _local.conn = conn
    return _local.conn


# ── Schema definition ─────────────────────────────────────────────────────────
# Written as a single string so it can be executed with executescript().
# Every statement uses IF NOT EXISTS — running init_db() twice is safe.
SCHEMA = """
-- Raw packets exactly as received from the gateway.
-- One row per LoRa transmission from any of the 5 nodes.
CREATE TABLE IF NOT EXISTS readings (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id       INTEGER NOT NULL,          -- 1-5: which miner node sent this
    section       TEXT    NOT NULL DEFAULT 'UNKNOWN',
    temperature   REAL,                      -- °C from DHT22
    humidity      REAL,                      -- % RH from DHT22
    gas_ppm       REAL,                      -- PPM from MQ-2 gas sensor
    rssi          INTEGER,                   -- dBm received signal strength
    snr           REAL,                      -- dB signal-to-noise ratio
    sos           INTEGER DEFAULT 0,         -- 1 if SOS button was pressed
    tx_count      INTEGER DEFAULT 0,         -- running TX counter from node firmware
    rx_count      INTEGER DEFAULT 0,         -- running RX/ACK counter
    node_ts       INTEGER,                   -- seconds since node boot (firmware clock)
    gw_ts         INTEGER,                   -- Unix timestamp at gateway receipt
    created_at    INTEGER NOT NULL DEFAULT (unixepoch())  -- server-side Unix timestamp
);

-- Agent 1's enriched version of each reading.
-- Linked to readings.id so we can always trace back to the raw packet.
CREATE TABLE IF NOT EXISTS enriched_readings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    reading_id      INTEGER REFERENCES readings(id),  -- FK to raw reading
    node_id         INTEGER NOT NULL,
    smooth_temp     REAL,            -- Kalman-filtered temperature
    smooth_humidity REAL,            -- Kalman-filtered humidity
    smooth_gas      REAL,            -- Kalman-filtered gas PPM
    signal_quality  TEXT,            -- EXCELLENT / GOOD / FAIR / WEAK / CRITICAL
    gas_label       TEXT,            -- SAFE / CAUTION / WARNING / DANGER
    gas_severity    INTEGER DEFAULT 0, -- 0-3 numeric severity for easy filtering
    temp_trend      TEXT,            -- RISING / STABLE / FALLING
    gas_trend       TEXT,            -- RISING / STABLE / FALLING
    anomalies       TEXT,            -- JSON array of anomaly dicts (may be empty [])
    created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Agent 2's position estimate for each reading.
-- One row per node per reading cycle (not per raw reading — location
-- processing has its own cadence based on RSSI accumulation).
CREATE TABLE IF NOT EXISTS locations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id         INTEGER NOT NULL,
    section         TEXT,
    pos_x           REAL,            -- estimated x position in metres from gateway
    pos_y           REAL,            -- estimated y position in metres (lateral)
    dist_from_gw    REAL,            -- Euclidean distance from gateway in metres
    nearest_anchor  TEXT,            -- ID of the closest known anchor (e.g. "N3")
    anchor_dist     REAL,            -- distance in metres to that anchor
    depth           REAL,            -- depth below surface (from ANCHOR_MAP)
    confidence      INTEGER,         -- 0-100% confidence from particle filter
    tunnel_path     TEXT,            -- JSON array: shortest BFS path (e.g. ["GW","N1","N3"])
    created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Every alert that was fired by the alert engine.
-- acknowledged=0 means it still shows in the dashboard alert panel.
-- acknowledged=1 means an operator dismissed it.
CREATE TABLE IF NOT EXISTS alerts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id      INTEGER,            -- which node triggered the alert (NULL for system alerts)
    type         TEXT    NOT NULL,   -- SOS / GAS_DANGER / TEMP_CRITICAL / NODE_SILENT_CRITICAL …
    severity     INTEGER DEFAULT 1, -- 1=info  2=warning  3=critical
    message      TEXT    NOT NULL,   -- human-readable message shown in dashboard
    data         TEXT,               -- JSON blob with context (e.g. {"ppm": 1200})
    acknowledged INTEGER DEFAULT 0,  -- 0=active  1=dismissed by operator
    created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Offline sync queue — every important record is queued here for later
-- upload to a cloud API when internet connectivity becomes available.
-- The server never blocks on sync; it just writes locally and moves on.
CREATE TABLE IF NOT EXISTS sync_queue (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name  TEXT    NOT NULL,   -- which table the record came from
    record_id   INTEGER NOT NULL,   -- PK of the record in that table
    payload     TEXT    NOT NULL,   -- JSON snapshot of the full record
    synced      INTEGER DEFAULT 0,  -- 0=pending  1=uploaded successfully
    attempts    INTEGER DEFAULT 0,  -- how many upload attempts have been made
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    synced_at   INTEGER             -- Unix timestamp when upload succeeded
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
-- These dramatically speed up the most common query patterns:

-- Dashboard "latest per node" query scans readings ordered by created_at DESC
CREATE INDEX IF NOT EXISTS idx_readings_node  ON readings(node_id, created_at DESC);

-- Alert panel polls for unacknowledged alerts frequently
CREATE INDEX IF NOT EXISTS idx_readings_ts    ON readings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_locations_node ON locations(node_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_acked   ON alerts(acknowledged, created_at DESC);

-- Sync worker scans for unsynced records on each connection attempt
CREATE INDEX IF NOT EXISTS idx_sync_unsynced  ON sync_queue(synced, created_at);
"""


def init_db():
    """
    Create all tables and indexes if they don't already exist.

    Called ONCE at server startup (inside the FastAPI lifespan context).
    Safe to call multiple times — all statements use IF NOT EXISTS.
    """
    conn = get_conn()
    conn.executescript(SCHEMA)   # executescript wraps everything in a transaction
    conn.commit()
    print(f"[DB] SQLite initialised → {DB_PATH}")


# ── INSERT helpers ────────────────────────────────────────────────────────────
# Each helper takes an open connection so the caller controls transactions.
# This allows save_reading_transaction() to batch multiple inserts into one
# atomic commit — if any insert fails, the whole batch is rolled back.

def insert_reading(conn: sqlite3.Connection, raw: dict) -> int:
    """
    Insert one raw sensor packet into the readings table.

    Parameters
    ----------
    conn : active SQLite connection (from get_conn())
    raw  : the parsed JSON dict from the gateway, keyed with firmware field
           names (nid, t, h, gas, rssi, snr, sos, tx, rx, ts, gw_ts, sec)

    Returns
    -------
    int — the auto-generated primary key (reading_id) of the new row.
          Callers pass this to insert_enriched() to link the two rows.
    """
    cur = conn.execute(
        """INSERT INTO readings
           (node_id, section, temperature, humidity, gas_ppm, rssi, snr,
            sos, tx_count, rx_count, node_ts, gw_ts)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            raw["nid"],                       # node 1-5
            raw.get("sec", "UNKNOWN"),        # mine section label
            raw.get("t"),                     # raw temperature (before Kalman)
            raw.get("h"),                     # raw humidity
            raw.get("gas"),                   # raw gas PPM
            raw.get("rssi"),                  # received signal strength
            raw.get("snr"),                   # signal-to-noise ratio
            1 if raw.get("sos") else 0,       # normalise truthy values to 0/1
            raw.get("tx", 0),                 # firmware TX counter
            raw.get("rx", 0),                 # firmware RX/ACK counter
            raw.get("ts", 0),                 # seconds since node boot
            raw.get("gw_ts", 0),              # Unix time at gateway
        ),
    )
    return cur.lastrowid   # SQLite auto-increment ID of the new row


def insert_enriched(conn: sqlite3.Connection, reading_id: int, e: dict):
    """
    Insert Agent 1's enriched output linked to a raw reading row.

    Parameters
    ----------
    conn       : active SQLite connection
    reading_id : FK to readings.id (returned by insert_reading)
    e          : the full enriched reading dict produced by signal_agent
    """
    conn.execute(
        """INSERT INTO enriched_readings
           (reading_id, node_id, smooth_temp, smooth_humidity, smooth_gas,
            signal_quality, gas_label, gas_severity, temp_trend, gas_trend, anomalies)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        (
            reading_id,
            e["nodeId"],
            e["smoothed"]["temperature"],     # Kalman-smoothed value
            e["smoothed"]["humidity"],
            e["smoothed"]["gasPPM"],
            e["signal"]["quality"],           # EXCELLENT/GOOD/FAIR/WEAK/CRITICAL
            e["gasLevel"]["label"],           # SAFE/CAUTION/WARNING/DANGER
            e["gasLevel"]["severity"],        # 0-3 for easy SQL comparison
            e["trend"]["temperature"],        # RISING/STABLE/FALLING
            e["trend"]["gasPPM"],
            json.dumps(e["alerts"].get("anomalies", [])),  # serialise list → TEXT
        ),
    )


def insert_location(conn: sqlite3.Connection, loc: dict):
    """
    Insert Agent 2's location estimate for one node.

    Parameters
    ----------
    conn : active SQLite connection
    loc  : the location dict produced by location_agent.process_reading()
    """
    conn.execute(
        """INSERT INTO locations
           (node_id, section, pos_x, pos_y, dist_from_gw,
            nearest_anchor, anchor_dist, depth, confidence, tunnel_path)
           VALUES (?,?,?,?,?,?,?,?,?,?)""",
        (
            loc["nodeId"],
            loc.get("section", "UNKNOWN"),
            loc["position"]["x"],                      # metres east of gateway
            loc["position"]["y"],                      # metres north of gateway
            loc["distanceFromGateway"]["estimated"],   # Euclidean distance in m
            loc["nearestAnchor"]["id"],                # e.g. "N3"
            loc["nearestAnchor"]["distM"],             # metres to that anchor
            loc.get("depth", 0),                       # depth below surface
            loc.get("confidence", 0),                  # 0-100 PF confidence
            json.dumps(loc.get("tunnelPath", [])),     # e.g. ["GW","N1","N3"]
        ),
    )


def insert_alert(conn: sqlite3.Connection, alert: dict):
    """
    Persist one fired alert.

    Called by alert_engine.py after cooldown check passes — i.e. only
    when the alert is actually shown to the operator.

    Parameters
    ----------
    conn  : active SQLite connection
    alert : dict with keys nodeId, type, severity, message, data
    """
    conn.execute(
        "INSERT INTO alerts (node_id, type, severity, message, data) VALUES (?,?,?,?,?)",
        (
            alert.get("nodeId"),
            alert["type"],
            alert["severity"],
            alert["message"],
            json.dumps(alert.get("data", {})),   # store context as JSON text
        ),
    )


def insert_sync_queue(conn: sqlite3.Connection, table: str, record_id: int, payload: dict):
    """
    Queue a record for eventual cloud upload.

    Parameters
    ----------
    conn      : active SQLite connection
    table     : name of the source table (e.g. "readings")
    record_id : primary key in that table
    payload   : full dict snapshot — we store the complete data so the
                cloud API does not need to query the local DB again
    """
    conn.execute(
        "INSERT INTO sync_queue (table_name, record_id, payload) VALUES (?,?,?)",
        (table, record_id, json.dumps(payload)),
    )


# ── Atomic transaction ────────────────────────────────────────────────────────

def save_reading_transaction(raw: dict, enriched: dict | None, location: dict | None) -> int:
    """
    Write a complete reading cycle atomically.

    A "reading cycle" consists of:
        1. Raw sensor packet          → readings table
        2. Agent 1 enriched output    → enriched_readings table  (if available)
        3. Agent 2 location estimate  → locations table           (if available)
        4. Sync queue entry           → sync_queue table

    All four inserts happen inside a single database transaction.
    If ANY insert raises an exception, the entire transaction is rolled back
    and no partial data is written.  This prevents the DB from ever having
    a raw reading with no corresponding enriched row.

    Parameters
    ----------
    raw      : the gateway packet dict (firmware field names: nid, t, h …)
    enriched : Agent 1 output dict, or None if Agent 1 failed
    location : Agent 2 output dict, or None if Agent 2 failed / not yet ready

    Returns
    -------
    int — reading_id of the newly inserted raw reading row
    """
    conn = get_conn()
    try:
        reading_id = insert_reading(conn, raw)

        if enriched:   # Agent 1 may not have output on parse error
            insert_enriched(conn, reading_id, enriched)

        if location:   # Agent 2 needs ≥1 reading before it can estimate
            insert_location(conn, location)

        # Always queue for sync — even if enriched/location are missing,
        # the raw reading is valuable for the cloud audit trail.
        insert_sync_queue(conn, "readings", reading_id, {
            "readingId": reading_id,
            "raw":       raw,
            "enriched":  enriched,
            "location":  location,
        })

        conn.commit()   # all-or-nothing: flush everything above to disk
        return reading_id

    except Exception as exc:
        conn.rollback()   # undo every insert above if anything failed
        raise exc         # re-raise so the caller can log the failure


# ── READ helpers ──────────────────────────────────────────────────────────────

def latest_per_node() -> list[dict]:
    """
    Return the most recent reading for EACH node, enriched with location data.

    This is the primary query for the dashboard "live" view — it runs on
    every WebSocket snapshot and every GET /api/nodes request.

    The LEFT JOINs mean nodes with no enriched or location data still appear
    in the result (with NULL fields) — useful to show "offline" nodes.

    Returns list of dicts, one entry per node that has ever sent a packet.
    """
    conn = get_conn()
    rows = conn.execute(
        """SELECT r.*, e.smooth_temp, e.smooth_humidity, e.smooth_gas,
                  e.signal_quality, e.gas_label, e.gas_severity, e.anomalies,
                  l.pos_x, l.pos_y, l.dist_from_gw,
                  l.nearest_anchor, l.confidence, l.depth
           FROM readings r
           LEFT JOIN enriched_readings e ON e.reading_id = r.id
           LEFT JOIN locations l ON l.node_id = r.node_id
             AND l.created_at = (
               -- Subquery: find the timestamp of the most recent location
               -- for this specific node, so we join the latest location row.
               SELECT MAX(created_at) FROM locations WHERE node_id = r.node_id)
           WHERE r.id IN (
               -- Subquery: for each node_id, keep only the row with the
               -- highest id (= most recently inserted reading).
               SELECT MAX(id) FROM readings GROUP BY node_id)
           ORDER BY r.node_id"""
    ).fetchall()
    # Convert Row objects to plain dicts so FastAPI can serialise them as JSON
    return [dict(r) for r in rows]


def readings_for_node(node_id: int, limit: int = 100) -> list[dict]:
    """
    Return the N most recent raw readings for one specific node.

    Used by the History page and the /api/nodes/{id}/history endpoint.
    `limit` is capped at 500 in the API route to prevent very large responses.

    Parameters
    ----------
    node_id : 1-5
    limit   : maximum number of rows to return (newest first)
    """
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM readings WHERE node_id=? ORDER BY created_at DESC LIMIT ?",
        (node_id, limit),
    ).fetchall()
    return [dict(r) for r in rows]


def recent_alerts(limit: int = 50) -> list[dict]:
    """
    Return the most recent UNACKNOWLEDGED alerts.

    The dashboard alert panel polls this.  Acknowledged alerts are excluded
    because they have been seen and dismissed by an operator — including them
    would clutter the panel with stale information.

    Parameters
    ----------
    limit : maximum rows to return; default 50 is plenty for one screen
    """
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM alerts WHERE acknowledged=0 ORDER BY created_at DESC, id DESC LIMIT ?",
        (limit,),
    ).fetchall()
    return [dict(r) for r in rows]


def acknowledge_alert(alert_id: int):
    """
    Mark one alert as acknowledged (dismissed by operator).

    Sets acknowledged=1.  The alert remains in the DB for audit purposes
    but will no longer appear in recent_alerts() results.

    Parameters
    ----------
    alert_id : primary key of the alerts row to dismiss
    """
    conn = get_conn()
    conn.execute("UPDATE alerts SET acknowledged=1 WHERE id=?", (alert_id,))
    conn.commit()


def stats_overview() -> dict:
    """
    Return aggregate statistics for the past 1 hour.

    Used by the dashboard stats strip and GET /api/stats.
    The WHERE clause filters to the last 3600 seconds (1 hour) so numbers
    reflect current conditions, not all-time totals.

    Returns dict with keys:
        active_nodes   — distinct nodes heard in the last hour
        total_readings — total packets received in the last hour
        avg_temp       — average temperature across all nodes and readings
        avg_humidity   — average humidity
        max_gas        — highest single gas reading (PPM)
        total_sos      — number of SOS packets received
    """
    conn = get_conn()
    row = conn.execute(
        """SELECT
             COUNT(DISTINCT node_id) AS active_nodes,
             COUNT(*)                AS total_readings,
             AVG(temperature)        AS avg_temp,
             AVG(humidity)           AS avg_humidity,
             MAX(gas_ppm)            AS max_gas,
             SUM(sos)                AS total_sos
           FROM readings
           WHERE created_at >= unixepoch() - 3600"""   # last 3600 seconds = 1 hour
    ).fetchone()
    return dict(row) if row else {}


def latest_locations() -> list[dict]:
    """
    Return the most recent location estimate for each node.

    Used by the Mine Map page and GET /api/map.
    Uses a subquery to select only the row with the maximum id per node,
    which is always the most recently inserted location row.
    """
    conn = get_conn()
    rows = conn.execute(
        """SELECT * FROM locations
           WHERE id IN (SELECT MAX(id) FROM locations GROUP BY node_id)"""
    ).fetchall()
    return [dict(r) for r in rows]


def pending_sync(limit: int = 100) -> list[dict]:
    """
    Return sync queue entries that have not yet been uploaded.

    Filters out rows with attempts >= 5 to avoid retrying permanently
    broken records that would never succeed (e.g. malformed JSON).

    Parameters
    ----------
    limit : cap the result set to avoid huge responses
    """
    conn = get_conn()
    rows = conn.execute(
        # attempts < 5: give up after 5 failed upload attempts
        "SELECT * FROM sync_queue WHERE synced=0 AND attempts<5 ORDER BY created_at LIMIT ?",
        (limit,),
    ).fetchall()
    return [dict(r) for r in rows]
