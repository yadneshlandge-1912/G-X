"""
models/
=======
This package owns everything that touches persistent storage.

Why a package?
--------------
Separating storage concerns into their own package means the agents and
services never import sqlite3 directly — they call db.py helpers.  This
makes it trivial to swap the storage engine later (e.g. PostgreSQL for a
cloud deployment) without touching any agent code.

What lives here?
----------------
db.py
    - SQLite schema definition (5 tables, WAL mode for fast writes)
    - Thread-local connection pool (one connection per OS thread, safe
      for FastAPI's default threaded request handling)
    - All prepared-style query helpers: insert_reading, insert_alert,
      latest_per_node, readings_for_node, etc.
    - save_reading_transaction() — atomic write of raw reading +
      enriched reading + location + sync_queue entry in one commit.

Public surface (import these wherever DB access is needed):
-----------------------------------------------------------
    from models.db import (
        init_db,
        get_conn,
        save_reading_transaction,
        latest_per_node,
        recent_alerts,
        acknowledge_alert,
        stats_overview,
        latest_locations,
        pending_sync,
    )
"""

# Nothing to re-export at package level — callers use `from models.db import X`
