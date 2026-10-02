
import React from 'react';
import { ShieldAlert, CheckCircle, Wind, Thermometer, Radio, Siren, AlertTriangle, X } from 'lucide-react';
import useMineStore from '../store/useMineStore';

const SEV = {
  3: { label: 'CRITICAL', color: '#ef4444', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.15)' },
  2: { label: 'WARNING', color: '#f97316', bg: 'rgba(249,115,22,0.05)', border: 'rgba(249,115,22,0.12)' },
  1: { label: 'CAUTION', color: '#f59e0b', bg: 'rgba(245,158,11,0.04)', border: 'rgba(245,158,11,0.1)' },
};

const TYPE_ICON = {
  SOS: '🆘', GAS_DANGER: '💨', GAS_WARNING: '💨',
  TEMP_CRITICAL: '🌡️', NODE_SILENT_CRITICAL: '📡',
};

function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

function AlertsPanel({ compact = false }) {
  const alerts = useMineStore(s => s.alerts);
  const ackAlert = useMineStore(s => s.acknowledgeAlert);
  const ackAll = useMineStore(s => s.acknowledgeAllAlerts);

  const shown = compact ? alerts.slice(0, 4) : alerts;

  return (
    <div className="card">
      <div className="section-head">
        <ShieldAlert className="w-3.5 h-3.5 text-danger-DEFAULT" style={{ color: '#ef4444' }} />
        Alert Centre
        {alerts.length > 0 && (
          <span className="badge badge-danger ml-1">{alerts.length}</span>
        )}
        {!compact && alerts.length > 0 && (
          <button onClick={() => ackAll()}
            className="ml-auto text-[11px] text-ink-500 hover:text-ink-300 transition-colors">
            Clear all
          </button>
        )}
      </div>

      {alerts.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-6 text-ink-600">
          <CheckCircle className="w-7 h-7" style={{ color: '#10b981' }} />
          <span className="text-sm">All clear</span>
        </div>
      )}

      <div className="space-y-2">
        {shown.map((alert, idx) => {
          const m = SEV[alert.severity] || SEV[1];
          const ts = alert.timestamp || (alert.created_at ? alert.created_at * 1000 : null);
          const icon = TYPE_ICON[alert.type] || '⚠️';
          return (
            <div key={alert.id || idx}
              className="flex items-start gap-3 rounded-xl p-3 animate-slide-in-u"
              style={{ background: m.bg, border: `1px solid ${m.border}` }}>
              <span className="text-base flex-shrink-0 mt-0.5">{icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-bold" style={{ color: m.color }}>{m.label}</span>
                  {alert.nodeId != null && (
                    <span className="text-[10px] font-mono text-ink-500">N-{alert.nodeId}</span>
                  )}
                  <span className="ml-auto text-[10px] font-mono text-ink-600">{timeAgo(ts)}</span>
                </div>
                <p className="text-xs text-ink-400 leading-snug">{alert.message}</p>
              </div>
              <button onClick={() => ackAlert(alert.id)}
                className="text-ink-600 hover:text-ink-300 transition-colors flex-shrink-0 mt-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {compact && alerts.length > 4 && (
        <button className="mt-2 text-xs font-semibold w-full text-center py-2 rounded-lg transition-colors"
          style={{ color: 'var(--text-dim)', background: 'transparent' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-nested)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          onClick={() => useMineStore.getState().setActivePage('alerts')}>
          View all {alerts.length} alerts →
        </button>
      )}
    </div>
  );
}

export default React.memo(AlertsPanel);
