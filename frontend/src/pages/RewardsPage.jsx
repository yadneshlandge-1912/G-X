import React, { useState } from 'react';
import { Award, Star, Trophy, Plus, X, CheckCircle, TrendingUp } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const BADGES = [
  { id:'b1', name:'Safety Champion', icon:'🛡️', description:'30 days without any safety violation', color:'#f59e0b' },
  { id:'b2', name:'Zero Incident',   icon:'✅', description:'Completed a full month with no incidents', color:'#10b981' },
  { id:'b3', name:'SOS Responder',   icon:'🚨', description:'Responded to an SOS within 2 minutes', color:'#ef4444' },
  { id:'b4', name:'Perfect Attendance',icon:'📅',description:'100% attendance for the month', color:'#3b82f6' },
  { id:'b5', name:'Training Star',   icon:'📚', description:'Completed all mandatory training modules', color:'#8b5cf6' },
  { id:'b6', name:'Equipment Care',  icon:'🔧', description:'Maintained all assigned equipment in perfect condition', color:'#06b6d4' },
];

const LEADERBOARD = [
  { rank:1, name:'Vikas Sharma',  role:'Supervisor', points:1240, badges:5, avatar:'👨‍💼', trend:'up' },
  { rank:2, name:'Rajan Kumar',   role:'Miner',      points:980,  badges:4, avatar:'👷', trend:'up' },
  { rank:3, name:'Arjun Meena',   role:'Rescue',     points:870,  badges:3, avatar:'🦺', trend:'stable' },
  { rank:4, name:'Deepak Singh',  role:'Miner',      points:760,  badges:3, avatar:'👷', trend:'down' },
  { rank:5, name:'Priya Nair',    role:'Supervisor', points:710,  badges:2, avatar:'👩‍💼', trend:'up' },
];

const RECENT = [
  { id:'r1', miner:'Rajan Kumar', badge:'Safety Champion', awardedBy:'Admin', date:'2026-09-20', points:150 },
  { id:'r2', miner:'Vikas Sharma',badge:'Zero Incident',   awardedBy:'Admin', date:'2026-09-15', points:200 },
  { id:'r3', miner:'Arjun Meena', badge:'SOS Responder',   awardedBy:'Admin', date:'2026-09-10', points:120 },
];

export default function RewardsPage() {
  const currentUser = useAuthStore(s => s.currentUser);
  const isAdmin = currentUser?.role === 'admin';
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ miner:'', badge:'Safety Champion', reason:'' });
  const [awards, setAwards] = useState(RECENT);

  function award() {
    if (!form.miner || !form.badge) return;
    const b = BADGES.find(b=>b.name===form.badge);
    setAwards(a => [{ id:'r'+Date.now(), miner:form.miner, badge:form.badge, awardedBy:currentUser?.name||'Admin', date:new Date().toISOString().slice(0,10), points:100 }, ...a]);
    setForm({ miner:'', badge:'Safety Champion', reason:'' });
    setShowForm(false);
  }

  const RANK_COLOR = ['#f59e0b','#94a3b8','#b45309'];

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Trophy className="w-5 h-5 text-amber-400" />
          <h1 className="font-bold text-lg">Safety Rewards & Recognition</h1>
        </div>
        {isAdmin && <button onClick={()=>setShowForm(v=>!v)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4"/>Award Badge</button>}
      </div>

      {showForm && (
        <div className="card border border-mine-border/60 space-y-3">
          <div className="section-title"><Award className="w-3.5 h-3.5 text-amber-400"/>Award a Badge</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="metric-label mb-1.5 block">Miner Name</label><input className="input-dark" value={form.miner} onChange={e=>setForm(f=>({...f,miner:e.target.value}))} placeholder="Recipient name" /></div>
            <div><label className="metric-label mb-1.5 block">Badge</label>
              <select className="input-dark" value={form.badge} onChange={e=>setForm(f=>({...f,badge:e.target.value}))}>
                {BADGES.map(b=><option key={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2"><label className="metric-label mb-1.5 block">Reason</label><input className="input-dark" value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} placeholder="Why are they being awarded?" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={award} className="btn-primary flex items-center gap-2"><Star className="w-4 h-4"/>Award</button>
            <button onClick={()=>setShowForm(false)} className="btn-ghost flex items-center gap-2"><X className="w-4 h-4"/>Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Leaderboard */}
        <div className="card">
          <div className="section-title mb-3"><Trophy className="w-3.5 h-3.5 text-amber-400"/>Safety Leaderboard</div>
          <div className="space-y-2">
            {LEADERBOARD.map(p => (
              <div key={p.rank} className={`flex items-center gap-3 p-3 rounded-lg ${p.rank<=3?'bg-mine-deeper':''}`}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
                  style={{ background: p.rank<=3 ? `${RANK_COLOR[p.rank-1]}22` : 'transparent', color: p.rank<=3 ? RANK_COLOR[p.rank-1] : '#475569' }}>
                  {p.rank<=3 ? ['🥇','🥈','🥉'][p.rank-1] : p.rank}
                </div>
                <div className="text-2xl flex-shrink-0">{p.avatar}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-mine-text truncate">{p.name}</div>
                  <div className="text-xs text-ink-500">{p.role} · {p.badges} badges</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-black text-mine-accent">{p.points}</div>
                  <div className="text-xs text-ink-500">pts</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Badges */}
        <div className="card">
          <div className="section-title mb-3"><Award className="w-3.5 h-3.5 text-amber-400"/>Available Badges</div>
          <div className="grid grid-cols-2 gap-2">
            {BADGES.map(b => (
              <div key={b.id} className="bg-mine-deeper rounded-lg p-3 flex items-start gap-2">
                <div className="text-2xl flex-shrink-0">{b.icon}</div>
                <div>
                  <div className="text-xs font-bold" style={{color:b.color}}>{b.name}</div>
                  <div className="text-xs text-ink-600 mt-0.5">{b.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-title mb-3"><Star className="w-3.5 h-3.5 text-amber-400"/>Recent Awards</div>
        <div className="space-y-2">
          {awards.map(a => (
            <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-mine-deeper">
              <div className="text-2xl">{BADGES.find(b=>b.name===a.badge)?.icon||'🏆'}</div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-mine-text">{a.miner}</div>
                <div className="text-xs text-ink-500">{a.badge} · Awarded by {a.awardedBy} · {a.date}</div>
              </div>
              <div className="text-mine-accent font-bold text-sm">+{a.points} pts</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
