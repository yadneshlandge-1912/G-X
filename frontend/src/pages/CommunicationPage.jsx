import React, { useState, useRef, useEffect } from 'react';
import { Radio, Send, User, Clock, AlertTriangle, Mic } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const CHANNELS = [
  { id:'ch1', name:'Channel 1 — All Sections', color:'#10b981' },
  { id:'ch2', name:'Channel 2 — Emergency', color:'#ef4444' },
  { id:'ch3', name:'Channel 3 — Supervisors', color:'#3b82f6' },
  { id:'ch4', name:'Channel 4 — Rescue Team', color:'#f59e0b' },
];

const SEED_MSGS = [
  { id:'msg1', channel:'ch1', sender:'Vikas Sharma', role:'supervisor', text:'Morning shift all clear. All 5 nodes operational.', time: Date.now()-3600000*3, type:'normal' },
  { id:'msg2', channel:'ch1', sender:'Rajan Kumar',  role:'miner',      text:'Node 1 section SEC-A reporting in. Gas levels normal.', time: Date.now()-3600000*2, type:'normal' },
  { id:'msg3', channel:'ch2', sender:'Arjun Meena',  role:'rescue',     text:'Emergency team on standby. All equipment checked.', time: Date.now()-3600000, type:'emergency' },
  { id:'msg4', channel:'ch1', sender:'Priya Nair',   role:'supervisor', text:'Ventilation fan #1 check complete. All good.', time: Date.now()-1800000, type:'normal' },
  { id:'msg5', channel:'ch3', sender:'Admin',        role:'admin',      text:'Reminder: Safety inspection at 15:00 today.', time: Date.now()-900000, type:'alert' },
];

function timeStr(ts) {
  return new Date(ts).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
}

const TYPE_STYLE = {
  normal:'',
  emergency:'border-l-2 border-red-500 pl-2 bg-red-900/5',
  alert:'border-l-2 border-amber-500 pl-2 bg-amber-900/5',
};

export default function CommunicationPage() {
  const currentUser = useAuthStore(s => s.currentUser);
  const [msgs, setMsgs] = useState(SEED_MSGS);
  const [channel, setChannel] = useState('ch1');
  const [text, setText] = useState('');
  const [msgType, setMsgType] = useState('normal');
  const bottomRef = useRef(null);

  const channelMsgs = msgs.filter(m => m.channel===channel);

  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:'smooth'}); }, [msgs, channel]);

  function send() {
    if (!text.trim()) return;
    setMsgs(m => [...m, {
      id:'msg'+Date.now(),
      channel,
      sender: currentUser?.name||'Unknown',
      role: currentUser?.role||'miner',
      text: text.trim(),
      time: Date.now(),
      type: msgType,
    }]);
    setText('');
  }

  const ROLE_COLOR = { admin:'#8b5cf6', supervisor:'#3b82f6', rescue:'#ef4444', miner:'#f59e0b' };
  const ch = CHANNELS.find(c=>c.id===channel);

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <Radio className="w-5 h-5 text-green-400" />
        <h1 className="font-bold text-lg">Radio Communications Log</h1>
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-xs text-green-400">Live</span>
      </div>

      {/* Channel selector */}
      <div className="flex gap-2 flex-wrap">
        {CHANNELS.map(c => (
          <button key={c.id} onClick={()=>setChannel(c.id)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${channel===c.id?'border-current':'border-transparent btn-ghost'}`}
            style={channel===c.id?{color:c.color,background:`${c.color}15`,borderColor:`${c.color}40`}:{}}>
            {c.name}
          </button>
        ))}
      </div>

      {/* Message area */}
      <div className="card" style={{height:'320px', display:'flex', flexDirection:'column'}}>
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-mine-border/40">
          <div className="w-2 h-2 rounded-full" style={{background:ch?.color}} />
          <span className="text-sm font-semibold text-mine-text">{ch?.name}</span>
          <span className="text-xs text-ink-500 ml-auto">{channelMsgs.length} messages</span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {channelMsgs.length===0 && <div className="text-center text-ink-600 py-8">No messages on this channel</div>}
          {channelMsgs.map(m => (
            <div key={m.id} className={`${TYPE_STYLE[m.type]||''}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-bold" style={{color:ROLE_COLOR[m.role]||'#94a3b8'}}>{m.sender}</span>
                <span className="text-xs text-ink-600">{m.role}</span>
                {m.type==='emergency' && <span className="badge-danger text-xs">EMERGENCY</span>}
                {m.type==='alert' && <span className="badge-warn text-xs">ALERT</span>}
                <span className="text-xs text-ink-600 ml-auto flex items-center gap-1"><Clock className="w-3 h-3"/>{timeStr(m.time)}</span>
              </div>
              <div className="text-sm text-mine-dim">{m.text}</div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Send */}
      <div className="card border border-mine-border/60">
        <div className="flex gap-2 mb-2">
          {[['normal','Normal'],['alert','Alert'],['emergency','Emergency']].map(([t,l])=>(
            <button key={t} onClick={()=>setMsgType(t)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${msgType===t?'bg-mine-accent text-mine-bg':'btn-ghost'}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input className="input-dark flex-1" placeholder={`Transmit on ${ch?.name}...`}
            value={text} onChange={e=>setText(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter')send();}} />
          <button onClick={send} className="btn-primary flex items-center gap-2" disabled={!text.trim()}>
            <Send className="w-4 h-4"/>Send
          </button>
        </div>
        <div className="text-xs text-ink-600 mt-2 flex items-center gap-1">
          <User className="w-3 h-3"/>{currentUser?.name} · {currentUser?.role}
        </div>
      </div>
    </div>
  );
}
