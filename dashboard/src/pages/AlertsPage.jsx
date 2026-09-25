import React from 'react';
import AlertsPanel  from '../components/AlertsPanel';
import useMineStore from '../store/useMineStore';
import { ShieldAlert, CheckCheck } from 'lucide-react';

export default function AlertsPage() {
  const alerts    = useMineStore(s => s.alerts);
  const ackAlert  = useMineStore(s => s.acknowledgeAlert);

  const critical = alerts.filter(a => a.severity === 3);
  const warning  = alerts.filter(a => a.severity === 2);
  const info     = alerts.filter(a => a.severity === 1);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="text-mine-accent w-5 h-5" />
          <h1 className="font-bold text-lg">Alert Center</h1>
        </div>
        {alerts.length > 0 && (
          <button
            onClick={() => alerts.forEach(a => ackAlert(a.id))}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-mine-border hover:bg-mine-panel rounded-lg text-sm transition-colors"
          >
            <CheckCheck className="w-4 h-4" /> Acknowledge All
          </button>
        )}
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card border-red-800">
          <div className="metric-label mb-1 text-red-400">Critical</div>
          <div className="text-3xl font-bold text-red-400">{critical.length}</div>
        </div>
        <div className="card border-orange-800">
          <div className="metric-label mb-1 text-orange-400">Warning</div>
          <div className="text-3xl font-bold text-orange-400">{warning.length}</div>
        </div>
        <div className="card border-yellow-800">
          <div className="metric-label mb-1 text-yellow-400">Info</div>
          <div className="text-3xl font-bold text-yellow-400">{info.length}</div>
        </div>
      </div>

      <AlertsPanel compact={false} />
    </div>
  );
}
