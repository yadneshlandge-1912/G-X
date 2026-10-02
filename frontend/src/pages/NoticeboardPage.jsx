import React, { useState } from 'react';
import { Megaphone, Plus, Pin, X, AlertTriangle, Info, CheckCircle, Bell } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const TYPE_META = {
  urgent:  { label:'URGENT',   color:'text-red-400',    bg:'bg-red-900/20',    border:'border-red-700/30',    Icon:AlertTriangle },
  notice:  { label:'NOTICE',   color:'text-amber-400',  bg:'bg-amber-900/20',  border:'border-amber-700/30',  Icon:Bell },
  info:    { label:'INFO',     color:'text-blue-400',   bg:'bg-blue-900/20',   border:'border-blue-700/30',   Icon:Info },
  resolved:{ label:'RESOLVED', color:'text-green-400',  bg:'bg-green-900/20',  border:'border-green-700/30',  Icon:CheckCircle },
};

const SEED = [
  { id:'n1', type:'urgent',   title:'Gas Level Alert — Node 4', body:'Gas PPM exceeded 600 in Deep Face East at 09:30. Ventilation team deployed. Area under monitoring.', author:'Admin', date: Date.now()-3600000, pinned:true },
  { id:'n2', type:'notice',   title:'Shift Change — 14:00 Today', body:'Evening shift starts at 14:00. All morning shift miners to complete exit checklist before 13:45.', author:'Vikas Sharma', date: Date.now()-7200000, pinned:true },
  { id:'n3', type:'info',     title:'Safety Training — 20 Sep', body:'Mandatory safety training for all miners on 20 September at 09:00. Attendance is compulsory.', author:'Admin', date: Date.now()-86400000, pinned:false },
  { id:'n4', type:'resolved', title:'Water Pump #2 Repaired', body:'Main tunnel water pump #2 has been repaired and is fully operational. Normal drainage resumed.', author:'Maintenance', date: Date.now()-172800000, pinned:false },
];

function timeAgo(ts) {
  const s = Math.floor((Date.now()-ts)/1000);
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

export default function NoticeboardPage() {
  const currentUser = useAuthStore(s => s.currentUser);
  const isAdmin = ['admin','supervisor'].includes(currentUser?.role);
  const [notices, setNotices] = useState(SEED);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title:'', body:'', type:'notice' });
  const [filter, setFilter] = useState('all');

  function post() {
    if (!form.title.trim() || !form.body.trim()) return;
    setNotices(n => [{ id:'n'+Date.now(), ...form, author: currentUser?.name, date: Date.now(), pinned:false }, ...n]);
    setForm({ title:'', body:'', type:'notice' });
    setShowForm(false);
  }

  function togglePin(id) { setNotices(n => n.map(x => x.id===id ? {...x, pinned:!x.pinned} : x)); }
  function remove(id) { setNotices(n => n.filter(x => x.id!==id)); }

  const filtered = filter==='all' ? notices : notices.filter(n => n.type===filter);
  const pinned = filtered.filter(n => n.pinned);
  const rest = filtered.filter(n => !n.pinned);

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Megaphone className="w-5 h-5 text-mine-accent" />
          <h1 className="font-bold text-lg">Noticeboard</h1>
          <span className="badge-danger">{notices.filter(n=>n.type==='urgent').length} urgent</span>
        </div>
        {isAdmin && <button onClick={()=>setShowForm(v=>!v)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4"/>Post Notice</button>}
      </div>

      {showForm && (
        <div className="card border border-mine-border/60 space-y-3">
          <div className="section-title"><Plus className="w-3.5 h-3.5"/>New Notice</div>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(TYPE_META).map(([k,m]) => (
              <button key={k} type="button" onClick={()=>setForm(f=>({...f,type:k}))}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${form.type===k ? `${m.bg} ${m.border} ${m.color}` : 'border-mine-border text-mine-muted'}`}>
                {m.label}
              </button>
            ))}
          </div>
          <input className="input-dark" placeholder="Notice title" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} />
          <textarea className="input-dark w-full" rows={3} placeholder="Notice body..." value={form.body} onChange={e=>setForm(f=>({...f,body:e.target.value}))} />
          <div className="flex gap-2">
            <button onClick={post} className="btn-primary flex items-center gap-2"><Megaphone className="w-4 h-4"/>Post</button>
            <button onClick={()=>setShowForm(false)} className="btn-ghost flex items-center gap-2"><X className="w-4 h-4"/>Cancel</button>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {['all','urgent','notice','info','resolved'].map(f => (
          <button key={f} onClick={()=>setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filter===f ? 'bg-mine-accent text-mine-bg' : 'btn-ghost'}`}>
            {f==='all' ? 'All' : f.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {[...pinned, ...rest].map(n => {
          const m = TYPE_META[n.type] || TYPE_META.info;
          return (
            <div key={n.id} className={`card border ${m.border} ${m.bg}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <m.Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${m.color}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-black ${m.color}`}>{m.label}</span>
                      {n.pinned && <Pin className="w-3 h-3 text-mine-accent" />}
                      <span className="font-semibold text-sm text-mine-text">{n.title}</span>
                    </div>
                    <p className="text-xs text-mine-dim mt-1 leading-relaxed">{n.body}</p>
                    <div className="text-xs text-ink-600 mt-2">{n.author} · {timeAgo(n.date)}</div>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={()=>togglePin(n.id)} className="btn-icon" title="Pin/Unpin"><Pin className="w-3 h-3"/></button>
                    <button onClick={()=>remove(n.id)} className="btn-icon" title="Delete"><X className="w-3 h-3"/></button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length===0 && <div className="card text-center py-10 text-mine-muted">No notices in this category.</div>}
      </div>
    </div>
  );
}
