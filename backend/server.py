"""
server.py — FastAPI Application Entry Point
============================================
ROLE IN THE SYSTEM
------------------
This file is the "wiring diagram" of the entire backend.  It does not contain
any business logic — it imports every component and connects them together.

STARTUP SEQUENCE (inside the lifespan context)
----------------------------------------------
1. init_db()         — create SQLite tables/indexes if they do not exist
2. signal_agent.start() — start Agent 1's heartbeat watchdog background task
3. location_agent.start() — log Agent 2 is ready (no background task needed)
4. SerialBridge.start()   — begin reading from USB serial or simulation
5. FastAPI begins accepting HTTP and WebSocket connections

SHUTDOWN SEQUENCE
-----------------
1. signal_agent.stop() — cancel the heartbeat watchdog task
2. bridge.stop()       — cancel the serial reader / simulation task
3. FastAPI closes all connections

WEBSOCKET PROTOCOL
------------------
The dashboard connects to ws://localhost:3001/ws immediately on page load.
The server sends a "snapshot" event with the current DB state so the
dashboard shows data instantly (no waiting for the next live packet).
Thereafter, every new reading / alert / event is pushed as a JSON string.

Event types the server sends:
    snapshot         — full current state on first connect
    reading          — one enriched reading from Agent 1 (every ~5 s per node)
    alert            — one alert that just fired
    sos              — SOS button event (also included in reading.alerts)
    node_lost        — node went silent
    node_discovered  — first packet from a new node ID
    gateway_connected — serial port opened successfully

CONNECTION MANAGER
------------------
A simple set of active WebSocket connections.  When the server broadcasts,
it iterates the set and sends to each.  Dead connections are pruned
automatically when a send fails.

APP.STATE
---------
FastAPI's app.state is an attribute bag.  We store shared mutable objects
there so any route handler can access them via the `request` parameter
without global variables.  Objects stored:
    app.state.serial_bridge — SerialBridge instance
    app.state.alert_engine  — AlertEngine instance
    app.state.syncer        — SupabaseSyncer instance
    app.state.start_time    — float Unix timestamp of server start
"""
from __future__ import annotations

import asyncio
import json      # json.dumps for WebSocket message serialisation
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

import models.db as db
from agents.signal_agent    import signal_agent
from agents.location_agent  import location_agent
from services.alert_engine  import AlertEngine
from services.serial_bridge import SerialBridge
from services.supabase_syncer import SupabaseSyncer
from routes.api             import router as api_router
from config                 import HOST, PORT, SERIAL_PORT, BAUD_RATE, SIMULATION_MODE

# Configure logging format for all modules.
# Using %(name)s shows which module (signal_agent, alert_engine, etc.) logged each line.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("server")


# ── WebSocket connection manager ──────────────────────────────────────────────

class ConnectionManager:
    """
    Manages the set of active WebSocket connections from dashboard clients.

    Why a set, not a list?
        O(1) add and discard instead of O(n) remove.  More importantly,
        a set prevents the same WebSocket object being broadcast to twice
        if client code reconnects without the old connection being cleaned up.

    Thread safety:
        All WebSocket operations in FastAPI run in the same asyncio event loop,
        so no locking is needed — there is no concurrent access.
    """

    def __init__(self):
        self._clients: set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        """
        Accept the WebSocket handshake and register the client.

        Parameters
        ----------
        ws : the WebSocket object for this client connection
        """
        await ws.accept()   # complete the HTTP → WS upgrade
        self._clients.add(ws)
        log.info("[WS] Client connected — %d client(s) active", len(self._clients))

    def disconnect(self, ws: WebSocket):
        """
        Remove a client from the active set.

        Called from the except block of the WebSocket endpoint when the
        client disconnects (closes browser tab, navigates away, etc.).
        """
        self._clients.discard(ws)   # discard is safe even if ws is not in the set
        log.info("[WS] Client disconnected — %d client(s) remaining", len(self._clients))

    async def broadcast(self, msg: dict):
        """
        Send a JSON message to ALL currently connected clients.

        Iterates a copy of the set so we can safely modify self._clients
        (remove dead connections) while iterating.

        Dead connections are identified when send_text() raises any exception.
        They are added to a `dead` set and pruned after the iteration.

        Parameters
        ----------
        msg : dict — will be JSON-serialised before sending.
              default=str handles datetime objects and other non-serialisable types.
        """
        data = json.dumps(msg, default=str)
        dead: set[WebSocket] = set()

        for ws in set(self._clients):   # iterate a snapshot copy
            try:
                await ws.send_text(data)
            except Exception:
                # Connection was closed without proper disconnect notification
                dead.add(ws)

        # Prune dead connections outside the loop
        self._clients -= dead

    async def send_snapshot(self, ws: WebSocket):
        """
        Push the current database state to a newly connected client.

        Called immediately after a client connects so the dashboard renders
        instantly with real data instead of showing loading spinners.

        The snapshot event contains all five nodes' latest readings.
        Subsequent live updates arrive as individual "reading" events.
        """
        try:
            nodes = db.latest_per_node()
            await ws.send_text(json.dumps(
                {
                    "event":   "snapshot",
                    "payload": {"nodes": nodes, "ts": int(time.time() * 1000)},
                },
                default=str,
            ))
        except Exception as exc:
            log.warning("[WS] Failed to send snapshot to new client: %s", exc)


# Singleton manager shared across all route handlers and the lifespan context
manager = ConnectionManager()


# ── Broadcast helper (sync-compatible wrapper) ────────────────────────────────

async def broadcast(msg: dict):
    """
    Thin async wrapper around manager.broadcast().

    This exists so it can be passed as broadcast_fn to AlertEngine.
    AlertEngine needs a callable — passing manager.broadcast directly would
    work too, but an explicit wrapper is clearer when reading server.py.
    """
    await manager.broadcast(msg)


# ── Instantiate the alert engine ──────────────────────────────────────────────
# Created at module level so server.py's event handlers can reference it.
# broadcast is injected here so the engine never imports WebSocket code directly.
alert_engine = AlertEngine(broadcast_fn=broadcast)

# ── Instantiate the Supabase syncer ───────────────────────────────────────────
# Disabled automatically when SUPABASE_URL/KEY are not set in .env.
# broadcast is passed so the syncer can push a "sync_complete" WS event.
syncer = SupabaseSyncer(on_sync_status=broadcast)


# ── Agent 1 event handlers ────────────────────────────────────────────────────
# These async functions are registered with signal_agent.on() inside the
# lifespan startup.  Agent 1 calls them via _emit() for every event.

async def _on_reading(reading: dict):
    """
    Handle every enriched reading from Agent 1.

    This is the most frequently called handler — once per node per 5 seconds.
    It performs three jobs:
        1. Feed Agent 2 (location estimation)
        2. Persist to SQLite (offline-first storage)
        3. Broadcast to WebSocket clients (live dashboard update)

    The alert engine is also called here so every reading is checked against
    safety thresholds in real time.
    """
    # ── Feed Agent 2 for location estimation ─────────────────────────────────
    # Agent 2 returns None if it does not yet have enough data for a position
    # estimate (before its RSSI store has accumulated 1+ readings).
    location = await location_agent.process_reading(reading)

    # ── Persist to SQLite in thread pool (non-blocking) ──────────────────────
    try:
        raw_dict = {
            "nid":   reading["nodeId"],
            "sec":   reading["section"],
            "t":     reading["raw"]["temperature"],   # raw (pre-Kalman) values
            "h":     reading["raw"]["humidity"],
            "gas":   reading["raw"]["gasPPM"],
            "rssi":  reading["raw"]["rssi"],
            "snr":   reading["raw"]["snr"],
            "sos":   1 if reading["alerts"]["sos"] else 0,
            "tx":    reading["stats"]["txCount"],   # firmware TX counter
            "rx":    reading["stats"]["rxCount"],   # agent-side RX counter
            "ts":    reading["timestamp"] // 1000,     # ms → s
            "gw_ts": reading["gwTimestamp"] // 1000,
        }
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: db.save_reading_transaction(
                raw=raw_dict,
                enriched=reading,
                location=location,
            ),
        )
    except Exception as exc:
        log.error("[DB] save_reading_transaction failed: %s", exc)

    # ── Run alert evaluation ──────────────────────────────────────────────────
    # alert_engine.evaluate() fires alerts, persists them, and broadcasts them.
    # We do not need to handle its return value here — it broadcasts internally.
    await alert_engine.evaluate(reading)

    # ── Broadcast live reading to dashboard ───────────────────────────────────
    # We send only the fields the dashboard needs (not the full enriched dict)
    # to keep WebSocket messages small.
    await manager.broadcast({
        "event": "reading",
        "payload": {
            "nodeId":   reading["nodeId"],
            "section":  reading["section"],
            "smoothed": reading["smoothed"],   # Kalman-filtered values
            "signal":   reading["signal"],     # RSSI, SNR, quality label
            "gasLevel": reading["gasLevel"],   # label, severity, colour
            "trend":    reading["trend"],      # RISING/STABLE/FALLING per sensor
            "alerts":   reading["alerts"],     # sos flag, anomaly list
            # Summarise location to keep the WS payload lean
            "location": {
                "position":   location["position"],
                "distFromGW": location["distanceFromGateway"]["estimated"],
                "nearest":    location["nearestAnchor"],
                "confidence": location["confidence"],
                "depth":      location["depth"],
            } if location else None,
            "ts": reading["timestamp"],
        },
    })


async def _on_node_lost(event: dict):
    """
    Handle a heartbeat timeout from Agent 1's watchdog.

    Triggers the alert engine (which fires NODE_SILENT_WARN or
    NODE_SILENT_CRITICAL depending on silence duration) and broadcasts
    a node_lost event so the dashboard can grey out that node's card.
    """
    await alert_engine.evaluate_node_lost(event)
    await manager.broadcast({"event": "node_lost", "payload": event})


async def _on_node_discovered(event: dict):
    """
    Handle first contact from a new node ID.

    Broadcasts the event so the dashboard can add a new node card if it
    was not previously visible.
    """
    await manager.broadcast({"event": "node_discovered", "payload": event})
    log.info("[Agent1] New node discovered: Node %s", event["nodeId"])


async def _on_sos(event: dict):
    """
    Handle an SOS button press from any miner node.

    Broadcasts a dedicated "sos" event (in addition to the "reading" event
    that was already sent) so the dashboard can trigger its SOS audio alert
    and red banner without waiting for the next polling cycle.
    """
    await manager.broadcast({"event": "sos", "payload": event})
    log.critical(
        "[🚨 SOS] Node %s in section %s — IMMEDIATE RESPONSE REQUIRED",
        event["nodeId"],
        event.get("section", "UNKNOWN"),
    )

async def _on_anomaly(event: dict):
    """
    Handle an anomaly detection event from Agent 1.

    Anomalies are already included in the "reading" WS event and evaluated
    by the alert engine (which fires an ANOMALY alert if cooldown allows).
    This handler just logs them for the server console.
    """
    log.warning(
        "[Agent1] Anomaly on Node %s: %s",
        event["nodeId"],
        [a.get("type") for a in event.get("anomalies", [])],
    )


# ── Serial bridge packet handler ──────────────────────────────────────────────

async def _on_gateway_status(status: dict):
    """Broadcast gateway connect/disconnect event to all dashboard clients."""
    await manager.broadcast({"event": "gateway_connected", "payload": status})
    if status.get("connected"):
        log.info("[GW] ✅ Receiver CONNECTED on port %s", status.get("port"))
    else:
        log.warning("[GW] ❌ Receiver DISCONNECTED")


async def _on_serial_line(line: str):
    """
    Receive one raw line from the serial bridge and hand it to Agent 1.
    Agent 1's process_packet() filters for "PKT:" prefix before processing.
    """
    await signal_agent.process_packet(line)


# ── FastAPI lifespan ──────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan context manager.

    Code before `yield` runs at STARTUP.
    Code after  `yield` runs at SHUTDOWN.

    Using a single lifespan function (instead of on_event decorators) is
    the modern FastAPI pattern — it keeps startup and shutdown code together
    and is compatible with testing frameworks that need to control lifecycle.
    """
    # ── STARTUP ───────────────────────────────────────────────────────────────

    # 1. Initialise the SQLite database (creates file and tables if missing)
    db.init_db()

    # 2. Register Agent 1 event handlers BEFORE starting the agent so no
    #    events are missed during the brief window between start() and
    #    handler registration.
    signal_agent.on("reading",         _on_reading)
    signal_agent.on("node_lost",       _on_node_lost)
    signal_agent.on("node_discovered", _on_node_discovered)
    signal_agent.on("sos",             _on_sos)
    signal_agent.on("anomaly",         _on_anomaly)

    # 3. Start Agent 1 (launches heartbeat watchdog background task)
    await signal_agent.start()

    # 4. Start Agent 2 (logs ready message; no background task needed)
    location_agent.start()

    # 5. Create and start the serial bridge
    #    SERIAL_PORT = None → simulation mode (no hardware needed)
    bridge = SerialBridge(
        port=SERIAL_PORT,
        baud=BAUD_RATE,
        on_line=_on_serial_line,
        on_status_change=_on_gateway_status,
    )
    bridge.start()

    # 6. Store shared objects on app.state for route handlers to access
    app.state.serial_bridge = bridge
    app.state.alert_engine  = alert_engine
    app.state.syncer        = syncer
    app.state.start_time    = time.time()

    # 7. Start the Supabase syncer (no-op if credentials not set in .env)
    syncer.start()

    _print_banner()
    yield   # server is now running — FastAPI handles requests

    # ── SHUTDOWN ──────────────────────────────────────────────────────────────
    await signal_agent.stop()   # cancel heartbeat watchdog
    bridge.stop()               # cancel serial reader / simulation
    syncer.stop()               # cancel cloud sync task
    log.info("[Server] Shutdown complete")


# ── FastAPI application ────────────────────────────────────────────────────────

app = FastAPI(
    title="CoalMine LoRa+AI Monitor",
    description=(
        "Offline-first underground coal mine monitoring platform. "
        "5 miner nodes, 1 gateway, 2 AI agents. "
        "No internet required."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Allow the React dev server (port 5173) and production build (port 3000)
# to make API and WebSocket requests.  The wildcard "*" would also work but
# explicit origins are more secure.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the REST API routes under /api
app.include_router(api_router, prefix="/api")


# ── WebSocket endpoint ─────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    """
    Single persistent WebSocket endpoint for the dashboard.

    Protocol:
        1. Client connects → server sends "snapshot" with current DB state
        2. Server pushes events whenever new data arrives
        3. Client may send any text (currently ignored) to keep connection alive

    The try/except handles both normal disconnection (WebSocketDisconnect)
    and unexpected errors (network drop, etc.) gracefully.
    """
    await manager.connect(ws)

    # Send the current state immediately so the dashboard renders without waiting
    await manager.send_snapshot(ws)

    try:
        while True:
            # We do not expect the dashboard to send messages in this protocol.
            # receive_text() just keeps the connection alive and raises
            # WebSocketDisconnect when the client closes the tab.
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception:
        # Any unexpected error — clean up the connection
        manager.disconnect(ws)


# ── Serve React dashboard (production build) ──────────────────────────────────
# In development the React dev server (port 5173) serves the dashboard.
# In production (after `npm run build`), the built files are in dashboard/dist.
# We mount them on the FastAPI app so one process serves everything.

DASH_DIST = Path(__file__).parent.parent / "frontend" / "dist"
if DASH_DIST.exists() and (DASH_DIST / "assets").exists():
    # Serve the static asset files (JS bundles, CSS, images)
    app.mount(
        "/assets",
        StaticFiles(directory=str(DASH_DIST / "assets")),
        name="assets",
    )

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        """
        Catch-all route that serves index.html for every non-API path.

        This implements the Single-Page Application (SPA) routing pattern:
        React Router handles navigation in the browser, but every URL that
        a user types or refreshes must serve the same index.html so React
        can boot up and render the correct page.

        include_in_schema=False hides this route from Swagger UI.
        """
        return FileResponse(str(DASH_DIST / "index.html"))


# ── Console banner ─────────────────────────────────────────────────────────────

def _print_banner():
    """Print the startup banner to the console."""
    print("\n" + "=" * 55)
    print("  COAL MINE LoRa+AI BACKEND (Python / FastAPI)")
    print(f"  API  : http://{HOST}:{PORT}/api")
    print(f"  WS   : ws://{HOST}:{PORT}/ws")
    print(f"  Docs : http://{HOST}:{PORT}/docs")
    print(f"  DB   : {db.DB_PATH}")
    print("=" * 55 + "\n")


# ── Script entry point ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Run with uvicorn when executed directly: `python server.py`
    # For production, prefer: `uvicorn server:app --host 0.0.0.0 --port 3001`
    import uvicorn
    uvicorn.run(
        "server:app",
        host=HOST,
        port=PORT,
        reload=False,      # reload=True is handy in dev but breaks asyncio tasks
        log_level="info",
    )
