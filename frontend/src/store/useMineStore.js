/**
 * Global state store — Zustand
 * Holds all live node data, alerts, location, WS connection status, and auth/role.
 * Dashboard components subscribe to slices they need — no prop drilling.
 */
import { create } from 'zustand';

const WS_URL    = `ws://${window.location.hostname}:3001/ws`;
const API_BASE  = '/api';
const HISTORY_MAX = 60;   // keep 60 data points per node for charts

// Helper: add to rolling array
function addToHistory(arr, val) {
  const next = [...arr, val];
  return next.length > HISTORY_MAX ? next.slice(-HISTORY_MAX) : next;
}

const useMineStore = create((set, get) => ({
  // ── Auth / Role ────────────────────────────────────────
  // role: null = not logged in, one of 'miner'|'supervisor'|'rescue'|'admin'
  role: null,
  setRole: (role) => {
    set({ role });
    // Kick off WS connection the first time a role is selected
    if (role && !get().wsRef) {
      get().connectWS();
    }
  },
  logout: () => set({ role: null }),

  // ── Connection ─────────────────────────────────────────
  wsStatus:   'disconnected',   // 'connected' | 'disconnected' | 'error'
  simMode:    false,
  gatewayInfo: null,

  // ── Nodes (keyed 1–5) ──────────────────────────────────
  nodes: {
    1: null, 2: null, 3: null, 4: null, 5: null,
  },

  // Chart history per node: { nodeId: [{ ts, temp, humid, gas, rssi }] }
  history: { 1: [], 2: [], 3: [], 4: [], 5: [] },

  // ── Alerts ─────────────────────────────────────────────
  alerts:     [],        // unacknowledged
  sosActive:  {},        // { nodeId: true/false }

  // ── Map / Location ─────────────────────────────────────
  anchors:    {},
  locations:  {},        // { nodeId: locationObject }

  // ── Stats ──────────────────────────────────────────────
  stats:      null,
  lastUpdate: null,

  // ── Selected node (for detail panel) ──────────────────
  selectedNode: null,
  setSelectedNode: (id) => set({ selectedNode: id }),

  // ── Page ──────────────────────────────────────────────
  // All valid pages: dashboard | map | alerts | history |
  //                  profile | users | shiftlog | settings |
  //                  incidents | equipment
  activePage: 'dashboard',
  setActivePage: (page) => set({ activePage: page }),

  // ── WebSocket init ─────────────────────────────────────
  wsRef: null,

  connectWS() {
    if (get().wsRef) return;
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      set({ wsStatus: 'connected', wsRef: ws });
      console.log('[WS] Connected to backend');
      // Fetch initial data
      get().fetchNodes();
      get().fetchAlerts();
      get().fetchMap();
      get().fetchStats();
      get().fetchHistory();
    };

    ws.onmessage = (evt) => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch { return; }
      get()._handleWSMessage(msg);
    };

    ws.onclose = () => {
      set({ wsStatus: 'disconnected', wsRef: null });
      console.warn('[WS] Disconnected — retrying in 3s');
      setTimeout(() => get().connectWS(), 3000);
    };

    ws.onerror = () => {
      set({ wsStatus: 'error' });
      ws.close();
    };

    set({ wsRef: ws });
  },

  // ── Handle incoming WS messages ────────────────────────
  _handleWSMessage(msg) {
    const { event, payload } = msg;

    switch (event) {
      case 'snapshot': {
        const nodesMap = {};
        for (const row of (payload.nodes || [])) {
          nodesMap[row.node_id] = normalizeDbRow(row);
        }
        set({ nodes: { ...get().nodes, ...nodesMap }, lastUpdate: Date.now() });
        break;
      }

      case 'reading': {
        const { nodeId, smoothed, signal, gasLevel, trend, alerts, location, ts } = payload;
        const point = {
          ts,
          temp:  smoothed.temperature,
          humid: smoothed.humidity,
          gas:   smoothed.gasPPM,
          rssi:  signal.rssi,
          label: new Date(ts).toLocaleTimeString(),
        };
        set((s) => ({
          nodes: {
            ...s.nodes,
            [nodeId]: {
              ...(s.nodes[nodeId] || {}),
              nodeId,
              temperature:   smoothed.temperature,
              humidity:      smoothed.humidity,
              gasPPM:        smoothed.gasPPM,
              signalQuality: signal.quality,
              gasLabel:      gasLevel.label,
              gasSeverity:   gasLevel.severity,
              rssi:          signal.rssi,
              snr:           signal.snr,
              sos:           alerts.sos,
              anomalies:     alerts.anomalies,
              trend,
              location,
              lastSeen:      ts,
              online:        true,
            },
          },
          history: {
            ...s.history,
            [nodeId]: addToHistory(s.history[nodeId] || [], point),
          },
          sosActive: s.sosActive[nodeId] === Boolean(alerts.sos) ? s.sosActive : {
            ...s.sosActive,
            [nodeId]: Boolean(alerts.sos),
          },
          lastUpdate: ts,
        }));
        break;
      }

      case 'alert': {
        set((s) => ({
          alerts: [payload, ...s.alerts].slice(0, 100),
        }));
        break;
      }

      case 'sos': {
        set((s) => ({
          sosActive: { ...s.sosActive, [payload.nodeId]: true },
        }));
        break;
      }

      case 'node_lost': {
        set((s) => ({
          nodes: {
            ...s.nodes,
            [payload.nodeId]: {
              ...(s.nodes[payload.nodeId] || {}),
              online: false,
            },
          },
        }));
        break;
      }

      case 'gateway_connected': {
        set({ gatewayInfo: payload });
        break;
      }

      default: break;
    }
  },

  // ── REST fetchers ──────────────────────────────────────
  async fetchNodes() {
    try {
      const res  = await fetch(`${API_BASE}/nodes`);
      const data = await res.json();
      if (!data.ok) return;
      const nodesMap = {};
      for (const row of data.nodes) nodesMap[row.node_id] = normalizeDbRow(row);
      set({ nodes: { ...get().nodes, ...nodesMap } });
    } catch (e) { console.error('[API] fetchNodes:', e.message); }
  },

  async fetchAlerts() {
    try {
      const res  = await fetch(`${API_BASE}/alerts`);
      const data = await res.json();
      if (data.ok) set({ alerts: data.alerts });
    } catch (e) { console.error('[API] fetchAlerts:', e.message); }
  },

  async fetchMap() {
    try {
      const res  = await fetch(`${API_BASE}/map`);
      const data = await res.json();
      if (data.ok) {
        const locs = {};
        for (const row of data.locations) locs[row.node_id] = row;
        set({ anchors: data.anchors, locations: locs });
      }
    } catch (e) { console.error('[API] fetchMap:', e.message); }
  },

  async fetchStats() {
    try {
      const res  = await fetch(`${API_BASE}/stats`);
      const data = await res.json();
      if (data.ok) set({ stats: data.stats });
    } catch (e) { console.error('[API] fetchStats:', e.message); }
  },

  // Loads the last 60 DB readings per node and pre-populates the in-memory
  // history so the History page charts render immediately without waiting
  // for live WS readings to accumulate.
  async fetchHistory() {
    const historyMap = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    await Promise.all([1, 2, 3, 4, 5].map(async (nid) => {
      try {
        const res  = await fetch(`${API_BASE}/nodes/${nid}/history?limit=60`);
        const data = await res.json();
        if (!data.ok) return;
        // DB rows are newest-first — reverse so the chart reads left-to-right
        const points = [...data.readings].reverse().map(row => ({
          ts:    (row.created_at || 0) * 1000,
          temp:  row.temperature,
          humid: row.humidity,
          gas:   row.gas_ppm,
          rssi:  row.rssi,
          label: new Date((row.created_at || 0) * 1000).toLocaleTimeString(),
        }));
        historyMap[nid] = points;
      } catch (e) { console.error(`[API] fetchHistory node ${nid}:`, e.message); }
    }));
    set({ history: historyMap });
    console.log('[API] History hydrated from DB');
  },

  async acknowledgeAlert(id) {
    try {
      await fetch(`${API_BASE}/alerts/${id}/ack`, { method: 'POST' });
      set((s) => ({ alerts: s.alerts.filter(a => a.id !== id) }));
    } catch (e) { console.error('[API] ackAlert:', e.message); }
  },

  async acknowledgeAllAlerts() {
    const alertsToAck = get().alerts;
    set({ alerts: [] });
    await Promise.all(
      alertsToAck.map(a => fetch(`${API_BASE}/alerts/${a.id}/ack`, { method: 'POST' }).catch(() => {}))
    );
  },
}));

// Normalize DB row from REST snapshot to match WS reading shape
function normalizeDbRow(row) {
  return {
    nodeId:        row.node_id,
    temperature:   row.smooth_temp  ?? row.temperature,
    humidity:      row.smooth_humidity ?? row.humidity,
    gasPPM:        row.smooth_gas   ?? row.gas_ppm,
    signalQuality: row.signal_quality,
    gasLabel:      row.gas_label,
    gasSeverity:   row.gas_severity ?? 0,
    rssi:          row.rssi,
    snr:           row.snr,
    sos:           row.sos === 1,
    lastSeen:      (row.created_at || 0) * 1000,
    // null = "not yet confirmed by a live WS reading" — avoids showing offline
    // for seeded/historical data. The WS 'reading' event sets this to true,
    // and 'node_lost' sets it to false.
    online:        null,
    location: row.pos_x != null ? {
      position:    { x: row.pos_x, y: row.pos_y },
      distFromGW:  row.dist_from_gw,
      nearest:     { id: row.nearest_anchor, distM: row.anchor_dist },
      confidence:  row.confidence,
      depth:       row.depth,
    } : null,
  };
}

export default useMineStore;
