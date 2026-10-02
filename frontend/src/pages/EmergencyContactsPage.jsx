import React, { useState } from 'react';
import {
  PhoneCall, Search, MapPin, Phone, Plus, X,
  CheckCircle, AlertTriangle, Clock,
} from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const SEED_CONTACTS = [
  { id:1,  name:'Mine Manager',        phone:'+919876543210', dept:'Management',  available:true,  loc:'Surface Office',  priority:1 },
  { id:2,  name:'Safety Officer',      phone:'+919876543211', dept:'Safety',      available:true,  loc:'SEC-A',           priority:1 },
  { id:3,  name:'Rescue Team Leader',  phone:'+919876543212', dept:'Rescue',      available:true,  loc:'Rescue Station',  priority:1 },
  { id:4,  name:'Medical Officer',     phone:'+919876543213', dept:'Medical',     available:false, loc:'Surface',         priority:1 },
  { id:5,  name:'Chief Engineer',      phone:'+919876543214', dept:'Engineering', available:true,  loc:'Control Room',    priority:2 },
  { id:6,  name:'DGMS Inspector',      phone:'+919988776655', dept:'Regulatory',  available:false, loc:'Dhanbad',         priority:2 },
  { id:7,  name:'Fire Brigade',        phone:'101',           dept:'Emergency',   available:true,  loc:'Nearest Station', priority:1 },
  { id:8,  name:'Ambulance / MHFW',    phone:'108',           dept:'Medical',     available:true,  loc:'5 km',            priority:1 },
  { id:9,  name:'Police Control Room', phone:'100',           dept:'Emergency',   available:true,  loc:'Jharia',          priority:1 },
  { id:10, name:'LoRa Gateway Admin',  phone:'+919876543215', dept:'Technical',   available:true,  loc:'Server Room',     priority:3 },
  { id:11, name:'BCCL Control Room',   phone:'+91326-2220900',dept:'Authority',   available:true,  loc:'Dhanbad HQ',      priority:2 },
  { id:12, name:'Electricity Board',   phone:'1912',          dept:'Utility',     available:true,  loc:'Regional Office', priority:3 },
];

const DEPT_COLOR = {
  Management:'#f59e0b', Safety:'#10b981', Rescue:'#ef4444',
  Medical:'#ec4899', Engineering:'#3b82f6', Regulatory:'#8b5cf6',
  Emergency:'#ef4444', Technical:'#06b6d4', Authority:'#f97316', Utility:'#64748b',
};

const PRIORITY_LABEL = { 1:'CRITICAL', 2:'IMPORTANT', 3:'SUPPORT' };
const PRIORITY_COLOR = { 1:'text-red-400', 2:'text-amber-400', 3:'text-ink-500' };

// Format phone for display
function displayPhone(p) {
  if (p.length <= 4) return p;
  return p.replace(/^\+91/, '+91 ').replace(/(\d{5})(\d{5})$/, '$1 $2');
}

// Log entry for call history
const CALL_LOG_KEY = 'mg_call_log';
function loadLog() {
  try { return JSON.parse(localStorage.getItem(CALL_LOG_KEY) || '[]'); } catch { return []; }
}
function saveLog(log) {
  try { localStorage.setItem(CALL_LOG_KEY, JSON.stringify(log.slice(0, 50))); } catch {}
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return new Date(ts).toLocaleDateString('en-IN');
}

export default function EmergencyContactsPage() {
  const currentUser = useAuthStore(s => s.currentUser);
  const isAdmin = ['admin','supervisor'].includes(currentUser?.role);

  const [contacts, setContacts] = useState(SEED_CONTACTS);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState('all');
  const [callLog, setCallLog]   = useState(loadLog);
  const [showForm, setShowForm] = useState(false);
  const [callingId, setCallingId] = useState(null); // shows "Calling…" feedback
  const [form, setForm] = useState({ name:'', phone:'', dept:'Safety', loc:'', available:true, priority:2 });

  // ── Filtered contacts ──────────────────────────────────────
  const filtered = contacts.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
                        c.dept.toLowerCase().includes(search.toLowerCase()) ||
                        c.phone.includes(search);
    const matchFilter = filter === 'all' ? true
      : filter === 'available' ? c.available
      : filter === 'critical'  ? c.priority === 1
      : c.dept.toLowerCase() === filter;
    return matchSearch && matchFilter;
  });

  // ── Make a call ────────────────────────────────────────────
  function makeCall(contact) {
    // Log the call attempt
    const entry = {
      id: Date.now(),
      name: contact.name,
      phone: contact.phone,
      calledBy: currentUser?.name || 'Unknown',
      ts: Date.now(),
    };
    const updated = [entry, ...callLog];
    setCallLog(updated);
    saveLog(updated);

    // Visual feedback
    setCallingId(contact.id);
    setTimeout(() => setCallingId(null), 3000);

    // Open the phone dialer (works on mobile + desktop calling apps)
    window.location.href = `tel:${contact.phone.replace(/\s+/g, '')}`;
  }

  // ── Add contact ────────────────────────────────────────────
  function addContact() {
    if (!form.name || !form.phone) return;
    setContacts(c => [...c, { id: Date.now(), ...form, priority: parseInt(form.priority) }]);
    setForm({ name:'', phone:'', dept:'Safety', loc:'', available:true, priority:2 });
    setShowForm(false);
  }

  // ── Toggle availability ────────────────────────────────────
  function toggleAvail(id) {
    setContacts(c => c.map(x => x.id === id ? {...x, available: !x.available} : x));
  }

  const critical = contacts.filter(c => c.priority === 1);
  const available = contacts.filter(c => c.available).length;

  return (
    <div className="p-4 space-y-4 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <PhoneCall className="w-5 h-5 text-red-400" />
          <h1 className="font-bold text-lg">Emergency Directory</h1>
          <span className="badge-danger">{critical.length} critical</span>
          <span className="badge-safe">{available} available</span>
        </div>
        {isAdmin && (
          <button onClick={() => setShowForm(v => !v)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Contact
          </button>
        )}
      </div>

      {/* SOS Quick-dial strip */}
      <div className="card border border-red-700/40 bg-red-900/10">
        <div className="section-title mb-3">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> Quick Dial — Emergency Numbers
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { label:'🚒 Fire',      phone:'101', color:'#ef4444' },
            { label:'🚑 Ambulance', phone:'108', color:'#ec4899' },
            { label:'👮 Police',    phone:'100', color:'#3b82f6' },
            { label:'⚡ Electricity','phone':'1912', color:'#f59e0b' },
          ].map(q => (
            <a
              key={q.phone}
              href={`tel:${q.phone}`}
              onClick={() => {
                const entry = { id:Date.now(), name:q.label, phone:q.phone, calledBy:currentUser?.name||'Unknown', ts:Date.now() };
                const updated = [entry, ...callLog];
                setCallLog(updated);
                saveLog(updated);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-105 active:scale-95"
              style={{
                background: `${q.color}18`,
                border: `1px solid ${q.color}40`,
                color: q.color,
                textDecoration: 'none',
                boxShadow: `0 2px 12px ${q.color}20`,
              }}
            >
              <Phone className="w-4 h-4" />
              {q.label} — {q.phone}
            </a>
          ))}
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mine-muted" />
          <input className="input-dark pl-9 w-full" placeholder="Search name, department, phone..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[
            ['all','All'],['available','Available'],['critical','Critical'],
            ['rescue','Rescue'],['medical','Medical'],['emergency','Emergency'],
          ].map(([k,l]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`filter-btn ${filter===k?'active':''}`}>{l}</button>
          ))}
        </div>
      </div>

      {/* Add contact form */}
      {showForm && (
        <div className="card border border-mine-border/60 space-y-3 form-animated">
          <div className="section-title"><Plus className="w-3.5 h-3.5" /> New Emergency Contact</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="metric-label mb-1.5 block">Name</label>
              <input className="input-dark" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Contact name / role" /></div>
            <div><label className="metric-label mb-1.5 block">Phone Number</label>
              <input className="input-dark" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+91XXXXXXXXXX or 101" /></div>
            <div><label className="metric-label mb-1.5 block">Department</label>
              <select className="input-dark" value={form.dept} onChange={e=>setForm(f=>({...f,dept:e.target.value}))}>
                {Object.keys(DEPT_COLOR).map(d=><option key={d}>{d}</option>)}
              </select></div>
            <div><label className="metric-label mb-1.5 block">Location</label>
              <input className="input-dark" value={form.loc} onChange={e=>setForm(f=>({...f,loc:e.target.value}))} placeholder="Where are they based?" /></div>
            <div><label className="metric-label mb-1.5 block">Priority</label>
              <select className="input-dark" value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}>
                <option value={1}>1 — Critical</option>
                <option value={2}>2 — Important</option>
                <option value={3}>3 — Support</option>
              </select></div>
          </div>
          <div className="flex gap-2">
            <button onClick={addContact} className="btn-primary flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Add Contact
            </button>
            <button onClick={()=>setShowForm(false)} className="btn-ghost flex items-center gap-2">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Contact cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.length === 0 && (
          <div className="card text-center py-10 text-mine-muted col-span-2">No contacts found.</div>
        )}
        {filtered.map(c => {
          const deptColor  = DEPT_COLOR[c.dept] || '#64748b';
          const isCalling  = callingId === c.id;

          return (
            <div key={c.id} className="card flex items-start gap-4 transition-all hover:border-white/10"
              style={{ borderColor: c.priority === 1 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)' }}>

              {/* Avatar / icon */}
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                style={{ background:`${deptColor}18`, border:`1px solid ${deptColor}30` }}>
                {c.dept==='Rescue'?'🦺':c.dept==='Medical'?'🏥':c.dept==='Emergency'?'🚨':c.dept==='Management'?'👔':c.dept==='Technical'?'💻':'📞'}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-white truncate">{c.name}</span>
                  <span className={`text-xs font-black ${PRIORITY_COLOR[c.priority]}`}>
                    {PRIORITY_LABEL[c.priority]}
                  </span>
                </div>

                <div className="text-sm font-mono mt-0.5" style={{ color: deptColor }}>
                  {displayPhone(c.phone)}
                </div>

                <div className="flex items-center gap-3 mt-1 text-xs text-ink-500">
                  <span style={{ color: deptColor }}>{c.dept}</span>
                  <span className="flex items-center gap-0.5">
                    <MapPin className="w-2.5 h-2.5" />{c.loc}
                  </span>
                </div>

                {/* Availability + last called */}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <button
                    onClick={() => isAdmin && toggleAvail(c.id)}
                    className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border transition-all
                      ${c.available
                        ? 'bg-green-900/20 text-green-400 border-green-700/30'
                        : 'bg-mine-deeper text-ink-500 border-mine-border/30'}`}
                    title={isAdmin ? 'Click to toggle availability' : undefined}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${c.available ? 'bg-green-400' : 'bg-ink-500'}`} />
                    {c.available ? 'Available' : 'Off Duty'}
                  </button>
                  {callLog.find(l => l.name === c.name) && (
                    <span className="text-xs text-ink-600 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      Called {timeAgo(callLog.find(l=>l.name===c.name).ts)}
                    </span>
                  )}
                </div>
              </div>

              {/* CALL button */}
              <a
                href={`tel:${c.phone.replace(/\s+/g,'')}`}
                onClick={() => makeCall(c)}
                className="flex-shrink-0 flex flex-col items-center justify-center gap-1 px-3 py-2.5 rounded-xl transition-all active:scale-95"
                style={{
                  background: isCalling
                    ? 'rgba(16,185,129,0.2)'
                    : c.available
                    ? 'rgba(16,185,129,0.12)'
                    : 'rgba(100,116,139,0.1)',
                  border: `1px solid ${isCalling ? 'rgba(16,185,129,0.6)' : c.available ? 'rgba(16,185,129,0.3)' : 'rgba(100,116,139,0.2)'}`,
                  color: isCalling ? '#34d399' : c.available ? '#10b981' : '#64748b',
                  textDecoration: 'none',
                  boxShadow: c.available && !isCalling ? '0 2px 12px rgba(16,185,129,0.15)' : 'none',
                  animation: isCalling ? 'btnAmberPulse 0.8s ease-in-out infinite' : 'none',
                  minWidth: '3.5rem',
                }}
              >
                <Phone className="w-5 h-5" />
                <span className="text-[10px] font-bold">
                  {isCalling ? 'Calling…' : 'CALL'}
                </span>
              </a>
            </div>
          );
        })}
      </div>

      {/* Recent call log */}
      {callLog.length > 0 && (
        <div className="card">
          <div className="section-title mb-3">
            <Clock className="w-3.5 h-3.5 text-mine-cyan" /> Recent Calls
          </div>
          <div className="space-y-2">
            {callLog.slice(0, 8).map(l => (
              <div key={l.id} className="flex items-center justify-between gap-3 py-2 border-b border-mine-border/20 last:border-0">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-sm font-semibold text-mine-text">{l.name}</span>
                  <span className="font-mono text-xs text-mine-accent">{displayPhone(l.phone)}</span>
                </div>
                <div className="text-right text-xs text-ink-500">
                  <div>{timeAgo(l.ts)}</div>
                  <div>by {l.calledBy}</div>
                </div>
              </div>
            ))}
          </div>
          {callLog.length > 8 && (
            <div className="text-xs text-ink-600 mt-2 text-center">
              +{callLog.length - 8} more calls in history
            </div>
          )}
        </div>
      )}
    </div>
  );
}
