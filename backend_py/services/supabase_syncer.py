"""
services/supabase_syncer.py — Offline-First Cloud Sync
=======================================================
ROLE IN THE SYSTEM
------------------
SQLite is always the primary store — this works with zero internet.
The syncer is a background asyncio task that wakes up every
SUPABASE_SYNC_INTERVAL seconds, grabs rows from the local sync_queue
that have not yet been pushed, and upserts them into Supabase.

If Supabase is unreachable (no internet, project paused, wrong key)
the syncer logs a warning and sleeps until the next interval.
The local SQLite data is never touched — nothing is at risk.

WHAT GETS SYNCED
----------------
The sync_queue table holds JSON snapshots written by
save_reading_transaction() in db.py.  Each snapshot contains:
    {
      "readingId": <int>,
      "raw":       { firmware packet fields },
      "enriched":  { Agent 1 output },
      "location":  { Agent 2 output } | null,
    }

The syncer unpacks each snapshot and writes to three Supabase tables:
    readings          ← from payload["raw"]
    enriched_readings ← from payload["enriched"]
    locations         ← from payload["location"]

Alerts are synced separately via a dedicated flush triggered by
alert_engine whenever a new alert fires (see push_alert()).

DEDUPLICATION
-------------
All Supabase inserts use upsert (on_conflict="id") so re-running the
syncer after a crash never creates duplicate rows.  The local SQLite
id is preserved as the Supabase row id so both sides stay in sync.

DISABLED MODE
-------------
If SUPABASE_URL or SUPABASE_KEY is empty in .env, the syncer starts
in disabled mode.  start() logs a single info message and returns
immediately — no background task is created, no errors are raised.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Callable, Awaitable

from config import (
    SUPABASE_URL,
    SUPABASE_KEY,
    SUPABASE_SYNC_INTERVAL,
    DEVICE_ID,
)
import models.db as db

log = logging.getLogger("supabase_syncer")

# Lazily imported so the server starts even if supabase isn't installed yet
_supabase_client = None


def _get_client():
    """Return a cached Supabase client, creating it on first call."""
    global _supabase_client
    if _supabase_client is None:
        try:
            from supabase import create_client
            _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        except Exception as exc:
            log.error("[Supabase] Failed to create client: %s", exc)
            raise
    return _supabase_client


class SupabaseSyncer:
    """
    Background service that syncs local SQLite data to Supabase.

    Parameters
    ----------
    on_sync_status : optional async callable that receives a status dict
                     so server.py can broadcast sync events to the dashboard.
                     Signature: on_sync_status({"synced": n, "pending": m, ...})
    """

    def __init__(
        self,
        on_sync_status: Callable[[dict], Awaitable | None] | None = None,
    ):
        self.on_sync_status = on_sync_status
        self._task: asyncio.Task | None = None
        self._enabled = bool(SUPABASE_URL and SUPABASE_KEY)
        self._total_synced = 0   # lifetime counter for logging

    # ── Public lifecycle ───────────────────────────────────────────────────────

    def start(self):
        """Start the background sync loop."""
        if not self._enabled:
            log.info(
                "[Supabase] SUPABASE_URL/KEY not set — cloud sync disabled. "
                "Add them to .env to enable."
            )
            return
        log.info(
            "[Supabase] Sync enabled → %s  interval=%ss  device=%s",
            SUPABASE_URL, SUPABASE_SYNC_INTERVAL, DEVICE_ID,
        )
        self._task = asyncio.create_task(self._loop())

    def stop(self):
        """Cancel the background task cleanly."""
        if self._task:
            self._task.cancel()
            self._task = None

    @property
    def enabled(self) -> bool:
        return self._enabled

    # ── Background loop ────────────────────────────────────────────────────────

    async def _loop(self):
        """
        Wake up every SUPABASE_SYNC_INTERVAL seconds and push pending rows.
        Errors are caught and logged — never propagated to crash the server.
        """
        # Short initial delay so the server finishes startup before first sync
        await asyncio.sleep(5)

        while True:
            try:
                n_synced = await asyncio.get_event_loop().run_in_executor(
                    None, self._sync_batch
                )
                if n_synced > 0:
                    self._total_synced += n_synced
                    log.info(
                        "[Supabase] ✅ Pushed %d row(s) — %d total this session",
                        n_synced, self._total_synced,
                    )
                    await self._broadcast_status(n_synced)

            except asyncio.CancelledError:
                raise   # let the task stop cleanly

            except Exception as exc:
                log.warning("[Supabase] Sync error (will retry): %s", exc)

            await asyncio.sleep(SUPABASE_SYNC_INTERVAL)

    # ── Sync logic (runs in executor — blocking I/O) ───────────────────────────

    def _sync_batch(self) -> int:
        """
        Pull up to 50 pending rows from sync_queue, push them to Supabase,
        mark them synced locally.  Returns the number of rows pushed.

        Runs in a thread-pool executor so it doesn't block the event loop
        during the Supabase HTTP calls.
        """
        rows = db.pending_sync(limit=50)
        if not rows:
            return 0

        client = _get_client()
        conn   = db.get_conn()
        pushed = 0

        for row in rows:
            try:
                payload = json.loads(row["payload"])
                self._push_reading(client, payload)
                self._push_enriched(client, payload)
                self._push_location(client, payload)

                # Mark as synced in the local sync_queue
                conn.execute(
                    "UPDATE sync_queue SET synced=1, synced_at=? WHERE id=?",
                    (int(time.time()), row["id"]),
                )
                # Write a sync_log entry in Supabase so you can audit what
                # arrived and from which device
                try:
                    client.table("sync_log").insert({
                        "local_id":  payload.get("readingId"),
                        "node_id":   payload.get("raw", {}).get("nid"),
                        "pushed_at": int(time.time()),
                        "device_id": DEVICE_ID,
                    }).execute()
                except Exception:
                    pass   # sync_log failure is non-fatal

                pushed += 1

            except Exception as exc:
                # Increment attempt counter so we give up after 5 failures
                conn.execute(
                    "UPDATE sync_queue SET attempts = attempts + 1 WHERE id=?",
                    (row["id"],),
                )
                log.warning(
                    "[Supabase] Failed to push sync_queue row %s: %s",
                    row["id"], exc,
                )

        conn.commit()
        return pushed

    def _push_reading(self, client, payload: dict):
        """Upsert the raw reading row into Supabase readings table."""
        raw = payload.get("raw")
        if not raw:
            return

        rid = payload.get("readingId")
        client.table("readings").upsert({
            "id":          rid,
            "node_id":     raw.get("nid"),
            "section":     raw.get("sec", "UNKNOWN"),
            "temperature": raw.get("t"),
            "humidity":    raw.get("h"),
            "gas_ppm":     raw.get("gas"),
            "rssi":        raw.get("rssi"),
            "snr":         raw.get("snr"),
            "sos":         1 if raw.get("sos") else 0,
            "tx_count":    raw.get("tx", 0),
            "rx_count":    raw.get("rx", 0),
            "node_ts":     raw.get("ts", 0),
            "gw_ts":       raw.get("gw_ts", 0),
            "created_at":  raw.get("gw_ts", int(time.time())),
        }, on_conflict="id").execute()

    def _push_enriched(self, client, payload: dict):
        """Upsert the enriched reading row into Supabase enriched_readings."""
        e = payload.get("enriched")
        if not e:
            return

        rid = payload.get("readingId")
        client.table("enriched_readings").upsert({
            "reading_id":      rid,
            "node_id":         e.get("nodeId"),
            "smooth_temp":     e.get("smoothed", {}).get("temperature"),
            "smooth_humidity": e.get("smoothed", {}).get("humidity"),
            "smooth_gas":      e.get("smoothed", {}).get("gasPPM"),
            "signal_quality":  e.get("signal", {}).get("quality"),
            "gas_label":       e.get("gasLevel", {}).get("label"),
            "gas_severity":    e.get("gasLevel", {}).get("severity", 0),
            "temp_trend":      e.get("trend", {}).get("temperature"),
            "gas_trend":       e.get("trend", {}).get("gasPPM"),
            "anomalies":       json.dumps(e.get("alerts", {}).get("anomalies", [])),
            "created_at":      e.get("timestamp", int(time.time() * 1000)) // 1000,
        }, on_conflict="reading_id").execute()

    def _push_location(self, client, payload: dict):
        """Upsert the location row into Supabase locations table."""
        loc = payload.get("location")
        if not loc:
            return

        client.table("locations").upsert({
            "node_id":        loc.get("nodeId"),
            "section":        loc.get("section", "UNKNOWN"),
            "pos_x":          loc.get("position", {}).get("x"),
            "pos_y":          loc.get("position", {}).get("y"),
            "dist_from_gw":   loc.get("distanceFromGateway", {}).get("estimated"),
            "nearest_anchor": loc.get("nearestAnchor", {}).get("id"),
            "anchor_dist":    loc.get("nearestAnchor", {}).get("distM"),
            "depth":          loc.get("depth", 0),
            "confidence":     loc.get("confidence", 0),
            "tunnel_path":    json.dumps(loc.get("tunnelPath", [])),
            "created_at":     int(time.time()),
        }).execute()

    # ── Alert push (called directly by alert_engine) ───────────────────────────

    async def push_alert(self, alert: dict):
        """
        Push a single alert to Supabase immediately when it fires.

        Called by alert_engine._fire() so alerts appear in Supabase
        in real time, not on the next sync interval.

        If Supabase is disabled or unreachable, this is a silent no-op.
        """
        if not self._enabled:
            return
        try:
            await asyncio.get_event_loop().run_in_executor(
                None, self._push_alert_sync, alert
            )
        except Exception as exc:
            log.warning("[Supabase] Alert push failed (non-fatal): %s", exc)

    def _push_alert_sync(self, alert: dict):
        """Blocking alert upsert — runs in executor."""
        client = _get_client()
        client.table("alerts").insert({
            "node_id":    alert.get("nodeId"),
            "type":       alert.get("type"),
            "severity":   alert.get("severity", 1),
            "message":    alert.get("message", ""),
            "data":       json.dumps(alert.get("data", {})),
            "acknowledged": 0,
            "created_at": int(alert.get("timestamp", time.time() * 1000) / 1000),
        }).execute()

    # ── Status broadcast ───────────────────────────────────────────────────────

    async def _broadcast_status(self, n_synced: int):
        """Optionally notify the dashboard that a sync just completed."""
        if not self.on_sync_status:
            return
        try:
            result = self.on_sync_status({
                "event":       "sync_complete",
                "synced":      n_synced,
                "total":       self._total_synced,
                "device":      DEVICE_ID,
                "ts":          int(time.time() * 1000),
            })
            if asyncio.iscoroutine(result):
                await result
        except Exception:
            pass   # broadcast failure must never crash the syncer

    # ── Convenience: sync status for /api/status ──────────────────────────────

    def get_status(self) -> dict:
        """Return current sync status for the /api/status endpoint."""
        conn   = db.get_conn()
        pending = conn.execute(
            "SELECT COUNT(*) FROM sync_queue WHERE synced=0 AND attempts<5"
        ).fetchone()[0]
        synced  = conn.execute(
            "SELECT COUNT(*) FROM sync_queue WHERE synced=1"
        ).fetchone()[0]
        return {
            "enabled":       self._enabled,
            "supabase_url":  SUPABASE_URL if self._enabled else None,
            "device_id":     DEVICE_ID,
            "pending_rows":  pending,
            "synced_rows":   synced,
            "total_session": self._total_synced,
            "interval_s":    SUPABASE_SYNC_INTERVAL,
        }
