import React, { useState } from 'react';
import { BookOpen, CheckSquare, Square, AlertTriangle, RefreshCw } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const CHECKLISTS = {
  miner: [
    { id:1, cat:'Personal Safety', items:['PPE fully equipped (helmet, lamp, belt)','SOS button on wearable tested and working','Gas detector clipped and charged','Emergency whistle attached to belt','Entry time logged with supervisor'] },
    { id:2, cat:'Environment Check', items:['Check for water seepage in assigned section','Verify ventilation airflow in work area','Inspect roof supports for cracks or movement','Confirm no loose rock or debris overhead','Note any unusual smells (gas, smoke)'] },
  ],
  supervisor: [
    { id:1, cat:'Pre-Shift Inspection', items:['All miners have valid permits','Headcount matches attendance register','Emergency equipment checked and staged','Communication devices functional','Escape routes are clear and marked'] },
    { id:2, cat:'Equipment Readiness', items:['Pumps are operational and primed','Conveyor belts visually inspected','Electrical panels locked out as needed','First aid kits stocked and accessible','Fire extinguishers in designated spots'] },
  ],
};

export default function SafetyChecklistPage() {
  const currentUser = useAuthStore(s => s.currentUser);
  const role = currentUser?.role === 'admin' ? 'supervisor' : (currentUser?.role || 'miner');
  const lists = CHECKLISTS[role] || CHECKLISTS.miner;
  const allItems = lists.flatMap(l => l.items);
  const [checked, setChecked] = useState(() => new Set());
  const [submitted, setSubmitted] = useState(false);

  const toggle = (item) => setChecked(s => { const n = new Set(s); n.has(item)?n.delete(item):n.add(item); return n; });
  const pct = Math.round((checked.size / allItems.length) * 100);

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><BookOpen className="w-5 h-5 text-mine-accent"/><h1 className="font-bold text-lg">Safety Checklist</h1></div>
        <button onClick={() => { setChecked(new Set()); setSubmitted(false); }} className="btn-ghost flex items-center gap-1.5 text-xs"><RefreshCw className="w-3.5 h-3.5"/>Reset</button>
      </div>

      {submitted ? (
        <div className="card text-center py-10 animate-scale-in">
          <div className="text-5xl mb-3">?</div>
          <div className="text-xl font-bold text-green-400 mb-1">Checklist Submitted!</div>
          <div className="text-mine-muted text-sm">All {allItems.length} items verified. Have a safe shift.</div>
          <div className="text-xs text-mine-dim mt-2 font-mono">{new Date().toLocaleString('en-IN')}</div>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-ink-100">Overall Progress</span>
              <span className="font-black text-mine-accent">{pct}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background:'var(--border-subtle)' }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width:`${pct}%`, background:'linear-gradient(90deg,#f59e0b88,#f59e0b)' }}/>
            </div>
            <div className="text-xs text-mine-muted mt-1">{checked.size} / {allItems.length} items checked</div>
          </div>

          {lists.map(list => (
            <div key={list.id} className="card space-y-2">
              <div className="section-title"><AlertTriangle className="w-3.5 h-3.5 text-mine-accent"/>{list.cat}</div>
              {list.items.map(item => (
                <button key={item} onClick={() => toggle(item)} className="w-full flex items-start gap-3 text-left rounded-lg p-2 transition-colors hover:bg-mine-deeper">
                  {checked.has(item) ? <CheckSquare className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5"/> : <Square className="w-4 h-4 text-mine-muted flex-shrink-0 mt-0.5"/>}
                  <span className={`text-sm ${checked.has(item)?'line-through text-mine-muted':'text-mine-dim'}`}>{item}</span>
                </button>
              ))}
            </div>
          ))}

          <button
            onClick={() => setSubmitted(true)}
            disabled={pct < 100}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all"
            style={{
              background: pct===100 ? 'linear-gradient(135deg,#10b981,#059669)' : 'var(--bg-card-nested)',
              color: pct===100 ? '#fff' : 'var(--text-dim)',
              cursor: pct===100 ? 'pointer' : 'not-allowed',
            }}
          >
            {pct===100 ? '? Submit & Start Shift' : `Complete all items to submit (${pct}%)`}
          </button>
        </>
      )}
    </div>
  );
}
