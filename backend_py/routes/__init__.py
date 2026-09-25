"""
routes/
=======
This package contains all FastAPI route definitions (the REST API layer).

Why a separate package?
-----------------------
Keeping routes out of server.py means server.py stays focused on
application wiring (startup, shutdown, WebSocket, static files) while
this package handles the HTTP contract.  Adding a new API endpoint means
editing only api.py, not the server bootstrap code.

What lives here?
----------------
api.py
    A FastAPI APIRouter with the following endpoints:

    GET  /api/status              — server + agent health check
    GET  /api/nodes               — latest enriched reading per node (1-5)
    GET  /api/nodes/{id}/history  — rolling history for one node
    GET  /api/alerts              — all unacknowledged alerts
    POST /api/alerts/{id}/ack     — acknowledge (dismiss) one alert
    GET  /api/stats               — 1-hour aggregate (avg temp, max gas …)
    GET  /api/map                 — anchor positions + latest locations
    POST /api/inject              — inject a test packet without hardware
    GET  /api/sync/pending        — offline sync-queue status
    GET  /api/thresholds          — DGMS threshold values in use

    The router is mounted into the FastAPI app in server.py with:
        app.include_router(api_router, prefix="/api")

Public surface:
--------------
    from routes.api import router as api_router
"""

# Nothing to re-export at package level.
