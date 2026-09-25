import React, { useState } from 'react';
import {
  FileWarning, Plus, CheckCircle, Clock, AlertTriangle,
  Filter, X, ChevronDown, ChevronUp, Edit3, Save,
} from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const TYPES     = ['GAS_LEAK','FIRE','COLLAPSE','EQUIPMENT_FAIL','INJURY','SOS','POWER_FAIL','OTHER'];
const SEVERITIES= ['LOW','MEDIUM','HIGH','CRITICAL'];
const STATUSES  = ['OPEN','IN_PROGRESS','RESOLVED','CLOSED'];

const SEV_COLOR = {
  LOW:      'text-green-400  badge-safe',
  MEDIUM:   'text-yellow-400 badge-warn',
  HIGH:     'text-orange-400 badge-warn',
  CRITICAL: 'text-red-400    badge-danger',
};
const STA_COLOR = {
  OPEN:        'badge-danger',
  IN_PROGRESS: 'badge-warn',
  RESOLVED:    'badge-safe',
  CLOSED:      'badge-offline',
};

function timeStr(ts) {
  return new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function IncidentReportPage() {
  const currentUser  = useAuthStore(s => s.currentUser);
  const incidents    = useAuthStore(s => s.incidents);
  const fileIncident = useAuthStore(s => s.fileIncident);
  const updateIncident = useAuthStore(s => s.updateIncident);

  const [showForm,  setShowForm]  = useState(false);
  const [expandId,  setExpandId]  = useState(null);
  const [editId,    setEditId]    = useState(null);
  const [filter,    setFilter]    = useState('all');
  const [form, setForm] = useState({ nodeId:'', type:'GAS_LEAK', severity:'HIGH', description:'' });
  const [actionText, setActionText] = useState('');

  const canFile = ['supervisor', 'admin', 'rescue'].includes(currentUser?.role);

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.description.trim()) return;
    fileIncident({ ...form, nodeId: form.nodeId ? parseInt(form.nodeId) : null });
    setForm({ nodeId:'', type:'GAS_LEAK', severity:'HIGH', description:'' });
    setShowForm(false);
  }

  function handleUpdateAction(id) {
    if (!actionText.trim()) return;
    updateIncident(id, { actionTaken: actionText, status: 'IN_PROGRESS' });
    setActionText('');
    setEditId(null);
  }

  const filtered = filter === 'all' ? incidents : incidents.filter(i => i.status === filter);

  const counts = STATUSES.reduce((a, s) => ({ ...a, [s]: incidents.filter(i => i.status === s).length }), {});

  return (
    <div className="p-4 space-y-4 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <FileWarning className="w-5 h-5 text-mine-accent" />
          <h1 className="font-bold text-lg">Incident Reports</h1>
          <span className="badge-danger">{counts.OPEN || 0} open</span>
        </div>
        {canFile && (
          <button onClick={() => setShowForm(v => !v)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> File Report
          </button>
        )}
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3">
        {STATUSES.map(s => (
          <div key={s} className="card text-center">
            <div className="metric-label mb-1">{s.replace('_',' ')}</div>
            <div className={`text-2xl font-black ${s==='OPEN'?'text-red-400':s==='IN_PROGRESS'?'text-orange-400':s==='RESOLVED'?'text-green-400':'text-mine-muted'}`}>
              {counts[s] || 0}
            </div>
          </div>
        ))}
      </div>

      {/* File form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card border border-red-800/40 bg-red-900/10 space-y-4 animate-slide-up">
          <div className="section-title">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> File New Incident Report
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="metric-label mb-1.5 block">Node ID</label>
              <input type="number" min={1} max={5} className="input-dark" placeholder="1–5 (optional)"
                value={form.nodeId} onChange={e => setForm(f => ({ ...f, nodeId: e.target.value }))} />
            </div>
            <div>
              <label className="metric-label mb-1.5 block">Incident Type</label>
              <select className="input-dark" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {TYPES.map(t => <option key={t}>{t.replace('_',' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="metric-label mb-1.5 block">Severity</label>
              <select className="input-dark" value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
                {SEVERITIES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="metric-label mb-1.5 block">Description</label>
            <div className="relative">
              <textarea className="input-dark w-full"
                style={{ minHeight: '6.5rem', maxHeight: '14rem', overflowY: 'auto' }}
                placeholder="Describe what happened, location, time, people involved…"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                maxLength={2000}
              />
              <span className={`absolute bottom-2.5 right-3 text-xs font-mono pointer-events-none transition-colors
                ${form.description.length > 1800 ? 'text-red-400' : form.description.length > 1400 ? 'text-amber-400' : 'text-ink-600'}`}>
                {form.description.length}/2000
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-danger flex items-center gap-2">
              <FileWarning className="w-4 h-4" /> Submit Report
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-ghost flex items-center gap-2">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-mine-muted" />
        {['all', ...STATUSES].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
              ${filter === s ? 'bg-mine-accent text-mine-bg' : 'btn-ghost'}`}>
            {s === 'all' ? 'All' : s.replace('_',' ')}
          </button>
        ))}
      </div>

      {/* Incident cards */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="card text-center py-10 text-mine-muted">No incidents in this category.</div>
        )}
        {filtered.map(inc => {
          const expanded = expandId === inc.id;
          return (
            <div key={inc.id} className="card border border-mine-border/60 animate-slide-in">
              {/* Card header row */}
              <div className="flex items-center gap-3 flex-wrap cursor-pointer"
                onClick={() => setExpandId(expanded ? null : inc.id)}>
                <span className={`badge-danger text-xs`}>{inc.severity}</span>
                <span className="font-semibold text-sm text-mine-text">{inc.type.replace('_',' ')}</span>
                {inc.nodeId && <span className="badge-info text-xs">Node {inc.nodeId}</span>}
                <span className={`text-xs px-2 py-0.5 rounded border ${STA_COLOR[inc.status]}`}>{inc.status.replace('_',' ')}</span>
                <span className="text-mine-muted text-xs ml-auto">{timeStr(inc.timestamp)}</span>
                {expanded ? <ChevronUp className="w-4 h-4 text-mine-muted" /> : <ChevronDown className="w-4 h-4 text-mine-muted" />}
              </div>

              {expanded && (
                <div className="mt-4 space-y-3 border-t border-mine-border/40 pt-3">
                  <div>
                    <div className="metric-label mb-1">Reported by</div>
                    <div className="text-mine-dim text-sm">{inc.reportedBy} · <span className="text-mine-muted">{inc.role}</span></div>
                  </div>
                  <div>
                    <div className="metric-label mb-1">Description</div>
                    <p className="text-mine-dim text-sm leading-relaxed">{inc.description}</p>
                  </div>
                  {inc.actionTaken && (
                    <div className="bg-green-900/15 border border-green-800/30 rounded-lg p-3">
                      <div className="metric-label mb-1 text-green-400">Action Taken</div>
                      <p className="text-mine-dim text-sm">{inc.actionTaken}</p>
                    </div>
                  )}

                  {/* Update status / action */}
                  {canFile && inc.status !== 'CLOSED' && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {STATUSES.filter(s => s !== inc.status).map(s => (
                        <button key={s} onClick={() => updateIncident(inc.id, { status: s })}
                          className="btn-ghost text-xs">{s.replace('_',' ')}</button>
                      ))}
                      {editId === inc.id ? (
                        <div className="flex items-center gap-2 w-full mt-2">
                          <input className="input-dark flex-1 text-sm py-1.5"
                            placeholder="Describe action taken…" value={actionText}
                            onChange={e => setActionText(e.target.value)} />
                          <button onClick={() => handleUpdateAction(inc.id)}
                            className="text-green-400 hover:text-green-300"><Save className="w-4 h-4" /></button>
                          <button onClick={() => setEditId(null)}
                            className="text-mine-muted hover:text-mine-dim"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditId(inc.id); setActionText(inc.actionTaken || ''); }}
                          className="btn-ghost text-xs flex items-center gap-1">
                          <Edit3 className="w-3 h-3" /> Add Action
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
