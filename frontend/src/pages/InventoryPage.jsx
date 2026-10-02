import React, { useState } from 'react';
import { Package, Search, CheckCircle, AlertTriangle } from 'lucide-react';

const SEED = [
  { id:1,  name:'Safety Helmets',           qty:24, min:20, unit:'pcs',  loc:'Surface Store',   cat:'PPE' },
  { id:2,  name:'Cap Lamps (LED)',           qty:18, min:15, unit:'pcs',  loc:'Surface Store',   cat:'PPE' },
  { id:3,  name:'SOS Wearable Nodes',        qty:5,  min:5,  unit:'pcs',  loc:'Server Room',     cat:'Electronics' },
  { id:4,  name:'Gas Detector Probes',       qty:12, min:10, unit:'pcs',  loc:'Surface Store',   cat:'Safety' },
  { id:5,  name:'LoRa Gateway Modules',      qty:2,  min:2,  unit:'pcs',  loc:'Server Room',     cat:'Electronics' },
  { id:6,  name:'First Aid Kits',            qty:8,  min:10, unit:'kits', loc:'Multiple Points', cat:'Medical' },
  { id:7,  name:'Fire Extinguisher CO₂',     qty:15, min:12, unit:'pcs',  loc:'All Sections',    cat:'Safety' },
  { id:8,  name:'Rescue Stretchers',         qty:3,  min:3,  unit:'pcs',  loc:'Rescue Station',  cat:'Rescue' },
  { id:9,  name:'Air Breathing Apparatus',   qty:6,  min:8,  unit:'sets', loc:'Rescue Station',  cat:'Rescue' },
  { id:10, name:'18V Li-ion Battery Packs',  qty:30, min:20, unit:'pcs',  loc:'Server Room',     cat:'Electronics' },
];
const CATS = ['All', ...new Set(SEED.map(i => i.cat))];

export default function InventoryPage() {
  const [items] = useState(SEED);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('All');

  const filtered = items.filter(i =>
    (cat === 'All' || i.cat === cat) &&
    (!search || i.name.toLowerCase().includes(search.toLowerCase()))
  );
  const lowStock = items.filter(i => i.qty < i.min).length;

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3"><Package className="w-5 h-5 text-mine-accent"/><h1 className="font-bold text-lg">Inventory</h1></div>
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center"><div className="metric-label mb-1">Total Items</div><div className="text-2xl font-black text-ink-100">{items.length}</div></div>
        <div className="card text-center"><div className="metric-label mb-1 text-red-400">Low Stock</div><div className="text-2xl font-black text-red-400">{lowStock}</div></div>
        <div className="card text-center"><div className="metric-label mb-1 text-green-400">OK</div><div className="text-2xl font-black text-green-400">{items.length-lowStock}</div></div>
      </div>
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-36">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mine-muted"/>
          <input className="input-dark pl-9 w-full" placeholder="Search item..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {CATS.map(c => (
          <button key={c} onClick={()=>setCat(c)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${cat===c?'bg-mine-accent text-black':'btn-ghost'}`}>{c}</button>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="data-table w-full">
          <thead><tr><th>Item</th><th>Category</th><th>Qty</th><th>Min</th><th>Location</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.map(item => {
              const ok = item.qty >= item.min;
              return (
                <tr key={item.id}>
                  <td className="font-medium text-ink-100">{item.name}</td>
                  <td><span className="badge-info text-xs">{item.cat}</span></td>
                  <td><span className="font-bold font-mono" style={{color:ok?'#10b981':'#ef4444'}}>{item.qty}</span> <span className="text-mine-muted text-xs">{item.unit}</span></td>
                  <td className="font-mono text-xs text-mine-muted">{item.min}</td>
                  <td className="text-mine-muted text-xs">{item.loc}</td>
                  <td>{ok
                    ? <span className="flex items-center gap-1 text-green-400 text-xs"><CheckCircle className="w-3.5 h-3.5"/>OK</span>
                    : <span className="flex items-center gap-1 text-red-400 text-xs"><AlertTriangle className="w-3.5 h-3.5"/>Reorder</span>}
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
