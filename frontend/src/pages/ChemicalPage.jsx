import React, { useState } from 'react';
import { FlaskConical, Plus, X, CheckCircle, AlertTriangle, Package } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const HAZARD_COLORS = { HIGH:'text-red-400 bg-red-900/20 border-red-700/30', MEDIUM:'text-amber-400 bg-amber-900/20 border-amber-700/30', LOW:'text-green-400 bg-green-900/20 border-green-700/30' };

const SEED = [
  { id:'ch1', name:'ANFO (Ammonium Nitrate Fuel Oil)', type:'Explosive', quantity:450, unit:'kg', location:'Magazine A', hazard:'HIGH', expires:'2027-01-01', supplier:'ExploTech India', msds:true },
  { id:'ch2', name:'Detonators (Electric)', type:'Explosive', quantity:200, unit:'pcs', location:'Magazine A', hazard:'HIGH', expires:'2026-12-01', supplier:'SafeBlast Ltd', msds:true },
  { id:'ch3', name:'Diesel (Generator)', type:'Fuel', quantity:820, unit:'L', location:'Fuel Tank', hazard:'MEDIUM', expires:'N/A', supplier:'Indian Oil', msds:true },
  { id:'ch4', name:'Hydraulic Oil (SAE 46)', type:'Lubricant', quantity:200, unit:'L', location:'Workshop Store', hazard:'LOW', expires:'N/A', supplier:'Castrol', msds:true },
  { id:'ch5', name:'Battery Acid (H2SO4)', type:'Chemical', quantity:50, unit:'L', location:'Battery Room', hazard:'HIGH', expires:'2026-11-01', supplier:'Exide', msds:true },
  { id:'ch6', name:'Fire Suppression Powder', type:'Safety', quantity:100, unit:'kg', location:'Fire Station', hazard:'LOW', expires:'2027-06-01', supplier:'FireSafe India', msds:true },
];

export default function ChemicalPage() {
  const currentUser = useAuthStore(s => s.currentUser);
  const isAdmin = ['admin','supervisor'].includes(currentUser?.role);
  const [items, setItems] = useState(SEED);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({ name:'', type:'Chemical', quantity:'', unit:'kg', location:'', hazard:'LOW', expires:'', supplier:'' });

  function add() {
    if (!form.name) return;
    setItems(i => [...i, { id:'ch'+Date.now(), ...form, quantity:parseFloat(form.quantity)||0, msds:false }]);
    setForm({ name:'', type:'Chemical', quantity:'', unit:'kg', location:'', hazard:'LOW', expires:'', supplier:'' });
    setShowForm(false);
  }

  const filtered = filter==='all' ? items : items.filter(i=>i.hazard===filter||i.type===filter);
  const highHazard = items.filter(i=>i.hazard==='HIGH').length;

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <FlaskConical className="w-5 h-5 text-purple-400" />
          <h1 className="font-bold text-lg">Chemical & Explosive Inventory</h1>
          {highHazard>0 && <span className="badge-danger">{highHazard} high hazard items</span>}
        </div>
        {isAdmin && <button onClick={()=>setShowForm(v=>!v)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4"/>Add Item</button>}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center border border-red-700/30"><div className="metric-label mb-1">High Hazard</div><div className="text-2xl font-black text-red-400">{items.filter(i=>i.hazard==='HIGH').length}</div></div>
        <div className="card text-center border border-amber-700/30"><div className="metric-label mb-1">Medium Hazard</div><div className="text-2xl font-black text-amber-400">{items.filter(i=>i.hazard==='MEDIUM').length}</div></div>
        <div className="card text-center border border-green-700/30"><div className="metric-label mb-1">Low Hazard</div><div className="text-2xl font-black text-green-400">{items.filter(i=>i.hazard==='LOW').length}</div></div>
      </div>

      {showForm && (
        <div className="card border border-mine-border/60 space-y-3">
          <div className="section-title"><Plus className="w-3.5 h-3.5"/>Add Chemical/Explosive</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><label className="metric-label mb-1.5 block">Item Name</label><input className="input-dark" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Type</label><select className="input-dark" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}><option>Chemical</option><option>Explosive</option><option>Fuel</option><option>Lubricant</option><option>Safety</option></select></div>
            <div><label className="metric-label mb-1.5 block">Hazard Level</label><select className="input-dark" value={form.hazard} onChange={e=>setForm(f=>({...f,hazard:e.target.value}))}><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select></div>
            <div><label className="metric-label mb-1.5 block">Quantity</label><input type="number" className="input-dark" value={form.quantity} onChange={e=>setForm(f=>({...f,quantity:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Unit</label><input className="input-dark" value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Storage Location</label><input className="input-dark" value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} /></div>
            <div><label className="metric-label mb-1.5 block">Expiry Date</label><input type="date" className="input-dark" value={form.expires} onChange={e=>setForm(f=>({...f,expires:e.target.value}))} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={add} className="btn-primary flex items-center gap-2"><CheckCircle className="w-4 h-4"/>Add</button>
            <button onClick={()=>setShowForm(false)} className="btn-ghost flex items-center gap-2"><X className="w-4 h-4"/>Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(item => (
          <div key={item.id} className={`card border ${HAZARD_COLORS[item.hazard]?.split(' ').slice(2).join(' ')||'border-mine-border/40'}`}>
            <div className="flex items-start gap-3 flex-wrap">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-black px-2 py-0.5 rounded border ${HAZARD_COLORS[item.hazard]||''}`}>{item.hazard}</span>
                  <span className="font-semibold text-sm text-mine-text">{item.name}</span>
                  <span className="badge-info text-xs">{item.type}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mt-2 text-xs text-ink-500">
                  <span className="flex items-center gap-1"><Package className="w-3 h-3"/>{item.quantity} {item.unit}</span>
                  <span>📍 {item.location}</span>
                  <span>Expires: {item.expires}</span>
                  <span>{item.msds ? '✅ MSDS Available' : '⚠️ No MSDS'}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
