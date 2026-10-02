"""
agents/signal_agent.py — AI Agent 1: Signal Receiver & Normalizer
==================================================================
ROLE IN THE SYSTEM
------------------
This is the first of two AI agents.  Every packet that arrives from the
gateway ESP32 enters the system through this file.  Nothing downstream
(location agent, alert engine, database, dashboard) ever sees a raw packet;
they all consume the cleaned, enriched reading that this agent produces.

PROCESSING PIPELINE (in order)
-------------------------------
1. Parse     — decode the "PKT:{json}" string from the serial bridge
2. Validate  — check that every field is within physically plausible bounds
3. Smooth    — apply a Kalman filter to remove LoRa radio noise
4. Anomaly   — detect sensor faults and sudden dangerous changes
5. Classify  — label signal quality (EXCELLENT … CRITICAL) and gas severity
6. Trend     — compute RISING / STABLE / FALLING from the rolling window
7. Emit      — fire async events so every subscriber reacts concurrently

WHY KALMAN FILTERING?
---------------------
LoRa packets travel through rock, water vapour, and reflective tunnel walls.
A single reading can be 5-10 °C off due to multipath interference and ADC
noise on the ESP32.  The Kalman filter maintains a running state estimate
that weights new measurements against the predicted state — giving a smooth,
physically plausible value without introducing the lag that a simple moving
average would create.

WHY ASYNC EVENTS?
-----------------
The agent uses a pub/sub pattern (agent.on("reading", callback)) rather than
direct function calls.  This means adding a new subscriber (e.g. a Telegram
alert bot) requires zero changes to this file — just register a new callback
in server.py.

WHY A SINGLETON?
----------------
There is one gateway and one set of nodes per mine section.  A single agent
instance accumulates state (Kalman estimates, rolling windows, rx_count) that
must persist across requests.  The singleton is created at module import and
shared via agents/__init__.py.
"""
from __future__ import annotations

import json          # parse the JSON payload inside "PKT:{json}"
import math          # sqrt for standard deviation in anomaly detection
import time          # time.time() for last_seen timestamps
import asyncio       # create_task for the heartbeat watchdog
import logging
from collections import deque          # fixed-size rolling window per node
from dataclasses import dataclass, field
from typing import Any, Callable, Deque

from config import (
    HEARTBEAT_TIMEOUT_S,   # seconds before a silent node is considered lost
    WINDOW_SIZE,           # how many readings to keep in the rolling window
    GAS_THRESHOLDS,        # PPM levels for CAUTION / WARNING / DANGER
    TEMP_THRESHOLDS,       # °C levels for CAUTION / WARNING / CRITICAL
)

log = logging.getLogger("signal_agent")

# ── Valid sensor ranges ───────────────────────────────────────────────────────
# Any reading outside these bounds is physically impossible and indicates
# either a wiring fault, a sensor failure, or a corrupted LoRa packet.
# The validation step flags these as errors but still processes the reading
# with a safe fallback value so we do not lose the RSSI / timestamp data.
VALID = {
    "temperature": (-10.0,  80.0),   # °C  — underground can reach 40 °C+ at depth
    "humidity":    (  0.0, 100.0),   # %   — 100 % = saturated air in wet mine
    "gasPPM":      (  0.0, 9999.0),  # PPM — MQ-2 saturates around 10000 PPM
    "rssi":        (-140.0,  0.0),   # dBm — LoRa SX1276 sensitivity floor ~-137 dBm
    "snr":         ( -20.0, 15.0),   # dB  — typical LoRa SNR range
}

# ── Signal quality bands ──────────────────────────────────────────────────────
# Classified by RSSI (dBm).  The list is ordered strongest → weakest so the
# first match in a loop gives the correct label.  RSSI_AT_1M is ~ -40 dBm, so
# signals above -70 dBm mean the miner is close to the gateway or a repeater.
SIGNAL_QUALITY = [
    {"label": "EXCELLENT", "rssi_min": -70,  "color": "#22c55e"},
    {"label": "GOOD",      "rssi_min": -85,  "color": "#84cc16"},
    {"label": "FAIR",      "rssi_min": -100, "color": "#eab308"},
    {"label": "WEAK",      "rssi_min": -115, "color": "#f97316"},
    {"label": "CRITICAL",  "rssi_min": -999, "color": "#ef4444"},  # catch-all
]

# ── Gas severity bands ────────────────────────────────────────────────────────
# The ppm_max of each band is the threshold imported from config.py.
# severity 0-3 is stored as an integer in the DB for easy SQL filtering
# (e.g. "WHERE gas_severity >= 2" to find all warning/danger readings).
GAS_LEVELS = [
    {"label": "SAFE",    "ppm_max": GAS_THRESHOLDS["CAUTION"], "color": "#22c55e", "severity": 0},
    {"label": "CAUTION", "ppm_max": GAS_THRESHOLDS["WARNING"], "color": "#eab308", "severity": 1},
    {"label": "WARNING", "ppm_max": GAS_THRESHOLDS["DANGER"],  "color": "#f97316", "severity": 2},
    {"label": "DANGER",  "ppm_max": 9999,                      "color": "#ef4444", "severity": 3},
]


# ── 1-D Kalman Filter ─────────────────────────────────────────────────────────
class KalmanFilter:
    """
    Lightweight scalar (1-dimensional) Kalman filter.

    A Kalman filter is a recursive Bayesian estimator.  It maintains two
    quantities:
        x  — the current best estimate of the true value
        P  — the uncertainty (variance) of that estimate

    On each update() call it performs:
        Predict: P = P + Q          (uncertainty grows with time)
        Gain:    K = P / (P + R)    (how much to trust the new measurement)
        Update:  x = x + K*(z - x) (blend estimate with measurement)
                 P = (1-K)*P        (uncertainty shrinks after good measurement)

    Parameters
    ----------
    process_noise       : Q — how much the true value can change between readings.
                          Low Q → filter trusts its own model; slow to adapt.
                          High Q → filter trusts measurements more; noisier output.
    measurement_noise   : R — how noisy the sensor measurements are.
                          Calibrate R from the variance of many still-air readings.

    Typical values for underground LoRa sensors:
        temperature  Q=0.005, R=0.5   (temperature changes slowly)
        humidity     Q=0.010, R=1.0
        gas PPM      Q=0.100, R=5.0   (gas can spike quickly — higher Q)
    """

    def __init__(self, process_noise: float = 0.01, measurement_noise: float = 1.0):
        self.Q = process_noise        # expected variance of the process itself
        self.R = measurement_noise    # expected variance of the sensor
        self.P = 1.0                  # initial estimate uncertainty (start uncertain)
        self.x: float | None = None  # current state estimate; None until first reading

    def update(self, z: float) -> float:
        """
        Incorporate one new measurement and return the filtered estimate.

        Parameters
        ----------
        z : the raw measurement from the sensor

        Returns
        -------
        float — the smoothed estimate, rounded to 2 decimal places
        """
        if self.x is None:
            # First measurement: accept it as-is; no prior to blend with
            self.x = z
            return z

        # ── Predict step ──────────────────────────────────────────────────────
        # The true value may have drifted since last reading; increase uncertainty
        self.P += self.Q

        # ── Update step ───────────────────────────────────────────────────────
        # Kalman gain: high when P >> R (we trust measurement more than model)
        K = self.P / (self.P + self.R)

        # Blend old estimate with new measurement, weighted by Kalman gain
        self.x += K * (z - self.x)

        # Reduce uncertainty now that we have incorporated a measurement
        self.P  = (1 - K) * self.P

        return round(self.x, 2)   # round to 2dp to avoid float noise in JSON

    def reset(self):
        """
        Forget all history — next update() will treat the measurement as first.
        Called when a node comes back online after being silent.
        """
        self.x = None
        self.P = 1.0


# ── Per-node state ────────────────────────────────────────────────────────────
@dataclass
class NodeState:
    """
    All persistent state the agent keeps for ONE miner node.

    Each node gets its own set of Kalman filters because the filters must
    track that node's sensor drift independently.  Mixing readings from two
    nodes into one filter would corrupt both estimates.

    The rolling window (deque with maxlen=WINDOW_SIZE) automatically drops
    the oldest entry when a new one is appended — no manual trimming needed.
    """

    node_id:      int

    # Three separate Kalman filters — one per sensed quantity.
    # Different Q and R values because each sensor has different noise characteristics.
    kalman_temp:  KalmanFilter = field(default_factory=lambda: KalmanFilter(0.005, 0.5))
    kalman_humid: KalmanFilter = field(default_factory=lambda: KalmanFilter(0.010, 1.0))
    kalman_gas:   KalmanFilter = field(default_factory=lambda: KalmanFilter(0.100, 5.0))

    # Rolling window of the last WINDOW_SIZE smoothed readings.
    # Each entry is a dict: {"t": float, "h": float, "gas": float,
    #                         "rssi": float, "ts": float}
    window: Deque = field(default_factory=lambda: deque(maxlen=WINDOW_SIZE))

    last_seen:    float | None = None   # Unix timestamp of last received packet
    rx_count:     int          = 0      # total packets received from this node
    lost_alerted: bool         = False  # True after a node_lost event is fired
                                         # (prevents duplicate lost alerts)

    def trend(self, field_key: str) -> str:
        """
        Compute RISING / FALLING / STABLE for a sensor field over recent history.

        Uses the last 5 window entries.  A delta of ±2 units is the threshold
        for "trending" — smaller changes are considered STABLE noise.

        Parameters
        ----------
        field_key : key to read from each window entry ("t", "h", "gas", "rssi")

        Returns
        -------
        "RISING", "FALLING", or "STABLE"
        """
        if len(self.window) < 3:
            # Not enough history yet — cannot determine a meaningful trend
            return "STABLE"

        vals  = [w[field_key] for w in list(self.window)[-5:]]
        delta = vals[-1] - vals[0]  # change over the last 5 readings

        if delta >  2.0: return "RISING"
        if delta < -2.0: return "FALLING"
        return "STABLE"


# ── Agent ─────────────────────────────────────────────────────────────────────
class SignalAgent:
    """
    AI Agent 1 — Signal Receiver and Normalizer.

    This class is the entry point for ALL sensor data.  It is designed as
    an async event emitter: callers register callbacks with .on(event, fn)
    and are notified whenever something interesting happens.

    Event catalogue:
        "reading"        — fired for every successfully processed packet;
                           payload is the full enriched reading dict
        "sos"            — fired when a miner presses the SOS button
        "gas_alert"      — fired when smoothed gas >= WARNING threshold
        "temp_alert"     — fired when smoothed temperature is abnormal
        "anomaly"        — fired when a statistical anomaly is detected
        "node_discovered"— fired the first time a node ID is seen
        "node_lost"      — fired by the watchdog when a node goes silent
        "error"          — fired on parse failures or out-of-range data

    The agent is instantiated once as a module-level singleton and started
    in server.py's lifespan context.
    """

    def __init__(self):
        self._nodes: dict[int, NodeState] = {}      # keyed by node_id (1-5)
        self._listeners: dict[str, list[Callable]] = {}   # event → list of callbacks
        self.processed_count = 0   # total packets successfully processed (for /api/status)
        self.error_count     = 0   # total parse/validation errors (for diagnostics)
        self._watchdog_task: asyncio.Task | None = None   # heartbeat background task

    # ── Listener registration ─────────────────────────────────────────────────

    def on(self, event: str, callback: Callable):
        """
        Register a callback for a named event.

        The callback may be a regular function or an async coroutine — both
        are handled by _emit().  Multiple callbacks per event are supported.

        Example (in server.py):
            signal_agent.on("reading", handle_reading)
            signal_agent.on("sos",     handle_sos)

        Parameters
        ----------
        event    : one of the event names listed in the class docstring
        callback : function or coroutine to call when the event fires
        """
        self._listeners.setdefault(event, []).append(callback)

    async def _emit(self, event: str, payload: Any):
        """
        Call all registered callbacks for an event.

        Supports both sync and async callbacks.  Errors in callbacks are
        caught and logged so one bad callback does not crash the agent.

        Parameters
        ----------
        event   : event name to fire
        payload : data passed as the single argument to each callback
        """
        for cb in self._listeners.get(event, []):
            try:
                if asyncio.iscoroutinefunction(cb):
                    await cb(payload)   # await coroutines directly
                else:
                    cb(payload)         # call regular functions synchronously
            except Exception as exc:
                log.error("Listener '%s' raised: %s", event, exc)

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    async def start(self):
        """
        Start the heartbeat watchdog background task.

        Called once from server.py's FastAPI lifespan context at startup.
        The watchdog runs forever in the background, checking every 5 seconds
        whether any node has gone silent.
        """
        self._watchdog_task = asyncio.create_task(self._heartbeat_watchdog())
        log.info("[Agent1] Signal Receiver Agent started")

    async def stop(self):
        """
        Cancel the watchdog task cleanly on server shutdown.
        """
        if self._watchdog_task:
            self._watchdog_task.cancel()
        log.info("[Agent1] Signal Receiver Agent stopped")

    # ── Public entry points ───────────────────────────────────────────────────

    async def process_packet(self, raw_line: str) -> dict | None:
        """
        Parse and process a raw line from the serial bridge.

        The gateway firmware prefixes every forwarded JSON packet with "PKT:"
        so the server can distinguish sensor packets from debug log lines
        (which start with "[GW]").

        Parameters
        ----------
        raw_line : a full line read from the serial port, e.g.
                   'PKT:{"nid":1,"sec":"SEC-A","t":28.5,"h":72,"gas":340,...}'

        Returns
        -------
        The enriched reading dict, or None if the line was not a sensor packet
        or could not be parsed.
        """
        if not raw_line.startswith("PKT:"):
            # Not a sensor packet — probably a debug line from the gateway firmware
            return None

        json_str = raw_line[4:].strip()  # strip the "PKT:" prefix
        try:
            payload = json.loads(json_str)
        except json.JSONDecodeError as exc:
            # Corrupt packet — could be a partial transmission or baud rate mismatch
            self.error_count += 1
            await self._emit("error", {"type": "PARSE_ERROR", "raw": raw_line, "error": str(exc)})
            return None

        return await self.process_payload(payload)

    async def process_payload(self, raw: dict) -> dict | None:
        """
        Process a pre-parsed payload dict.

        Used by the /api/inject endpoint so developers can test the full
        pipeline without real hardware.

        Parameters
        ----------
        raw : dict with firmware field names (nid, t, h, gas, rssi, snr, sos …)
        """
        return await self._process(raw)

    # ── Core processing pipeline ──────────────────────────────────────────────

    async def _process(self, raw: dict) -> dict | None:
        """
        Run the full 8-step processing pipeline on one packet.

        Returns the enriched reading dict on success, or None on fatal error.
        """

        # ── Step 1: Extract and validate node ID ──────────────────────────────
        nid = int(raw.get("nid", 0))
        if nid < 1 or nid > 5:
            # Node IDs outside 1-5 are not part of the SEC-A deployment.
            # This guards against stray packets from other LoRa devices using
            # the same frequency and sync word.
            self.error_count += 1
            await self._emit("error", {"type": "INVALID_NODE", "raw": raw})
            return None

        # ── Step 2: Initialise state for first-time nodes ─────────────────────
        if nid not in self._nodes:
            self._nodes[nid] = NodeState(node_id=nid)
            # Notify server.py so it can log and broadcast the discovery event
            await self._emit("node_discovered", {"nodeId": nid})

        state = self._nodes[nid]

        # ── Step 3: Validate field ranges ─────────────────────────────────────
        # Returns cleaned values (with fallbacks) and a list of error strings.
        # We proceed even with validation errors — RSSI and timestamp are still
        # useful for location and heartbeat tracking.
        validated, errors = self._validate(raw)

        # ── Step 4: Kalman-filter each sensor value ────────────────────────────
        smooth_temp  = state.kalman_temp.update(validated["temperature"])
        smooth_humid = state.kalman_humid.update(validated["humidity"])
        smooth_gas   = state.kalman_gas.update(validated["gasPPM"])

        # ── Step 5: Anomaly detection ──────────────────────────────────────────
        anomalies = self._detect_anomalies(state, smooth_temp, smooth_gas, validated["rssi"])

        # ── Step 6: Classify signal quality and gas severity ──────────────────
        sig_quality = self._classify_signal(validated["rssi"])
        gas_level   = self._classify_gas(smooth_gas)

        # Simple temperature alert labels (more nuanced thresholds in alert_engine)
        temp_alert = (
            "HIGH_TEMP" if smooth_temp > TEMP_THRESHOLDS["WARNING"]
            else "LOW_TEMP" if smooth_temp < 5   # abnormally cold — sensor fault?
            else None
        )

        # ── Step 7: Update rolling window for trend analysis ───────────────────
        state.window.append({
            "t":    smooth_temp,
            "h":    smooth_humid,
            "gas":  smooth_gas,
            "rssi": validated["rssi"],
            "ts":   time.time(),
        })

        # ── Step 8: Update node state ─────────────────────────────────────────
        state.last_seen    = time.time()   # reset heartbeat timer
        state.rx_count    += 1
        state.lost_alerted = False         # node is back if it was previously lost
        self.processed_count += 1

        # ── Step 9: Build the enriched reading dict ────────────────────────────
        # This is the canonical data structure consumed by all downstream code.
        # Keys are camelCase to match the React dashboard's expected format.
        reading = {
            "nodeId":      nid,
            "section":     raw.get("sec", "UNKNOWN"),
            # Millisecond timestamps for JavaScript Date() compatibility
            "timestamp":   int(time.time() * 1000),
            "gwTimestamp": int(raw.get("gw_ts", 0)) * 1000,

            # Raw values — stored in DB for audit trail
            "raw": {
                "temperature": validated["temperature"],
                "humidity":    validated["humidity"],
                "gasPPM":      validated["gasPPM"],
                "rssi":        validated["rssi"],
                "snr":         validated["snr"],
            },

            # Smoothed values — what the dashboard and alert engine use
            "smoothed": {
                "temperature": smooth_temp,
                "humidity":    smooth_humid,
                "gasPPM":      smooth_gas,
            },

            # Trend direction for each sensor
            "trend": {
                "temperature": state.trend("t"),
                "humidity":    state.trend("h"),
                "gasPPM":      state.trend("gas"),
            },

            # Signal quality metadata
            "signal": {
                "rssi":         validated["rssi"],
                "snr":          validated["snr"],
                "quality":      sig_quality["label"],
                "qualityColor": sig_quality["color"],  # hex colour for dashboard
            },

            # Gas severity metadata
            "gasLevel": {
                "label":    gas_level["label"],
                "color":    gas_level["color"],
                "severity": gas_level["severity"],  # 0-3 integer
                "ppm":      smooth_gas,
            },

            # Alert flags — consumed by alert_engine and the dashboard
            "alerts": {
                "sos":              bool(raw.get("sos")),   # True = SOS button pressed
                "gasLevel":         gas_level["severity"],
                "tempAlert":        temp_alert,
                "anomalies":        anomalies,              # list of anomaly dicts
                "validationErrors": errors,                 # list of error strings
            },

            # Processing statistics
            # txCount comes from the raw firmware TX counter (not the agent's own count)
            # rxCount tracks how many packets the agent itself has processed for this node
            "stats": {
                "rxCount":        state.rx_count,
                "txCount":        int(raw.get("tx", raw.get("tx_count", 0))),
                "totalProcessed": self.processed_count,
            },
        }

        # ── Step 10: Fire events for downstream subscribers ────────────────────
        await self._emit("reading", reading)   # always fire — server.py handles all

        if reading["alerts"]["sos"]:
            await self._emit("sos", {
                "nodeId":  nid,
                "section": reading["section"],
                "reading": reading,
            })

        if gas_level["severity"] >= 2:   # WARNING or DANGER
            await self._emit("gas_alert", {
                "nodeId": nid,
                "level":  gas_level,
                "ppm":    smooth_gas,
            })

        if temp_alert:
            await self._emit("temp_alert", {
                "nodeId": nid,
                "alert":  temp_alert,
                "temp":   smooth_temp,
            })

        if anomalies:
            await self._emit("anomaly", {
                "nodeId":   nid,
                "anomalies": anomalies,
                "reading":  reading,
            })

        return reading

    # ── Validation ────────────────────────────────────────────────────────────

    def _validate(self, raw: dict) -> tuple[dict, list[str]]:
        """
        Extract and range-check all sensor fields from a raw packet dict.

        Firmware uses short field names (t, h, gas) to save LoRa airtime.
        This method accepts both the short names and the long names so the
        /api/inject endpoint can use human-readable keys.

        Returns
        -------
        tuple(validated_values, error_messages)
            validated_values : dict with float values and safe fallbacks applied
            error_messages   : list of human-readable strings (empty = all OK)
        """
        errors: list[str] = []

        def safe_float(val, fallback: float = 0.0) -> float:
            """Convert to float, return fallback if conversion fails."""
            try:
                return float(val)
            except (TypeError, ValueError):
                return fallback

        # Accept both firmware short names and long names
        temp  = safe_float(raw.get("t",   raw.get("temperature")), 25.0)
        humid = safe_float(raw.get("h",   raw.get("humidity")),    60.0)
        gas   = safe_float(raw.get("gas", raw.get("gasPPM")),       0.0)
        rssi  = safe_float(raw.get("rssi"), -120.0)
        snr   = safe_float(raw.get("snr"),    0.0)

        # Check each value against its physical bounds
        for name, value, (lo, hi) in [
            ("temperature", temp,  VALID["temperature"]),
            ("humidity",    humid, VALID["humidity"]),
            ("gasPPM",      gas,   VALID["gasPPM"]),
            ("rssi",        rssi,  VALID["rssi"]),
        ]:
            if not (lo <= value <= hi):
                errors.append(f"{name} out of range: {value} (expected {lo}–{hi})")

        return {
            "temperature": temp,
            "humidity":    humid,
            "gasPPM":      gas,
            "rssi":        rssi,
            "snr":         snr,
        }, errors

    # ── Anomaly detection ─────────────────────────────────────────────────────

    def _detect_anomalies(
        self,
        state: NodeState,
        temp: float,
        gas: float,
        rssi: float,
    ) -> list[dict]:
        """
        Apply four anomaly detectors to the current reading.

        Returns a list of anomaly dicts (empty = no anomalies).
        Each dict has at minimum a "type" key.

        Detectors:
            TEMP_SPIKE    — current temperature is > 3 standard deviations
                            from the rolling window mean, plus a 2 °C buffer.
                            The buffer prevents false positives when variance
                            is very small.

            GAS_SPIKE     — gas PPM changed by more than 200 PPM in a single
                            reading interval (~5 seconds).  This rate of change
                            is physically impossible for normal ventilation and
                            indicates either a gas pocket rupture or sensor fault.

            TEMP_FLATLINE — the last 5 temperature values are all within 0.1 °C
                            of each other.  A perfectly flat signal usually means
                            the DHT22 sensor has failed and is outputting its
                            last cached value repeatedly.

            GAS_FLATLINE  — same flatline logic for the gas sensor.

            RSSI_CLIFF    — RSSI dropped or jumped by more than 20 dBm in one
                            reading.  This can indicate the miner has moved
                            around a tunnel corner or the antenna has come loose.
        """
        anomalies: list[dict] = []

        # Need at least 3 readings in the window before anomaly detection is
        # meaningful — otherwise we have no baseline to compare against.
        if len(state.window) < 3:
            return anomalies

        temps = [w["t"]    for w in state.window]
        gases = [w["gas"]  for w in state.window]
        rssis = [w["rssi"] for w in state.window]

        # ── Temperature spike ─────────────────────────────────────────────────
        mean_t = sum(temps) / len(temps)
        # Population standard deviation (not sample) — we want the actual spread
        var_t  = sum((v - mean_t) ** 2 for v in temps) / len(temps)
        std_t  = math.sqrt(var_t) if var_t > 0 else 0.01   # avoid division by zero

        if abs(temp - mean_t) > 3 * std_t + 2.0:
            anomalies.append({
                "type":  "TEMP_SPIKE",
                "value": temp,
                "mean":  round(mean_t, 2),
                "std":   round(std_t, 2),
            })

        # ── Gas spike ─────────────────────────────────────────────────────────
        # Compare to the most recent window entry (last reading, before this one)
        if gases:
            delta_gas = gas - gases[-1]
            if abs(delta_gas) > 200:
                anomalies.append({
                    "type":    "GAS_SPIKE",
                    "delta":   round(delta_gas, 1),
                    "current": round(gas, 1),
                })

        # ── Flatline detection ────────────────────────────────────────────────
        if len(state.window) >= 5:
            last5_t = temps[-5:]
            # All 5 values within 0.1 °C of the first → sensor is stuck
            if all(abs(v - last5_t[0]) < 0.1 for v in last5_t):
                anomalies.append({"type": "TEMP_FLATLINE", "value": last5_t[0]})

            last5_g = gases[-5:]
            # All 5 values exactly equal → gas sensor is stuck (ADC frozen)
            if all(v == last5_g[0] for v in last5_g):
                anomalies.append({"type": "GAS_FLATLINE", "value": last5_g[0]})

        # ── RSSI cliff ────────────────────────────────────────────────────────
        if rssis:
            delta_rssi = rssi - rssis[-1]
            if abs(delta_rssi) > 20:
                anomalies.append({
                    "type":    "RSSI_CLIFF",
                    "delta":   round(delta_rssi, 1),
                    "current": round(rssi, 1),
                })

        return anomalies

    # ── Classifiers ───────────────────────────────────────────────────────────

    @staticmethod
    def _classify_signal(rssi: float) -> dict:
        """
        Map an RSSI value to a labelled quality band.

        Iterates the SIGNAL_QUALITY list (ordered best → worst) and returns
        the first band whose rssi_min threshold is met.

        Parameters
        ----------
        rssi : received signal strength in dBm (negative number)
        """
        for q in SIGNAL_QUALITY:
            if rssi >= q["rssi_min"]:
                return q
        # Should never reach here because the last entry has rssi_min=-999,
        # but return it as a safe fallback anyway.
        return SIGNAL_QUALITY[-1]

    @staticmethod
    def _classify_gas(ppm: float) -> dict:
        """
        Map a gas PPM value to a severity band.

        Iterates GAS_LEVELS (SAFE → DANGER) and returns the first band whose
        ppm_max the reading does NOT exceed.

        Parameters
        ----------
        ppm : smoothed gas concentration in parts-per-million
        """
        for g in GAS_LEVELS:
            if ppm <= g["ppm_max"]:
                return g
        return GAS_LEVELS[-1]   # ppm > 9999 — return DANGER as fallback

    # ── Heartbeat watchdog ────────────────────────────────────────────────────

    async def _heartbeat_watchdog(self):
        """
        Background task: check every 5 seconds whether any known node has
        gone silent for longer than HEARTBEAT_TIMEOUT_S.

        When a node is detected as lost:
            1. state.lost_alerted is set True to prevent duplicate events
            2. A "node_lost" event is emitted with the silence duration

        The lost_alerted flag is reset in _process() the moment a new packet
        arrives from that node, so the watchdog will fire again if silence
        recurs.

        The 5-second poll interval means worst-case detection latency is
        HEARTBEAT_TIMEOUT_S + 5 seconds.  This is acceptable for mine safety
        (the threshold is 30 s, so detection happens within 35 s).
        """
        while True:
            await asyncio.sleep(5)   # poll every 5 seconds
            now = time.time()
            for nid, state in self._nodes.items():
                if state.last_seen and not state.lost_alerted:
                    silence_s = now - state.last_seen
                    if silence_s > HEARTBEAT_TIMEOUT_S:
                        state.lost_alerted = True   # prevent duplicate firing
                        await self._emit("node_lost", {
                            "nodeId":     nid,
                            "silenceSec": int(silence_s),
                            "lastSeen":   state.last_seen,  # Unix timestamp
                        })

    # ── Status export ─────────────────────────────────────────────────────────

    def get_status(self) -> dict:
        """
        Return a snapshot of the agent's current state.

        Called by GET /api/status so operators can verify Agent 1 is running
        and see which nodes are currently considered online.

        Returns
        -------
        dict with keys:
            nodes          — per-node dict with lastSeen, rxCount, online bool
            processedTotal — lifetime total of successfully processed packets
            errors         — lifetime total of parse/validation errors
        """
        now   = time.time()
        nodes = {}
        for nid, s in self._nodes.items():
            nodes[nid] = {
                "nodeId":   nid,
                "lastSeen": s.last_seen,
                "rxCount":  s.rx_count,
                # online = heard within the heartbeat timeout window
                "online": (
                    s.last_seen is not None
                    and (now - s.last_seen) < HEARTBEAT_TIMEOUT_S
                ),
            }
        return {
            "nodes":          nodes,
            "processedTotal": self.processed_count,
            "errors":         self.error_count,
        }


# ── Module-level singleton ────────────────────────────────────────────────────
# Instantiated once when the module is first imported.
# server.py calls signal_agent.start() inside the FastAPI lifespan.
# agents/__init__.py re-exports this so callers can write:
#     from agents import signal_agent
signal_agent = SignalAgent()
