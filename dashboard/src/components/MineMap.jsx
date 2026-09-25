/**
 * MineMap.jsx — Live Satellite Map (Leaflet + OpenStreetMap)
 *
 * Uses:
 *  - ESRI World Imagery (satellite) as base tile layer — no API key needed
 *  - OpenStreetMap labels overlay so street names appear on top of satellite
 *  - react-leaflet v4 MapContainer / TileLayer / Marker / Popup
 *
 * Node markers:
 *  - Custom coloured circle markers based on gas safety level
 *  - Pulse animation on the marker when SOS is active
 *  - Popup shows all live sensor values on click
 *  - Marker moves automatically when GPS coordinates arrive from the node
 *
 * Mine centre default:
 *  - Defaults to Jharia coalfield, Jharkhand, India (23.745°N, 86.415°E)
 *  - Automatically re-centres on the first valid GPS fix from any node
 */
import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  CircleMarker,
  Tooltip,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import { Maximize2, Satellite, LocateFixed, LocateOff, Loader } from 'lucide-react';
import useMineStore from '../store/useMineStore';
import useMyLocation from '../hooks/useMyLocation';

// ── Fix leaflet's default icon path broken by bundlers ──────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Mine default centre — Jharia Coalfield, Jharkhand ───────────────────────
// ⚠  CHANGE THESE to your actual mine coordinates.
// How to get them: Open Google Maps → right-click your location → copy the numbers shown.
// Example: if Google Maps shows  23.7451, 86.4144  then set:
//   const MINE_CENTER = [23.7451, 86.4144];
const MINE_CENTER = [23.745, 86.415];
const DEFAULT_ZOOM = 17;   // 17 = street level, 18-19 = building level, 15 = neighbourhood

// ── Tile layer options ────────────────────────────────────────────────────────
// Using Google Maps satellite tiles via a public proxy — same imagery as Google Maps.
// These are the exact same tiles Google Maps uses, served through tile servers.
const TILES = {
  // Google Satellite — same imagery as Google Maps satellite view
  googleSat: {
    url:  'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attr: '© Google Maps',
    maxZ: 21,
  },
  // Google Hybrid — satellite + road names/labels on top (closest to Google Maps)
  googleHybrid: {
    url:  'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attr: '© Google Maps',
    maxZ: 21,
  },
  // OpenStreetMap fallback (road map, not satellite)
  osm: {
    url:  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr: '© OpenStreetMap contributors',
    maxZ: 19,
  },
};

// ── Gas level → marker colour ────────────────────────────────────────────────
const GAS_COLOUR = {
  SAFE:    '#10b981',
  CAUTION: '#f59e0b',
  WARNING: '#f97316',
  DANGER:  '#ef4444',
};
// Each node is offset slightly from the mine centre so all 5 are visible
// even when no GPS fix is available.  1° lat ≈ 111 km, so 0.0002° ≈ 22 m.
const FALLBACK_OFFSETS = {
  1: [0,       0      ],
  2: [0.0003,  0      ],
  3: [0.0006,  0      ],
  4: [0.0002,  0.0005 ],
  5: [0.0005,  0.0005 ],
};

// ── Auto-pan component — follows first GPS fix ───────────────────────────────
function AutoPan({ nodes }) {
  const map = useMap();
  const panned = useRef(false);

  useEffect(() => {
    if (panned.current) return;
    for (let id = 1; id <= 5; id++) {
      const node = nodes[id];
      if (node?.location?.gpsLat && node?.location?.gpsLon) {
        map.setView([node.location.gpsLat, node.location.gpsLon], DEFAULT_ZOOM, {
          animate: true,
        });
        panned.current = true;
        break;
      }
    }
  }, [nodes, map]);

  return null;
}

// ── Auto-pan to user's live position ─────────────────────────────────────────
function AutoPanToMe({ position, shouldPan }) {
  const map = useMap();
  const didPan = useRef(false);

  useEffect(() => {
    if (!shouldPan || !position || didPan.current) return;
    map.setView([position.lat, position.lon], Math.max(map.getZoom(), 17), {
      animate: true,
    });
    didPan.current = true;
  }, [position, shouldPan, map]);

  // Reset so next "locate me" press pans again
  useEffect(() => {
    if (!shouldPan) didPan.current = false;
  }, [shouldPan]);

  return null;
}

// ── Live user location marker ─────────────────────────────────────────────────
// Renders a pulsing blue dot (Google Maps–style) with an accuracy radius circle.
function LiveLocationMarker({ position }) {
  const map = useMap();

  // Pulsing blue dot icon
  const myIcon = useMemo(() => L.divIcon({
    className: '',
    html: `
      <div style="position:relative; width:22px; height:22px; display:flex; align-items:center; justify-content:center;">
        <!-- outer pulse ring -->
        <div style="
          position:absolute;
          width:44px; height:44px;
          border-radius:50%;
          background: rgba(59,130,246,0.15);
          animation: locationPulse 2s ease-out infinite;
          top:50%; left:50%; transform:translate(-50%,-50%);
        "></div>
        <!-- mid ring -->
        <div style="
          position:absolute;
          width:30px; height:30px;
          border-radius:50%;
          border: 2px solid rgba(59,130,246,0.35);
          top:50%; left:50%; transform:translate(-50%,-50%);
        "></div>
        <!-- core dot -->
        <div style="
          width:14px; height:14px;
          border-radius:50%;
          background: radial-gradient(circle at 35% 35%, #60a5fa, #2563eb);
          border: 2.5px solid #fff;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.4), 0 2px 8px rgba(0,0,0,0.5);
          position:relative; z-index:1;
        "></div>
      </div>`,
    iconSize:   [22, 22],
    iconAnchor: [11, 11],
    popupAnchor:[0, -16],
  }), []);

  return (
    <>
      {/* Accuracy radius circle */}
      {position.accuracy > 0 && (
        <Circle
          center={[position.lat, position.lon]}
          radius={position.accuracy}
          pathOptions={{
            color:       '#3b82f6',
            fillColor:   '#3b82f6',
            fillOpacity: 0.08,
            weight:      1.5,
            dashArray:   '4 4',
          }}
        />
      )}

      {/* Blue dot marker */}
      <Marker position={[position.lat, position.lon]} icon={myIcon} zIndexOffset={1000}>
        <Popup minWidth={200}>
          <div style={{ fontFamily: "'Inter', sans-serif" }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 8, paddingBottom: 8,
              borderBottom: '1px solid #e2e8f0',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'linear-gradient(135deg, #60a5fa, #2563eb)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, color: 'white',
              }}>📍</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a' }}>Your Location</div>
                <div style={{ fontSize: 10, color: '#3b82f6', fontWeight: 700 }}>● Live GPS</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
              <div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 1 }}>📍 Latitude</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                  {position.lat.toFixed(6)}°
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 1 }}>📍 Longitude</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                  {position.lon.toFixed(6)}°
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 1 }}>🎯 Accuracy</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                  ± {Math.round(position.accuracy)} m
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 1 }}>🕐 Updated</div>
                <div style={{ fontSize: 11, color: '#0f172a' }}>
                  {position.ts ? new Date(position.ts).toLocaleTimeString() : '—'}
                </div>
              </div>
              {position.speed != null && position.speed > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 1 }}>🏃 Speed</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                    {(position.speed * 3.6).toFixed(1)} km/h
                  </div>
                </div>
              )}
            </div>
          </div>
        </Popup>
        <Tooltip direction="top" offset={[0, -16]} permanent>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#3b82f6' }}>YOU</span>
        </Tooltip>
      </Marker>
    </>
  );
}

// ── Gateway marker (fixed at mine centre) ────────────────────────────────────
function GatewayMarker({ center }) {
  const gwIcon = useMemo(() => L.divIcon({
    className: '',
    html: `
      <div style="
        width:36px; height:36px; border-radius:50%;
        background: radial-gradient(circle, #f59e0b 0%, #d97706 100%);
        border: 3px solid rgba(255,255,255,0.9);
        box-shadow: 0 0 0 4px rgba(245,158,11,0.3), 0 2px 8px rgba(0,0,0,0.5);
        display:flex; align-items:center; justify-content:center;
        font-size:16px; line-height:1;
      ">📡</div>`,
    iconSize:   [36, 36],
    iconAnchor: [18, 18],
    popupAnchor:[0, -20],
  }), []);

  return (
    <Marker position={center} icon={gwIcon}>
      <Popup className="mine-popup">
        <div style={{ minWidth: 160 }}>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4, color: '#f59e0b' }}>
            📡 GATEWAY
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>LoRa 915 MHz · SF12</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>SEC-A Mine Control</div>
          <div style={{ fontSize: 11, color: '#10b981', marginTop: 4, fontWeight: 700 }}>
            ● Online
          </div>
        </div>
      </Popup>
      <Tooltip direction="top" offset={[0, -22]} permanent>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b' }}>GATEWAY</span>
      </Tooltip>
    </Marker>
  );
}

// ── Single node marker ────────────────────────────────────────────────────────
function NodeMarker({ nodeId, node, position }) {
  const online  = node?.online ?? false;
  const hasSOS  = node?.sos ?? false;
  const gasLabel= node?.gasLabel || 'SAFE';
  const colour  = online ? (GAS_COLOUR[gasLabel] || GAS_COLOUR.SAFE) : '#475569';
  const radius  = 14;

  const nodeIcon = useMemo(() => L.divIcon({
    className: '',
    html: `
      <div style="position:relative; width:${radius*2}px; height:${radius*2}px;">
        ${hasSOS ? `
          <div style="
            position:absolute; inset:-8px; border-radius:50%;
            border: 2px solid rgba(239,68,68,0.6);
            animation: sosRing 1s ease-in-out infinite;
          "/>` : ''}
        <div style="
          width:${radius*2}px; height:${radius*2}px; border-radius:50%;
          background: radial-gradient(circle at 35% 35%, ${colour}ff, ${colour}99);
          border: 2.5px solid rgba(255,255,255,0.9);
          box-shadow: 0 0 0 3px ${colour}44, 0 2px 8px rgba(0,0,0,0.5);
          display:flex; align-items:center; justify-content:center;
          font-size:10px; font-weight:900; color:white;
          font-family: 'JetBrains Mono', monospace;
          text-shadow: 0 1px 2px rgba(0,0,0,0.8);
        ">N${nodeId}</div>
        ${online && node?.temperature != null ? `
          <div style="
            position:absolute; top:-18px; left:50%; transform:translateX(-50%);
            background:rgba(0,0,0,0.75); color:${colour}; border:1px solid ${colour}44;
            border-radius:4px; padding:1px 5px;
            font-size:9px; font-weight:700; white-space:nowrap;
            font-family:'JetBrains Mono',monospace;
          ">${node.temperature.toFixed(1)}°C</div>` : ''}
      </div>`,
    iconSize:   [radius*2, radius*2],
    iconAnchor: [radius, radius],
    popupAnchor:[0, -radius - 10],
  }), [nodeId, colour, hasSOS, online, node?.temperature]);

  return (
    <Marker position={position} icon={nodeIcon}>
      <Popup className="mine-popup" minWidth={200}>
        <div style={{ fontFamily: "'Inter', sans-serif" }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 8, paddingBottom: 8,
            borderBottom: '1px solid #e2e8f0',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: colour, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: 'white',
              fontSize: 11, fontWeight: 900,
            }}>N{nodeId}</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a' }}>
                Node {nodeId} — {node?.section || 'SEC-A'}
              </div>
              <div style={{ fontSize: 10, color: online ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                {online ? '● Online' : '○ Offline'}
                {hasSOS && <span style={{ color: '#ef4444', marginLeft: 8 }}>🆘 SOS ACTIVE</span>}
              </div>
            </div>
          </div>

          {online && node ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
              {[
                { label: '🌡 Temperature', value: node.temperature != null ? `${node.temperature.toFixed(1)} °C` : '—' },
                { label: '💧 Humidity',    value: node.humidity    != null ? `${node.humidity.toFixed(0)} %`    : '—' },
                { label: '💨 Gas PPM',     value: node.gasPPM      != null ? `${Math.round(node.gasPPM)} ppm`  : '—' },
                { label: '📶 RSSI',        value: node.rssi        != null ? `${node.rssi} dBm`                : '—' },
                { label: '⚠ Gas Level',   value: node.gasLabel    || '—',  colour: colour },
                { label: '📡 Signal',      value: node.signalQuality || '—' },
              ].map(({ label, value, colour: c }) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 1 }}>{label}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c || '#0f172a' }}>{value}</div>
                </div>
              ))}

              {/* GPS */}
              {node.location?.gpsLat && (
                <div style={{ gridColumn: '1/-1', marginTop: 4, paddingTop: 6, borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>📍 GPS Position</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#0f172a', fontFamily: 'monospace' }}>
                    {node.location.gpsLat.toFixed(5)}, {node.location.gpsLon.toFixed(5)}
                  </div>
                </div>
              )}

              {/* Last seen */}
              <div style={{ gridColumn: '1/-1', marginTop: 4 }}>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>
                  Last update: {node.lastSeen ? new Date(node.lastSeen).toLocaleTimeString() : '—'}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: '8px 0' }}>
              No signal — node offline
            </div>
          )}
        </div>
      </Popup>

      {/* Always-visible tooltip label */}
      <Tooltip direction="bottom" offset={[0, radius + 4]} permanent>
        <span style={{
          fontSize: 9, fontWeight: 700,
          color: colour, fontFamily: "'JetBrains Mono', monospace",
        }}>
          {hasSOS ? '🆘 SOS' : online ? gasLabel : 'OFFLINE'}
        </span>
      </Tooltip>
    </Marker>
  );
}

// ── Main MineMap component ────────────────────────────────────────────────────
export default function MineMap() {
  const nodes = useMineStore(s => s.nodes);
  const [tileMode,    setTileMode]    = React.useState('googleHybrid');
  const [panToMe,     setPanToMe]     = React.useState(false);

  const { position: myPos, status: locStatus, error: locError, start: startLoc, stop: stopLoc } = useMyLocation();

  const currentTile = TILES[tileMode] || TILES.googleHybrid;

  // When user clicks "Locate Me", start watching and trigger a pan
  function handleLocateMe() {
    if (locStatus === 'active') {
      stopLoc();
      setPanToMe(false);
    } else {
      startLoc();
      setPanToMe(true);
    }
  }

  // Pan triggered — reset flag after a tick so it doesn't keep re-panning
  useEffect(() => {
    if (panToMe && myPos) {
      const t = setTimeout(() => setPanToMe(false), 500);
      return () => clearTimeout(t);
    }
  }, [panToMe, myPos]);

  function getNodePosition(nodeId) {
    const node = nodes[nodeId];
    if (node?.location?.gpsLat && node?.location?.gpsLon) {
      return [node.location.gpsLat, node.location.gpsLon];
    }
    const [dLat, dLon] = FALLBACK_OFFSETS[nodeId] || [0, 0];
    return [MINE_CENTER[0] + dLat, MINE_CENTER[1] + dLon];
  }

  // Button appearance based on location status
  const locBtnStyle = locStatus === 'active'
    ? { background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', color: '#60a5fa' }
    : locStatus === 'loading'
    ? { background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24' }
    : locStatus === 'denied' || locStatus === 'error'
    ? { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }
    : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' };

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

      {/* Card header */}
      <div className="flex items-center gap-2 px-4 py-3 flex-wrap gap-y-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <Satellite className="w-4 h-4 flex-shrink-0" style={{ color: '#f59e0b' }} />
        <span className="section-head" style={{ margin: 0 }}>Live Satellite Map — SEC-A</span>

        {/* Layer switcher */}
        <div className="flex items-center gap-1 ml-3 flex-shrink-0"
          style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '2px' }}>
          {[
            { key: 'googleHybrid', label: '🗺 Hybrid'    },
            { key: 'googleSat',    label: '🛰 Satellite' },
            { key: 'osm',          label: '🗾 Street'    },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setTileMode(key)}
              className="text-xs font-semibold px-2.5 py-1 rounded-md transition-all"
              style={tileMode === key
                ? { background: '#f59e0b', color: '#030509' }
                : { background: 'transparent', color: '#64748b' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 ml-2 flex-wrap">
          {[
            { colour: '#10b981', label: 'Safe'      },
            { colour: '#f59e0b', label: 'Caution'   },
            { colour: '#f97316', label: 'Warning'   },
            { colour: '#ef4444', label: 'Danger/SOS'},
            { colour: '#3b82f6', label: 'You'       },
          ].map(({ colour, label }) => (
            <div key={label} className="flex items-center gap-1"
              style={{ fontSize: 10, color: '#64748b' }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: colour, boxShadow: `0 0 4px ${colour}`,
              }} />
              {label}
            </div>
          ))}
        </div>

        {/* Locate Me button */}
        <button
          onClick={handleLocateMe}
          title={locStatus === 'active' ? 'Stop tracking my location' : 'Show my live location on map'}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0"
          style={locBtnStyle}>
          {locStatus === 'loading'
            ? <Loader  className="w-3.5 h-3.5 animate-spin" />
            : locStatus === 'active'
            ? <LocateFixed className="w-3.5 h-3.5" />
            : <LocateFixed className="w-3.5 h-3.5" />}
          {locStatus === 'active' ? 'Tracking' : locStatus === 'loading' ? 'Locating…' : 'Locate Me'}
        </button>

        <button className="btn-icon flex-shrink-0" title="Full screen"
          onClick={() => document.querySelector('.leaflet-container')?.requestFullscreen?.()}>
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Location error banner */}
      {locError && (
        <div className="px-4 py-2 text-xs flex items-center gap-2"
          style={{ background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}>
          <LocateOff className="w-3.5 h-3.5 flex-shrink-0" />
          {locError}
        </div>
      )}

      {/* Map */}
      <div style={{ height: 420, width: '100%' }}>
        <MapContainer
          center={MINE_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
          attributionControl={true}
        >
          {/* Google Maps tile layer — switches based on selected mode */}
          <TileLayer
            key={tileMode}
            url={currentTile.url}
            attribution={currentTile.attr}
            maxZoom={currentTile.maxZ}
            maxNativeZoom={currentTile.maxZ}
          />

          {/* Auto-pan to first node GPS fix */}
          <AutoPan nodes={nodes} />

          {/* Auto-pan to user when they click Locate Me */}
          <AutoPanToMe position={myPos} shouldPan={panToMe} />

          {/* Gateway marker at mine centre */}
          <GatewayMarker center={MINE_CENTER} />

          {/* Node markers 1–5 */}
          {[1, 2, 3, 4, 5].map(id => (
            <NodeMarker
              key={id}
              nodeId={id}
              node={nodes[id]}
              position={getNodePosition(id)}
            />
          ))}

          {/* Live user location marker */}
          {myPos && <LiveLocationMarker position={myPos} />}
        </MapContainer>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 text-xs"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.2)',
          color: '#475569',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
        <span>© Google Maps · Tiles via public proxy · No API key required</span>
        <span className="flex items-center gap-3">
          {myPos && (
            <span style={{ color: '#60a5fa' }}>
              📍 {myPos.lat.toFixed(5)}, {myPos.lon.toFixed(5)} ±{Math.round(myPos.accuracy)}m
            </span>
          )}
          <span>
            {Object.values(nodes).filter(n => n?.online).length} / 5 nodes online
            · {MINE_CENTER[0]}°N, {MINE_CENTER[1]}°E
          </span>
        </span>
      </div>
    </div>
  );
}
