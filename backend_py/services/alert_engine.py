"""
services/alert_engine.py — Compliance Alert Engine
===================================================
ROLE IN THE SYSTEM
------------------
The alert engine sits between Agent 1 and the operator interface.  Every
enriched reading flows through here after Agent 1 produces it.  The engine
asks: "Does this reading require operator attention right now?"

If yes, it:
    1. Persists the alert to SQLite (so it survives a server restart)
    2. Broadcasts it over WebSocket to every connected dashboard client
    3. Logs it to the console with a coloured severity icon

If no (cooldown not yet expired), it silently drops the evaluation.

REGULATORY CONTEXT
------------------
Alert thresholds are aligned with the Directorate General of Mines Safety
(DGMS), India — specifically:
    • Coal Mines Regulations 2017, Regulation 167  (methane / gas)
    • Coal Mines Regulations 2017, Regulation 89   (temperature / wet-bulb)

The thresholds in config.py are deliberately MORE conservative than the
statutory DGMS limits to give early warning before the legal threshold is
crossed.  Never raise them above the DGMS limits without written DGMS approval.

DEDUPLICATION DESIGN
--------------------
Without deduplication, a gas reading of 1100 PPM would fire a new DANGER
alert every 5 seconds indefinitely.  The operator's screen would be flooded,
making it impossible to acknowledge anything.

The engine uses a simple dict keyed by "nodeId:alertType" to track when each
alert last fired.  A new alert of the same type for the same node is only
allowed once the cooldown window (from config.ALERT_COOLDOWN) has elapsed.

Why not deduplicate in the DB?  Because a DB round-trip on every reading
would add 2-5 ms latency.  The in-memory dict is O(1) and survives fine
between restarts because alert history is persistent in SQLite anyway.

BROADCAST DESIGN
----------------
The engine accepts a broadcast_fn at construction time (dependency injection).
This means the engine has no direct knowledge of WebSocket internals — it
just calls whatever function it was given.  In tests, this function is a
Mock so no actual WebSocket code runs.
"""
from __future__ import annotations

import time       # time.time() for cooldown timestamps
import logging
import asyncio    # iscoroutine check for the broadcast function
from typing import Callable, Awaitable

# Import thresholds from the single source of truth
from config import (
    GAS_THRESHOLDS,    # {"CAUTION": 300, "WARNING": 600, "DANGER": 1000}
    TEMP_THRESHOLDS,   # {"CAUTION": 33, "WARNING": 37, "CRITICAL": 40}
    HUMIDITY_HIGH,     # 90 % RH
    ALERT_COOLDOWN,    # per-type cooldown windows in seconds
)

# DB helpers — insert_alert writes the alert row; get_conn provides the connection
from models.db import insert_alert, get_conn

log = logging.getLogger("alert_engine")


# ── Alert type catalogue ──────────────────────────────────────────────────────
# Central registry of every alert type the engine can fire.
# Keys match the strings stored in the alerts.type column.
# severity: 1 = informational (green)
#           2 = warning       (yellow/orange)
#           3 = critical      (red — requires immediate action)
ALERT_DEFS: dict[str, dict] = {
    # ── Gas / air quality ─────────────────────────────────────────────────────
    "GAS_CAUTION": {
        "severity": 1,
        "msg": "Gas level elevated — increase monitoring frequency",
    },
    "GAS_WARNING": {
        "severity": 2,
        "msg": "Gas WARNING — check ventilation fans, prepare for evacuation",
    },
    "GAS_DANGER": {
        "severity": 3,
        # Below the DGMS statutory limit but enough to require evacuation
        "msg": "DANGER — gas exceeds safe limit, evacuate section immediately",
    },

    # ── Temperature ───────────────────────────────────────────────────────────
    "TEMP_CAUTION": {
        "severity": 1,
        "msg": "High temperature — enforce hydration breaks",
    },
    "TEMP_WARNING": {
        "severity": 2,
        "msg": "Temperature WARNING — reduce work intensity, deploy cooling",
    },
    "TEMP_CRITICAL": {
        "severity": 3,
        # DGMS Reg 89 wet-bulb limit is 33.5°C; this fires at dry-bulb 40°C
        "msg": "CRITICAL HEAT — stop all work immediately, evacuate section",
    },

    # ── Humidity ──────────────────────────────────────────────────────────────
    "HUMIDITY_HIGH": {
        "severity": 2,
        # High humidity reduces the body's ability to cool itself by sweating
        "msg": "Very high humidity — heat-stress risk, enforce rest periods",
    },

    # ── Node connectivity ─────────────────────────────────────────────────────
    "NODE_SILENT_WARN": {
        "severity": 2,
        # 30 s silence = 6 missed transmissions (nodes send every 5 s)
        "msg": "Node not responding — check radio link and miner status",
    },
    "NODE_SILENT_CRITICAL": {
        "severity": 3,
        # 120 s silence = 24 missed transmissions — miner may be incapacitated
        "msg": "CRITICAL: Node silent >2 min — possible entrapment or incapacitation",
    },

    # ── Emergency ─────────────────────────────────────────────────────────────
    "SOS": {
        "severity": 3,
        # Fired by the physical SOS button on the miner's node hardware
        "msg": "SOS ACTIVATED — miner requires immediate assistance",
    },

    # ── Sensor integrity ──────────────────────────────────────────────────────
    "ANOMALY": {
        "severity": 2,
        # Covers TEMP_SPIKE, GAS_SPIKE, TEMP_FLATLINE, GAS_FLATLINE, RSSI_CLIFF
        "msg": "Sensor anomaly detected — readings may be unreliable",
    },
}


class AlertEngine:
    """
    Evaluates enriched readings against safety thresholds and fires alerts.

    Parameters
    ----------
    broadcast_fn : async or sync callable that pushes a message dict to all
                   WebSocket clients.  Injected at construction so tests can
                   pass a Mock without starting a real WebSocket server.
                   Signature: broadcast_fn(msg: dict) -> None or Awaitable
    """

    def __init__(
        self,
        broadcast_fn: Callable[[dict], Awaitable | None] | None = None,
    ):
        # Default to a no-op lambda so the engine works even without a
        # WebSocket server (e.g. in unit tests that do not pass broadcast_fn)
        self.broadcast = broadcast_fn or (lambda _: None)

        # In-memory cooldown tracker: {"nodeId:alertType": last_fired_unix_ts}
        # This dict is the entire deduplication mechanism — if the key is
        # present and the elapsed time is less than the cooldown, the alert
        # is suppressed.  The dict grows by at most len(ALERT_DEFS) × 5 nodes
        # = ~55 entries, so memory usage is negligible.
        self._last_fired: dict[str, float] = {}

    # ── Primary evaluation method ─────────────────────────────────────────────

    async def evaluate(self, reading: dict) -> list[dict]:
        """
        Check one enriched reading against all applicable thresholds.

        Called by server.py's _on_reading() handler for every packet Agent 1
        produces.  Returns the list of alerts that actually fired (i.e. passed
        the cooldown check).  An empty list means everything is within limits.

        Parameters
        ----------
        reading : enriched reading dict from signal_agent._process()
                  Must have keys: nodeId, section, smoothed, alerts

        Returns
        -------
        list of alert dicts that fired this cycle (may be empty)
        """
        nid      = reading["nodeId"]
        smoothed = reading["smoothed"]   # Kalman-filtered sensor values
        alerts_  = reading["alerts"]     # flags set by Agent 1

        fired: list[dict] = []   # collect every alert that passes cooldown

        # ── 1. SOS — highest priority, checked first ──────────────────────────
        # The SOS flag is set by the firmware when the miner presses the
        # physical panic button.  It must always be reported, even if other
        # alerts are in cooldown.
        if alerts_["sos"]:
            a = await self._fire(
                nid, "SOS", 3,
                f"🚨 SOS from Node {nid} in section "
                f"{reading.get('section', '?')} — immediate response required",
                {"nodeId": nid, "section": reading.get("section")},
            )
            if a:
                fired.append(a)

        # ── 2. Gas levels — evaluate from most to least severe ────────────────
        # We check DANGER first so we don't fire CAUTION and DANGER simultaneously.
        # Only one gas alert fires per evaluation cycle.
        ppm = smoothed["gasPPM"]
        if ppm >= GAS_THRESHOLDS["DANGER"]:
            a = await self._fire(nid, "GAS_DANGER",  3,
                                 ALERT_DEFS["GAS_DANGER"]["msg"],  {"ppm": round(ppm, 1)})
        elif ppm >= GAS_THRESHOLDS["WARNING"]:
            a = await self._fire(nid, "GAS_WARNING", 2,
                                 ALERT_DEFS["GAS_WARNING"]["msg"], {"ppm": round(ppm, 1)})
        elif ppm >= GAS_THRESHOLDS["CAUTION"]:
            a = await self._fire(nid, "GAS_CAUTION", 1,
                                 ALERT_DEFS["GAS_CAUTION"]["msg"], {"ppm": round(ppm, 1)})
        else:
            a = None   # gas is safe — no alert
        if a:
            fired.append(a)

        # ── 3. Temperature — same most-to-least-severe ordering ───────────────
        temp = smoothed["temperature"]
        if temp >= TEMP_THRESHOLDS["CRITICAL"]:
            a = await self._fire(nid, "TEMP_CRITICAL", 3,
                                 ALERT_DEFS["TEMP_CRITICAL"]["msg"], {"temp": round(temp, 1)})
        elif temp >= TEMP_THRESHOLDS["WARNING"]:
            a = await self._fire(nid, "TEMP_WARNING",  2,
                                 ALERT_DEFS["TEMP_WARNING"]["msg"],  {"temp": round(temp, 1)})
        elif temp >= TEMP_THRESHOLDS["CAUTION"]:
            a = await self._fire(nid, "TEMP_CAUTION",  1,
                                 ALERT_DEFS["TEMP_CAUTION"]["msg"],  {"temp": round(temp, 1)})
        else:
            a = None
        if a:
            fired.append(a)

        # ── 4. Humidity ────────────────────────────────────────────────────────
        # A single threshold: ≥ HUMIDITY_HIGH (90 % RH) is always WARNING severity
        if smoothed["humidity"] >= HUMIDITY_HIGH:
            a = await self._fire(
                nid, "HUMIDITY_HIGH", 2,
                ALERT_DEFS["HUMIDITY_HIGH"]["msg"],
                {"humidity": round(smoothed["humidity"], 1)},
            )
            if a:
                fired.append(a)

        # ── 5. Sensor anomalies ────────────────────────────────────────────────
        # Agent 1 may have detected multiple anomalies in one reading
        # (e.g. both TEMP_SPIKE and RSSI_CLIFF).  We fire one ANOMALY alert
        # per anomaly, subject to cooldown — this avoids alert flooding while
        # still making sure each distinct anomaly type is reported.
        for anomaly in alerts_.get("anomalies", []):
            a = await self._fire(
                nid, "ANOMALY", 2,
                f"Sensor anomaly on Node {nid}: {anomaly.get('type', 'UNKNOWN')}",
                anomaly,   # pass the full anomaly dict as context data
            )
            if a:
                fired.append(a)

        return fired

    # ── Node-lost evaluation ──────────────────────────────────────────────────

    async def evaluate_node_lost(self, event: dict) -> dict | None:
        """
        Fire an alert when the heartbeat watchdog reports a silent node.

        Called by server.py's _on_node_lost() handler.  Uses two severity
        levels depending on how long the node has been silent:
            ≥ 120 s → NODE_SILENT_CRITICAL (severity 3, short cooldown)
            ≥  30 s → NODE_SILENT_WARN     (severity 2, longer cooldown)
            <  30 s → no alert (within normal packet loss tolerance)

        Parameters
        ----------
        event : dict from signal_agent's heartbeat watchdog with keys
                nodeId, silenceSec, lastSeen

        Returns
        -------
        The alert dict if one fired, or None if cooldown blocked it.
        """
        nid     = event["nodeId"]
        silence = event["silenceSec"]

        if silence >= 120:
            # 120 s = 24 missed packets — treat as possible entrapment
            return await self._fire(
                nid, "NODE_SILENT_CRITICAL", 3,
                f"CRITICAL: Node {nid} silent for {silence}s "
                "— possible entrapment or incapacitation",
                event,
            )
        elif silence >= 30:
            # 30 s = 6 missed packets — radio link problem or minor incident
            return await self._fire(
                nid, "NODE_SILENT_WARN", 2,
                f"Node {nid} has not been heard for {silence}s",
                event,
            )
        # Less than 30 s silence is within normal LoRa packet-loss tolerance
        return None

    # ── Core fire logic ───────────────────────────────────────────────────────

    async def _fire(
        self,
        node_id:    int,
        alert_type: str,
        severity:   int,
        message:    str,
        data:       dict,
    ) -> dict | None:
        """
        Attempt to fire one alert.  Returns the alert dict if it fired,
        or None if the cooldown suppressed it.

        This is the single choke-point through which every alert must pass.
        All deduplication, persistence, and broadcasting happen here.

        Parameters
        ----------
        node_id    : which miner node triggered the alert (1-5)
        alert_type : key from ALERT_DEFS, also stored in alerts.type column
        severity   : 1 / 2 / 3
        message    : human-readable string shown in the dashboard alert panel
        data       : additional context dict stored as JSON in alerts.data
        """
        # ── Cooldown check ────────────────────────────────────────────────────
        key      = f"{node_id}:{alert_type}"   # unique key per (node, alert type)
        now      = time.time()
        cooldown = ALERT_COOLDOWN.get(alert_type, 60)   # default 60 s if not listed

        if key in self._last_fired:
            elapsed = now - self._last_fired[key]
            if elapsed < cooldown:
                # Alert is still "hot" — suppress to avoid flooding the dashboard.
                # We do not log this; suppression should be invisible.
                return None

        # ── Record the firing time BEFORE doing I/O ────────────────────────────
        # Recording first means even if DB write fails, we will not spam the
        # operator with repeated alerts for the same condition.
        self._last_fired[key] = now

        # ── Build the alert dict ───────────────────────────────────────────────
        alert = {
            "nodeId":    node_id,
            "type":      alert_type,
            "severity":  severity,
            "message":   message,
            "data":      data,
            # Millisecond timestamp for JavaScript Date() compatibility in dashboard
            "timestamp": int(now * 1000),
        }

        # ── Persist to SQLite ─────────────────────────────────────────────────
        # Writing to the DB first means alerts are not lost even if the
        # WebSocket broadcast fails (e.g. no clients connected at that moment).
        try:
            conn = get_conn()
            insert_alert(conn, alert)
            conn.commit()
        except Exception as exc:
            # Log but do not re-raise — a DB error should not prevent the
            # broadcast from reaching currently connected dashboard clients.
            log.error("[AlertEngine] DB write failed for %s: %s", alert_type, exc)

        # ── Broadcast to WebSocket clients ────────────────────────────────────
        # The broadcast_fn is injected at construction time and is always
        # an async coroutine in production (ConnectionManager.broadcast).
        try:
            result = self.broadcast({"event": "alert", "payload": alert})
            if asyncio.iscoroutine(result):
                await result   # await if the broadcast fn is async
        except Exception as exc:
            log.error("[AlertEngine] Broadcast failed for %s: %s", alert_type, exc)

        # ── Console log with severity icon ────────────────────────────────────
        icon = "🔴" if severity == 3 else "🟡" if severity == 2 else "🟢"
        log.warning("%s [Node %s] %s | %s", icon, node_id, alert_type, message)

        return alert

    # ── Introspection helpers ─────────────────────────────────────────────────

    def get_thresholds(self) -> dict:
        """
        Return all configured thresholds in one dict.

        Exposed via GET /api/thresholds so the dashboard can display the
        exact values in use without hard-coding them in the frontend.
        """
        return {
            "gas":      GAS_THRESHOLDS,
            "temp":     TEMP_THRESHOLDS,
            "humidity": HUMIDITY_HIGH,
            "cooldown": ALERT_COOLDOWN,
        }
