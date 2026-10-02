import React, { useState } from 'react';
import { Shield, Plus, CheckCircle, XCircle, Clock, User, Save, X } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const PERMIT_TYPES = ['Hot Work','Confined Space','Electrical','Blasting','Excavation','Height Work'];
const STATUS_META = {
  PENDING:  { label:'Pending',  color:'text-yellow-400', badge:'badge-warn' },
  APPROVED: { label:'Approved', color:'text-green-400',  badge:'badge-safe' },
  ACTIVE:   { label:'Active',   color:'text-mine-blue',  badge:'badge-info' },
  EXPIRED:  { label:'Expired',  color:'text-mine-muted', badge:'badge-offline' },
  REJECTED: { label:'Rejected', color:'text-red-400',    badge:'badge-danger' },
};

let permitId = 1;
const SEED = [
  { id:1, type:'Hot Work',       requestedBy:'Rajan Kumar', section:'SEC-A', status:'APPROVED', validFrom:'2026-09-27 08:00', validTo:'2026-09-27 18:00', description:'Welding repairs on conveyor belt motor housing.' },
  { id:2, type:'Confined Space', requestedBy:'Arjun Singh',  section:'SEC-B', status:'ACTIVE',   validFrom:'2026-09-27 10:00', validTo:'2026-09-27 14:00', description:'Pump chamber inspection and cleaning.' },
  { id:3, type:'Blasting',       requestedBy:'Vikas Sharma', section:'SEC-C', status:'PENDING',  validFrom:'2026-09-28 06:00', validTo:'2026-09-28 08:00', description:'Controlled blast for tunnel extension phase 2.' },
];

export default function WorkPermitPage() {
  const currentUser = useAuthStore(s => s.currentUser);
  const [permits, setPermits] = useState(SEED);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type:'Hot Work', section:'SEC-A', description:'', validFrom:'', validTo:'' });

  const canApprove = ['admin','supervisor'].includes(currentUser?.role);

  function submit(e) {
    e.preventDefault();
    if (!form.description.trim()) return;
    setPermits(p => [...p, { id:++permitId, ...form, requestedBy:currentUser?.name, status:'PENDING' }]);
    setShowForm(false);
    setForm({ type:'Hot Work', section:'SEC-A', description:'', validFrom:'', validTo:'' });
  }

  function updateStatus(id, status) {
    setPermits(p => p.map(permit => permit.id === id ? { ...permit, status } : permit));
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><Shield className="w-5 h-5 text-mine-accent" /><h1 className="font-bold text-lg">Work Permits</h1></div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1.5 text-sm"><Plus className="w-4 h-4" /> New Permit</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card space-y-3 animate-scale-in">
          <div className="section-title"><Plus className="w-3.5 h-3.5 text-mine-accent" /> Request New Work Permit</div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="metric-label mb-1 block">Permit Type</label>
              <select className="input-dark" value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))}>{PERMIT_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
            <div><label className="metric-label mb-1 block">Section</label>
              <select className="input-dark" value={form.section} onChange={e => setForm(f=>({...f,section:e.target.value}))}>{['SEC-A','SEC-B','SEC-C'].map(s=><option key={s}>{s}</option>)}</select></div>
            <div><label className="metric-label mb-1 block">Valid From</label>
              <input type="datetime-local" className="input-dark" value={form.validFrom} onChange={e=>setForm(f=>({...f,validFrom:e.target.value}))} /></div>
            <div><label className="metric-label mb-1 block">Valid To</label>
              <input type="datetime-local" className="input-dark" value={form.validTo} onChange={e=>setForm(f=>({...f,validTo:e.target.value}))} /></div>
            <div className="col-span-2"><label className="metric-label mb-1 block">Work Description</label>
              <textarea className="input-dark w-full resize-none" rows={3} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Describe the work to be done..." /></div>
          </div>
          <div className="flex gap-3"><button type="submit" className="btn-primary flex items-center gap-2"><Save className="w-4 h-4"/>Submit</button><button type="button" onClick={()=>setShowForm(false)} className="btn-ghost flex items-center gap-2"><X className="w-4 h-4"/>Cancel</button></div>
        </form>
      )}

      <div className="space-y-3">
        {permits.map(p => {
          const sm = STATUS_META[p.status] || STATUS_META.PENDING;
          return (
            <div key={p.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="font-bold text-sm text-ink-100">{p.type}</span>
                    <span className={`badge ${sm.badge}`}>{sm.label}</span>
                    <span className="text-xs text-mine-muted">#{p.id}</span>
                  </div>
                  <p className="text-sm text-mine-dim mb-2">{p.description}</p>
                  <div className="flex items-center gap-4 text-xs text-mine-muted flex-wrap">
                    <span className="flex items-center gap-1"><User className="w-3 h-3"/> {p.requestedBy}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {p.validFrom} ? {p.validTo}</span>
                    <span>{p.section}</span>
                  </div>
                </div>
                {canApprove && p.status === 'PENDING' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => updateStatus(p.id,'APPROVED')} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-900/30 text-green-400 border border-green-700/30 hover:bg-green-900/50 transition-colors"><CheckCircle className="w-3.5 h-3.5"/>Approve</button>
                    <button onClick={() => updateStatus(p.id,'REJECTED')} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-900/30 text-red-400 border border-red-700/30 hover:bg-red-900/50 transition-colors"><XCircle className="w-3.5 h-3.5"/>Reject</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
