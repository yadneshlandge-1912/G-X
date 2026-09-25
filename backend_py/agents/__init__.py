"""
agents/
=======
This package contains the two AI agents at the heart of the platform.

Why a package?
--------------
Python requires an __init__.py in every directory that is imported as a
module.  Without this file, `from agents.signal_agent import signal_agent`
in server.py would raise ModuleNotFoundError at startup.

What lives here?
----------------
signal_agent.py   — AI Agent 1
    Receives raw LoRa packets from the gateway, validates sensor ranges,
    smooths noisy readings with a Kalman filter, detects anomalies
    (spikes, flatlines, RSSI cliffs), classifies signal quality and gas
    severity, and fires async events that the rest of the system reacts to.

location_agent.py — AI Agent 2
    Converts the RSSI reported by Agent 1 into an estimated 2-D position
    using the log-distance path-loss model and a Sequential Importance
    Resampling (SIR) particle filter.  Also resolves the nearest tunnel
    anchor and computes the BFS shortest path back to the gateway.

Public singletons (import these in server.py):
----------------------------------------------
    from agents.signal_agent   import signal_agent
    from agents.location_agent import location_agent
"""

# Re-export the singletons so callers can do:
#   from agents import signal_agent, location_agent
from agents.signal_agent   import signal_agent    # noqa: F401
from agents.location_agent import location_agent  # noqa: F401
