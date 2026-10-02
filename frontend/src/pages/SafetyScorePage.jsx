import React from 'react';
import { Flame, TrendingUp, Award, Shield } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const WEEKLY = [
  {day:'Mon',score:88},{day:'Tue',score:91},{day:'Wed',score:79},
  {day:'Thu',score:85},{day:'Fri',score:90},{day:'Sat',score:93},{day:'Sun',score:87},
];
const CRITERIA = [
  { label:'Node Uptime',          score:98, weight:20, color:'#38bdf8' },
  { label:'Alert Response Time',  score:84, weight:25, color:'#f59e0b' },
  { label:'PPE Compliance',       score:91, weight:20, color:'#10b981' },
  { label:'Checklist Completion', score:96, weight:15, color:'#a78bfa' },
  { label:'Gas Incidents',        score:78, weight:20, color:'#f97316' },
];
const totalScore = Math.round(CRITERIA.reduce((s,c)=>s+(c.score*c.weight/100),0));
const scoreColor = totalScore>=90?'#10b981':totalScore>=75?'#f59e0b':'#ef4444';
const scoreGrade = totalScore>=90?'A':totalScore>=80?'B':totalScore>=70?'C':'D';

export default function SafetyScorePage() {
  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3"><Flame className="w-5 h-5 text-mine-accent"/><h1 className="font-bold text-lg">Safety Score</h1></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card text-center flex flex-col items-center justify-center py-8">
          <div className="text-6xl font-black mb-2" style={{color:scoreColor}}>{totalScore}</div>
          <div className="text-xl font-black mb-1" style={{color:scoreColor}}>Grade: {scoreGrade}</div>
          <div className="text-xs text-mine-muted">Today's Safety Index</div>
          <Award className="w-8 h-8 mt-3" style={{color:scoreColor}}/>
        </div>
        <div className="card sm:col-span-2">
          <div className="section-head mb-3"><TrendingUp className="w-3.5 h-3.5" style={{color:'#38bdf8'}}/>7-Day Trend</div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={WEEKLY}>
              <XAxis dataKey="day" tick={{fill:'var(--text-dim)',fontSize:10}}/>
              <YAxis domain={[60,100]} tick={{fill:'var(--text-dim)',fontSize:10}}/>
              <Tooltip contentStyle={{background:'var(--bg-dropdown)',border:'1px solid var(--border-card)',borderRadius:'8px',color:'var(--text-heading)',fontSize:'12px'}}/>
              <Area type="monotone" dataKey="score" stroke="#10b981" fill="rgba(16,185,129,0.1)" strokeWidth={2} dot={{r:3,fill:'#10b981'}}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card space-y-4">
        <div className="section-title"><Shield className="w-3.5 h-3.5 text-mine-accent"/>Score Breakdown</div>
        {CRITERIA.map(c => (
          <div key={c.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-mine-dim">{c.label} <span className="text-mine-muted">({c.weight}% weight)</span></span>
              <span className="font-bold font-mono" style={{color:c.color}}>{c.score}/100</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{background:'var(--border-subtle)'}}>
              <div className="h-full rounded-full transition-all duration-700" style={{width:`${c.score}%`,background:`linear-gradient(90deg,${c.color}88,${c.color})`}}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
