import React, { useState } from 'react';
import { Users, AlertTriangle, CheckCircle, X, Clock, MapPin, Siren } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const MINERS = [
  { id:'u1', name:'Rajan Kumar',  badge:'MN-001', nodeId:1, section:'SEC-A', shift:'Morning' },
  { id:'u2', name:'Deepak Singh', badge:'MN-002', nodeId:2, section:'SEC-A', shift:'Morning' },
  { id:'u3', name:'Amit Verma',   badge:'MN-003', nodeId:3, section:'SEC-A', shift:'Evening' },
  { id:'u4', name:'Suresh Pal',   badge:'MN-004', nodeId:4, section:'SEC-A', shift:'Evening' },
  { id:'u5', name:'Mohan Das',    badge:'MN-005', nodeId:5, section:'SEC-A', shift:'Night' },
];

const MUSTER_HISTORY = [
  { id:'ms1', date:'2026-09-15 09:45', type:'Fire Drill', totalMiners:5, accounted:5, missing:0, duration:8, conductor:'Vikas Sharma', status:'COMPLETE' },
  { id:'ms2', date:'2026-08-20 14:30', type:'Gas Alert', totalMiners:5, accounted:4, missing:1, duration:15, conductor:'Arjun Meena', status:'INCOMPLETE', missingNames:['Mohan Das'] },
];

export default function MusterPage() {
  const currentUser = useAuthStore(s => s.currentUser);
  const isAdmin = ['admin','supervisor','rescue'].includes(currentUser?.role);
  const [activeMuster, setActiveMuster] = useState(null);
  const [checkedIn, setCheckedIn] = useState({});
  const [startTime, setStartTime] = useState(null);

  function startMuster(type) {
    setActiveMuster(type);
    setCheckedIn({});
    setStartTime(new Date());
  }

  function checkIn(id) { setCheckedIn(c => ({...c, [id]: true})); }
  function checkOut(id) { setCheckedIn(c => { const n={...c}; delete n[id]; return n; }); }

  const accountedCount = Object.keys(checkedIn).length;
  const missingCount = MINERS.length - accountedCount;
  const elapsed = startTime ? Math.floor((Date.now()-startTime.getTime())/1000) : 0;

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <Users className="w-5 h-5 text-red-400" />
        <h1 className="font-bold text-lg">Emergency Muster / Roll Call</h1>
      </div>

      {!activeMuster ? (
        <>
          <div className="card border border-red-700/30 bg-red-900/10">
            <div className="flex items-center gap-3 mb-3">
              <Siren className="w-5 h-5 text-red-400" />
              <span className="font-bold text-red-300">Start Emergency Muster</span>
            </div>
            <p className="text-xs text-mine-dim mb-4">Activate a muster to account for all underground personnel in an emergency.</p>
            <div className="flex flex-wrap gap-3">
              {['Fire Emergency','Gas Alert','Roof Fall','General Evacuation'].map(type => (
                <button key={type} onClick={()=>startMuster(type)}
                  className="btn-danger flex items-center gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4"/>{type}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="section-title mb-3"><Clock className="w-3.5 h-3.5"/>Muster History</div>
            <div className="space-y-2">
              {MUSTER_HISTORY.map(m => (
                <div key={m.id} className={`rounded-lg p-3 border ${m.status==='COMPLETE'?'border-green-700/30 bg-green-900/10':'border-red-700/30 bg-red-900/10'}`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="flex items-center gap-2"><span className="font-semibold text-sm">{m.type}</span><span className={`badge text-xs ${m.status==='COMPLETE'?'badge-safe':'badge-danger'}`}>{m.status}</span></div>
                      <div className="text-xs text-ink-500 mt-1">{m.date} · {m.duration} min · {m.conductor}</div>
                      {m.missingNames && <div className="text-xs text-red-400 mt-1">Missing: {m.missingNames.join(', ')}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-mine-text">{m.accounted}/{m.totalMiners}</div>
                      <div className="text-xs text-ink-500">Accounted</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="card border border-red-700/50 bg-red-900/15">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Siren className="w-5 h-5 text-red-400 animate-pulse" />
                <div>
                  <div className="font-black text-red-300 text-lg">MUSTER IN PROGRESS</div>
                  <div className="text-xs text-ink-500">{activeMuster} · Started {startTime?.toLocaleTimeString()}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <div className="text-2xl font-black text-green-400">{accountedCount}</div>
                  <div className="text-xs text-ink-500">Accounted</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-black text-red-400">{missingCount}</div>
                  <div className="text-xs text-ink-500">Missing</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MINERS.map(m => {
              const isIn = checkedIn[m.id];
              return (
                <div key={m.id} className={`card border transition-all ${isIn?'border-green-700/40 bg-green-900/10':'border-red-700/30 bg-red-900/5'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-sm text-mine-text">{m.name}</div>
                      <div className="text-xs text-ink-500 mt-0.5">{m.badge} · Node {m.nodeId} · {m.shift}</div>
                    </div>
                    {isIn
                      ? <div className="flex items-center gap-2 text-green-400 text-xs font-bold"><CheckCircle className="w-4 h-4"/>SAFE</div>
                      : <div className="flex items-center gap-2 text-red-400 text-xs font-bold"><AlertTriangle className="w-4 h-4"/>MISSING</div>
                    }
                  </div>
                  <button
                    onClick={()=>isIn ? checkOut(m.id) : checkIn(m.id)}
                    className={`w-full mt-3 py-2 rounded-lg text-xs font-bold transition-all ${isIn?'bg-green-900/30 text-green-300 border border-green-700/40':'bg-red-900/30 text-red-300 border border-red-700/40'}`}>
                    {isIn ? '✓ Checked In — Click to undo' : 'Mark as SAFE / Checked In'}
                  </button>
                </div>
              );
            })}
          </div>

          {missingCount === 0 && (
            <div className="card border border-green-700/40 bg-green-900/15 text-center py-6">
              <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <div className="font-black text-green-300 text-xl">ALL MINERS ACCOUNTED FOR</div>
              <div className="text-xs text-ink-500 mt-1">All {MINERS.length} personnel are safe</div>
            </div>
          )}

          <button onClick={()=>setActiveMuster(null)} className="btn-ghost flex items-center gap-2 w-full justify-center">
            <X className="w-4 h-4"/>End Muster
          </button>
        </div>
      )}
    </div>
  );
}
