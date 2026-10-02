import React, { useState } from 'react';
import { Cpu, Award, CheckCircle, AlertTriangle } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const COURSES = [
  { id:1, title:'LoRa Node Safety Operations',      duration:'2h',  expiry:30,  mandatory:true  },
  { id:2, title:'Emergency SOS Protocol',            duration:'1h',  expiry:90,  mandatory:true  },
  { id:3, title:'Gas Detection & Response',           duration:'3h',  expiry:60,  mandatory:true  },
  { id:4, title:'Confined Space Entry Procedures',    duration:'4h',  expiry:60,  mandatory:true  },
  { id:5, title:'First Aid & Mine Rescue Basics',    duration:'6h',  expiry:180, mandatory:false },
  { id:6, title:'Explosion-Proof Equipment Handling',duration:'2h',  expiry:90,  mandatory:false },
];

function daysLeft(completed, expiryDays) {
  if (!completed) return null;
  return expiryDays - Math.floor((Date.now()-completed)/86400000);
}

export default function TrainingPage() {
  const users = useAuthStore(s => s.users);
  const [completions, setCompletions] = useState({});
  const [modal, setModal] = useState(null);

  function complete(userId, courseId) {
    setCompletions(c => ({ ...c, [`${userId}-${courseId}`]: Date.now() }));
    setModal(null);
  }

  const miners = users.filter(u => ['miner','supervisor','rescue'].includes(u.role));
  const totalCerts = Object.keys(completions).length;
  const mandatoryTotal = miners.length * COURSES.filter(c=>c.mandatory).length;
  const mandatoryDone = miners.reduce((s,u) => s + COURSES.filter(c=>c.mandatory && completions[`${u.id}-${c.id}`]).length,0);

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3"><Cpu className="w-5 h-5 text-mine-purple"/><h1 className="font-bold text-lg">Training Records</h1></div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center"><div className="metric-label mb-1">Total Courses</div><div className="text-2xl font-black text-ink-100">{COURSES.length}</div></div>
        <div className="card text-center"><div className="metric-label mb-1">Mandatory</div><div className="text-2xl font-black text-red-400">{COURSES.filter(c=>c.mandatory).length}</div></div>
        <div className="card text-center"><div className="metric-label mb-1">Completions</div><div className="text-2xl font-black text-green-400">{totalCerts}</div></div>
      </div>

      <div className="card">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-mine-dim">Mandatory Compliance</span>
          <span className="font-bold text-mine-accent">{mandatoryTotal ? Math.round((mandatoryDone/mandatoryTotal)*100) : 0}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{background:'var(--border-subtle)'}}>
          <div className="h-full rounded-full bg-mine-accent transition-all duration-700" style={{width:`${mandatoryTotal ? (mandatoryDone/mandatoryTotal)*100 : 0}%`}}/>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="data-table w-full" style={{minWidth:'600px'}}>
          <thead>
            <tr>
              <th>Miner</th>
              {COURSES.map(c => <th key={c.id} className="text-[9px] max-w-20">{c.mandatory?'🔴 ':''}{c.title.split(' ').slice(0,2).join(' ')}</th>)}
            </tr>
          </thead>
          <tbody>
            {miners.map(u => (
              <tr key={u.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{u.avatar||'👤'}</span>
                    <span className="font-semibold text-xs text-ink-100">{u.name.split(' ')[0]}</span>
                  </div>
                </td>
                {COURSES.map(c => {
                  const key = `${u.id}-${c.id}`;
                  const comp = completions[key];
                  const days = daysLeft(comp, c.expiry);
                  const expired = days !== null && days < 0;
                  const expiring = days !== null && days < 14 && days >= 0;
                  return (
                    <td key={c.id} className="text-center">
                      {comp ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <CheckCircle className="w-4 h-4" style={{color:expired?'#ef4444':expiring?'#f59e0b':'#10b981'}}/>
                          <span className="text-[8px]" style={{color:expired?'#ef4444':expiring?'#f59e0b':'#475569'}}>
                            {expired?'Expired':expiring?`${days}d`:`${days}d`}
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={() => setModal({userId:u.id,courseId:c.id,courseName:c.title})}
                          className="text-[9px] px-2 py-0.5 rounded bg-mine-deeper text-mine-muted hover:text-mine-dim border border-mine-border transition-colors"
                        >Mark</button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={()=>setModal(null)}>
          <div className="card max-w-sm w-full m-4 animate-scale-in" onClick={e=>e.stopPropagation()}>
            <div className="section-title mb-3"><Award className="w-4 h-4 text-mine-accent"/>Mark as Completed</div>
            <p className="text-sm text-mine-dim mb-4">{modal.courseName}</p>
            <div className="flex gap-3">
              <button onClick={()=>complete(modal.userId,modal.courseId)} className="btn-primary flex items-center gap-2"><CheckCircle className="w-4 h-4"/>Confirm</button>
              <button onClick={()=>setModal(null)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
