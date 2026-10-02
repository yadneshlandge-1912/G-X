"""
services/
=========
This package contains infrastructure services that support the AI agents
but are not themselves AI logic.

Why a package?
--------------
Splitting these into a separate package keeps the agent code focused on
signal processing and location math.  Services deal with I/O concerns
(hardware serial, alert persistence, WebSocket broadcasting) that change
independently of the AI algorithms.

What lives here?
----------------
alert_engine.py
    Evaluates every enriched reading from Agent 1 against DGMS-aligned
    safety thresholds (Coal Mines Regulations 2017).  Deduplicates alerts
    using a per-(node, type) cooldown so operators are not flooded with
    repeated notifications.  Persists every fired alert to SQLite and
    broadcasts it over the WebSocket to connected dashboard clients.

serial_bridge.py
    Reads the stream of "PKT:{json}" lines that the gateway ESP32 sends
    over USB serial at 115200 baud.  Passes each line to Agent 1 via an
    async callback.  When no serial port is available (development PC,
    demo environment) it automatically falls back to a simulation mode
    that generates realistic sensor drift for all five nodes, including
    occasional gas spikes and SOS events.

Public surface:
--------------
    from services.alert_engine  import AlertEngine
    from services.serial_bridge import SerialBridge
"""

# Nothing to re-export at package level — callers import classes directly.
