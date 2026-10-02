import React, { useState } from 'react';
import {
  Settings, Save, RotateCcw, Sliders, Radio,
  Thermometer, Wind, Droplets, Bell, Clock,
  Hash, MapPin, Moon, Sun,
} from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

function Section({ title, icon: Icon, children }) {
  return (
    <div className="card space-y-4">
      <div className="section-title">
        <Icon className="w-3.5 h-3.5 text-mine-accent" />{title}
      </div>
      {children}
    </div>
  );
}

function RangeRow({ label, icon: Icon, field, subfield, value, min, max, step = 1, unit, color = 'text-mine-accent', onChange }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 w-44 flex-shrink-0">
        {Icon && <Icon className={`w-3.5 h-3.5 ${color}`} />}
        <span className="text-sm text-mine-dim">{label}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(field, subfield, Number(e.target.value))}
        className="flex-1 accent-amber-400 h-1.5 rounded-full" />
      <div className={`w-20 text-right font-mono font-bold text-sm ${color}`}>
        {value} <span className="text-mine-muted font-normal text-xs">{unit}</span>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const currentUser    = useAuthStore(s => s.currentUser);
  const settings       = useAuthStore(s => s.settings);
  const updateSettings = useAuthStore(s => s.updateSettings);
  const theme          = useAuthStore(s => s.theme);
  const toggleTheme    = useAuthStore(s => s.toggleTheme);

  const [local,   setLocal]   = useState({ ...settings });
  const [saved,   setSaved]   = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  function handleThreshold(field, subfield, val) {
    setLocal(prev => ({
      ...prev,
      [field]: { ...prev[field], [subfield]: val },
    }));
  }

  function handleField(key, val) {
    setLocal(prev => ({ ...prev, [key]: val }));
  }

  function handleSave() {
    updateSettings(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function handleReset() {
    setLocal({ ...settings });
  }

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-mine-accent" />
          <h1 className="font-bold text-lg">System Settings</h1>
          {!isAdmin && <span className="badge-warn text-xs">Read-only — Admin only</span>}
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-green-400 text-sm animate-fade-in flex items-center gap-1"><Save className="w-4 h-4" /> Saved</span>}
          {isAdmin && (
            <>
              <button onClick={handleReset} className="btn-ghost flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
              <button onClick={handleSave} className="btn-primary flex items-center gap-1.5">
                <Save className="w-4 h-4" /> Save Settings
              </button>
            </>
          )}
        </div>
      </div>

      {/* Appearance */}
      <Section title="Appearance" icon={Moon}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-mine-dim font-medium">Theme</div>
            <div className="text-mine-muted text-xs mt-0.5">Switch between dark and light mode</div>
          </div>
          <button onClick={toggleTheme}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-mine-border bg-mine-deeper text-sm font-semibold transition-all hover:border-mine-accent/40">
            {theme === 'dark'
              ? <><Sun className="w-4 h-4 text-mine-accent" /> Switch to Light</>
              : <><Moon className="w-4 h-4 text-mine-blue" /> Switch to Dark</>}
          </button>
        </div>
      </Section>

      {/* Gas thresholds */}
      <Section title="Gas Alert Thresholds (PPM)" icon={Wind}>
        <div className="space-y-4">
          <RangeRow label="Caution"  icon={Wind} field="gasThreshold" subfield="caution"
            value={local.gasThreshold?.caution}  min={50}  max={200}  unit="PPM"
            color="text-yellow-400"  onChange={handleThreshold} />
          <RangeRow label="Warning"  icon={Wind} field="gasThreshold" subfield="warning"
            value={local.gasThreshold?.warning}  min={200} max={500}  unit="PPM"
            color="text-orange-400"  onChange={handleThreshold} />
          <RangeRow label="Danger"   icon={Wind} field="gasThreshold" subfield="danger"
            value={local.gasThreshold?.danger}   min={400} max={1500} unit="PPM"
            color="text-red-400"     onChange={handleThreshold} />
        </div>
      </Section>

      {/* Temperature thresholds */}
      <Section title="Temperature Alert Thresholds (°C)" icon={Thermometer}>
        <div className="space-y-4">
          <RangeRow label="Caution"  icon={Thermometer} field="tempThreshold" subfield="caution"
            value={local.tempThreshold?.caution} min={28} max={35} unit="°C"
            color="text-yellow-400"  onChange={handleThreshold} />
          <RangeRow label="Warning"  icon={Thermometer} field="tempThreshold" subfield="warning"
            value={local.tempThreshold?.warning} min={33} max={40} unit="°C"
            color="text-orange-400"  onChange={handleThreshold} />
          <RangeRow label="Danger"   icon={Thermometer} field="tempThreshold" subfield="danger"
            value={local.tempThreshold?.danger}  min={38} max={50} unit="°C"
            color="text-red-400"     onChange={handleThreshold} />
        </div>
      </Section>

      {/* Humidity thresholds */}
      <Section title="Humidity Alert Thresholds (%)" icon={Droplets}>
        <div className="space-y-4">
          <RangeRow label="Caution"  icon={Droplets} field="humidThreshold" subfield="caution"
            value={local.humidThreshold?.caution} min={60} max={85} unit="%"
            color="text-yellow-400"  onChange={handleThreshold} />
          <RangeRow label="Warning"  icon={Droplets} field="humidThreshold" subfield="warning"
            value={local.humidThreshold?.warning} min={80} max={95} unit="%"
            color="text-orange-400"  onChange={handleThreshold} />
          <RangeRow label="Danger"   icon={Droplets} field="humidThreshold" subfield="danger"
            value={local.humidThreshold?.danger}  min={88} max={100} unit="%"
            color="text-red-400"     onChange={handleThreshold} />
        </div>
      </Section>

      {/* LoRa config */}
      <Section title="LoRa Network Config" icon={Radio}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { key:'loraFreqMHz', label:'Frequency (MHz)', min:433,  max:915, step:1  },
            { key:'loraSF',      label:'Spreading Factor', min:7,    max:12,  step:1  },
            { key:'loraTxPower', label:'TX Power (dBm)',  min:2,    max:20,  step:1  },
            { key:'maxNodes',    label:'Max Nodes',       min:1,    max:10,  step:1  },
          ].map(({ key, label, min, max, step }) => (
            <div key={key} className="bg-mine-deeper rounded-lg p-3">
              <div className="metric-label mb-2">{label}</div>
              <input type="number" min={min} max={max} step={step}
                disabled={!isAdmin}
                className="input-dark text-lg font-bold text-mine-accent"
                value={local[key] || 0}
                onChange={e => handleField(key, Number(e.target.value))} />
            </div>
          ))}
          <div className="bg-mine-deeper rounded-lg p-3">
            <div className="metric-label mb-2">Mine Section Name</div>
            <input className="input-dark" disabled={!isAdmin}
              value={local.mineSectionName || ''} onChange={e => handleField('mineSectionName', e.target.value)} />
          </div>
          <div className="bg-mine-deeper rounded-lg p-3">
            <div className="metric-label mb-2">Node Timeout (s)</div>
            <input type="number" min={10} max={300} className="input-dark" disabled={!isAdmin}
              value={local.nodeTimeoutSec || 60} onChange={e => handleField('nodeTimeoutSec', Number(e.target.value))} />
          </div>
        </div>
      </Section>

      {/* Alert behaviour */}
      <Section title="Alert Behaviour" icon={Bell}>
        <div className="space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="text-sm text-mine-dim">Alert Sound</div>
              <div className="text-mine-muted text-xs">Play audio when critical alerts fire</div>
            </div>
            <div className={`relative w-11 h-6 rounded-full transition-colors ${local.alertSoundEnabled ? 'bg-mine-accent' : 'bg-mine-border'}`}
              onClick={() => isAdmin && handleField('alertSoundEnabled', !local.alertSoundEnabled)}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${local.alertSoundEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
          </label>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-mine-dim">Auto-Acknowledge Alerts (min)</div>
              <div className="text-mine-muted text-xs">Auto-dismiss unacknowledged alerts after N minutes</div>
            </div>
            <input type="number" min={0} max={120} disabled={!isAdmin}
              className="input-dark w-24 text-right" value={local.autoAckAfterMin || 30}
              onChange={e => handleField('autoAckAfterMin', Number(e.target.value))} />
          </div>
        </div>
      </Section>
    </div>
  );
}
