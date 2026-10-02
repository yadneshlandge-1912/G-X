"""
routes/api.py — REST API Route Definitions
==========================================
ROLE IN THE SYSTEM
------------------
This module defines every HTTP endpoint the backend exposes.  It is mounted
into the FastAPI app in server.py with the "/api" prefix:

    app.include_router(api_router, prefix="/api")

so every route here is reachable at  http://localhost:3001/api/<path>.

DESIGN PRINCIPLES
-----------------
Route handlers are kept intentionally thin:
    • Input validation is handled by Pydantic models (FastAPI does this
      automatically when you type-annotate parameters).
    • Business logic lives in agents and services — route handlers just
      call those and return the result.
    • All responses are plain dicts; FastAPI serialises them to JSON.

FastAPI auto-generates interactive Swagger UI documentation at /docs and
ReDoc at /redoc — no extra work needed.  This is especially useful on a
Raspberry Pi where there is no IDE available to explore the API.

REQUEST.APP.STATE
-----------------
server.py stores mutable shared objects (serial_bridge, alert_engine,
start_time) on app.state during the lifespan startup.  Route handlers
access them via the `request` parameter:
    bridge = request.app.state.serial_bridge
"""
from __future__ import annotations

import time
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Any

import models.db as db                     # all database helpers
from agents.signal_agent   import signal_agent    # AI Agent 1 singleton
from agents.location_agent import location_agent  # AI Agent 2 singleton

# Create the router that server.py will mount.
# All routes defined on this router get the "/api" prefix automatically.
router = APIRouter()


# ── GET /api/status ────────────────────────────────────────────────────────────
@router.get("/status")
async def get_status(request: Request):
    """
    Return a health snapshot of the entire backend.

    Includes:
        gateway  — serial port connection state and packet count
        agent1   — signal agent processed/error counts and per-node online status
        agent2   — location agent tracker count and per-node last position
        uptime   — seconds since server started
        ts       — current Unix timestamp in milliseconds

    Used by the dashboard header to show the LIVE / OFFLINE indicator.
    """
    bridge = getattr(request.app.state, "serial_bridge", None)
    syncer = getattr(request.app.state, "syncer", None)
    return {
        "ok":      True,
        "gateway": bridge.get_status() if bridge else {},
        "agent1":  signal_agent.get_status(),
        "agent2":  location_agent.get_status(),
        "supabase": syncer.get_status() if syncer else {"enabled": False},
        "uptime":  time.time() - request.app.state.start_time,
        "ts":      int(time.time() * 1000),
    }


# ── GET /api/nodes ─────────────────────────────────────────────────────────────
@router.get("/nodes")
async def get_nodes():
    """
    Return the most recent enriched reading for every node that has ever
    transmitted.

    This is the primary data source for the dashboard's five node cards.
    The response includes raw readings, Kalman-smoothed values, signal
    quality, gas severity, and the latest location estimate — all in one
    query thanks to the LEFT JOINs in db.latest_per_node().

    Returns an empty list if no packets have been received yet (e.g. server
    just started and nodes have not transmitted).
    """
    try:
        rows = db.latest_per_node()
        return {"ok": True, "nodes": rows, "ts": int(time.time() * 1000)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /api/nodes/{node_id}/history ──────────────────────────────────────────
@router.get("/nodes/{node_id}/history")
async def get_node_history(node_id: int, limit: int = 100):
    """
    Return the N most recent raw readings for one specific node.

    Used by the History page to populate the multi-metric trend chart.
    The `limit` query parameter defaults to 100 but is capped at 500 to
    prevent accidentally large responses.

    Parameters (path / query)
    -------------------------
    node_id : int, 1–5 — which miner node to query
    limit   : int, default 100, max 500 — how many readings to return

    Raises 400 if node_id is outside 1–5.
    """
    if node_id < 1 or node_id > 5:
        raise HTTPException(
            status_code=400,
            detail="node_id must be between 1 and 5 inclusive",
        )
    limit = min(500, max(1, limit))   # clamp to [1, 500]
    rows  = db.readings_for_node(node_id, limit)
    return {"ok": True, "nodeId": node_id, "readings": rows}


# ── GET /api/alerts ────────────────────────────────────────────────────────────
@router.get("/alerts")
async def get_alerts():
    """
    Return all unacknowledged alerts, newest first.

    Acknowledged alerts (dismissed by the operator) are excluded from the
    response.  They remain in the DB for audit purposes but do not appear
    in the dashboard panel.

    The dashboard alert panel polls this every time a new alert WebSocket
    event arrives, to get the full current list including the DB-persisted
    history (not just the one new alert from the WS event).
    """
    try:
        alerts = db.recent_alerts()
        return {"ok": True, "alerts": alerts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /api/alerts/{alert_id}/ack ────────────────────────────────────────────
@router.post("/alerts/{alert_id}/ack")
async def ack_alert(alert_id: int):
    """
    Acknowledge (dismiss) one alert by its database ID.

    Sets acknowledged=1 in the alerts table.  The alert disappears from
    the dashboard panel immediately (the dashboard removes it from local
    state on success response) but it remains in the DB for the audit trail.

    Parameters (path)
    -----------------
    alert_id : int — primary key of the alerts row to acknowledge
    """
    db.acknowledge_alert(alert_id)
    return {"ok": True, "id": alert_id}


# ── GET /api/stats ─────────────────────────────────────────────────────────────
@router.get("/stats")
async def get_stats():
    """
    Return aggregate statistics for the past 1 hour.

    Used by the dashboard stats strip (active nodes, total readings,
    average temperature, max gas, SOS count).

    The 1-hour window means the numbers reflect current mine conditions,
    not all-time totals which would be misleading for a safety display.
    """
    try:
        stats = db.stats_overview()
        return {"ok": True, "stats": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /api/map ───────────────────────────────────────────────────────────────
@router.get("/map")
async def get_map():
    """
    Return all data needed to render the Mine Map page.

    Response includes:
        anchors   — ANCHOR_MAP from config (surveyed positions of all nodes)
        graph     — TUNNEL_GRAPH adjacency list (for drawing tunnel lines)
        locations — latest estimated position for each node from the DB

    The React MineMap component uses anchors + graph to draw the static
    tunnel layout, then overlays the live positions from locations.
    """
    anchors   = location_agent.get_anchor_map()
    graph     = location_agent.get_tunnel_graph()
    locations = db.latest_locations()
    return {"ok": True, "anchors": anchors, "graph": graph, "locations": locations}


# ── POST /api/inject ───────────────────────────────────────────────────────────

class InjectPayload(BaseModel):
    """
    Pydantic model for the /api/inject request body.

    FastAPI uses this to:
        1. Parse and validate the incoming JSON body automatically
        2. Return a 422 error with field-level details if validation fails
        3. Generate accurate OpenAPI schema in Swagger UI

    Field constraints mirror the VALID dict in signal_agent.py.
    The `ge` / `le` arguments set minimum/maximum allowed values.
    """
    nid:   int   = Field(...,    ge=1,   le=5,    description="Node ID (1-5)")
    sec:   str   = Field("SEC-A",                 description="Mine section label")
    t:     float = Field(25.0,   ge=-10, le=80,   description="Temperature °C")
    h:     float = Field(60.0,   ge=0,   le=100,  description="Humidity %")
    gas:   int   = Field(100,    ge=0,   le=9999, description="Gas PPM")
    sos:   int   = Field(0,      ge=0,   le=1,    description="SOS flag (0 or 1)")
    rssi:  int   = Field(-80,    ge=-140, le=0,   description="RSSI dBm")
    snr:   float = Field(5.0,                     description="SNR dB")
    tx:    int   = Field(0,                        description="TX counter")
    ts:    int   = Field(0,                        description="Node boot seconds")
    gw_ts: int   = Field(0,                        description="Gateway Unix timestamp")
    rx:    int   = Field(0,                        description="RX/ACK counter")


@router.post("/inject")
async def inject_packet(payload: InjectPayload):
    """
    Inject a synthetic packet directly into the processing pipeline.

    This endpoint feeds the payload through Agent 1 and Agent 2 exactly
    as if it had arrived from the real gateway over serial.  It is the
    primary way to test the system without hardware:

        curl -X POST http://localhost:3001/api/inject \\
          -H "Content-Type: application/json" \\
          -d '{"nid":1,"t":28.5,"h":72,"gas":350,"rssi":-85}'

    To test SOS:
        -d '{"nid":3,"t":30,"h":75,"gas":100,"rssi":-90,"sos":1}'

    Returns the enriched reading and location estimate so callers can
    verify the pipeline output without connecting to the WebSocket.
    """
    raw      = payload.model_dump()    # convert Pydantic model → plain dict
    enriched = await signal_agent.process_payload(raw)
    location = await location_agent.process_reading(enriched) if enriched else None
    return {"ok": True, "enriched": enriched, "location": location}


# ── GET /api/sync/pending ──────────────────────────────────────────────────────
@router.get("/sync/pending")
async def get_pending_sync():
    """
    Return the current state of the offline sync queue.

    The sync queue holds records waiting to be uploaded to a cloud API
    when internet connectivity becomes available.  This endpoint lets
    operators check how many records are backlogged.

    The response includes the first 10 pending items for inspection.
    The full count is always returned regardless.

    In a fully offline deployment this count will grow continuously —
    that is expected behaviour, not an error.
    """
    items = db.pending_sync(limit=100)
    return {"ok": True, "count": len(items), "items": items[:10]}


# ── GET /api/thresholds ────────────────────────────────────────────────────────
@router.get("/thresholds")
async def get_thresholds(request: Request):
    """
    Return all configured safety thresholds currently in use.

    Exposed so the dashboard can display exact threshold values next to
    sensor readings without hard-coding them in the React code.

    Also useful for mine safety officers who want to verify that the
    system is using the correct DGMS-aligned limits without reading code.
    """
    engine = getattr(request.app.state, "alert_engine", None)
    if engine:
        return {"ok": True, "thresholds": engine.get_thresholds()}
    return JSONResponse(
        status_code=503,
        content={"ok": False, "error": "Alert engine not initialised yet"},
    )


# ── POST /api/log-login ────────────────────────────────────────────────────────
class LoginEvent(BaseModel):
    username:     str
    name:         str | None = None
    role:         str | None = None
    device:       str | None = None
    logged_in_at: int | None = None

@router.post("/log-login")
async def log_login(event: LoginEvent, request: Request):
    """
    Record a user login event to SQLite and Supabase.
    Called by the frontend useAuthStore on every successful login.
    """
    import time
    conn = db.get_conn()
    # Ensure the login_events table exists
    conn.execute("""
        CREATE TABLE IF NOT EXISTS login_events (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            username     TEXT NOT NULL,
            name         TEXT,
            role         TEXT,
            device       TEXT,
            logged_in_at INTEGER NOT NULL,
            created_at   INTEGER NOT NULL DEFAULT (unixepoch())
        )
    """)
    conn.execute(
        "INSERT INTO login_events (username, name, role, device, logged_in_at) VALUES (?,?,?,?,?)",
        (event.username, event.name, event.role, event.device, event.logged_in_at or int(time.time()*1000))
    )
    conn.commit()

    # Push to Supabase if syncer is available
    syncer = getattr(request.app.state, 'syncer', None)
    if syncer and syncer.enabled:
        try:
            from supabase import create_client
            from config import SUPABASE_URL, SUPABASE_KEY
            client = create_client(SUPABASE_URL, SUPABASE_KEY)
            client.table('login_events').insert({
                'username':     event.username,
                'name':         event.name,
                'role':         event.role,
                'device':       (event.device or '')[:120],
                'logged_in_at': event.logged_in_at or int(time.time()*1000),
            }).execute()
        except Exception as exc:
            pass   # silent fail — login still works

    return {"ok": True}


# ── POST /api/auth/login ───────────────────────────────────────────────────────
import hashlib

# Hardcoded credentials as fallback (same as frontend seed)
_LOCAL_USERS = {
    'rajan.kumar':   {'password':'miner123',    'id':'u1',  'name':'Rajan Kumar',     'role':'miner',      'badge':'MN-001','shift':'Morning','section':'SEC-A','nodeId':1,   'phone':'9876543201','joined':'2024-01-10'},
    'deepak.singh':  {'password':'miner456',    'id':'u2',  'name':'Deepak Singh',    'role':'miner',      'badge':'MN-002','shift':'Morning','section':'SEC-A','nodeId':2,   'phone':'9876543202','joined':'2024-02-15'},
    'amit.verma':    {'password':'miner789',    'id':'u3',  'name':'Amit Verma',      'role':'miner',      'badge':'MN-003','shift':'Evening','section':'SEC-A','nodeId':3,   'phone':'9876543203','joined':'2024-03-20'},
    'suresh.pal':    {'password':'miner321',    'id':'u4',  'name':'Suresh Pal',      'role':'miner',      'badge':'MN-004','shift':'Evening','section':'SEC-A','nodeId':4,   'phone':'9876543204','joined':'2024-04-05'},
    'mohan.das':     {'password':'miner654',    'id':'u5',  'name':'Mohan Das',       'role':'miner',      'badge':'MN-005','shift':'Night',  'section':'SEC-A','nodeId':5,   'phone':'9876543205','joined':'2024-05-11'},
    'vikas.sharma':  {'password':'super123',    'id':'u6',  'name':'Vikas Sharma',    'role':'supervisor', 'badge':'SV-001','shift':'Morning','section':'SEC-A','nodeId':None,'phone':'9876543206','joined':'2023-06-01'},
    'priya.nair':    {'password':'super456',    'id':'u7',  'name':'Priya Nair',      'role':'supervisor', 'badge':'SV-002','shift':'Evening','section':'SEC-A','nodeId':None,'phone':'9876543207','joined':'2023-07-15'},
    'arjun.rescue':  {'password':'rescue123',   'id':'u8',  'name':'Arjun Meena',     'role':'rescue',     'badge':'RS-001','shift':'On-Call','section':'SEC-A','nodeId':None,'phone':'9876543208','joined':'2023-08-20'},
    'sunita.rescue': {'password':'rescue456',   'id':'u9',  'name':'Sunita Bose',     'role':'rescue',     'badge':'RS-002','shift':'On-Call','section':'SEC-A','nodeId':None,'phone':'9876543209','joined':'2023-09-01'},
    'admin':         {'password':'admin@mine1', 'id':'u10', 'name':'Admin Controller','role':'admin',      'badge':'AD-001','shift':'All',    'section':'ALL',  'nodeId':None,'phone':'9876543210','joined':'2023-01-01'},
}

class LoginRequest(BaseModel):
    username: str
    password: str
    device:   str | None = None

@router.post("/auth/login")
async def auth_login(req: LoginRequest, request: Request):
    """
    Authenticate a user and log the login event to Supabase.
    Returns user data on success, 401 on failure.
    """
    import time

    username = req.username.strip().lower()
    password = req.password

    # Check credentials against local store
    user = _LOCAL_USERS.get(username)
    if not user or user['password'] != password:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Build response (exclude password)
    user_data = {k: v for k, v in user.items() if k != 'password'}
    user_data['username'] = username
    user_data['loginAt'] = int(time.time() * 1000)

    # Log to Supabase
    syncer = getattr(request.app.state, 'syncer', None)
    if syncer and syncer.enabled:
        try:
            from supabase import create_client
            from config import SUPABASE_URL, SUPABASE_KEY
            client = create_client(SUPABASE_URL, SUPABASE_KEY)
            client.table('login_events').insert({
                'username':     username,
                'name':         user['name'],
                'role':         user['role'],
                'device':       (req.device or '')[:120],
                'logged_in_at': user_data['loginAt'],
            }).execute()
        except Exception:
            pass   # silent fail — login still works without Supabase

    return {"ok": True, "user": user_data}
