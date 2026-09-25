import React, { useRef, useEffect } from 'react';
import {
  Bell, BellOff, CheckCheck, Trash2, Info,
  AlertTriangle, CheckCircle, ShieldAlert, X,
} from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const TYPE_META = {
  info:    { Icon: Info,         color: 'text-mine-blue',   bg: 'bg-blue-900/20',   border: 'border-blue-800/40' },
  warning: { Icon: AlertTriangle,color: 'text-orange-400',  bg: 'bg-orange-900/15', border: 'border-orange-800/30' },
  success: { Icon: CheckCircle,  color: 'text-green-400',   bg: 'bg-green-900/15',  border: 'border-green-800/30' },
  danger:  { Icon: ShieldAlert,  color: 'text-red-400',     bg: 'bg-red-900/20',    border: 'border-red-800/40' },
};

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function NotificationsPanel({ onClose }) {
  const notifications   = useAuthStore(s => s.notifications);
  const markRead        = useAuthStore(s => s.markNotifRead);
  const markAllRead     = useAuthStore(s => s.markAllNotifsRead);
  const clearAll        = useAuthStore(s => s.clearNotifications);
  const unreadCount     = notifications.filter(n => !n.read).length;

  const panelRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose?.();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={panelRef}
      className="absolute right-0 top-12 w-96 rounded-xl border border-mine-border overflow-hidden z-50 animate-slide-in shadow-panel"
      style={{ background: 'linear-gradient(160deg, #0d1220 0%, #080c14 100%)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-mine-border/60">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-mine-accent" />
          <span className="font-bold text-sm">Notifications</span>
          {unreadCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-mine-danger text-white text-[10px] font-bold flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="btn-ghost text-[10px] flex items-center gap-1">
              <CheckCheck className="w-3 h-3" /> Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button onClick={clearAll} className="btn-ghost text-[10px] flex items-center gap-1 text-red-400 hover:text-red-300">
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          )}
          <button onClick={onClose} className="text-mine-muted hover:text-mine-dim transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-mine-muted">
            <BellOff className="w-8 h-8 opacity-30" />
            <span className="text-sm">No notifications</span>
          </div>
        )}
        {notifications.map(n => {
          const m = TYPE_META[n.type] || TYPE_META.info;
          return (
            <div key={n.id}
              onClick={() => markRead(n.id)}
              className={`flex items-start gap-3 px-4 py-3 border-b border-mine-border/30 last:border-0 cursor-pointer
                transition-colors hover:bg-mine-border/20 ${n.read ? 'opacity-50' : ''}`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${m.bg} border ${m.border}`}>
                <m.Icon className={`w-3.5 h-3.5 ${m.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className={`text-xs font-bold ${n.read ? 'text-mine-muted' : 'text-mine-text'}`}>{n.title}</div>
                  <div className="text-[10px] text-mine-muted font-mono whitespace-nowrap">{timeAgo(n.ts)}</div>
                </div>
                <div className="text-xs text-mine-muted mt-0.5 leading-snug">{n.message}</div>
              </div>
              {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-mine-accent flex-shrink-0 mt-2" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
