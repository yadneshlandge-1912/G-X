import React, { useState } from 'react';
import { UserCheck, Search, Users, HardHat, MapPin } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import useMineStore from '../store/useMineStore';
import FormField from '../components/ui/FormField';

function timeAgo(ts) {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
}

const SHIFTS = ['All','Morning','Evening','Night','On-Call'];

export default function AttendancePage() {
  const users   = useAuthStore(s => s.users);
  const nodes   = useMineStore(s => s.nodes);
  const [search, setSearch] = useState('');
  const [shift,  setShift]  = useState('All');

  const miners   = users.filter(u => u.role === 'miner' || u.role === 'supervisor');
  const filtered = miners.filter(u =>
    (shift === 'All' || u.shift === shift) &&
    (!search || u.name.toLowerCase().includes(search.toLowerCase()))
  );

  const underground = filtered.filter(u => u.nodeId && nodes[u.nodeId]?.online).length;
  const surface     = filtered.length - underground;

  return (
    <div className="p-4 space-y-4 animate-fade-in">

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <UserCheck className="w-5 h-5 text-mine-accent" />
        <h1 className="font-bold text-lg">Shift Attendance</h1>
        <span className="badge-info ml-auto">
          {new Date().toLocaleString('en-IN',{ dateStyle:'medium', timeStyle:'short' })}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center" style={{ borderColor:'rgba(255,255,255,0.08)' }}>
          <div className="metric-label mb-1">On Shift</div>
          <div className="text-3xl font-black text-white">{filtered.length}</div>
        </div>
        <div className="card text-center" style={{ borderColor:'rgba(16,185,129,0.2)', background:'rgba(16,185,129,0.04)' }}>
          <div className="metric-label mb-1 text-green-400">Underground</div>
          <div className="text-3xl font-black text-green-400">{underground}</div>
        </div>
        <div className="card text-center" style={{ borderColor:'rgba(56,189,248,0.2)', background:'rgba(56,189,248,0.04)' }}>
          <div className="metric-label mb-1 text-sky-400">Surface</div>
          <div className="text-3xl font-black text-sky-400">{surface}</div>
        </div>
      </div>

      {/* Search + shift filter */}
      <div className="flex gap-3 flex-wrap items-center">
        {/* Animated search field */}
        <div className="flex-1 min-w-[180px]">
          <FormField
            icon={Search}
            placeholder="Search miner..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Animated filter buttons */}
        <div className="flex gap-1.5 flex-wrap">
          {SHIFTS.map(s => (
            <button
              key={s}
              onClick={() => setShift(s)}
              className={`filter-btn ${shift === s ? 'active' : ''}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Miner</th>
              <th>Badge</th>
              <th>Shift</th>
              <th>Section</th>
              <th>Node</th>
              <th>Status</th>
              <th>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-mine-muted">No miners found.</td></tr>
            )}
            {filtered.map(u => {
              const linked = u.nodeId && nodes[u.nodeId];
              const online = linked?.online;
              return (
                <tr key={u.id} style={{ transition:'background 0.15s ease' }}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{u.avatar || '👤'}</span>
                      <span className="font-semibold text-white">{u.name}</span>
                    </div>
                  </td>
                  <td><span className="font-mono text-xs">{u.badge || '—'}</span></td>
                  <td><span className="badge-info text-xs">{u.shift || '—'}</span></td>
                  <td><span className="text-mine-muted text-xs">{u.section || '—'}</span></td>
                  <td>
                    {u.nodeId
                      ? <span className="badge-cyan text-xs">N-{u.nodeId}</span>
                      : <span className="text-mine-muted text-xs">—</span>}
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <div className={`dot ${online ? 'dot-online' : 'dot-offline'}`} />
                      <span className={`text-xs font-semibold ${online ? 'text-green-400' : 'text-ink-500'}`}>
                        {online ? 'Underground' : 'Surface'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="text-xs text-ink-500">
                      {linked?.lastSeen ? timeAgo(linked.lastSeen) : '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
