import React, { useState } from 'react';
import { BookOpen, Search, ChevronDown, ChevronUp, Download, Shield, Flame, Wind, Zap, Droplets, AlertTriangle } from 'lucide-react';

const SOPS = [
  { id:'s1', code:'SOP-001', title:'Gas Leak Emergency Procedure', category:'Emergency', icon:Flame, steps:['Immediately press SOS button on node','Evacuate section to nearest safe zone','Contact supervisor via radio on Channel 1','Do not re-enter until gas PPM < 100','Log incident in the system'], lastUpdated:'2024-01-15', version:'v3.2', critical:true },
  { id:'s2', code:'SOP-002', title:'Node Equipment Failure Protocol', category:'Equipment', icon:Zap, steps:['Note the node ID showing failure','Report to supervisor immediately','Switch to manual monitoring for affected area','Retrieve backup node from store','Replace and test within 30 minutes'], lastUpdated:'2024-02-10', version:'v2.1', critical:false },
  { id:'s3', code:'SOP-003', title:'Ventilation Fan Shutdown Procedure', category:'Operations', icon:Wind, steps:['Get written clearance from Mine Manager','Inform all underground personnel','Monitor gas levels every 5 minutes','Maximum shutdown duration: 15 minutes','Restart fan and verify airflow before resuming work'], lastUpdated:'2024-03-01', version:'v4.0', critical:true },
  { id:'s4', code:'SOP-004', title:'Water Inrush Emergency', category:'Emergency', icon:Droplets, steps:['Sound emergency alarm immediately','Evacuate all personnel from affected level','Activate water pump to maximum capacity','Report to Mine Manager and DGMS','Account for all miners at muster point'], lastUpdated:'2024-01-20', version:'v2.5', critical:true },
  { id:'s5', code:'SOP-005', title:'Daily Safety Inspection Checklist', category:'Safety', icon:Shield, steps:['Check all 5 node battery levels (>20%)','Test SOS buttons on each node','Verify ventilation fan operation','Check gas sensor calibration dates','Log all readings in shift log'], lastUpdated:'2024-04-05', version:'v1.8', critical:false },
  { id:'s6', code:'SOP-006', title:'Blasting Safety Clearance Procedure', category:'Blasting', icon:AlertTriangle, steps:['Obtain written permit from supervisor','Clear all personnel within 200m radius','Issue 3 long horn blasts as warning','Wait 5 minutes after blast before re-entry','Inspect area for misfire before clearing'], lastUpdated:'2024-02-28', version:'v5.1', critical:true },
];

const CATS = ['All','Emergency','Equipment','Operations','Safety','Blasting'];

export default function SOPPage() {
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('All');
  const [expanded, setExpanded] = useState(null);

  const filtered = SOPS.filter(s =>
    (cat==='All' || s.category===cat) &&
    (s.title.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <BookOpen className="w-5 h-5 text-mine-blue" />
        <h1 className="font-bold text-lg">Standard Operating Procedures</h1>
        <span className="badge-info">{SOPS.length} SOPs</span>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mine-muted" />
          <input className="input-dark pl-9" placeholder="Search SOPs..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {CATS.map(c => (
          <button key={c} onClick={()=>setCat(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${cat===c ? 'bg-mine-accent text-mine-bg' : 'btn-ghost'}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(sop => {
          const Icon = sop.icon;
          const isOpen = expanded === sop.id;
          return (
            <div key={sop.id} className={`card border transition-all ${sop.critical ? 'border-red-700/30' : 'border-mine-border/40'}`}>
              <div className="flex items-center gap-3 cursor-pointer" onClick={()=>setExpanded(isOpen ? null : sop.id)}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${sop.critical ? 'bg-red-900/30' : 'bg-mine-deeper'}`}>
                  <Icon className={`w-4 h-4 ${sop.critical ? 'text-red-400' : 'text-mine-accent'}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-ink-500">{sop.code}</span>
                    {sop.critical && <span className="badge-danger text-xs">CRITICAL</span>}
                    <span className="font-semibold text-sm text-mine-text">{sop.title}</span>
                  </div>
                  <div className="text-xs text-ink-500 mt-0.5">{sop.category} · {sop.version} · Updated {sop.lastUpdated}</div>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-mine-muted flex-shrink-0"/> : <ChevronDown className="w-4 h-4 text-mine-muted flex-shrink-0"/>}
              </div>
              {isOpen && (
                <div className="mt-4 pt-3 border-t border-mine-border/40">
                  <div className="metric-label mb-2">Procedure Steps</div>
                  <ol className="space-y-2">
                    {sop.steps.map((step,i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5"
                          style={{ background:'rgba(245,158,11,0.15)', color:'#f59e0b' }}>{i+1}</span>
                        <span className="text-sm text-mine-dim">{step}</span>
                      </li>
                    ))}
                  </ol>
                  <button className="btn-ghost flex items-center gap-2 mt-4 text-xs">
                    <Download className="w-3.5 h-3.5"/> Download PDF
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
