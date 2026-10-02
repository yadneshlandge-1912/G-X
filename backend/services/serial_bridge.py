"""
services/serial_bridge.py — Gateway Serial Bridge
===================================================
ROLE IN THE SYSTEM
------------------
The gateway ESP32 connects to the Raspberry Pi (or laptop) via USB.  From
the OS's perspective it looks like a virtual serial port (COMx on Windows,
/dev/ttyUSBx on Linux).  The gateway firmware continuously writes lines in
the format:

    PKT:{"nid":1,"sec":"SEC-A","t":28.5,"h":72,"gas":340,...}

This class reads those lines asynchronously and forwards each one to Agent 1
via an `on_line` callback.

NON-BLOCKING DESIGN
-------------------
pyserial's readline() is a blocking call — it waits until a newline arrives.
Running it directly in an async function would freeze the entire event loop.
Instead, we run it in asyncio's thread pool executor:

    line = await loop.run_in_executor(None, ser.readline)

This moves the blocking readline() to a background OS thread while the event
loop stays free to handle WebSocket messages and API requests.

SIMULATION MODE (no hardware needed)
--------------------------------------
When SERIAL_PORT is None (the default in .env) OR pyserial is not installed,
the bridge switches to SIMULATION MODE automatically.  It generates synthetic
sensor readings for all five nodes using a random-walk drift model.

Why does simulation matter?
    • Developers without hardware can run the full stack immediately
    • Presentations can use realistic live-looking data without a mine
    • CI/CD pipelines can run integration tests without physical devices

The simulation injects occasional events to keep demos interesting:
    • Node 4 gets a gas spike 3 % of the time (simulates pocket rupture)
    • Node 3 gets an SOS 0.8 % of the time (simulates panic button press)

PACKET FORMAT
-------------
The gateway prefixes every forwarded JSON with "PKT:" so the bridge can
distinguish sensor packets from gateway debug log lines (which start with
"[GW]" and are silently ignored by Agent 1).
"""
from __future__ import annotations

import asyncio
import json
import logging
import random
import time
from typing import Callable, Awaitable

from config import SIMULATION_MODE   # new flag — default False

log = logging.getLogger("serial_bridge")

try:
    import serial
    SERIAL_AVAILABLE = True
except ImportError:
    serial = None
    SERIAL_AVAILABLE = False
    log.warning(
        "[SerialBridge] pyserial not installed. "
        "Install with:  pip install pyserial"
    )


# ── Simulation state initialiser ─────────────────────────────────────────────

def _make_sim_state(nid: int) -> dict:
    """
    Create a starting sensor state for one simulated node.

    Baseline values are offset by node ID so all five nodes look distinct
    on the dashboard (different temperatures, RSSI levels, etc.).

    Parameters
    ----------
    nid : node ID (1-5)
    """
    return {
        "temp":  22.0 + nid * 1.5 + random.uniform(0, 3),   # °C
        "humid": 65.0 + nid * 2.0 + random.uniform(0, 5),   # %
        "gas":   50.0 + nid * 20  + random.uniform(0, 30),  # PPM
        "rssi": -70.0 - nid * 8   - random.uniform(0, 10),  # dBm
        "tx":    0,    # running transmit counter (incremented each cycle)
        "rx":    0,    # running receive/ACK counter
    }


def _drift(val: float, sigma: float, lo: float, hi: float) -> float:
    """
    Apply one step of Gaussian random-walk drift, clamped to [lo, hi].

    Random-walk drift mimics how real sensors change over time:
        • Temperature drifts slowly (small sigma = 0.3)
        • Gas PPM can change quickly (larger sigma = 15)
        • RSSI fluctuates due to multipath fading (sigma = 3)

    Parameters
    ----------
    val   : current value
    sigma : standard deviation of the Gaussian step
    lo    : minimum allowed value after drift
    hi    : maximum allowed value after drift
    """
    return max(lo, min(hi, val + random.gauss(0, sigma)))


class SerialBridge:
    """
    Async gateway ↔ backend bridge.

    Reads "PKT:{json}" lines from the gateway ESP32 over USB serial
    (or generates synthetic ones in simulation mode) and calls `on_line`
    for each packet so Agent 1 can process it.

    Parameters
    ----------
    port    : serial port path (e.g. "COM3" or "/dev/ttyUSB0").
              None → simulation mode.
    baud    : baud rate — must match the gateway firmware (115200)
    on_line : async or sync callable that receives one raw "PKT:..." string
    """

    def __init__(
        self,
        port:    str | None,
        baud:    int,
        on_line: Callable[[str], Awaitable | None],
        on_status_change: Callable[[dict], Awaitable | None] | None = None,
    ):
        self.port      = port
        self.baud      = baud
        self.on_line   = on_line
        self.on_status_change = on_status_change  # broadcast gateway connect/disconnect
        self.sim_mode  = False
        self.connected = False
        self.packet_count = 0
        self._task: asyncio.Task | None = None
        self._sim_states = {n: _make_sim_state(n) for n in range(1, 6)}

    # ── Public lifecycle ───────────────────────────────────────────────────────

    def start(self):
        """
        Start the bridge as an asyncio background task.

        Decision logic:
          1. If SERIAL_PORT is set AND pyserial is available → try real serial
          2. Else if SIMULATION_MODE=true in .env              → run simulation
          3. Else                                               → stay idle, wait for hardware
        """
        if SERIAL_AVAILABLE and self.port:
            self._task = asyncio.create_task(self._read_serial())
        elif SIMULATION_MODE:
            log.info("[SerialBridge] SIMULATION_MODE=true — starting synthetic data")
            self._task = asyncio.create_task(self._simulate())
        else:
            # No port, no simulation — stay silent and wait for real hardware
            log.info(
                "[SerialBridge] ⏸  Waiting for receiver hardware. "
                "Plug in the gateway ESP32 and set SERIAL_PORT in .env, "
                "or set SIMULATION_MODE=true in .env to use fake data."
            )
            self._task = asyncio.create_task(self._wait_for_hardware())

    def stop(self):
        """
        Cancel the background task cleanly.

        Called from server.py's lifespan context on server shutdown.
        asyncio.Task.cancel() raises CancelledError inside the task, which
        is caught by the try/except in _read_serial and _simulate.
        """
        if self._task:
            self._task.cancel()

    # ── Wait for hardware (hot-plug detection) ────────────────────────────────

    async def _wait_for_hardware(self):
        """
        Actively polls for the gateway ESP32 to be plugged in via USB.

        Every 3 seconds it scans all available COM ports looking for an
        ESP32 / CH340 / CP210x device. When found it automatically opens
        the port and starts reading — no server restart needed.

        Also handles the case where SERIAL_PORT is set in .env but the
        cable wasn't plugged in when the server started.
        """
        import serial.tools.list_ports   # part of pyserial

        ESP32_KEYWORDS = [
            'cp210', 'ch340', 'ch341', 'uart', 'usb serial',
            'usb-serial', 'ftdi', 'esp32', 'arduino',
        ]

        log.info(
            "[SerialBridge] ⏸  Waiting for receiver — "
            "plug in the gateway ESP32 USB cable now."
        )

        last_ports = set()

        try:
            while True:
                # If a specific port is configured, just wait for it to appear
                if self.port:
                    available = {p.device for p in serial.tools.list_ports.comports()}
                    if self.port in available:
                        log.info(
                            "[SerialBridge] 🔌 Receiver detected on %s — connecting…",
                            self.port
                        )
                        self._task = asyncio.create_task(self._read_serial())
                        return

                else:
                    # No port configured — auto-detect any ESP32/serial device
                    current_ports = {
                        p.device: p
                        for p in serial.tools.list_ports.comports()
                    }
                    current_set = set(current_ports.keys())
                    new_ports   = current_set - last_ports

                    for device in new_ports:
                        port_info = current_ports[device]
                        desc      = (port_info.description or '').lower()
                        mfr       = (port_info.manufacturer or '').lower()

                        # Check if it looks like an ESP32 / USB-serial adapter
                        if any(kw in desc or kw in mfr for kw in ESP32_KEYWORDS):
                            log.info(
                                "[SerialBridge] 🔌 ESP32 receiver auto-detected: "
                                "%s (%s) — connecting…",
                                device, port_info.description
                            )
                            self.port = device   # set the port automatically
                            self._task = asyncio.create_task(self._read_serial())
                            return

                    # Log newly appeared ports even if not matched
                    for device in new_ports:
                        log.info(
                            "[SerialBridge] New device plugged in: %s (%s) "
                            "— if this is your receiver, set SERIAL_PORT=%s in .env",
                            device,
                            current_ports[device].description,
                            device,
                        )

                    last_ports = current_set

                await asyncio.sleep(3)   # check every 3 seconds

        except asyncio.CancelledError:
            pass

    # ── Real serial reader ─────────────────────────────────────────────────────

    async def _notify(self, connected: bool, port: str = ""):
        """Broadcast gateway connect/disconnect status to the dashboard."""
        if self.on_status_change:
            result = self.on_status_change({
                "connected": connected,
                "simMode":   False,
                "port":      port,
                "packetCount": self.packet_count,
            })
            if asyncio.iscoroutine(result):
                await result

    async def _read_serial(self):
        """
        Open the serial port and read lines indefinitely.

        Uses run_in_executor to perform the blocking pyserial readline() call
        in a thread pool, keeping the asyncio event loop free for other tasks.

        Falls back to simulation if the port cannot be opened or if a
        SerialException occurs during reading (e.g. cable disconnected).
        """
        loop = asyncio.get_event_loop()
        try:
            # Open the port in a thread (serial.Serial() itself can block briefly)
            ser = await loop.run_in_executor(
                None,
                lambda: serial.Serial(self.port, self.baud, timeout=1)
                # timeout=1 means readline() returns after 1 s even with no data,
                # preventing the executor thread from blocking forever
            )
            self.connected = True
            log.info("[SerialBridge] ✅ Gateway connected on %s at %d baud", self.port, self.baud)
            await self._notify(True, self.port)

            while True:
                # readline() blocks until '\n' or timeout — runs in thread pool
                raw_bytes = await loop.run_in_executor(None, ser.readline)
                if not raw_bytes:
                    continue   # timeout — no data in the last 1 s, loop again

                # Decode bytes to str; replace bad bytes (e.g. baud mismatch)
                # with '?' rather than raising an exception
                decoded = raw_bytes.decode("utf-8", errors="replace").strip()

                if decoded.startswith("PKT:"):
                    self.packet_count += 1
                    result = self.on_line(decoded)
                    if asyncio.iscoroutine(result):
                        await result   # on_line is async in production

        except serial.SerialException as exc:
            log.warning(
                "[SerialBridge] ❌ Serial error: %s — receiver disconnected or wrong port", exc
            )
            self.connected = False
            await self._notify(False, self.port or "")
            # Do NOT fall back to simulation — stay idle and wait
            self._task = asyncio.create_task(self._wait_for_hardware())

        except asyncio.CancelledError:
            # Normal shutdown — stop() was called
            pass

    # ── Simulation mode ───────────────────────────────────────────────────────

    async def _simulate(self):
        """
        Generate realistic synthetic packets for all five nodes.

        Runs indefinitely, emitting one node's packet every 2 seconds.
        With 5 nodes this produces a full round-robin every 10 seconds,
        which matches the real hardware cadence (nodes transmit every 5 s
        but only one gateway, so effective per-node rate from server POV is 5 s).

        Sensor drift model:
            temperature  — slow drift (σ=0.3 °C), bounded 18–45 °C
            humidity     — medium drift (σ=0.5 %), bounded 40–98 %
            gas PPM      — faster drift (σ=15 PPM), bounded 0–1200 PPM
            RSSI         — fading noise (σ=3 dBm), bounded -130 to -50 dBm

        Special events (low probability):
            Node 4 gas spike — 3 % chance per reading; simulates a gas pocket
            Node 3 SOS       — 0.8 % chance per reading; simulates panic button
        """
        self.sim_mode = True
        log.info(
            "[SerialBridge] 🔵 SIMULATION MODE active — "
            "5-node synthetic data, 2 s interval"
        )

        # ── Demo burst: fire 3 scripted packets immediately on startup ────────
        # This proves the full receive → process → alert pipeline is live
        # the moment someone opens the dashboard, without waiting for the
        # stochastic events in the normal loop.
        #
        # Packet 1 — Node 4, Deep Face East: gas at DANGER level (1050 PPM)
        # Packet 2 — Node 2, Main Shaft: SOS button pressed by miner
        # Packet 3 — Node 5, West Drift: temperature WARNING (38.5 °C)
        _DEMO_BURST = [
            {
                "nid": 4, "sec": "SEC-A",
                "t": 28.4, "h": 72.0, "gas": 1050, "sos": 0,
                "rssi": -94, "snr": 3.1,
                "tx": 1, "ts": int(time.time()), "gw_ts": int(time.time()), "rx": 1,
            },
            {
                "nid": 2, "sec": "SEC-A",
                "t": 25.1, "h": 68.0, "gas": 120, "sos": 1,
                "rssi": -78, "snr": 5.4,
                "tx": 1, "ts": int(time.time()), "gw_ts": int(time.time()), "rx": 1,
            },
            {
                "nid": 5, "sec": "SEC-A",
                "t": 38.5, "h": 85.0, "gas": 280, "sos": 0,
                "rssi": -101, "snr": 1.8,
                "tx": 1, "ts": int(time.time()), "gw_ts": int(time.time()), "rx": 1,
            },
        ]
        for _pkt in _DEMO_BURST:
            _line = "PKT:" + json.dumps(_pkt)
            _result = self.on_line(_line)
            if asyncio.iscoroutine(_result):
                await _result
            await asyncio.sleep(0.3)   # tiny gap so timestamps differ
        log.info("[SerialBridge] 🟡 Demo burst sent — 3 alert-triggering packets injected")
        # ── End demo burst ────────────────────────────────────────────────────

        node_index = 0   # cycles 0→4→0→4 to round-robin across nodes

        try:
            while True:
                nid = (node_index % 5) + 1   # maps 0,1,2,3,4 → 1,2,3,4,5
                node_index += 1

                s = self._sim_states[nid]   # get this node's current state

                # ── Apply drift to each sensor ────────────────────────────────
                s["temp"]  = _drift(s["temp"],  0.3, 18.0,  45.0)
                s["humid"] = _drift(s["humid"], 0.5, 40.0,  98.0)
                s["gas"]   = _drift(s["gas"],  15.0,  0.0, 1200.0)
                s["rssi"]  = _drift(s["rssi"],  3.0, -130.0, -50.0)
                s["tx"] += 1
                s["rx"] += 1

                # ── Inject demo events ────────────────────────────────────────
                # Node 4 is in the deepest section (Deep Face East) — gas spikes
                # are more plausible there.  3 % chance produces ~1 spike per
                # ~33 readings = roughly every 5 minutes of continuous operation.
                if nid == 4 and random.random() < 0.03:
                    s["gas"] = _drift(s["gas"], 200.0, 800.0, 1500.0)

                # Node 3 is in the East Branch — SOS is rare (0.8 %) so the demo
                # shows it occasionally without being annoying during a presentation.
                sos = 1 if (nid == 3 and random.random() < 0.008) else 0

                # ── Build the JSON packet ─────────────────────────────────────
                # Field names match the firmware: short names save LoRa airtime.
                packet = {
                    "nid":   nid,
                    "sec":   "SEC-A",
                    "t":     round(s["temp"],  1),
                    "h":     round(s["humid"], 1),
                    "gas":   int(s["gas"]),
                    "sos":   sos,
                    "rssi":  int(s["rssi"]),
                    # SNR: random value in typical LoRa range (-2 to +10 dB)
                    "snr":   round(random.uniform(-2, 10), 1),
                    "tx":    s["tx"],
                    "ts":    int(time.time()),      # Unix timestamp (seconds since boot sim)
                    "gw_ts": int(time.time()),      # gateway receipt timestamp
                    "rx":    s["rx"],
                }

                # Prefix with "PKT:" so Agent 1's process_packet() accepts it
                line = "PKT:" + json.dumps(packet)
                self.packet_count += 1

                # Deliver to Agent 1 via the registered callback
                result = self.on_line(line)
                if asyncio.iscoroutine(result):
                    await result   # on_line is async in production

                # Wait before the next node's packet
                # 2 s × 5 nodes = 10 s per full round-robin
                await asyncio.sleep(2.0)

        except asyncio.CancelledError:
            # Normal shutdown — stop() was called
            pass

    # ── Status export ─────────────────────────────────────────────────────────

    def get_status(self) -> dict:
        """
        Return the current connection state for GET /api/status.

        Returns
        -------
        dict with keys:
            connected   — True if a real serial port is open
            simMode     — True if running without hardware
            port        — the configured port path (or "N/A")
            packetCount — total packets forwarded to Agent 1 since startup
        """
        return {
            "connected":   self.connected,
            "simMode":     self.sim_mode,
            "port":        self.port or "N/A",
            "packetCount": self.packet_count,
        }
