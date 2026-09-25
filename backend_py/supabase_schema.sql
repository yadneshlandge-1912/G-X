-- CoalMine LoRa+AI Platform - Supabase / PostgreSQL Schema
-- Run this once in: Supabase Dashboard > SQL Editor > New Query > Run

-- 1. readings
CREATE TABLE IF NOT EXISTS readings (
    id            BIGSERIAL PRIMARY KEY,
    node_id       INTEGER          NOT NULL,
    section       TEXT             NOT NULL DEFAULT 'UNKNOWN',
    temperature   DOUBLE PRECISION,
    humidity      DOUBLE PRECISION,
    gas_ppm       DOUBLE PRECISION,
    rssi          INTEGER,
    snr           DOUBLE PRECISION,
    sos           INTEGER          DEFAULT 0,
    tx_count      INTEGER          DEFAULT 0,
    rx_count      INTEGER          DEFAULT 0,
    node_ts       BIGINT,
    gw_ts         BIGINT,
    created_at    BIGINT           NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_readings_node ON readings(node_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_readings_ts   ON readings(created_at DESC);

-- 2. enriched_readings
CREATE TABLE IF NOT EXISTS enriched_readings (
    id              BIGSERIAL PRIMARY KEY,
    reading_id      BIGINT           REFERENCES readings(id) ON DELETE CASCADE,
    node_id         INTEGER          NOT NULL,
    smooth_temp     DOUBLE PRECISION,
    smooth_humidity DOUBLE PRECISION,
    smooth_gas      DOUBLE PRECISION,
    signal_quality  TEXT,
    gas_label       TEXT,
    gas_severity    INTEGER          DEFAULT 0,
    temp_trend      TEXT,
    gas_trend       TEXT,
    anomalies       TEXT,
    created_at      BIGINT           NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_enriched_node ON enriched_readings(node_id, created_at DESC);

-- 3. locations
CREATE TABLE IF NOT EXISTS locations (
    id             BIGSERIAL PRIMARY KEY,
    node_id        INTEGER          NOT NULL,
    section        TEXT,
    pos_x          DOUBLE PRECISION,
    pos_y          DOUBLE PRECISION,
    dist_from_gw   DOUBLE PRECISION,
    nearest_anchor TEXT,
    anchor_dist    DOUBLE PRECISION,
    depth          DOUBLE PRECISION,
    confidence     INTEGER,
    tunnel_path    TEXT,
    created_at     BIGINT           NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_locations_node ON locations(node_id, created_at DESC);

-- 4. alerts
CREATE TABLE IF NOT EXISTS alerts (
    id           BIGSERIAL PRIMARY KEY,
    node_id      INTEGER,
    type         TEXT             NOT NULL,
    severity     INTEGER          DEFAULT 1,
    message      TEXT             NOT NULL,
    data         TEXT,
    acknowledged INTEGER          DEFAULT 0,
    created_at   BIGINT           NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alerts_acked ON alerts(acknowledged, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_node  ON alerts(node_id, created_at DESC);

-- 5. sync_log
CREATE TABLE IF NOT EXISTS sync_log (
    id         BIGSERIAL PRIMARY KEY,
    local_id   BIGINT    NOT NULL,
    node_id    INTEGER,
    pushed_at  BIGINT    NOT NULL,
    device_id  TEXT
);
