import React, { useState } from 'react';
import { Download, FileText, Table, CheckCircle2 } from 'lucide-react';
import useMineStore from '../store/useMineStore';

export default function ExportPage() {
  const nodes = useMineStore(s => s.nodes);
  const history = useMineStore(s => s.history);
  const alerts = useMineStore(s => s.alerts);
  const [exporting, setExporting] = useState(null);
  const [done, setDone] = useState(null);
  const [range, setRange] = useState('today');

  async function doExport(type) {
    setExporting(type); setDone(null);
    await new Promise(r => setTimeout(r, 1200));
    let content = '';
    if (type === 'sensors') {
      const rows = [['Node','Timestamp','Temp(C)','Humidity(%)','GasPPM','RSSI']];
      for (const [nid, hist] of Object.entries(history)) {
        for (const h of (hist||[])) rows.push([`N-${nid}`,new Date(h.ts).toISOString(),h.temp??'',h.humid??'',h.gas??'',h.rssi??'']);
      }
      content = rows.map(r=>r.join(',')).join('\n');
    } else if (type === 'alerts') {
      const rows = [['ID','Severity','Message','Node','Timestamp','Acknowledged']];
      alerts.forEach(a => rows.push([a.id,a.severity,`"${a.msg}"`,a.nodeId||'',new Date(a.ts).toISOString(),a.acked?'Yes':'No']));
      content = rows.map(r=>r.join(',')).join('\n');
    } else {
      content = `GuardianX Daily Report - ${new Date().toLocaleDateString()}\n\nNodes Online: ${Object.values(nodes).filter(n=>n?.online).length}/5\nTotal Alerts: ${alerts.length}`;
    }
    const blob = new Blob([content],{type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`guardianx_${type}_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    setExporting(null); setDone(type);
    setTimeout(()=>setDone(null), 3000);
  }

  const cards = [
    { id:'sensors', label:'Sensor Data',   desc:'All node readings — temp, humidity, gas PPM, RSSI', icon:Table,    color:'#38bdf8' },
    { id:'alerts',  label:'Alert History', desc:'All alerts with severity, timestamp & ack status', icon:FileText, color:'#f59e0b' },
    { id:'report',  label:'Daily Summary', desc:'Auto-generated daily safety summary report',       icon:FileText, color:'#10b981' },
  ];

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3"><Download className="w-5 h-5 text-mine-accent"/><h1 className="font-bold text-lg">Export Data</h1></div>
      <div className="card flex items-center gap-4 flex-wrap">
        <span className="text-sm text-mine-dim">Date Range:</span>
        {['today','week','month'].map(r => (
          <button key={r} onClick={()=>setRange(r)} className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${range===r?'bg-mine-accent text-black':'btn-ghost'}`}>{r.charAt(0).toUpperCase()+r.slice(1)}</button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map(card => (
          <div key={card.id} className="card flex flex-col gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:`${card.color}18`,border:`1px solid ${card.color}28`}}>
              <card.icon className="w-5 h-5" style={{color:card.color}}/>
            </div>
            <div>
              <div className="font-bold text-sm text-ink-100">{card.label}</div>
              <div className="text-xs text-mine-muted mt-0.5">{card.desc}</div>
            </div>
            <button
              onClick={()=>doExport(card.id)}
              disabled={!!exporting}
              className="mt-auto flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all"
              style={{
                background: done===card.id?'linear-gradient(135deg,#10b981,#059669)':exporting===card.id?'var(--bg-card-nested)':`${card.color}18`,
                color: done===card.id?'#fff':card.color,
                border:`1px solid ${done===card.id?'rgba(16,185,129,0.4)':card.color+'28'}`,
              }}
            >
              {done===card.id ? <><CheckCircle2 className="w-3.5 h-3.5"/>Downloaded!</> : exporting===card.id ? <>Generating…</> : <><Download className="w-3.5 h-3.5"/>Download CSV</>}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
