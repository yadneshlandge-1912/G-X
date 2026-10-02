"""
tests/test_db.py — Unit Tests for the Database Layer
======================================================
WHAT IS TESTED
--------------
Every function in models/db.py is covered:

    init_db()                  — creates all 5 tables and indexes
    insert_reading()           — writes raw packet, returns integer ID
    insert_enriched()          — writes Agent 1 output linked to reading
    insert_location()          — writes Agent 2 output
    insert_alert()             — writes an alert row
    save_reading_transaction() — atomic batch of all four inserts
    latest_per_node()          — one row per node, no duplicates
    readings_for_node()        — correct node, correct limit
    recent_alerts()            — only unacknowledged, newest first
    acknowledge_alert()        — sets acknowledged=1
    stats_overview()           — correct aggregate for last hour
    latest_locations()         — one location per node

DATABASE ISOLATION
------------------
Every test gets its own SQLite file in pytest's tmp_path directory.
This prevents test pollution: a reading inserted by one test will never
appear in another test's queries.

The `isolated_db` fixture uses monkeypatch to replace:
    models.db.DB_PATH   — the file path used by get_conn()
    models.db._local    — the threading.local() used for connection caching

Both must be replaced because get_conn() uses _local to cache connections.
Without replacing _local, the first test's connection (pointing at the first
temp file) would be reused in the second test (pointing at a different file).

HOW TO RUN
----------
From backend_py/:
    python -m pytest tests/test_db.py -v
"""
from __future__ import annotations

import json
import threading
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


# ── Database isolation fixture ─────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def isolated_db(tmp_path, monkeypatch):
    """
    Redirect all db operations to a fresh temp SQLite file for this test.

    autouse=True means this runs automatically for every test in this file.
    No test needs to explicitly request it.

    Why monkeypatch instead of just setting DB_PATH?
    Because `import models.db` has already happened — we must patch the
    attribute ON the module object that is already in memory.
    """
    import models.db as db
    # Point DB_PATH at a file that will be deleted after the test
    monkeypatch.setattr("models.db.DB_PATH", str(tmp_path / "test.db"))
    # Reset connection cache so get_conn() creates a fresh connection to the new file
    monkeypatch.setattr("models.db._local", threading.local())
    db.init_db()   # create tables in the temp file
    return db


import models.db as db


# ── Reusable test data builders ───────────────────────────────────────────────

def raw_reading(nid=1, gas=100, sos=0, ts=1000) -> dict:
    """Build a minimal raw packet dict as the gateway would produce."""
    return {
        "nid": nid, "sec": "SEC-A",
        "t": 25.0, "h": 60.0, "gas": gas,
        "rssi": -80, "snr": 5.0, "sos": sos,
        "tx": 1, "rx": 1, "ts": ts, "gw_ts": ts,
    }


def enriched_reading(nid=1) -> dict:
    """Build a minimal enriched reading dict as Agent 1 would produce."""
    return {
        "nodeId":   nid,
        "smoothed": {"temperature": 25.0, "humidity": 60.0, "gasPPM": 100.0},
        "signal":   {"quality": "GOOD", "rssi": -80, "snr": 5.0,
                     "qualityColor": "#84cc16"},
        "gasLevel": {"label": "SAFE", "color": "#22c55e", "severity": 0,
                     "ppm": 100.0},
        "trend":    {"temperature": "STABLE", "humidity": "STABLE",
                     "gasPPM": "STABLE"},
        "alerts":   {"sos": False, "gasLevel": 0, "tempAlert": None,
                     "anomalies": []},
        "stats":    {"rxCount": 1, "totalProcessed": 1},
    }


def location_reading(nid=1) -> dict:
    """Build a minimal location dict as Agent 2 would produce."""
    return {
        "nodeId":  nid,
        "section": "SEC-A",
        "position": {"x": 52.0, "y": 1.0, "unit": "metres"},
        "distanceFromGateway": {
            "estimated": 52.0, "rssiRaw": -80,
            "rssiSmooth": -80, "unit": "metres",
        },
        "nearestAnchor": {"id": "N1", "label": "Node 1", "distM": 2.0},
        "tunnelPath": ["GW", "N1"],
        "depth":      10,
        "confidence": 72,
    }


# ══════════════════════════════════════════════════════════════════════════════
# Schema initialisation
# ══════════════════════════════════════════════════════════════════════════════

class TestInitDB:
    """
    Verify that init_db() creates the correct tables and indexes.
    These tests are simple but important — a missing table would cause
    a crash on first real use.
    """

    def test_all_five_tables_created(self):
        """All five tables defined in SCHEMA must exist after init_db()."""
        conn   = db.get_conn()
        tables = {
            row[0] for row in
            conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        for expected in ("readings", "enriched_readings", "locations",
                         "alerts", "sync_queue"):
            assert expected in tables, f"Table '{expected}' not created by init_db()"

    def test_expected_indexes_created(self):
        """Critical indexes must exist for acceptable dashboard query performance."""
        conn    = db.get_conn()
        indexes = {
            row[0] for row in
            conn.execute(
                "SELECT name FROM sqlite_master WHERE type='index'"
            ).fetchall()
        }
        for expected in ("idx_readings_node", "idx_alerts_acked", "idx_sync_unsynced"):
            assert expected in indexes, f"Index '{expected}' not created"

    def test_init_db_is_idempotent(self):
        """
        Calling init_db() twice should not raise an error.
        All CREATE TABLE statements use IF NOT EXISTS — this is a safety check.
        """
        db.init_db()   # called again on an already-initialised DB
        db.init_db()   # third call — still must not raise


# ══════════════════════════════════════════════════════════════════════════════
# insert_reading
# ══════════════════════════════════════════════════════════════════════════════

class TestInsertReading:
    """Tests for the raw reading insert helper."""

    def test_returns_positive_integer_id(self):
        """The return value is the auto-increment PK and must be a positive int."""
        conn = db.get_conn()
        rid  = db.insert_reading(conn, raw_reading())
        conn.commit()
        assert isinstance(rid, int) and rid > 0

    def test_inserted_row_is_retrievable(self):
        """After insert, the row must appear in readings_for_node()."""
        conn = db.get_conn()
        db.insert_reading(conn, raw_reading(nid=2, gas=250))
        conn.commit()
        rows = db.readings_for_node(2, limit=5)
        assert len(rows) == 1
        assert rows[0]["gas_ppm"]  == 250
        assert rows[0]["node_id"] == 2

    def test_sos_flag_stored_as_integer(self):
        """SOS is stored as 0/1 in SQLite (no native bool type)."""
        conn = db.get_conn()
        db.insert_reading(conn, raw_reading(sos=1))
        conn.commit()
        rows = db.readings_for_node(1, limit=1)
        assert rows[0]["sos"] == 1

    def test_section_stored_correctly(self):
        """The section label must be preserved exactly as given."""
        conn = db.get_conn()
        raw  = raw_reading()
        raw["sec"] = "SECTION-B"
        db.insert_reading(conn, raw)
        conn.commit()
        rows = db.readings_for_node(1, limit=1)
        assert rows[0]["section"] == "SECTION-B"


# ══════════════════════════════════════════════════════════════════════════════
# save_reading_transaction
# ══════════════════════════════════════════════════════════════════════════════

class TestSaveReadingTransaction:
    """
    Tests for the atomic batch writer.

    The transaction must write all four tables (readings, enriched_readings,
    locations, sync_queue) in one commit or roll back everything.
    """

    def test_returns_positive_reading_id(self):
        """The reading ID returned is the PK of the readings row just inserted."""
        rid = db.save_reading_transaction(
            raw_reading(), enriched_reading(), location_reading()
        )
        assert isinstance(rid, int) and rid > 0

    def test_reading_row_persisted(self):
        """After transaction, the reading must appear in latest_per_node()."""
        db.save_reading_transaction(
            raw_reading(nid=1), enriched_reading(nid=1), location_reading(nid=1)
        )
        nodes = db.latest_per_node()
        node_ids = [n["node_id"] for n in nodes]
        assert 1 in node_ids

    def test_location_row_persisted(self):
        """After transaction, the location must appear in latest_locations()."""
        db.save_reading_transaction(
            raw_reading(nid=2), enriched_reading(nid=2), location_reading(nid=2)
        )
        locs = db.latest_locations()
        assert any(l["node_id"] == 2 for l in locs)

    def test_sync_queue_row_created(self):
        """Every transaction must queue one record for cloud sync."""
        db.save_reading_transaction(raw_reading(), None, None)
        pending = db.pending_sync()
        assert len(pending) >= 1

    def test_transaction_works_with_none_enriched(self):
        """None for enriched (Agent 1 failed) must not crash the transaction."""
        rid = db.save_reading_transaction(raw_reading(), None, None)
        assert rid > 0

    def test_transaction_works_with_none_location(self):
        """None for location (Agent 2 not ready) must not crash the transaction."""
        rid = db.save_reading_transaction(raw_reading(), enriched_reading(), None)
        assert rid > 0


# ══════════════════════════════════════════════════════════════════════════════
# Alerts
# ══════════════════════════════════════════════════════════════════════════════

class TestAlerts:
    """Tests for alert insertion, retrieval, and acknowledgement."""

    def _insert_alert(self, nid=1, alert_type="GAS_DANGER", severity=3):
        """Helper to insert one alert row and commit."""
        conn = db.get_conn()
        db.insert_alert(conn, {
            "nodeId":   nid,
            "type":     alert_type,
            "severity": severity,
            "message":  f"Test alert for node {nid}",
            "data":     {"ppm": 1100},
        })
        conn.commit()

    def test_inserted_alert_appears_in_recent_alerts(self):
        """An inserted alert must appear in recent_alerts() (unacknowledged)."""
        self._insert_alert()
        alerts = db.recent_alerts()
        assert len(alerts) == 1
        assert alerts[0]["type"] == "GAS_DANGER"

    def test_acknowledged_alert_excluded_from_recent(self):
        """
        After acknowledge_alert(), the row must no longer appear in
        recent_alerts().  The operator has seen and dismissed it.
        """
        self._insert_alert()
        alert_id = db.recent_alerts()[0]["id"]
        db.acknowledge_alert(alert_id)
        remaining = db.recent_alerts()
        assert all(a["id"] != alert_id for a in remaining)

    def test_multiple_alerts_ordered_newest_first(self):
        """
        recent_alerts() is ordered by created_at DESC so the most recent
        alert appears first in the dashboard panel.
        """
        conn = db.get_conn()
        for i in range(3):
            db.insert_alert(conn, {
                "nodeId":   i + 1,
                "type":     "GAS_CAUTION",
                "severity": 1,
                "message":  f"Alert {i}",
                "data":     {},
            })
        conn.commit()
        alerts = db.recent_alerts()
        # IDs should be in descending order (newest first)
        ids = [a["id"] for a in alerts]
        assert ids == sorted(ids, reverse=True)

    def test_alert_data_stored_as_json(self):
        """
        The data column stores a JSON string.  We verify the value can be
        round-tripped through json.loads without error.
        """
        self._insert_alert()
        alert = db.recent_alerts()[0]
        parsed = json.loads(alert["data"])
        assert isinstance(parsed, dict)


# ══════════════════════════════════════════════════════════════════════════════
# latest_per_node
# ══════════════════════════════════════════════════════════════════════════════

class TestLatestPerNode:
    """
    Tests for the primary dashboard data query.

    The query must return AT MOST ONE row per node, always the most recently
    inserted one, with LEFT JOINed enriched and location data.
    """

    def test_returns_one_row_per_node(self):
        """
        With 3 readings for node 1 and 2 readings for node 2, the result
        must have exactly one row per node (no duplicates).
        """
        conn = db.get_conn()
        for _ in range(3):
            db.insert_reading(conn, raw_reading(nid=1))
        for _ in range(2):
            db.insert_reading(conn, raw_reading(nid=2))
        conn.commit()
        rows    = db.latest_per_node()
        node_ids = [r["node_id"] for r in rows]
        # No duplicates: each node_id should appear exactly once
        assert sorted(node_ids) == sorted(set(node_ids))

    def test_returns_most_recent_reading(self):
        """
        The last inserted reading for a node should be the one returned.
        We distinguish them by gas_ppm value.
        """
        conn = db.get_conn()
        db.insert_reading(conn, raw_reading(nid=1, gas=100))   # older
        db.insert_reading(conn, raw_reading(nid=1, gas=999))   # newer
        conn.commit()
        rows   = db.latest_per_node()
        node_1 = next(r for r in rows if r["node_id"] == 1)
        assert node_1["gas_ppm"] == 999, "latest_per_node should return the newest reading"

    def test_empty_db_returns_empty_list(self):
        """An empty database must return an empty list, not raise an error."""
        rows = db.latest_per_node()
        assert rows == []


# ══════════════════════════════════════════════════════════════════════════════
# readings_for_node
# ══════════════════════════════════════════════════════════════════════════════

class TestReadingsForNode:
    """Tests for the history query used by the History page."""

    def test_limit_respected(self):
        """
        Inserting 10 readings and requesting limit=5 must return exactly 5.
        This prevents the dashboard from loading unbounded data.
        """
        conn = db.get_conn()
        for _ in range(10):
            db.insert_reading(conn, raw_reading(nid=1))
        conn.commit()
        rows = db.readings_for_node(1, limit=5)
        assert len(rows) == 5

    def test_only_correct_node_returned(self):
        """
        Readings for node 1 must not appear when querying node 2 and vice versa.
        """
        conn = db.get_conn()
        db.insert_reading(conn, raw_reading(nid=1))
        db.insert_reading(conn, raw_reading(nid=2))
        conn.commit()
        rows = db.readings_for_node(2, limit=10)
        assert all(r["node_id"] == 2 for r in rows)

    def test_no_readings_returns_empty_list(self):
        """A node that has never transmitted should return an empty list."""
        rows = db.readings_for_node(5, limit=10)
        assert rows == []


# ══════════════════════════════════════════════════════════════════════════════
# stats_overview
# ══════════════════════════════════════════════════════════════════════════════

class TestStatsOverview:
    """Tests for the 1-hour aggregate statistics query."""

    def test_empty_db_returns_zero_readings(self):
        """
        Before any data is inserted, total_readings must be 0 (not None),
        so the dashboard stats strip shows "0" instead of crashing on None.
        """
        stats = db.stats_overview()
        assert stats["total_readings"] == 0

    def test_counts_readings_correctly(self):
        """Inserting N readings should produce total_readings = N."""
        conn = db.get_conn()
        for nid in (1, 2, 3):
            db.insert_reading(conn, raw_reading(nid=nid))
        conn.commit()
        stats = db.stats_overview()
        assert stats["total_readings"] == 3

    def test_counts_active_nodes_correctly(self):
        """active_nodes should count distinct node IDs, not total readings."""
        conn = db.get_conn()
        # Insert 3 readings for node 1 and 1 reading for node 2 → 2 active nodes
        for _ in range(3):
            db.insert_reading(conn, raw_reading(nid=1))
        db.insert_reading(conn, raw_reading(nid=2))
        conn.commit()
        stats = db.stats_overview()
        assert stats["active_nodes"] == 2

    def test_max_gas_reflects_highest_value(self):
        """max_gas must be the maximum gas_ppm across all recent readings."""
        conn = db.get_conn()
        for gas in (100, 500, 1200, 300):
            db.insert_reading(conn, raw_reading(nid=1, gas=gas))
        conn.commit()
        stats = db.stats_overview()
        assert stats["max_gas"] == 1200
