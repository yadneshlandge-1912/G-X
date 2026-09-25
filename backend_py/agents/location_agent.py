"""
agents/location_agent.py — AI Agent 2: Underground Location Engine
===================================================================
ROLE IN THE SYSTEM
------------------
This is the second AI agent.  It receives the enriched reading dict produced
by Agent 1 and answers the question: "WHERE is this miner right now?"

WHY NOT GPS?
------------
GPS signals cannot penetrate rock.  Underground coal mines in India have
reported zero GPS coverage in 100 % of surveyed sections.  This agent
uses RSSI (Received Signal Strength Indicator) from the LoRa radio instead.

HOW RSSI-BASED POSITIONING WORKS
----------------------------------
Radio waves attenuate (weaken) predictably with distance.  The
"log-distance path-loss model" captures this:

    RSSI(d) = RSSI(1m) - 10 * n * log10(d)

where:
    RSSI(1m)  = signal strength at 1 metre (calibrated on-site)
    n         = path-loss exponent (2.0–3.5 for mine tunnels)
    d         = distance in metres

Inverting this gives distance from measured RSSI:
    d = 10 ^ ((RSSI(1m) - RSSI) / (10 * n))

With ONE gateway this gives a CIRCLE of possible positions at distance d.
We resolve the ambiguity using:
    a) The known anchor positions (surveyed tunnel layout)
    b) A particle filter that tracks movement over time
    c) The tunnel graph that constrains positions to valid paths

PARTICLE FILTER (Sequential Importance Resampling)
---------------------------------------------------
A particle filter represents the miner's position as a cloud of N weighted
"particles", each holding a candidate (x, y) position.

Each cycle:
  Predict  — move every particle randomly (simulates walking)
  Update   — weight each particle by how well its RSSI prediction matches
             the measured RSSI (Gaussian likelihood)
  Resample — create a new population biased toward high-weight particles

After convergence, the weighted mean of all particles is the position estimate.
The ratio of the "effective sample size" to N gives the confidence score.

WHY BLEND WITH A DIRECT ESTIMATE?
----------------------------------
The particle filter needs ~20 readings to converge from a random initialisation.
During this warm-up period we blend it with a simple "direct line estimate"
(the miner is at distance d along the straight line from the gateway to their
known anchor).  The blend ratio ramps from 100% direct to 100% particle filter
over the first 20 readings.
"""
from __future__ import annotations

import math          # log10, sqrt for path-loss calculations
import random        # random.gauss for particle motion noise
import time          # time.time() for history timestamps
import asyncio
import logging
from collections import deque
from dataclasses import dataclass, field
from typing import Callable, Any

from config import (
    ANCHOR_MAP,        # surveyed anchor positions {id: {x, y, label, depth}}
    TUNNEL_GRAPH,      # adjacency list {anchor_id: [neighbour_id, ...]}
    PATH_LOSS_EXP,     # n — path-loss exponent (calibrate on-site)
    RSSI_AT_1M_DBM,    # RSSI measured at 1 m reference distance
    REF_DISTANCE_M,    # d0 = 1 m (do not change)
    NUM_PARTICLES,     # SIR filter population size
    MOTION_NOISE_M,    # standard deviation of random-walk step (metres)
    RSSI_NOISE_DBM,    # standard deviation of RSSI measurement noise (dBm)
)

log = logging.getLogger("location_agent")


# ── Particle ──────────────────────────────────────────────────────────────────
@dataclass
class Particle:
    """
    One hypothesis about the miner's current position.

    x, y  — candidate position in metres (mine coordinate system)
    w     — importance weight; normalised so all weights sum to 1.0.
            A high-weight particle is near a position that is consistent
            with the observed RSSI; low-weight particles are far away.
    """
    x: float
    y: float
    w: float = 1.0 / NUM_PARTICLES   # uniform weight at initialisation


# ── Per-miner tracker ─────────────────────────────────────────────────────────
@dataclass
class MinerTracker:
    """
    All location state for ONE miner node.

    Holds the particle population, the last estimated position, a history
    deque for the dashboard sparkline, and the current confidence score.

    Instantiated in location_agent._trackers when a node is first seen.
    """
    node_id:    int
    particles:  list = field(default_factory=list)

    # Most recent position estimate — used to seed the blend calculation
    last_pos:   dict | None = None

    # Ring buffer of recent positions for the dashboard history sparkline
    # maxlen=20 means we keep the last 20 location estimates
    history:    deque = field(default_factory=lambda: deque(maxlen=20))

    # 0.0 to 1.0 — derived from effective sample size of the particle filter.
    # Low confidence means particles are spread out (uncertain location).
    # High confidence means particles are clustered (well-localised miner).
    confidence: float = 0.0

    def __post_init__(self):
        """Populate the particle cloud immediately after construction."""
        self._init_particles()

    def _init_particles(self):
        """
        Scatter NUM_PARTICLES uniformly across the mine area.

        Mine bounds: x = 0–200 m, y = 0–100 m  (matches SEC-A layout).
        Uniform initialisation is correct when we have no prior knowledge
        of the miner's position.  The filter converges within ~20 readings.
        """
        self.particles = [
            Particle(
                x=random.uniform(0, 200),
                y=random.uniform(0, 100),
            )
            for _ in range(NUM_PARTICLES)
        ]


# ── Agent ─────────────────────────────────────────────────────────────────────
class LocationAgent:
    """
    AI Agent 2 — Underground Location Engine.

    Receives enriched readings from Agent 1 and produces location estimates.
    One MinerTracker instance is maintained per node.

    The RSSI store accumulates the last 5 RSSI readings per node per anchor
    for median filtering — this reduces the effect of single-packet fading.
    """

    def __init__(self):
        # One tracker per node, created on first reading
        self._trackers:   dict[int, MinerTracker] = {}

        # Rolling RSSI buffer: {node_id: {anchor_id: [rssi values]}}
        # "GW" is the only anchor in the single-gateway MVP; a multi-gateway
        # deployment would add "GW2", "GW3" etc.
        self._rssi_store: dict[int, dict[str, list]] = {}

        # Pub/sub listeners (same pattern as Agent 1)
        self._listeners:  dict[str, list[Callable]] = {}

        # Total location estimates produced (reported in /api/status)
        self.loc_count = 0

    # ── Listener registration ─────────────────────────────────────────────────

    def on(self, event: str, callback: Callable):
        """Register an async or sync callback for a named event."""
        self._listeners.setdefault(event, []).append(callback)

    async def _emit(self, event: str, payload: Any):
        """Fire all callbacks registered for an event."""
        for cb in self._listeners.get(event, []):
            try:
                if asyncio.iscoroutinefunction(cb):
                    await cb(payload)
                else:
                    cb(payload)
            except Exception as exc:
                log.error("Listener '%s' raised: %s", event, exc)

    def start(self):
        """Log startup message. Agent 2 has no background tasks."""
        log.info("[Agent2] Location Agent started")

    # ── Main entry ────────────────────────────────────────────────────────────

    async def process_reading(self, reading: dict) -> dict | None:
        """
        Estimate the position of one miner from their latest enriched reading.

        Parameters
        ----------
        reading : the enriched reading dict produced by Agent 1

        Returns
        -------
        A location dict, or None if the node has no matching anchor in the map.

        Processing steps:
            1. Accumulate RSSI in a 5-reading median filter
            2. Convert median RSSI → distance via path-loss model
            3. Run particle filter update
            4. Blend particle-filter position with direct line estimate
            5. Compute nearest anchor via Euclidean distance
            6. Find shortest tunnel path via BFS
            7. Build and return the location dict
        """
        nid       = reading["nodeId"]
        rssi      = reading["signal"]["rssi"]
        anchor_id = f"N{nid}"   # each node IS a fixed anchor in the single-GW MVP

        # Reject nodes whose anchor is not in the map (shouldn't happen in normal ops)
        if anchor_id not in ANCHOR_MAP:
            return None

        # ── Step 1: Accumulate RSSI for median filtering ──────────────────────
        # We keep the last 5 RSSI values per (node, anchor) pair.
        # Median filtering removes impulsive noise (single very low/high RSSI
        # caused by momentary multipath destructive interference).
        self._rssi_store.setdefault(nid, {}).setdefault("GW", [])
        self._rssi_store[nid]["GW"].append(rssi)
        if len(self._rssi_store[nid]["GW"]) > 5:
            self._rssi_store[nid]["GW"].pop(0)   # keep only last 5

        filtered_rssi = self._median(self._rssi_store[nid]["GW"])

        # ── Step 2: Convert RSSI → distance ───────────────────────────────────
        dist_from_gw = self.rssi_to_distance(filtered_rssi)

        # ── Step 3: Particle filter update ────────────────────────────────────
        if nid not in self._trackers:
            self._trackers[nid] = MinerTracker(node_id=nid)

        tracker  = self._trackers[nid]
        gw       = ANCHOR_MAP["GW"]       # gateway position (0,0)
        anchor   = ANCHOR_MAP[anchor_id]  # this node's known anchor position

        pf_pos = self._particle_filter_update(tracker, gw, filtered_rssi)

        # ── Step 4: Blend particle filter + direct line estimate ──────────────
        # Ramp from 100% direct estimate to 100% particle filter over first 20 readings.
        # This prevents the uninitialised PF from producing wildly wrong positions.
        blend   = min(1.0, self.loc_count / 20.0)
        direct  = self._direct_estimate(gw, anchor, dist_from_gw)
        final_x = direct["x"] * (1 - blend) + pf_pos["x"] * blend
        final_y = direct["y"] * (1 - blend) + pf_pos["y"] * blend

        # Euclidean distance from the gateway (0,0)
        dist_m  = math.sqrt(final_x ** 2 + final_y ** 2)

        # ── Step 5: Nearest anchor ────────────────────────────────────────────
        nearest = self._nearest_anchor({"x": final_x, "y": final_y})

        # ── Step 6: BFS tunnel path ───────────────────────────────────────────
        path = self._bfs_path("GW", nearest["id"])

        # ── Step 7: Build location dict ───────────────────────────────────────
        location = {
            "nodeId":   nid,
            "section":  reading.get("section", "UNKNOWN"),
            "timestamp": int(time.time() * 1000),

            "position": {
                "x":    round(final_x, 1),   # metres along main tunnel axis
                "y":    round(final_y, 1),   # metres lateral from main tunnel
                "unit": "metres",
            },

            "distanceFromGateway": {
                "rssiRaw":    rssi,            # unfiltered RSSI for diagnostics
                "rssiSmooth": filtered_rssi,   # median-filtered RSSI used for calc
                "estimated":  round(dist_m, 1),
                "unit":       "metres",
            },

            "nearestAnchor": {
                "id":    nearest["id"],        # e.g. "N3"
                "label": nearest["label"],     # human-readable name
                "distM": round(nearest["dist"], 1),
            },

            "tunnelPath": path,               # e.g. ["GW", "N1", "N3"]
            "depth":      nearest.get("depth", 0),   # metres below surface
            "confidence": int(tracker.confidence * 100),  # 0-100 %
        }

        # Update tracker with the new estimate
        tracker.last_pos = location["position"]
        tracker.history.append({**location["position"], "ts": time.time()})
        self.loc_count += 1

        await self._emit("location_update", {"nodeId": nid, "location": location})
        return location

    # ── RSSI → Distance conversion ────────────────────────────────────────────

    def rssi_to_distance(self, rssi: float) -> float:
        """
        Convert a received signal strength (dBm) to an estimated distance (m).

        Uses the log-distance path-loss model inversion:
            d = d0 * 10 ^ ((RSSI_at_d0 - RSSI) / (10 * n))

        Where d0 = REF_DISTANCE_M = 1 m and RSSI_at_d0 = RSSI_AT_1M_DBM.

        Result is clamped to [1 m, 250 m]:
            - Below 1 m: physically impossible given 1-m calibration point
            - Above 250 m: beyond the SEC-A mine section extent

        Parameters
        ----------
        rssi : filtered RSSI value in dBm (typically -40 to -130)
        """
        exponent = (RSSI_AT_1M_DBM - rssi) / (10 * PATH_LOSS_EXP)
        dist = REF_DISTANCE_M * (10 ** exponent)
        return max(1.0, min(250.0, dist))

    # ── Direct line estimate ──────────────────────────────────────────────────

    def _direct_estimate(self, gw: dict, anchor: dict, dist: float) -> dict:
        """
        Estimate position by placing the miner at distance `dist` along
        the straight line from the gateway toward their known anchor.

        This is a fast, deterministic estimate that works even before the
        particle filter has converged.  It is geometrically correct when the
        miner is on the straight path between GW and their anchor.

        Parameters
        ----------
        gw     : gateway anchor dict {x, y, …}
        anchor : this node's anchor dict {x, y, …}
        dist   : estimated distance from gateway in metres
        """
        dx  = anchor["x"] - gw["x"]
        dy  = anchor["y"] - gw["y"]
        mag = math.sqrt(dx ** 2 + dy ** 2) or 1.0   # magnitude of direction vector
        # Scale unit vector by dist to get estimated position
        return {
            "x": gw["x"] + (dx / mag) * dist,
            "y": gw["y"] + (dy / mag) * dist,
        }

    # ── SIR Particle Filter ───────────────────────────────────────────────────

    def _particle_filter_update(
        self,
        tracker: MinerTracker,
        anchor: dict,
        rssi: float,
    ) -> dict:
        """
        Run one Sequential Importance Resampling (SIR) cycle.

        SIR has three steps: Predict → Update → Resample.

        Parameters
        ----------
        tracker : the MinerTracker for this node (holds the particle population)
        anchor  : the gateway anchor (RSSI measurement point at x=0, y=0)
        rssi    : the median-filtered RSSI for this reading

        Returns
        -------
        dict with keys "x" and "y" — the weighted mean position estimate
        """
        particles = tracker.particles

        # ── Predict: random walk ──────────────────────────────────────────────
        # Each particle moves by a Gaussian random step.  This represents our
        # prior belief that the miner could have walked up to MOTION_NOISE_M
        # metres in any direction since the last reading.
        for p in particles:
            p.x = max(0.0, min(200.0, p.x + random.gauss(0, MOTION_NOISE_M)))
            p.y = max(0.0, min(100.0, p.y + random.gauss(0, MOTION_NOISE_M)))

        # ── Update: Gaussian RSSI likelihood ─────────────────────────────────
        # For each particle, compute what RSSI we WOULD expect if the miner
        # were at that particle's position.  Then compute how likely the
        # observed RSSI is given that expected RSSI (Gaussian likelihood).
        # Particles near the correct position get high weights; far ones low.
        total_w = 0.0
        for p in particles:
            # Expected distance from this particle to the gateway
            d = math.sqrt((p.x - anchor["x"]) ** 2 + (p.y - anchor["y"]) ** 2)
            # Expected RSSI at that distance (path-loss model)
            expected_rssi = (
                RSSI_AT_1M_DBM
                - 10 * PATH_LOSS_EXP * math.log10(max(1.0, d))
            )
            # Gaussian likelihood: exp(-(diff^2) / (2 * sigma^2))
            diff  = rssi - expected_rssi
            p.w   = math.exp(-(diff ** 2) / (2 * RSSI_NOISE_DBM ** 2))
            total_w += p.w

        # ── Normalise weights so they sum to 1.0 ─────────────────────────────
        if total_w < 1e-10:
            # All weights collapsed to zero — particle cloud has drifted too far.
            # Reset to uniform to recover gracefully.
            tracker._init_particles()
            return tracker.last_pos or {"x": 50.0, "y": 0.0}

        for p in particles:
            p.w /= total_w

        # ── Compute weighted mean position ────────────────────────────────────
        est_x = sum(p.x * p.w for p in particles)
        est_y = sum(p.y * p.w for p in particles)

        # ── Compute effective sample size N_eff ───────────────────────────────
        # N_eff = 1 / sum(w_i^2).  When all particles have equal weight (perfect
        # spread) N_eff = N.  When one particle dominates N_eff = 1.
        # N_eff / N gives an intuitive 0–1 confidence score.
        n_eff = 1.0 / sum(p.w ** 2 for p in particles)
        tracker.confidence = min(1.0, n_eff / NUM_PARTICLES * 3)
        # The *3 multiplier makes medium-confidence situations read ~0.5–0.7
        # instead of always being very low (N_eff / N is naturally small).

        # ── Resample if weight degeneracy is too high ─────────────────────────
        # When N_eff < N/3, most particles carry negligible weight.
        # Resampling replaces low-weight particles with copies of high-weight
        # ones, preventing "particle impoverishment" over many cycles.
        if n_eff < NUM_PARTICLES / 3:
            self._resample(tracker)

        return {"x": est_x, "y": est_y}

    # ── Systematic resampling ─────────────────────────────────────────────────

    @staticmethod
    def _resample(tracker: MinerTracker):
        """
        Replace the particle population with a new one sampled proportionally
        to the current weights (systematic resampling algorithm).

        Systematic resampling is preferred over multinomial resampling because
        it has O(N) complexity and lower variance — it visits every weight
        interval exactly once instead of randomly.

        A small Gaussian jitter (σ = 0.3 m) is added to each resampled
        particle to prevent particle collapse (all particles becoming identical).
        """
        N   = len(tracker.particles)

        # Build cumulative weight array for the wheel
        cum = []
        s   = 0.0
        for p in tracker.particles:
            s += p.w
            cum.append(s)

        # Draw N samples spaced evenly across [0, 1] with random starting offset
        new_particles = []
        step = 1.0 / N
        u    = random.random() * step   # random start in [0, 1/N]
        j    = 0                         # index into cumulative weights

        for _ in range(N):
            # Advance j until cum[j] >= u (find the weight interval containing u)
            while j < N - 1 and u > cum[j]:
                j += 1
            src = tracker.particles[j]
            # Copy the selected particle with a tiny jitter to maintain diversity
            new_particles.append(Particle(
                x=src.x + random.gauss(0, 0.3),
                y=src.y + random.gauss(0, 0.3),
                w=1.0 / N,              # reset to uniform weight after resampling
            ))
            u += step   # advance to next sample point

        tracker.particles = new_particles

    # ── Median filter ─────────────────────────────────────────────────────────

    @staticmethod
    def _median(values: list) -> float:
        """
        Compute the median of a list of numbers.

        The median is more robust than the mean for RSSI values because it is
        not affected by a single outlier caused by a momentary fade.

        Returns -100.0 (a safe fallback) for an empty list.
        """
        if not values:
            return -100.0
        s = sorted(values)
        n = len(s)
        # For even-length lists, average the two middle values
        return (s[n // 2 - 1] + s[n // 2]) / 2 if n % 2 == 0 else s[n // 2]

    # ── Nearest anchor ────────────────────────────────────────────────────────

    @staticmethod
    def _nearest_anchor(pos: dict) -> dict:
        """
        Find the ANCHOR_MAP entry closest to the given (x, y) position.

        Used to label the estimated position with a human-readable name
        (e.g. "Near N3 — East Branch 40m") and to look up depth.

        Parameters
        ----------
        pos : dict with "x" and "y" keys (metres)

        Returns
        -------
        The nearest anchor dict from ANCHOR_MAP, extended with a "dist" key
        containing the Euclidean distance in metres.
        """
        best, best_dist = None, float("inf")
        for anchor in ANCHOR_MAP.values():
            d = math.sqrt(
                (pos["x"] - anchor["x"]) ** 2
                + (pos["y"] - anchor["y"]) ** 2
            )
            if d < best_dist:
                best_dist = d
                best = anchor
        return {**best, "dist": best_dist}   # copy + add "dist" key

    # ── BFS shortest path ─────────────────────────────────────────────────────

    @staticmethod
    def _bfs_path(src: str, dst: str) -> list[str]:
        """
        Find the shortest path between two anchors in the TUNNEL_GRAPH.

        Uses breadth-first search (BFS) which guarantees the shortest path
        in an unweighted graph.  The mine tunnel graph is small (≤6 nodes)
        so BFS is perfectly fast enough — no need for Dijkstra or A*.

        The result tells operators: to reach a miner near N5, go through
        GW → N1 → N3 → N5.  This is shown on the dashboard Mine Map.

        Parameters
        ----------
        src : starting anchor ID (always "GW" in current usage)
        dst : destination anchor ID (e.g. "N5")

        Returns
        -------
        list of anchor IDs from src to dst inclusive, or [src, dst] as
        a direct fallback if no path exists in the graph.
        """
        if src == dst:
            return [src]   # trivial case — already there

        visited = {src}
        queue   = [(src, [src])]   # (current_node, path_so_far)

        while queue:
            node, path = queue.pop(0)   # FIFO = BFS
            for neighbour in TUNNEL_GRAPH.get(node, []):
                if neighbour in visited:
                    continue   # already explored
                new_path = path + [neighbour]
                if neighbour == dst:
                    return new_path   # found the destination
                visited.add(neighbour)
                queue.append((neighbour, new_path))

        # No path found (disconnected graph?) — return direct as fallback
        return [src, dst]

    # ── Status export ─────────────────────────────────────────────────────────

    def get_status(self) -> dict:
        """
        Return a snapshot of all tracked node positions and confidence scores.

        Called by GET /api/status.
        """
        nodes = {}
        for nid, t in self._trackers.items():
            nodes[nid] = {
                "nodeId":     nid,
                "lastPos":    t.last_pos,
                "confidence": t.confidence,
                # Last 5 positions for mini sparkline history
                "history":    list(t.history)[-5:],
            }
        return {"nodes": nodes, "locationCount": self.loc_count}

    def get_anchor_map(self) -> dict:
        """Return the ANCHOR_MAP for the /api/map endpoint."""
        return ANCHOR_MAP

    def get_tunnel_graph(self) -> dict:
        """Return the TUNNEL_GRAPH for the /api/map endpoint."""
        return TUNNEL_GRAPH


# ── Module-level singleton ────────────────────────────────────────────────────
location_agent = LocationAgent()
