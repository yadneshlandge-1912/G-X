import React, { useState } from 'react';
import { ClipboardCheck, Plus, CheckCircle, X, AlertTriangle, Calendar, User } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const CHECKLIST_ITEMS = [
  'All 5 LoRa nodes transmitting correctly',
  'Gas sensor readings within normal range (<300 PPM)',
  'Temperature readings within normal range (<33°C)',
  'Ventilation fans operational (all sections)',
  'Water pumps operational',
  'SOS buttons tested on all nodes',
  'Emergency lighting functional',
  'Fire extinguishers accessible and charged',
  'First aid kit fully stocked',
  'Exit routes clear of obstruction',
  'Gateway ESP32 battery/power OK',
  'Serial connection to backend active',
];

const SEED = [
  { id:'ins1', date:'2026-09-26', shift:'Morning', inspector:'Vikas Sharma', passed:11, failed:1, issues:'Node 3 gas sensor showing intermittent readings', overall:'MINOR ISSUES', items: Object.fromEntries(CHECKLIST_ITEMS.map((c,i)=>[i, i!==0])) },
  { id:'ins2', date:'2026-09-25', shift:'Morning', inspector:'Priya Nair', passed:12, failed:0, issues:'None', overall:'PASS', items: Object.fromEntries(CHECKLIST_ITEMS.map((c,i)=>[i, true])) },
];

export default function InspectionPage() {
  const currentUser = useAuthStore(s => s.currentUser);
  const isAdmin = ['admin','supervisor'].includes(currentUser?.role);
  const [inspections, setInspections] = useState(SEED);
  const [active, setActive] = useState(null);
  const [checks, setChecks] = useState({});
  const [issue, setIssue] = useState('');

  function startInspection() {
    setActive('new');
    setChecks({});
    setIssue('');
  }

  function toggle(i) { setChecks(c => ({...c,[i]:!c[i]})); }

  function submit() {
    const passed = CHECKLIST_ITEMS.filter((_,i)=>checks[i]).length;
    const failed = CHECKLIST_ITEMS.length - passed;
    const overall = failed===0 ? 'PASS' : failed<=2 ? 'MINOR ISSUES' : 'FAIL';
    setInspections(ins => [{
      id:'ins'+Date.now(),
      date: new Date().toISOString().slice(0,10),
      shift: 'Morning',
      inspector: currentUser?.name||'Inspector',
      passed, failed,
      issues: issue||'None',
      overall,
      items: {...checks},
    }, ...ins]);
    setActive(null);
  }

  const STATUS_COLOR = { 'PASS':'text-green-400', 'MINOR ISSUES':'text-amber-400', 'FAIL':'text-red-400' };
  const STATUS_BORDER = { 'PASS':'border-green-700/30', 'MINOR ISSUES':'border-amber-700/30', 'FAIL':'border-red-700/30' };

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="w-5 h-5 text-mine-blue" />
          <h1 className="font-bold text-lg">Daily Mine Inspection</h1>
        </div>
        {isAdmin && !active && <button onClick={startInspection} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4"/>Start Inspection</button>}
      </div>

      {active==='new' && (
        <div className="card border border-mine-border/60 space-y-4">
          <div className="section-title"><ClipboardCheck className="w-3.5 h-3.5"/>Today's Inspection Checklist</div>
          <div className="space-y-2">
            {CHECKLIST_ITEMS.map((item, i) => (
              <label key={i} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border ${checks[i]?'border-green-700/30 bg-green-900/10':'border-mine-border/30 bg-mine-deeper'}`}>
                <input type="checkbox" checked={!!checks[i]} onChange={()=>toggle(i)} className="w-4 h-4 accent-green-500" />
                <span className={`text-sm ${checks[i]?'text-green-300':'text-mine-dim'}`}>{item}</span>
                {checks[i] && <CheckCircle className="w-4 h-4 text-green-400 ml-auto flex-shrink-0" />}
                {!checks[i] && <AlertTriangle className="w-4 h-4 text-red-400 ml-auto flex-shrink-0" />}
              </label>
            ))}
          </div>
          <div><label className="metric-label mb-1.5 block">Issues Observed</label><textarea className="input-dark w-full" rows={2} value={issue} onChange={e=>setIssue(e.target.value)} placeholder="Describe any issues found..." /></div>
          <div className="flex gap-2">
            <button onClick={submit} className="btn-primary flex items-center gap-2"><CheckCircle className="w-4 h-4"/>Submit Inspection</button>
            <button onClick={()=>setActive(null)} className="btn-ghost flex items-center gap-2"><X className="w-4 h-4"/>Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {inspections.map(ins => (
          <div key={ins.id} className={`card border ${STATUS_BORDER[ins.overall]||'border-mine-border/40'}`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-black ${STATUS_COLOR[ins.overall]}`}>{ins.overall}</span>
                  <span className="text-sm font-semibold text-mine-text">{ins.date} — {ins.shift} Shift</span>
                </div>
                <div className="text-xs text-ink-500 mt-1 flex items-center gap-3">
                  <span className="flex items-center gap-1"><User className="w-3 h-3"/>{ins.inspector}</span>
                  <span className="text-green-400">{ins.passed} passed</span>
                  {ins.failed>0 && <span className="text-red-400">{ins.failed} failed</span>}
                </div>
                {ins.issues!=='None' && <div className="text-xs text-orange-300 mt-1 flex items-start gap-1"><AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5"/>{ins.issues}</div>}
              </div>
              <div className="text-right">
                <div className="text-xl font-black" style={{ color: ins.passed/CHECKLIST_ITEMS.length>=0.9?'#10b981':'#f59e0b' }}>
                  {Math.round(ins.passed/CHECKLIST_ITEMS.length*100)}%
                </div>
                <div className="text-xs text-ink-500">Score</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
