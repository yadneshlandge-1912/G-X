"""
tests/test_alert_engine.py — Unit Tests for the Alert Engine
=============================================================
WHAT IS TESTED
--------------
Every evaluation path in services/alert_engine.py is covered:

    evaluate()             — gas, temperature, humidity, SOS, anomaly thresholds
    evaluate_node_lost()   — 30 s and 120 s silence thresholds
    _fire()                — cooldown deduplication, DB persistence, broadcast
    alert structure        — required fields and timestamp format

MOCKING STRATEGY
----------------
1. Database (models.db)
   The alert engine calls insert_alert() and get_conn() which need a real
   SQLite file.  Each test redirects DB_PATH to a temp directory using the
   `isolated_db` fixture so no production data is touched and every test
   starts with an empty database.

2. Broadcast function (broadcast_fn)
   We pass `AsyncMock()` from unittest.mock so we can:
   • Assert it was called (alert WAS broadcast)
   • Assert it was NOT called (alert was suppressed by cooldown)
   • Inspect call arguments if needed

WHY COOLDOWN TESTS MATTER
--------------------------
The cooldown mechanism is the most subtle part of the alert engine.
Without these tests, a refactoring could accidentally remove the cooldown
and flood the operator's screen with thousands of identical alerts per hour.
Tests lock in the expected behaviour explicitly.

HOW TO RUN
----------
From backend_py/:
    python -m pytest tests/test_alert_engine.py -v
"""
from __future__ import annotations

import pytest
import sys
import time
import threading
from pathlib import Path
from unittest.mock import AsyncMock

sys.path.insert(0, str(Path(__file__).parent.parent))


# ── Database isolation fixture ─────────────────────────────────────────────────
# This must run BEFORE importing alert_engine because alert_engine imports
# models.db at module level (for insert_alert and get_conn).
# We use autouse=True so it applies to every test in this file automatically.

@pytest.fixture(autouse=True)
def isolated_db(tmp_path, monkeypatch):
    """
    Redirect all database operations to a fresh temp file for each test.

    tmp_path is a pytest built-in fixture that provides a unique temporary
    directory per test.  monkeypatch.setattr replaces the module-level
    attributes in models.db without affecting other modules.

    The threading.local() replacement ensures no cross-test connection leakage.
    """
    import models.db as db
    monkeypatch.setattr("models.db.DB_PATH", str(tmp_path / "test.db"))
    monkeypatch.setattr("models.db._local", threading.local())
    db.init_db()   # create tables in the temp file


# Import after the fixture is defined so monkeypatching takes effect
from services.alert_engine import AlertEngine


# ── Helper functions ──────────────────────────────────────────────────────────

def make_reading(
    temp=25.0, humid=60.0, gas=100.0, sos=False, nid=1, anomalies=None
) -> dict:
    """
    Build a minimal enriched reading dict for alert evaluation.

    Only the keys that alert_engine.evaluate() reads are included.
    The smoothed values are the Kalman-filtered outputs from Agent 1.
    """
    return {
        "nodeId":  nid,
        "section": "SEC-A",
        "smoothed": {
            "temperature": temp,
            "humidity":    humid,
            "gasPPM":      gas,
        },
        "alerts": {
            "sos":       sos,
            "gasLevel":  0,
            "anomalies": anomalies or [],
        },
    }


@pytest.fixture
def engine():
    """
    Provide a fresh AlertEngine with a mocked broadcast function.

    AsyncMock lets us:
        engine.broadcast.assert_awaited()   # verify broadcast was called
        engine.broadcast.assert_not_called()  # verify it was suppressed
    """
    return AlertEngine(broadcast_fn=AsyncMock())


# ══════════════════════════════════════════════════════════════════════════════
# SOS alerts
# ══════════════════════════════════════════════════════════════════════════════

class TestSOSAlerts:
    """
    SOS is the highest-priority alert.  It must always fire immediately
    and at severity 3 regardless of gas, temperature, or humidity levels.
    """

    async def test_sos_fires_severity_3(self, engine):
        """SOS must always be severity 3 (critical — immediate response)."""
        fired = await engine.evaluate(make_reading(sos=True))
        sos_alerts = [a for a in fired if a and a["type"] == "SOS"]
        assert len(sos_alerts) == 1
        assert sos_alerts[0]["severity"] == 3

    async def test_sos_triggers_broadcast(self, engine):
        """
        The broadcast function must be called when SOS fires so the
        dashboard receives the alert in real time over WebSocket.
        """
        await engine.evaluate(make_reading(sos=True))
        engine.broadcast.assert_awaited()

    async def test_sos_message_contains_node_id(self, engine):
        """The SOS message must identify which node so operators know who to help."""
        fired = await engine.evaluate(make_reading(sos=True, nid=4))
        sos_alerts = [a for a in fired if a and a["type"] == "SOS"]
        assert "4" in sos_alerts[0]["message"]   # node ID appears in the message

    async def test_no_sos_when_flag_false(self, engine):
        """Normal operation (sos=False) must not produce any SOS alert."""
        fired = await engine.evaluate(make_reading(sos=False))
        sos_alerts = [a for a in fired if a and a["type"] == "SOS"]
        assert sos_alerts == []


# ══════════════════════════════════════════════════════════════════════════════
# Gas alerts
# ══════════════════════════════════════════════════════════════════════════════

class TestGasAlerts:
    """
    Three gas thresholds: CAUTION (300 PPM), WARNING (600 PPM), DANGER (1000 PPM).
    Only the highest applicable level should fire — not all three simultaneously.
    """

    @pytest.mark.parametrize("ppm,expected_type,expected_severity", [
        (100,  None,          None),   # below CAUTION — no alert
        (350,  "GAS_CAUTION", 1),      # above 300 PPM
        (700,  "GAS_WARNING", 2),      # above 600 PPM
        (1100, "GAS_DANGER",  3),      # above 1000 PPM — evacuate
    ])
    async def test_gas_threshold_levels(self, ppm, expected_type, expected_severity):
        """
        For each PPM level, verify that the correct alert type fires
        (or no alert fires if below the lowest threshold).

        A fresh engine is created per parametrize run to avoid cooldown interference.
        """
        eng   = AlertEngine(broadcast_fn=AsyncMock())
        fired = await eng.evaluate(make_reading(gas=ppm))
        gas_alerts = [
            a for a in fired
            if a and a["type"] in ("GAS_CAUTION", "GAS_WARNING", "GAS_DANGER")
        ]
        if expected_type is None:
            assert gas_alerts == [], f"Expected no gas alert at {ppm} PPM"
        else:
            assert len(gas_alerts) == 1
            assert gas_alerts[0]["type"]     == expected_type
            assert gas_alerts[0]["severity"] == expected_severity

    async def test_only_one_gas_alert_per_evaluation(self, engine):
        """
        At 1100 PPM, only GAS_DANGER should fire — NOT GAS_DANGER + GAS_WARNING
        + GAS_CAUTION all at once.  The evaluate() method checks from most
        severe to least and fires only the first match.
        """
        fired = await engine.evaluate(make_reading(gas=1100))
        gas_alerts = [
            a for a in fired
            if a and a["type"] in ("GAS_CAUTION", "GAS_WARNING", "GAS_DANGER")
        ]
        assert len(gas_alerts) == 1
        assert gas_alerts[0]["type"] == "GAS_DANGER"

    async def test_gas_alert_includes_ppm_in_data(self, engine):
        """The data field must include the PPM value for operator context."""
        fired = await engine.evaluate(make_reading(gas=1100))
        danger = next(a for a in fired if a and a["type"] == "GAS_DANGER")
        assert "ppm" in danger["data"]


# ══════════════════════════════════════════════════════════════════════════════
# Temperature alerts
# ══════════════════════════════════════════════════════════════════════════════

class TestTemperatureAlerts:
    """
    Three temperature thresholds: CAUTION (33°C), WARNING (37°C), CRITICAL (40°C).
    """

    @pytest.mark.parametrize("temp,expected_type,expected_severity", [
        (25.0, None,            None),
        (34.0, "TEMP_CAUTION",  1),
        (38.0, "TEMP_WARNING",  2),
        (41.0, "TEMP_CRITICAL", 3),
    ])
    async def test_temperature_threshold_levels(self, temp, expected_type, expected_severity):
        """Verify each temperature band triggers the correct alert."""
        eng   = AlertEngine(broadcast_fn=AsyncMock())
        fired = await eng.evaluate(make_reading(temp=temp))
        temp_alerts = [
            a for a in fired
            if a and "TEMP" in (a.get("type") or "")
        ]
        if expected_type is None:
            assert temp_alerts == []
        else:
            assert len(temp_alerts) == 1
            assert temp_alerts[0]["type"]     == expected_type
            assert temp_alerts[0]["severity"] == expected_severity


# ══════════════════════════════════════════════════════════════════════════════
# Humidity alerts
# ══════════════════════════════════════════════════════════════════════════════

class TestHumidityAlerts:
    """
    Single humidity threshold: ≥ 90% RH triggers HUMIDITY_HIGH (severity 2).
    """

    async def test_high_humidity_fires_warning(self, engine):
        """92% RH is above the 90% threshold — must fire HUMIDITY_HIGH."""
        fired = await engine.evaluate(make_reading(humid=92.0))
        hum   = [a for a in fired if a and a["type"] == "HUMIDITY_HIGH"]
        assert len(hum) == 1
        assert hum[0]["severity"] == 2

    async def test_normal_humidity_no_alert(self, engine):
        """70% RH is well below the threshold — no alert should fire."""
        fired = await engine.evaluate(make_reading(humid=70.0))
        hum   = [a for a in fired if a and a["type"] == "HUMIDITY_HIGH"]
        assert hum == []

    async def test_exactly_at_threshold_fires(self, engine):
        """Exactly 90% RH is AT the threshold — the alert should fire."""
        eng   = AlertEngine(broadcast_fn=AsyncMock())
        fired = await eng.evaluate(make_reading(humid=90.0))
        hum   = [a for a in fired if a and a["type"] == "HUMIDITY_HIGH"]
        assert len(hum) == 1


# ══════════════════════════════════════════════════════════════════════════════
# Anomaly alerts
# ══════════════════════════════════════════════════════════════════════════════

class TestAnomalyAlerts:
    """
    Agent 1 can detect multiple anomalies in one reading.
    The engine fires one ANOMALY alert per anomaly in the list.
    """

    async def test_single_anomaly_fires_one_alert(self, engine):
        """One anomaly in the list → one ANOMALY alert."""
        anomaly = {"type": "GAS_SPIKE", "delta": 300, "current": 500}
        fired   = await engine.evaluate(make_reading(anomalies=[anomaly]))
        anom    = [a for a in fired if a and a["type"] == "ANOMALY"]
        assert len(anom) == 1

    async def test_multiple_anomalies_fire_multiple_alerts(self, engine):
        """
        Two different anomaly types should produce two separate ANOMALY alerts
        so the operator knows about both the gas spike AND the flatline.
        """
        anomalies = [
            {"type": "GAS_SPIKE",    "delta": 300},
            {"type": "TEMP_FLATLINE", "value": 25.0},
        ]
        fired = await engine.evaluate(make_reading(anomalies=anomalies))
        anom  = [a for a in fired if a and a["type"] == "ANOMALY"]
        assert len(anom) == 2

    async def test_no_anomalies_no_anomaly_alert(self, engine):
        """An empty anomalies list must produce zero ANOMALY alerts."""
        fired = await engine.evaluate(make_reading(anomalies=[]))
        anom  = [a for a in fired if a and a["type"] == "ANOMALY"]
        assert anom == []


# ══════════════════════════════════════════════════════════════════════════════
# Cooldown deduplication
# ══════════════════════════════════════════════════════════════════════════════

class TestCooldown:
    """
    The most important functional correctness tests.

    The cooldown mechanism prevents alert floods.  Without it, a sustained
    gas level of 1100 PPM would produce ~720 GAS_DANGER alerts per hour.
    """

    async def test_same_alert_not_refired_during_cooldown(self, engine):
        """
        Two consecutive calls with the same alert condition must result in
        exactly ONE alert firing (the second is blocked by cooldown).
        """
        fired1 = await engine.evaluate(make_reading(gas=1100))
        fired2 = await engine.evaluate(make_reading(gas=1100))
        danger1 = [a for a in fired1 if a and a["type"] == "GAS_DANGER"]
        danger2 = [a for a in fired2 if a and a["type"] == "GAS_DANGER"]
        assert len(danger1) == 1, "First evaluation should fire the alert"
        assert len(danger2) == 0, "Second evaluation should be blocked by cooldown"

    async def test_different_nodes_have_independent_cooldowns(self, engine):
        """
        Node 1 and Node 2 having the same alert type must each fire their
        own alert — they use different cooldown keys ("1:GAS_DANGER" vs
        "2:GAS_DANGER").
        """
        fired1 = await engine.evaluate(make_reading(gas=1100, nid=1))
        fired2 = await engine.evaluate(make_reading(gas=1100, nid=2))
        assert any(a and a["type"] == "GAS_DANGER" for a in fired1)
        assert any(a and a["type"] == "GAS_DANGER" for a in fired2)

    async def test_different_alert_types_independent_cooldowns(self, engine):
        """
        GAS_DANGER and TEMP_CRITICAL are different keys so both can fire
        in the same cycle without interfering.
        """
        fired = await engine.evaluate(make_reading(gas=1100, temp=41.0))
        types = [a["type"] for a in fired if a]
        assert "GAS_DANGER"   in types
        assert "TEMP_CRITICAL" in types

    async def test_alert_refires_after_cooldown_expires(self, engine):
        """
        After the cooldown expires (simulated by back-dating the last_fired
        timestamp), the same alert must fire again.
        """
        # First fire establishes the cooldown
        await engine.evaluate(make_reading(gas=1100, nid=1))

        # Simulate cooldown expiry by setting last_fired to 10000 s ago
        engine._last_fired["1:GAS_DANGER"] = time.time() - 10_000

        # Second fire should now succeed
        fired2 = await engine.evaluate(make_reading(gas=1100, nid=1))
        assert any(a and a["type"] == "GAS_DANGER" for a in fired2)


# ══════════════════════════════════════════════════════════════════════════════
# Node lost evaluation
# ══════════════════════════════════════════════════════════════════════════════

class TestNodeLost:
    """
    Tests for evaluate_node_lost() called by the heartbeat watchdog.

    Two severity levels:
        silence ≥ 30 s  → NODE_SILENT_WARN     (severity 2)
        silence ≥ 120 s → NODE_SILENT_CRITICAL  (severity 3)
    """

    async def test_30s_silence_fires_warn(self, engine):
        """35 seconds of silence should produce a WARNING level alert."""
        alert = await engine.evaluate_node_lost({"nodeId": 2, "silenceSec": 35})
        assert alert is not None
        assert alert["type"]     == "NODE_SILENT_WARN"
        assert alert["severity"] == 2

    async def test_120s_silence_fires_critical(self, engine):
        """130 seconds = possible entrapment → CRITICAL alert."""
        alert = await engine.evaluate_node_lost({"nodeId": 2, "silenceSec": 130})
        assert alert is not None
        assert alert["type"]     == "NODE_SILENT_CRITICAL"
        assert alert["severity"] == 3

    async def test_under_30s_silence_no_alert(self, engine):
        """10 seconds of silence is within normal packet loss tolerance."""
        alert = await engine.evaluate_node_lost({"nodeId": 2, "silenceSec": 10})
        assert alert is None

    async def test_exactly_120s_fires_critical(self, engine):
        """Exactly 120 s meets the CRITICAL threshold."""
        eng   = AlertEngine(broadcast_fn=AsyncMock())
        alert = await eng.evaluate_node_lost({"nodeId": 1, "silenceSec": 120})
        assert alert["type"] == "NODE_SILENT_CRITICAL"

    async def test_node_id_in_message(self, engine):
        """The message must identify the node so the safety officer knows where to look."""
        alert = await engine.evaluate_node_lost({"nodeId": 3, "silenceSec": 35})
        assert "3" in alert["message"]


# ══════════════════════════════════════════════════════════════════════════════
# Alert structure
# ══════════════════════════════════════════════════════════════════════════════

class TestAlertStructure:
    """
    Structural tests that verify every fired alert has the fields that
    downstream consumers (DB, WebSocket, dashboard) require.
    """

    async def test_alert_has_all_required_fields(self, engine):
        """
        Every alert dict must have these five fields.
        Missing any of them would cause a KeyError in server.py or the dashboard.
        """
        fired = await engine.evaluate(make_reading(sos=True))
        alert = next(a for a in fired if a)
        for field in ("nodeId", "type", "severity", "message", "timestamp"):
            assert field in alert, f"Alert is missing required field: '{field}'"

    async def test_timestamp_is_in_milliseconds(self, engine):
        """
        The timestamp must be in milliseconds (13-digit Unix time) because
        the React dashboard uses JavaScript Date() which expects milliseconds.
        """
        fired = await engine.evaluate(make_reading(sos=True))
        alert = next(a for a in fired if a)
        # 13-digit Unix millisecond timestamps are > 1_000_000_000_000
        assert alert["timestamp"] > 1_000_000_000_000, (
            f"Timestamp {alert['timestamp']} looks like seconds, not milliseconds"
        )

    async def test_severity_is_integer_1_2_or_3(self, engine):
        """Severity must be a plain integer in {1, 2, 3}."""
        fired = await engine.evaluate(make_reading(sos=True))
        alert = next(a for a in fired if a)
        assert alert["severity"] in (1, 2, 3)
        assert isinstance(alert["severity"], int)
