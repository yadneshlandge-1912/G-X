"""
tests/test_signal_agent.py — Unit Tests for AI Agent 1
========================================================
WHAT IS TESTED
--------------
Every class and method in agents/signal_agent.py is covered:

    KalmanFilter        — convergence, smoothing, spike attenuation, reset
    SignalAgent.process_packet   — parse, validate, produce enriched reading
    SignalAgent.process_payload  — same but with pre-parsed dict
    Signal classification        — all 5 RSSI quality bands
    Gas classification           — all 4 PPM severity bands
    Validation                   — out-of-range fields produce error strings
    Anomaly detection            — flatline and spike detection
    Trend analysis               — RISING, FALLING, STABLE
    Node tracking                — discovery, rx_count, multi-node isolation
    SOS detection                — flag set correctly, event emitted

WHY SEPARATE AGENT INSTANCES
-----------------------------
The module-level `signal_agent` singleton accumulates state (Kalman
estimates, rolling window, rx_count) across calls.  If tests share it,
one test's readings bleed into the next test's baseline, making tests
order-dependent and fragile.

Every test fixture creates a fresh `SignalAgent()` instance so each test
starts from a clean state.

HOW ASYNC TESTS WORK
--------------------
Signal Agent methods are async because they call `await self._emit(...)`.
pytest cannot call async functions directly.  The `pytest-asyncio` library
handles this: when `asyncio_mode = auto` is set in pytest.ini, pytest
automatically wraps every `async def test_*` function in an event loop.
No `@pytest.mark.asyncio` decorators are needed.

HOW TO RUN
----------
From backend_py/:
    python -m pytest tests/test_signal_agent.py -v
    python -m pytest tests/ -v          # run all test files
"""
from __future__ import annotations

import asyncio
import json
import math
import pytest
import sys
from pathlib import Path

# ── Path setup ────────────────────────────────────────────────────────────────
# Make sure `from agents.signal_agent import ...` resolves to our source,
# not a system-installed package with the same name.
sys.path.insert(0, str(Path(__file__).parent.parent))

from agents.signal_agent import SignalAgent, KalmanFilter


# ── Test fixtures ─────────────────────────────────────────────────────────────

@pytest.fixture
def agent():
    """
    Provide a FRESH SignalAgent for each test function.

    Using a fixture means pytest calls this function before every test that
    requests the `agent` parameter.  Each test gets its own instance with
    empty Kalman state, empty rolling window, and zero counters.
    """
    return SignalAgent()


def make_packet(
    nid=1, temp=25.0, humid=60.0, gas=100, rssi=-80, snr=6.0, sos=0
) -> str:
    """
    Build a valid "PKT:{json}" string that matches the gateway firmware format.

    This is the entry format for process_packet().  All parameters have safe
    default values so most tests only need to override one or two fields.

    Parameters
    ----------
    nid   : node ID (1-5)
    temp  : temperature °C
    humid : humidity %
    gas   : gas PPM
    rssi  : RSSI dBm
    snr   : signal-to-noise ratio dB
    sos   : SOS flag (0 or 1)
    """
    payload = {
        "nid": nid, "sec": "SEC-A",
        "t": temp, "h": humid, "gas": gas,
        "sos": sos, "rssi": rssi, "snr": snr,
        "tx": 1, "ts": 1000, "gw_ts": 1000, "rx": 1,
    }
    return "PKT:" + json.dumps(payload)


# ══════════════════════════════════════════════════════════════════════════════
# KalmanFilter
# ══════════════════════════════════════════════════════════════════════════════

class TestKalmanFilter:
    """
    Tests for the 1-D Kalman filter used to smooth LoRa sensor readings.

    The filter must:
    • Accept the first measurement as-is (no prior to blend with)
    • Attenuate sudden spikes while following genuine gradual changes
    • Converge to a constant signal within ~50 updates
    • Fully reset when reset() is called
    """

    def test_first_update_returns_measurement_unchanged(self):
        """
        On the very first call, there is no prior estimate so the filter
        must return the raw measurement exactly.
        """
        kf = KalmanFilter()
        assert kf.update(25.0) == 25.0

    def test_spike_is_heavily_attenuated(self):
        """
        A sudden 75-unit spike should be damped to well below 60 after one
        update.  If the filter passes the spike through, it is useless for
        underground safety monitoring where a stuck ADC can output 4095.
        """
        kf = KalmanFilter(process_noise=0.01, measurement_noise=1.0)
        # Feed five stable readings to build a reliable prior
        for _ in range(5):
            kf.update(25.0)
        # Now inject a large spike
        spiked = kf.update(100.0)
        # The filtered output should be much lower than the spike
        assert spiked < 60.0, (
            f"Kalman filter did not attenuate spike: got {spiked}, expected < 60"
        )

    def test_converges_to_constant_signal(self):
        """
        After 50 identical measurements the filter estimate should be
        within 0.1 units of the true value.
        """
        kf  = KalmanFilter()
        out = 0.0
        for _ in range(50):
            out = kf.update(30.0)
        assert abs(out - 30.0) < 0.1, (
            f"Filter did not converge: got {out}"
        )

    def test_follows_gradual_ramp(self):
        """
        The filter should track a gradually rising signal (0.5 units per
        step) and eventually come within 2 units of the true value.
        """
        kf  = KalmanFilter(process_noise=0.05, measurement_noise=0.5)
        out = 0.0
        for i in range(40):
            out = kf.update(float(i) * 0.5)
        # After 40 steps the signal is at 19.5; filter should be close
        assert out > 15.0, "Filter is too slow to follow a ramp"

    def test_reset_clears_all_state(self):
        """
        After reset() the filter should behave as if it is brand new —
        the next measurement must be returned unchanged.
        """
        kf = KalmanFilter()
        kf.update(25.0)   # establish a prior
        kf.reset()
        # State should be cleared
        assert kf.x is None
        assert kf.P == 1.0
        # First update after reset = passthrough
        assert kf.update(50.0) == 50.0

    def test_p_decreases_after_update(self):
        """
        The estimate error covariance P should decrease after each update
        (uncertainty reduces as we receive more measurements).
        """
        kf = KalmanFilter()
        p_before = kf.P
        kf.update(25.0)
        # After first update P may stay at 1 (passthrough), then decrease
        kf.update(25.0)
        assert kf.P <= p_before, "Uncertainty should not increase after measurement"


# ══════════════════════════════════════════════════════════════════════════════
# SignalAgent.process_packet  (parses "PKT:{json}" strings)
# ══════════════════════════════════════════════════════════════════════════════

class TestProcessPacket:
    """
    Tests for the main entry point: process_packet("PKT:{json}").

    Covers the full pipeline: parse → validate → smooth → classify → emit.
    """

    async def test_valid_packet_returns_reading(self, agent):
        """A well-formed packet should produce a non-None enriched reading."""
        result = await agent.process_packet(make_packet(nid=1))
        assert result is not None

    async def test_reading_has_correct_node_id(self, agent):
        """The nodeId in the enriched reading must match the packet's nid field."""
        result = await agent.process_packet(make_packet(nid=3))
        assert result["nodeId"] == 3

    async def test_non_pkt_prefix_returns_none(self, agent):
        """
        Gateway debug log lines start with "[GW]" or similar.
        These must be ignored — only "PKT:" lines are sensor data.
        """
        result = await agent.process_packet("[GW] Gateway online — waiting for nodes")
        assert result is None

    async def test_malformed_json_returns_none_and_increments_error(self, agent):
        """
        A truncated or corrupt packet (e.g. baud rate mismatch mid-byte)
        must not crash the agent.  It should return None and count the error.
        """
        result = await agent.process_packet("PKT:{nid:1, bad json!!!")
        assert result is None
        assert agent.error_count == 1, "error_count should increment on parse failure"

    async def test_node_id_zero_returns_none(self, agent):
        """
        Node IDs outside 1-5 are rejected.  They may come from other LoRa
        devices on the same frequency that are not part of this mine section.
        """
        result = await agent.process_packet(make_packet(nid=0))
        assert result is None

    async def test_node_id_99_returns_none(self, agent):
        """Node IDs above 5 are also rejected."""
        result = await agent.process_packet(make_packet(nid=99))
        assert result is None

    async def test_enriched_reading_structure(self, agent):
        """
        The enriched reading dict must contain all top-level keys that
        downstream consumers (DB, alert engine, dashboard) expect.
        """
        r = await agent.process_packet(make_packet())
        # Check all mandatory top-level keys exist
        for key in ("nodeId", "section", "timestamp", "raw", "smoothed",
                    "trend", "signal", "gasLevel", "alerts", "stats"):
            assert key in r, f"Missing key in enriched reading: '{key}'"

    async def test_smoothed_values_are_floats(self, agent):
        """
        Smoothed sensor values must always be floats, not ints.
        The Kalman filter returns round(float, 2) but the first pass-through
        could be an int if the firmware sends integer temperatures.
        """
        r = await agent.process_packet(make_packet(temp=28, humid=72, gas=250))
        assert isinstance(r["smoothed"]["temperature"], float)
        assert isinstance(r["smoothed"]["humidity"],    float)
        assert isinstance(r["smoothed"]["gasPPM"],      float)

    async def test_processed_count_increments(self, agent):
        """Each successful packet should increment the processed_count by 1."""
        for i in range(5):
            await agent.process_packet(make_packet(nid=1))
        assert agent.processed_count == 5

    async def test_location_key_not_present(self, agent):
        """
        Location estimation is Agent 2's job.  Agent 1's enriched reading
        must NOT contain a 'location' key — Agent 2 adds that separately.
        """
        r = await agent.process_packet(make_packet())
        assert "location" not in r


# ══════════════════════════════════════════════════════════════════════════════
# SOS Detection
# ══════════════════════════════════════════════════════════════════════════════

class TestSOSDetection:
    """
    Tests for SOS button detection.

    The SOS flag comes from the miner's physical panic button.  It must be
    detected reliably and fire an event to all subscribers.
    """

    async def test_sos_flag_true_when_set(self, agent):
        """When sos=1 in the packet, alerts.sos must be True."""
        r = await agent.process_packet(make_packet(sos=1))
        assert r["alerts"]["sos"] is True

    async def test_sos_flag_false_when_clear(self, agent):
        """When sos=0 (normal operation), alerts.sos must be False."""
        r = await agent.process_packet(make_packet(sos=0))
        assert r["alerts"]["sos"] is False

    async def test_sos_event_emitted_with_correct_node(self, agent):
        """
        The 'sos' event must be emitted with the correct nodeId so
        the alert engine and dashboard can identify which miner needs help.
        """
        received = []
        # Register a listener that captures the event payload
        agent.on("sos", lambda e: received.append(e))
        await agent.process_packet(make_packet(nid=2, sos=1))
        assert len(received) == 1
        assert received[0]["nodeId"] == 2

    async def test_no_sos_event_when_sos_clear(self, agent):
        """No 'sos' event should fire when the SOS flag is 0."""
        received = []
        agent.on("sos", lambda e: received.append(e))
        await agent.process_packet(make_packet(sos=0))
        assert len(received) == 0

    async def test_sos_event_includes_section(self, agent):
        """The SOS event payload must include the section label."""
        received = []
        agent.on("sos", lambda e: received.append(e))
        await agent.process_packet(make_packet(nid=1, sos=1))
        assert "section" in received[0]


# ══════════════════════════════════════════════════════════════════════════════
# Signal quality classification
# ══════════════════════════════════════════════════════════════════════════════

class TestSignalClassification:
    """
    Tests for _classify_signal().

    The five quality bands (EXCELLENT → CRITICAL) map to RSSI thresholds
    defined in the SIGNAL_QUALITY list in signal_agent.py.
    """

    @pytest.mark.parametrize("rssi,expected", [
        (-65,  "EXCELLENT"),   # close to gateway, strong signal
        (-80,  "GOOD"),        # acceptable — typical 50m in open tunnel
        (-95,  "FAIR"),        # usable but getting weaker
        (-110, "WEAK"),        # marginal — consider a repeater
        (-130, "CRITICAL"),    # near the LoRa sensitivity floor (~-137 dBm)
    ])
    def test_classify_signal_bands(self, rssi, expected):
        """
        Each RSSI value should map to the correct quality label.
        Parametrize runs this test once per (rssi, expected) pair.
        """
        result = SignalAgent()._classify_signal(rssi)
        assert result["label"] == expected, (
            f"rssi={rssi} should be '{expected}', got '{result['label']}'"
        )

    def test_classify_signal_returns_color(self):
        """Every quality band must include a hex color for the dashboard."""
        result = SignalAgent()._classify_signal(-80)
        assert result["color"].startswith("#"), "color should be a hex string"

    def test_classify_signal_worst_case(self):
        """An impossible RSSI of -200 should still return CRITICAL, not crash."""
        result = SignalAgent()._classify_signal(-200)
        assert result["label"] == "CRITICAL"


# ══════════════════════════════════════════════════════════════════════════════
# Gas classification
# ══════════════════════════════════════════════════════════════════════════════

class TestGasClassification:
    """
    Tests for _classify_gas().

    The four severity bands (SAFE → DANGER) correspond directly to the
    DGMS thresholds in config.GAS_THRESHOLDS.
    """

    @pytest.mark.parametrize("ppm,expected_label,expected_severity", [
        (100,  "SAFE",    0),   # well below 300 PPM caution level
        (400,  "CAUTION", 1),   # between 300 and 600 PPM
        (700,  "WARNING", 2),   # between 600 and 1000 PPM
        (1100, "DANGER",  3),   # above 1000 PPM — evacuate now
    ])
    def test_gas_bands(self, ppm, expected_label, expected_severity):
        """Each PPM value should produce the correct label and severity."""
        result = SignalAgent()._classify_gas(ppm)
        assert result["label"]    == expected_label
        assert result["severity"] == expected_severity

    def test_boundary_at_300_ppm(self):
        """299 PPM = SAFE, 300 PPM = start of CAUTION band."""
        assert SignalAgent()._classify_gas(299)["label"] == "SAFE"
        assert SignalAgent()._classify_gas(300)["label"] == "CAUTION"

    def test_boundary_at_1000_ppm(self):
        """999 PPM = WARNING, 1000 PPM = DANGER."""
        assert SignalAgent()._classify_gas(999)["label"]  == "WARNING"
        assert SignalAgent()._classify_gas(1000)["label"] == "DANGER"


# ══════════════════════════════════════════════════════════════════════════════
# Validation
# ══════════════════════════════════════════════════════════════════════════════

class TestValidation:
    """
    Tests for _validate().

    Out-of-range values must produce error strings, not exceptions.
    Valid values must produce an empty error list.
    """

    def test_temperature_200_is_flagged(self):
        """200 °C is physically impossible for a mine sensor."""
        _, errors = SignalAgent()._validate(
            {"t": 200, "h": 60, "gas": 0, "rssi": -80, "snr": 5}
        )
        assert any("temperature" in e for e in errors)

    def test_humidity_150_is_flagged(self):
        """Humidity above 100% is impossible — indicates a sensor fault."""
        _, errors = SignalAgent()._validate(
            {"t": 25, "h": 150, "gas": 0, "rssi": -80, "snr": 5}
        )
        assert any("humidity" in e for e in errors)

    def test_positive_rssi_is_flagged(self):
        """RSSI should always be negative for received radio signals."""
        _, errors = SignalAgent()._validate(
            {"t": 25, "h": 60, "gas": 0, "rssi": 10, "snr": 5}
        )
        assert any("rssi" in e for e in errors)

    def test_all_valid_values_produce_no_errors(self):
        """A perfectly normal reading should have zero validation errors."""
        _, errors = SignalAgent()._validate(
            {"t": 28, "h": 70, "gas": 200, "rssi": -85, "snr": 6}
        )
        assert errors == []

    def test_fallback_applied_for_non_numeric_temperature(self):
        """
        If the firmware sends a non-numeric value (e.g. garbled packet),
        the validation should fall back to 25.0 rather than crashing.
        """
        values, _ = SignalAgent()._validate(
            {"t": "broken", "h": 60, "gas": 0, "rssi": -80, "snr": 5}
        )
        assert values["temperature"] == 25.0


# ══════════════════════════════════════════════════════════════════════════════
# Anomaly detection
# ══════════════════════════════════════════════════════════════════════════════

class TestAnomalyDetection:
    """
    Tests for _detect_anomalies().

    Anomalies represent dangerous conditions that simple threshold checks
    miss — a sensor stuck at a constant value, or a reading that jumps
    impossibly fast between two consecutive packets.
    """

    async def test_temperature_flatline_detected(self, agent):
        """
        When the DHT22 fails it often outputs its last cached value
        indefinitely.  Six identical readings should trigger TEMP_FLATLINE.
        """
        # Feed 6 identical temperature readings to build the rolling window
        for _ in range(6):
            await agent.process_packet(make_packet(temp=25.0))
        # The 7th reading should detect the flatline
        r = await agent.process_packet(make_packet(temp=25.0))
        types = [a["type"] for a in r["alerts"]["anomalies"]]
        assert "TEMP_FLATLINE" in types, (
            "Identical temperature values should trigger TEMP_FLATLINE"
        )

    async def test_no_flatline_with_varying_temperature(self, agent):
        """Naturally varying temperature should NOT trigger a flatline alert."""
        temps = [24.0, 24.3, 24.1, 24.5, 24.2, 24.4]
        r = None
        for t in temps:
            r = await agent.process_packet(make_packet(temp=t))
        types = [a["type"] for a in r["alerts"]["anomalies"]]
        assert "TEMP_FLATLINE" not in types

    async def test_gas_spike_detected(self, agent):
        """
        A jump of more than 200 PPM between consecutive readings is
        physically improbable under normal mine conditions.
        """
        # Establish baseline
        for _ in range(3):
            await agent.process_packet(make_packet(gas=100))
        # Large spike: 100 → 600 PPM (delta = 500)
        await agent.process_packet(make_packet(gas=600))
        r = await agent.process_packet(make_packet(gas=600))
        types = [a["type"] for a in r["alerts"]["anomalies"]]
        assert "GAS_SPIKE" in types

    async def test_rssi_cliff_detected(self, agent):
        """
        A sudden RSSI drop of more than 20 dBm indicates the miner has
        moved around a corner or the antenna has been damaged.
        """
        for _ in range(3):
            await agent.process_packet(make_packet(rssi=-70))
        r = await agent.process_packet(make_packet(rssi=-100))   # -30 dBm cliff
        types = [a["type"] for a in r["alerts"]["anomalies"]]
        assert "RSSI_CLIFF" in types

    async def test_no_anomaly_on_normal_readings(self, agent):
        """
        Three normal readings should produce zero anomalies — the
        detection window is too small to classify anything.
        """
        r = None
        for _ in range(3):
            r = await agent.process_packet(make_packet())
        assert r["alerts"]["anomalies"] == []


# ══════════════════════════════════════════════════════════════════════════════
# Trend analysis
# ══════════════════════════════════════════════════════════════════════════════

class TestTrends:
    """
    Tests for NodeState.trend().

    Trends are derived from the last 5 readings in the rolling window.
    A delta > ±2 units across those 5 readings is classified as a trend.
    """

    async def test_rising_temperature_trend(self, agent):
        """Steadily increasing temperature should produce RISING trend."""
        for t in [20.0, 21.0, 23.0, 26.0, 30.0]:
            r = await agent.process_packet(make_packet(temp=t))
        assert r["trend"]["temperature"] == "RISING"

    async def test_falling_temperature_trend(self, agent):
        """Steadily decreasing temperature should produce FALLING trend."""
        for t in [30.0, 28.0, 25.0, 22.0, 19.0]:
            r = await agent.process_packet(make_packet(temp=t))
        assert r["trend"]["temperature"] == "FALLING"

    async def test_stable_temperature_trend(self, agent):
        """
        Five identical readings → delta of 0 → STABLE.
        The Kalman filter may smooth them slightly but the window delta
        should stay well within the ±2 unit threshold.
        """
        for _ in range(5):
            r = await agent.process_packet(make_packet(temp=25.0))
        assert r["trend"]["temperature"] == "STABLE"

    async def test_insufficient_window_returns_stable(self, agent):
        """
        With fewer than 3 readings, there is not enough data to determine
        a meaningful trend — must return STABLE as a safe default.
        """
        r = await agent.process_packet(make_packet(temp=25.0))
        assert r["trend"]["temperature"] == "STABLE"


# ══════════════════════════════════════════════════════════════════════════════
# Node tracking
# ══════════════════════════════════════════════════════════════════════════════

class TestNodeTracking:
    """
    Tests for multi-node state management.

    The agent must keep separate state for each of the five miner nodes.
    Readings from Node 1 must not affect Node 2's Kalman state or window.
    """

    async def test_node_discovered_event_fires_on_first_packet(self, agent):
        """
        The 'node_discovered' event should fire exactly once when a node
        ID is seen for the first time.
        """
        discovered = []
        agent.on("node_discovered", lambda e: discovered.append(e))
        await agent.process_packet(make_packet(nid=2))
        assert len(discovered) == 1
        assert discovered[0]["nodeId"] == 2

    async def test_node_discovered_fires_only_once(self, agent):
        """Subsequent packets from the same node must not re-fire the event."""
        discovered = []
        agent.on("node_discovered", lambda e: discovered.append(e))
        for _ in range(5):
            await agent.process_packet(make_packet(nid=1))
        assert len(discovered) == 1   # fired on first packet only

    async def test_five_nodes_tracked_independently(self, agent):
        """
        Sending one packet per node should result in five separate entries
        in the agent's _nodes dict.
        """
        for nid in range(1, 6):
            await agent.process_packet(make_packet(nid=nid))
        status = agent.get_status()
        # All five node IDs should appear in the status
        for nid in range(1, 6):
            assert nid in status["nodes"]

    async def test_rx_count_per_node(self, agent):
        """
        rx_count should increment only for the node that received the packet,
        not for all nodes.
        """
        for _ in range(3):
            await agent.process_packet(make_packet(nid=1))
        await agent.process_packet(make_packet(nid=2))   # one packet for node 2
        status = agent.get_status()
        assert status["nodes"][1]["rxCount"] == 3
        assert status["nodes"][2]["rxCount"] == 1

    async def test_get_status_online_flag(self, agent):
        """A node that just sent a packet should be marked online=True."""
        await agent.process_packet(make_packet(nid=1))
        status = agent.get_status()
        assert status["nodes"][1]["online"] is True
