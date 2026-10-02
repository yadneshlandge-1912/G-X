import React, { useState } from 'react';
import {
  Wrench, Plus, CheckCircle, AlertTriangle, XCircle,
  Filter, Edit3, Save, X, Clock, User,
} from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const STATUS_META = {
  OK:       { label: 'OK',       Icon: CheckCircle,  color: 'text-green-400',  badge: 'badge-safe',   border: 'border-green-800/40'  },
  WARNING:  { label: 'Warning',  Icon: AlertTriangle, color: 'text-orange-400', badge: 'badge-warn',   border: 'border-orange-700/40' },
  CRITICAL: { label: 'Critical', Icon: XCircle,      color: 'text-red-400',    badge: 'badge-danger', border: 'border-red-700/40'    },
};

const TYPES = ['wearable','electronics','infrastructure','power','sensor','safety','other'];

const TYPE_EMOJI = {
  wearable:'📟', electronics:'💻', infrastructure:'🏗️', power:'🔋', sensor:'📡', safety:'🧯', other:'📦',
};

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}

const BLANK = { name:'', type:'wearable', status:'OK', assignedTo:'', notes:'' };

export default function EquipmentPage() {
  const currentUser    = useAuthStore(s => s.currentUser);
  const equipment      = useAuthStore(s => s.equipment);
  const updateEquipment= useAuthStore(s => s.updateEquipment);
  const addEquipment   = useAuthStore(s => s.addEquipment);

  const [filter,    setFilter]    = useState('all');
  const [typeFilter,setTypeFilter]= useState('all');
  const [editId,    setEditId]    = useState(null);
  const [editForm,  setEditForm]  = useState({});
  const [showAdd,   setShowAdd]   = useState(false);
  const [newItem,   setNewItem]   = useState({ ...BLANK });

  const canEdit = ['admin','supervisor'].includes(currentUser?.role);

  const filtered = equipment.filter(e => {
    const matchStatus = filter === 'all' || e.status === filter;
    const matchType   = typeFilter === 'all' || e.type === typeFilter;
    return matchStatus && matchType;
  });

  const counts = {
    OK:       equipment.filter(e => e.status === 'OK').length,
    WARNING:  equipment.filter(e => e.status === 'WARNING').length,
    CRITICAL: equipment.filter(e => e.status === 'CRITICAL').length,
  };

  function startEdit(item) {
    setEditId(item.id);
    setEditForm({ ...item });
    setShowAdd(false);
  }

  function saveEdit() {
    updateEquipment(editId, editForm);
    setEditId(null);
  }

  function handleAdd() {
    if (!newItem.name.trim()) return;
    addEquipment(newItem);
    setNewItem({ ...BLANK });
    setShowAdd(false);
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Wrench className="w-5 h-5 text-mine-accent" />
          <h1 className="font-bold text-lg">Equipment & Maintenance</h1>
          <span className="badge-info">{equipment.length} items</span>
        </div>
        {canEdit && (
          <button onClick={() => { setShowAdd(v => !v); setEditId(null); }}
            className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Equipment
          </button>
        )}
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(STATUS_META).map(([k, m]) => (
          <div key={k} className={`card border ${m.border} flex items-center gap-3`}>
            <m.Icon className={`w-8 h-8 ${m.color}`} />
            <div>
              <div className="metric-label">{m.label}</div>
              <div className={`text-2xl font-black ${m.color}`}>{counts[k]}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card border border-mine-accent/30 animate-slide-up space-y-3">
          <div className="section-title"><Plus className="w-3.5 h-3.5 text-mine-accent" /> Add Equipment</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="metric-label mb-1.5 block">Item Name</label>
              <input className="input-dark" placeholder="e.g. Node 6 Wearable"
                value={newItem.name} onChange={e => setNewItem(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="metric-label mb-1.5 block">Type</label>
              <select className="input-dark" value={newItem.type} onChange={e => setNewItem(f => ({ ...f, type: e.target.value }))}>
                {TYPES.map(t => <option key={t} value={t}>{TYPE_EMOJI[t]} {t}</option>)}
              </select>
            </div>
            <div>
              <label className="metric-label mb-1.5 block">Status</label>
              <select className="input-dark" value={newItem.status} onChange={e => setNewItem(f => ({ ...f, status: e.target.value }))}>
                {Object.keys(STATUS_META).map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="metric-label mb-1.5 block">Assigned To</label>
              <input className="input-dark" placeholder="Person or team"
                value={newItem.assignedTo} onChange={e => setNewItem(f => ({ ...f, assignedTo: e.target.value }))} />
            </div>
            <div>
              <label className="metric-label mb-1.5 block">Notes</label>
              <input className="input-dark" placeholder="Optional notes"
                value={newItem.notes} onChange={e => setNewItem(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleAdd} className="btn-primary flex items-center gap-2">
              <Save className="w-4 h-4" /> Save
            </button>
            <button onClick={() => setShowAdd(false)} className="btn-ghost flex items-center gap-2">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <Filter className="w-3.5 h-3.5 text-mine-muted mr-1" />
          {['all', 'OK', 'WARNING', 'CRITICAL'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                ${filter === f ? 'bg-mine-accent text-mine-bg' : 'btn-ghost'}`}>
              {f === 'all' ? 'All Status' : f}
            </button>
          ))}
        </div>
        <select className="input-dark w-auto text-xs py-1.5"
          value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          {TYPES.map(t => <option key={t} value={t}>{TYPE_EMOJI[t]} {t}</option>)}
        </select>
      </div>

      {/* Equipment grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(item => {
          const m = STATUS_META[item.status] || STATUS_META.OK;
          const isEditing = editId === item.id;
          return (
            <div key={item.id} className={`card border ${m.border} relative`}>
              {/* Status indicator */}
              <div className="absolute top-3 right-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded border ${m.badge}`}>{m.label}</span>
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  <select className="input-dark text-xs py-1.5" value={editForm.status}
                    onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                    {Object.keys(STATUS_META).map(s => <option key={s}>{s}</option>)}
                  </select>
                  <input className="input-dark text-xs py-1.5" placeholder="Assigned to"
                    value={editForm.assignedTo || ''}
                    onChange={e => setEditForm(f => ({ ...f, assignedTo: e.target.value }))} />
                  <input className="input-dark text-xs py-1.5" placeholder="Notes"
                    value={editForm.notes || ''}
                    onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
                  <div className="flex gap-2 mt-2">
                    <button onClick={saveEdit} className="text-green-400 hover:text-green-300 transition-colors"><Save className="w-4 h-4" /></button>
                    <button onClick={() => setEditId(null)} className="text-mine-muted hover:text-mine-dim"><X className="w-4 h-4" /></button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3 mb-3 pr-16">
                    <span className="text-2xl flex-shrink-0">{TYPE_EMOJI[item.type] || '📦'}</span>
                    <div>
                      <div className="font-semibold text-sm text-mine-text leading-tight">{item.name}</div>
                      <div className="text-mine-muted text-xs mt-0.5 capitalize">{item.type}</div>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 text-mine-muted">
                      <User className="w-3 h-3" />
                      <span>{item.assignedTo || 'Unassigned'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-mine-muted">
                      <Clock className="w-3 h-3" />
                      <span>Last check: {timeAgo(item.lastCheck)}</span>
                    </div>
                    {item.notes && (
                      <div className="text-mine-muted italic mt-1">{item.notes}</div>
                    )}
                  </div>
                  {canEdit && (
                    <button onClick={() => startEdit(item)}
                      className="absolute bottom-3 right-3 text-mine-muted hover:text-mine-accent transition-colors">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-3 card text-center py-10 text-mine-muted">No equipment matches your filter.</div>
        )}
      </div>
    </div>
  );
}
