"""
tests/test_location_agent.py — Unit Tests for AI Agent 2
==========================================================
WHAT IS TESTED
--------------
Every method in agents/location_agent.py is covered:

    rssi_to_distance     — path-loss model inversion, clamping
    _direct_estimate     — geometry of the straight-line estimate
    _nearest_anchor      — Euclidean nearest-neighbour search
    _bfs_path            — BFS shortest path in the tunnel graph
    _median              — median filter for RSSI smoothing
    _particle_filter_update — particle count, bounds, confidence range
    _resample            — particle count preserved after resampling
    process_reading      — full integration: input → location dict

WHY FRESH INSTANCES
-------------------
Like test_signal_agent.py, each test fixture creates a new LocationAgent()
because the agent accumulates RSSI history and tracker state that would
make tests order-dependent if shared.

HOW TO RUN
----------
From backend_py/:
    python -m pytest tests/test_location_agent.py -v
"""
from __future__ import annotations

import math
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agents.location_agent import LocationAgent, MinerTracker, Particle


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def agent():
    """Fresh LocationAgent for each test."""
    return LocationAgent()


def make_reading(nid=1, rssi=-80, section="SEC-A") -> dict:
    """
    Build a minimal enriched reading dict as Agent 1 would produce.

    Only the fields that Agent 2 actually reads are included.
    """
    return {
        "nodeId":  nid,
        "section": section,
        "signal":  {
            "rssi":        rssi,
            "snr":         6.0,
            "quality":     "GOOD",
            "qualityColor": "#84cc16",
        },
        "smoothed": {"temperature": 25.0, "humidity": 60.0, "gasPPM": 100.0},
        "alerts":   {"sos": False, "gasLevel": 0, "tempAlert": None, "anomalies": []},
    }


# ══════════════════════════════════════════════════════════════════════════════
# RSSI → Distance
# ══════════════════════════════════════════════════════════════════════════════

class TestRSSIToDistance:
    """
    Tests for the log-distance path-loss model inversion.

    The model:  d = d0 * 10 ^ ((RSSI_1m - RSSI) / (10 * n))
    With RSSI_1m = -40, n = 2.5, d0 = 1m
    """

    def test_rssi_at_calibration_point_gives_approx_1m(self):
        """
        At the reference RSSI of -40 dBm (1 m calibration) the result
        should be approximately 1 metre.
        """
        d = LocationAgent().rssi_to_distance(-40)
        assert 0.8 <= d <= 1.5, f"Expected ~1m at RSSI=-40, got {d}m"

    def test_weaker_signal_gives_greater_distance(self):
        """The farther away a miner is, the weaker their signal."""
        agent    = LocationAgent()
        d_close  = agent.rssi_to_distance(-70)
        d_far    = agent.rssi_to_distance(-100)
        assert d_far > d_close, "Weaker RSSI should map to greater distance"

    def test_very_strong_signal_clamped_to_1m(self):
        """
        An RSSI of 0 dBm would produce a distance below 1 m.
        The clamp ensures we never return sub-1-m estimates.
        """
        d = LocationAgent().rssi_to_distance(0)
        assert d == 1.0, "Should be clamped at 1 m minimum"

    def test_extremely_weak_signal_clamped_to_250m(self):
        """
        An RSSI below the LoRa sensitivity floor extrapolates to huge
        distances.  The 250 m cap keeps estimates within the mine section.
        """
        d = LocationAgent().rssi_to_distance(-200)
        assert d == 250.0, "Should be clamped at 250 m maximum"

    @pytest.mark.parametrize("rssi,min_m,max_m", [
        # These bands reflect what you would actually measure underground
        (-70,   5,  60),    # strong signal → close range
        (-85,  20, 100),    # medium signal → mid range
        (-100, 50, 200),    # weak signal   → far range
    ])
    def test_rssi_bands_map_to_reasonable_distances(self, rssi, min_m, max_m):
        """
        Each RSSI band should produce a distance in the expected range.
        These ranges are intentionally wide to allow for different path-loss
        exponent calibrations.
        """
        d = LocationAgent().rssi_to_distance(rssi)
        assert min_m <= d <= max_m, (
            f"rssi={rssi} dBm → {d:.1f}m is outside expected [{min_m}, {max_m}]m"
        )


# ══════════════════════════════════════════════════════════════════════════════
# Direct line estimate
# ══════════════════════════════════════════════════════════════════════════════

class TestDirectEstimate:
    """
    Tests for _direct_estimate().

    The estimate places the miner at distance `dist` along the straight
    line from the gateway to their anchor.  Basic geometry must hold.
    """

    def test_zero_distance_stays_at_gateway(self):
        """
        If estimated distance is 0, the miner is at the gateway position.
        """
        agent  = LocationAgent()
        result = agent._direct_estimate({"x": 0, "y": 0}, {"x": 50, "y": 0}, 0.0)
        assert result["x"] == pytest.approx(0.0, abs=0.1)
        assert result["y"] == pytest.approx(0.0, abs=0.1)

    def test_full_distance_reaches_anchor_on_x_axis(self):
        """
        If dist equals the anchor distance, the estimate should land on
        the anchor position.
        """
        agent  = LocationAgent()
        result = agent._direct_estimate({"x": 0, "y": 0}, {"x": 100, "y": 0}, 100.0)
        assert result["x"] == pytest.approx(100.0, abs=0.5)
        assert result["y"] == pytest.approx(0.0,   abs=0.5)

    def test_diagonal_direction_preserved(self):
        """
        The direction from GW to anchor must be preserved when the anchor
        is not on the x-axis (e.g. N3 at (75, 40)).
        """
        agent  = LocationAgent()
        gw     = {"x": 0, "y": 0}
        anchor = {"x": 75, "y": 40}
        dist   = math.sqrt(75 ** 2 + 40 ** 2)   # true anchor distance
        result = agent._direct_estimate(gw, anchor, dist)
        assert result["x"] == pytest.approx(75.0, abs=2.0)
        assert result["y"] == pytest.approx(40.0, abs=2.0)

    def test_half_distance_is_midpoint(self):
        """
        At 50% of the anchor distance, the estimate should be at the
        midpoint between GW and anchor.
        """
        agent  = LocationAgent()
        result = agent._direct_estimate({"x": 0, "y": 0}, {"x": 100, "y": 0}, 50.0)
        assert result["x"] == pytest.approx(50.0, abs=1.0)


# ══════════════════════════════════════════════════════════════════════════════
# Nearest anchor
# ══════════════════════════════════════════════════════════════════════════════

class TestNearestAnchor:
    """
    Tests for _nearest_anchor().

    Uses the ANCHOR_MAP from config (GW at 0,0; N1 at 50,0; etc.).
    The nearest anchor tells operators which tunnel section the miner is in.
    """

    def test_at_gateway_position_returns_gw(self):
        """Position (0,0) should return the GW anchor."""
        result = LocationAgent()._nearest_anchor({"x": 0, "y": 0})
        assert result["id"] == "GW"

    def test_near_n1_returns_n1(self):
        """A position close to (50,0) should return N1."""
        result = LocationAgent()._nearest_anchor({"x": 52, "y": 2})
        assert result["id"] == "N1"

    def test_near_n4_deep_face_returns_n4(self):
        """N4 is at (150,30) — a nearby position should return N4."""
        result = LocationAgent()._nearest_anchor({"x": 148, "y": 31})
        assert result["id"] == "N4"

    def test_near_n5_south_branch_returns_n5(self):
        """N5 is at (90,80) — a nearby position should return N5."""
        result = LocationAgent()._nearest_anchor({"x": 91, "y": 79})
        assert result["id"] == "N5"

    def test_returned_dict_includes_dist_key(self):
        """The dist key should contain the Euclidean distance in metres."""
        result = LocationAgent()._nearest_anchor({"x": 55, "y": 5})
        assert "dist" in result
        assert result["dist"] >= 0


# ══════════════════════════════════════════════════════════════════════════════
# BFS tunnel path
# ══════════════════════════════════════════════════════════════════════════════

class TestBFSPath:
    """
    Tests for _bfs_path().

    The TUNNEL_GRAPH for SEC-A:
        GW → N1 → N2 → N4
                └→ N3 → N5

    Every path must match the actual connected topology — shortcuts that
    skip tunnel sections would be physically meaningless.
    """

    def test_same_src_and_dst_returns_single_node(self):
        """No travel needed — path is just [src]."""
        assert LocationAgent()._bfs_path("GW", "GW") == ["GW"]

    def test_adjacent_nodes_one_hop(self):
        """GW and N1 are directly connected."""
        assert LocationAgent()._bfs_path("GW", "N1") == ["GW", "N1"]

    def test_two_hop_path_to_n2(self):
        """GW → N1 → N2 (N2 is connected via N1, not directly to GW)."""
        assert LocationAgent()._bfs_path("GW", "N2") == ["GW", "N1", "N2"]

    def test_three_hop_path_to_n4(self):
        """GW → N1 → N2 → N4 (deep face is three hops away)."""
        assert LocationAgent()._bfs_path("GW", "N4") == ["GW", "N1", "N2", "N4"]

    def test_branch_path_to_n5(self):
        """GW → N1 → N3 → N5 (south branch goes via east branch junction)."""
        assert LocationAgent()._bfs_path("GW", "N5") == ["GW", "N1", "N3", "N5"]

    def test_reverse_path_n1_to_gw(self):
        """Paths work in both directions — the graph is undirected."""
        path = LocationAgent()._bfs_path("N1", "GW")
        assert path[0] == "N1"
        assert path[-1] == "GW"

    def test_path_contains_no_duplicates(self):
        """BFS should never visit the same node twice."""
        path = LocationAgent()._bfs_path("GW", "N5")
        assert len(path) == len(set(path)), "Path should not contain duplicate anchors"

    def test_non_existent_dst_returns_fallback(self):
        """If the destination is not in the graph, return [src, dst] as fallback."""
        path = LocationAgent()._bfs_path("GW", "N99")
        assert path[0] == "GW"
        assert path[-1] == "N99"


# ══════════════════════════════════════════════════════════════════════════════
# Median filter
# ══════════════════════════════════════════════════════════════════════════════

class TestMedianFilter:
    """
    Tests for the static _median() method.

    The median is used to filter 5 consecutive RSSI readings.  It must be
    robust to outliers and handle edge cases like empty or single-element lists.
    """

    def test_single_value_returns_itself(self):
        """The median of a single value is that value."""
        assert LocationAgent._median([-80]) == -80

    def test_odd_count_returns_middle_value(self):
        """For 3 sorted values, the median is the middle one."""
        assert LocationAgent._median([-90, -80, -70]) == -80

    def test_even_count_returns_average_of_two_middle(self):
        """For 2 values, the median is their average."""
        assert LocationAgent._median([-90, -80]) == -85.0

    def test_empty_list_returns_fallback(self):
        """An empty RSSI window should not crash — return -100 dBm as safe fallback."""
        assert LocationAgent._median([]) == -100.0

    def test_outlier_does_not_dominate(self):
        """
        A single -130 dBm outlier (antenna disconnection) in a list of
        ~ -80 dBm values should not pull the median far from the true value.
        """
        vals   = [-80, -81, -79, -130, -82]
        result = LocationAgent._median(vals)
        assert -85 <= result <= -75, (
            f"Outlier should not dominate median, got {result}"
        )

    def test_unsorted_input_handled_correctly(self):
        """The method must sort internally — unsorted input must work."""
        assert LocationAgent._median([3, 1, 2]) == 2


# ══════════════════════════════════════════════════════════════════════════════
# Particle filter
# ══════════════════════════════════════════════════════════════════════════════

class TestParticleFilter:
    """
    Tests for _particle_filter_update().

    We cannot test exact position accuracy (the filter is stochastic) but we
    can test that the structural invariants always hold:
    - particle count is preserved
    - particles stay inside mine bounds
    - confidence is always in [0, 1]
    - returned position is a dict with x and y keys
    """

    def test_particle_count_unchanged_after_update(self):
        """
        Resampling creates a new particle list of the same size.
        If count changed, the filter's statistical properties would break.
        """
        from config import NUM_PARTICLES
        tracker = MinerTracker(node_id=1)
        initial = len(tracker.particles)
        LocationAgent()._particle_filter_update(tracker, {"x": 0, "y": 0}, -80)
        assert len(tracker.particles) == initial == NUM_PARTICLES

    def test_particles_stay_within_mine_bounds(self):
        """
        After 10 update cycles, ALL particles must stay within the
        mine coordinate bounds (x: 0-200m, y: 0-100m).
        """
        agent   = LocationAgent()
        tracker = MinerTracker(node_id=1)
        for _ in range(10):
            agent._particle_filter_update(tracker, {"x": 0, "y": 0}, -80)
        for p in tracker.particles:
            assert 0.0 <= p.x <= 200.0, f"Particle x={p.x} outside bounds"
            assert 0.0 <= p.y <= 100.0, f"Particle y={p.y} outside bounds"

    def test_confidence_always_between_0_and_1(self):
        """Confidence is a probability — it must never be negative or > 1."""
        agent   = LocationAgent()
        tracker = MinerTracker(node_id=1)
        agent._particle_filter_update(tracker, {"x": 0, "y": 0}, -80)
        assert 0.0 <= tracker.confidence <= 1.0

    def test_returns_dict_with_x_and_y(self):
        """The position estimate must always be a dict with float x and y."""
        agent   = LocationAgent()
        tracker = MinerTracker(node_id=1)
        pos = agent._particle_filter_update(tracker, {"x": 0, "y": 0}, -80)
        assert "x" in pos and "y" in pos
        assert isinstance(pos["x"], float)
        assert isinstance(pos["y"], float)


# ══════════════════════════════════════════════════════════════════════════════
# process_reading — full integration
# ══════════════════════════════════════════════════════════════════════════════

class TestProcessReading:
    """
    Integration tests for process_reading() — the main public entry point.

    These tests verify the complete pipeline from enriched reading to
    location dict, without mocking any internal components.
    """

    async def test_valid_reading_returns_location_dict(self, agent):
        """A normal enriched reading must produce a non-None location dict."""
        loc = await agent.process_reading(make_reading(nid=1, rssi=-80))
        assert loc is not None

    async def test_location_has_all_required_keys(self, agent):
        """
        The location dict must contain all keys that the DB layer,
        dashboard, and server.py broadcast handler expect.
        """
        loc = await agent.process_reading(make_reading(nid=1))
        for key in ("position", "distanceFromGateway", "nearestAnchor",
                    "tunnelPath", "depth", "confidence"):
            assert key in loc, f"Location dict missing key: '{key}'"

    async def test_position_values_are_floats(self, agent):
        """
        x and y must be floats (not ints) so JSON serialisation is
        consistent and dashboard charts don't break on integer-looking values.
        """
        loc = await agent.process_reading(make_reading(nid=2, rssi=-85))
        assert isinstance(loc["position"]["x"], float)
        assert isinstance(loc["position"]["y"], float)

    async def test_distance_from_gateway_is_positive(self, agent):
        """Distance is always non-negative by definition."""
        loc = await agent.process_reading(make_reading(nid=1, rssi=-80))
        assert loc["distanceFromGateway"]["estimated"] > 0

    async def test_confidence_is_0_to_100_percent(self, agent):
        """Confidence is reported as an integer 0-100 in the location dict."""
        for _ in range(5):
            loc = await agent.process_reading(make_reading(nid=1, rssi=-80))
        assert 0 <= loc["confidence"] <= 100

    async def test_tunnel_path_starts_at_gw(self, agent):
        """The rescue path must always start from the gateway."""
        loc = await agent.process_reading(make_reading(nid=3))
        assert loc["tunnelPath"][0] == "GW"

    async def test_unknown_node_returns_none(self, agent):
        """
        Node 9 has no anchor in ANCHOR_MAP.  The agent must return None
        rather than crash, as unknown nodes may be test transmitters or
        other LoRa devices on the same frequency.
        """
        loc = await agent.process_reading(make_reading(nid=9))
        assert loc is None

    async def test_location_update_event_emitted(self, agent):
        """The 'location_update' event must fire for every successful estimate."""
        events = []
        agent.on("location_update", lambda e: events.append(e))
        await agent.process_reading(make_reading(nid=1))
        assert len(events) == 1
        assert events[0]["nodeId"] == 1

    async def test_loc_count_increments_per_estimate(self, agent):
        """loc_count tracks the total number of location estimates produced."""
        await agent.process_reading(make_reading(nid=1))
        await agent.process_reading(make_reading(nid=2))
        assert agent.loc_count == 2

    async def test_rssi_smoothed_by_median_filter(self, agent):
        """
        Send 3 readings with different RSSI values.  The 3rd location's
        rssiSmooth should be the median of the 3 values, not the raw last value.
        """
        rssi_values = [-80, -100, -85]
        for rssi in rssi_values:
            loc = await agent.process_reading(make_reading(nid=1, rssi=rssi))
        # Median of [-80, -85, -100] = -85
        smooth = loc["distanceFromGateway"]["rssiSmooth"]
        assert smooth == pytest.approx(-85.0, abs=1.0)
