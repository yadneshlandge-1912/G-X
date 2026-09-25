import React, { useState } from 'react';
import { ClipboardList, Plus, Send, Clock, User, Tag } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const TYPE_META = {
  handover: { label: 'Handover',  color: 'text-mine-accent',  bg: 'bg-amber-900/20',  border: 'border-mine-accent/30'  },
  note:     { label: 'Note',      color: 'text-mine-blue',    bg: 'bg-blue-900/20',    border: 'border-mine-blue/30'    },
  warning:  { label: 'Warning',   color: 'text-orange-400',   bg: 'bg-orange-900/20',  border: 'border-orange-700/30'   },
  incident: { label: 'Incident',  color: 'text-red-400',      bg: 'bg-red-900/20',     border: 'border-red-700/30'      },
};

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day:'numeric', month:'short' });
}

export default function ShiftLogPage() {
  const currentUser  = useAuthStore(s => s.currentUser);
  const shiftLog     = useAuthStore(s => s.shiftLog);
  const addShiftEntry= useAuthStore(s => s.addShiftEntry);

  const [content, setContent] = useState('');
  const [type,    setType]    = useState('note');
  const [filter,  setFilter]  = useState('all');

  // Only supervisors and admins can add entries; miners can view
  const canAdd = ['supervisor', 'admin', 'rescue'].includes(currentUser?.role);

  function handleSubmit(e) {
    e.preventDefault();
    if (!content.trim()) return;
    addShiftEntry(content.trim(), type);
    setContent('');
  }

  const filtered = filter === 'all' ? shiftLog : shiftLog.filter(e => e.type === filter);

  return (
    <div className="p-4 space-y-4 animate-fade-in">

      {/* Header */}
      <div className="flex items-center gap-3">
        <ClipboardList className="w-5 h-5 text-mine-accent" />
        <h1 className="font-bold text-lg">Shift Log</h1>
        <span className="badge-info">{shiftLog.length} entries</span>
      </div>

      {/* Add entry form */}
      {canAdd && (
        <form onSubmit={handleSubmit} className="card border border-mine-border/60 space-y-3">
          <div className="section-title">
            <Plus className="w-3.5 h-3.5 text-mine-accent" /> New Entry
          </div>

          {/* Type selector */}
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(TYPE_META).map(([k, m]) => (
              <button key={k} type="button" onClick={() => setType(k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150
                  ${type === k
                    ? `${m.bg} ${m.border} ${m.color} shadow-[0_0_12px_rgba(0,0,0,0.3)]`
                    : 'border-transparent text-mine-muted hover:text-mine-dim hover:bg-white/5'}`}>
                {m.label}
              </button>
            ))}
          </div>

          {/* Textarea with char counter */}
          <div className="relative">
            <textarea
              className="input-dark w-full resize-none"
              style={{ minHeight: '7rem', maxHeight: '16rem', overflowY: 'auto' }}
              placeholder="Write your shift handover note, warning, or observation here…"
              value={content}
              onChange={e => setContent(e.target.value)}
              maxLength={1000}
            />
            <span className={`absolute bottom-2.5 right-3 text-xs font-mono pointer-events-none transition-colors
              ${content.length > 900 ? 'text-red-400' : content.length > 700 ? 'text-amber-400' : 'text-ink-600'}`}>
              {content.length}/1000
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-mine-muted">
              Posting as <span className="text-mine-dim font-semibold">{currentUser?.name}</span> · {currentUser?.shift} shift
            </div>
            <button type="submit" disabled={!content.trim()}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all
                ${content.trim() ? 'btn-primary' : 'bg-mine-border/40 text-mine-muted cursor-not-allowed'}`}>
              <Send className="w-3.5 h-3.5" /> Post Entry
            </button>
          </div>
        </form>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {['all', ...Object.keys(TYPE_META)].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
              ${filter === f ? 'bg-mine-accent text-mine-bg' : 'btn-ghost'}`}>
            {f === 'all' ? 'All' : TYPE_META[f].label}
          </button>
        ))}
      </div>

      {/* Log entries */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="card text-center py-10 text-mine-muted">No log entries yet.</div>
        )}
        {filtered.map(entry => {
          const m = TYPE_META[entry.type] || TYPE_META.note;
          return (
            <div key={entry.id} className={`card border ${m.border} ${m.bg} animate-slide-in`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${m.border} ${m.color} ${m.bg}`}>
                      {m.label}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-mine-muted">
                      <User className="w-3 h-3" />{entry.author}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-mine-muted">
                      <Tag className="w-3 h-3" />{entry.role}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-mine-muted">
                      <Clock className="w-3 h-3" />{entry.shift} shift
                    </span>
                  </div>
                  <p className="text-mine-dim text-sm leading-relaxed">{entry.content}</p>
                </div>
                <div className="text-mine-muted text-xs font-mono whitespace-nowrap flex-shrink-0">
                  {timeAgo(entry.timestamp)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
