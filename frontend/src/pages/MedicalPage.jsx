import React, { useState } from 'react';
import { Heart, Plus, User, AlertTriangle, CheckCircle, X, Calendar } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const SEED_RECORDS = [
  { id:'med1', name:'Rajan Kumar',  badge:'MN-001', blood:'B+', lastCheckup:'2026-08-15', status:'Fit',      conditions:'None',           emergencyContact:'9876543201', notes:'' },
  { id:'med2', name:'Deepak Singh', badge:'MN-002', blood:'O+', lastCheckup:'2026-07-20', status:'Fit',      conditions:'Mild hypertension',emergencyContact:'9876543202', notes:'BP 140/90 — monitor' },
  { id:'med3', name:'Amit Verma',   badge:'MN-003', blood:'A+', lastCheckup:'2026-09-01', status:'Restricted',conditions:'Back injury',    emergencyContact:'9876543203', notes:'No lifting >10kg' },
  { id:'med4', name:'Suresh Pal',   badge:'MN-004', blood:'AB+',lastCheckup:'2026-08-30', status:'Fit',      conditions:'None',           emergencyContact:'9876543204', notes:'' },
  { id:'med5', name:'Mohan Das',    badge:'MN-005', blood:'B-', lastCheckup:'2026-06-10', status:'Review Due',conditions:'Diabetes (Type 2)',emergencyContact:'9876543205', notes:'Annual checkup overdue' },
];

const SEED_AID = [
  { id:'a1', date:'2026-09-10', miner:'Suresh Pal', injury:'Minor cut on right hand', treatment:'Antiseptic + bandage', treatedBy:'Arjun Meena', followUp:false },
  { id:'a2', date:'2026-09-05', miner:'Rajan Kumar', injury:'Dust exposure — eye irritation', treatment:'Eye wash + rest', treatedBy:'Sunita Bose', followUp:true },
];

const STATUS_COLOR = { 'Fit':'text-green-400', 'Restricted':'text-amber-400', 'Review Due':'text-red-400', 'Unfit':'text-red-400' };

export default function MedicalPage() {
  const currentUser = useAuthStore(s => s.currentUser);
  const isAdmin = ['admin','supervisor','rescue'].includes(currentUser?.role);
  const [records] = useState(SEED_RECORDS);
  const [aidLog, setAidLog] = useState(SEED_AID);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ miner:'', injury:'', treatment:'', treatedBy: currentUser?.name || '', followUp:false });
  const [tab, setTab] = useState('records');

  function addAid() {
    if (!form.miner || !form.injury) return;
    setAidLog(l => [{ id:'a'+Date.now(), date: new Date().toISOString().slice(0,10), ...form }, ...l]);
    setForm({ miner:'', injury:'', treatment:'', treatedBy: currentUser?.name||'', followUp:false });
    setShowForm(false);
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Heart className="w-5 h-5 text-red-400" />
          <h1 className="font-bold text-lg">Medical Records</h1>
          <span className="badge-danger">{records.filter(r=>r.status==='Review Due').length} review due</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center"><div className="metric-label mb-1">Fit for Work</div><div className="text-2xl font-black text-green-400">{records.filter(r=>r.status==='Fit').length}</div></div>
        <div className="card text-center"><div className="metric-label mb-1">Restricted</div><div className="text-2xl font-black text-amber-400">{records.filter(r=>r.status==='Restricted').length}</div></div>
        <div className="card text-center"><div className="metric-label mb-1">Review Due</div><div className="text-2xl font-black text-red-400">{records.filter(r=>r.status==='Review Due').length}</div></div>
      </div>

      <div className="flex gap-2">
        {['records','firstaid'].map(t => (
          <button key={t} onClick={()=>setTab(t)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${tab===t?'bg-mine-accent text-mine-bg':'btn-ghost'}`}>
            {t==='records' ? 'Health Records' : 'First Aid Log'}
          </button>
        ))}
      </div>

      {tab==='records' && (
        <div className="card overflow-x-auto">
          <table className="data-table w-full">
            <thead><tr><th>Miner</th><th>Badge</th><th>Blood</th><th>Last Checkup</th><th>Status</th><th>Conditions</th><th>Notes</th></tr></thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id}>
                  <td className="font-semibold text-mine-text">{r.name}</td>
                  <td className="font-mono">{r.badge}</td>
                  <td><span className="badge-danger">{r.blood}</span></td>
                  <td className="font-mono text-xs">{r.lastCheckup}</td>
                  <td><span className={`font-bold text-xs ${STATUS_COLOR[r.status]}`}>{r.status}</span></td>
                  <td className="text-xs">{r.conditions}</td>
                  <td className="text-xs text-ink-500">{r.notes||'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab==='firstaid' && (
        <div className="space-y-3">
          {isAdmin && (
            <button onClick={()=>setShowForm(v=>!v)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4"/>Log First Aid</button>
          )}
          {showForm && (
            <div className="card border border-mine-border/60 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="metric-label mb-1.5 block">Miner Name</label><input className="input-dark" value={form.miner} onChange={e=>setForm(f=>({...f,miner:e.target.value}))} placeholder="Miner name" /></div>
                <div><label className="metric-label mb-1.5 block">Injury/Complaint</label><input className="input-dark" value={form.injury} onChange={e=>setForm(f=>({...f,injury:e.target.value}))} placeholder="Describe injury" /></div>
                <div><label className="metric-label mb-1.5 block">Treatment Given</label><input className="input-dark" value={form.treatment} onChange={e=>setForm(f=>({...f,treatment:e.target.value}))} placeholder="Treatment" /></div>
                <div><label className="metric-label mb-1.5 block">Treated By</label><input className="input-dark" value={form.treatedBy} onChange={e=>setForm(f=>({...f,treatedBy:e.target.value}))} placeholder="Name" /></div>
              </div>
              <div className="flex gap-3">
                <button onClick={addAid} className="btn-primary flex items-center gap-2"><CheckCircle className="w-4 h-4"/>Save Record</button>
                <button onClick={()=>setShowForm(false)} className="btn-ghost flex items-center gap-2"><X className="w-4 h-4"/>Cancel</button>
              </div>
            </div>
          )}
          {aidLog.map(a => (
            <div key={a.id} className="card border border-mine-border/40">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2"><User className="w-3.5 h-3.5 text-mine-accent"/><span className="font-semibold text-sm">{a.miner}</span><span className="text-xs text-ink-500">{a.date}</span></div>
                  <div className="text-xs text-mine-dim mt-1"><span className="text-ink-400 font-semibold">Injury:</span> {a.injury}</div>
                  <div className="text-xs text-mine-dim mt-0.5"><span className="text-ink-400 font-semibold">Treatment:</span> {a.treatment}</div>
                  <div className="text-xs text-ink-500 mt-1">Treated by: {a.treatedBy} {a.followUp && <span className="badge-warn ml-2">Follow-up needed</span>}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
