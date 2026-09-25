import React, { useState } from 'react';
import {
  User, Edit3, Save, X, Phone, Calendar, MapPin,
  HardHat, ShieldCheck, Siren, Settings2, Badge,
  Clock, Activity, Lock, Eye, EyeOff,
} from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const ROLE_META = {
  miner:      { label: 'Miner',        Icon: HardHat,     color: 'text-mine-accent',  bg: 'bg-amber-900/30',  border: 'border-mine-accent/30' },
  supervisor: { label: 'Supervisor',   Icon: ShieldCheck,  color: 'text-mine-blue',    bg: 'bg-blue-900/30',   border: 'border-mine-blue/30' },
  rescue:     { label: 'Rescue Team',  Icon: Siren,        color: 'text-red-400',      bg: 'bg-red-900/30',    border: 'border-red-700/30' },
  admin:      { label: 'Admin',        Icon: Settings2,    color: 'text-mine-purple',  bg: 'bg-purple-900/30', border: 'border-purple-700/30' },
};

const SHIFTS = ['Morning', 'Evening', 'Night', 'On-Call', 'All'];
const SECTIONS = ['SEC-A', 'SEC-B', 'SEC-C', 'ALL'];

function Field({ label, value, icon: Icon }) {
  return (
    <div className="bg-mine-deeper rounded-lg p-3">
      <div className="metric-label mb-1 flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}{label}
      </div>
      <div className="text-mine-text text-sm font-medium">{value || '—'}</div>
    </div>
  );
}

export default function ProfilePage() {
  const currentUser   = useAuthStore(s => s.currentUser);
  const updateProfile = useAuthStore(s => s.updateProfile);

  const [editing,   setEditing]   = useState(false);
  const [showPass,  setShowPass]  = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [form, setForm] = useState({
    name:     currentUser?.name     || '',
    phone:    currentUser?.phone    || '',
    shift:    currentUser?.shift    || '',
    section:  currentUser?.section  || '',
    password: '',
  });

  if (!currentUser) return null;
  const meta = ROLE_META[currentUser.role] || ROLE_META.supervisor;

  function handleSave() {
    const updates = { name: form.name, phone: form.phone, shift: form.shift, section: form.section };
    if (form.password.length >= 6) updates.password = form.password;
    updateProfile(updates);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function handleCancel() {
    setForm({ name: currentUser.name, phone: currentUser.phone, shift: currentUser.shift, section: currentUser.section, password: '' });
    setEditing(false);
  }

  const loginTime = currentUser.loginAt
    ? new Date(currentUser.loginAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : '—';

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <User className="w-5 h-5 text-mine-accent" />
          <h1 className="font-bold text-lg">My Profile</h1>
        </div>
        {saved && (
          <div className="flex items-center gap-2 bg-green-900/30 border border-green-700/50 px-3 py-1.5 rounded-lg text-sm text-green-400 animate-fade-in">
            <Save className="w-4 h-4" /> Profile saved
          </div>
        )}
      </div>

      {/* Identity card */}
      <div className={`card border ${meta.border} flex items-center gap-5`}>
        <div className={`w-16 h-16 rounded-2xl text-4xl flex items-center justify-center ${meta.bg} border ${meta.border}`}>
          {currentUser.avatar || '👤'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xl font-black text-white">{currentUser.name}</div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border ${meta.bg} ${meta.border} ${meta.color}`}>
              <meta.Icon className="w-3.5 h-3.5" />{meta.label}
            </span>
            <span className="badge-info">{currentUser.badge}</span>
            <span className="text-mine-muted text-xs font-mono">@{currentUser.username}</span>
          </div>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)}
            className="btn-ghost flex items-center gap-1.5 flex-shrink-0">
            <Edit3 className="w-3.5 h-3.5" /> Edit
          </button>
        )}
      </div>

      {/* View / Edit form */}
      {editing ? (
        <div className="card space-y-4">
          <div className="section-title mb-2">
            <Edit3 className="w-3.5 h-3.5 text-mine-accent" /> Edit Profile
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="metric-label mb-1.5 block">Full Name</label>
              <input className="input-dark" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="metric-label mb-1.5 block">Phone Number</label>
              <input className="input-dark" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 XXXXXXXXXX" />
            </div>
            <div>
              <label className="metric-label mb-1.5 block">Shift</label>
              <select className="input-dark" value={form.shift} onChange={e => setForm(f => ({ ...f, shift: e.target.value }))}>
                {SHIFTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="metric-label mb-1.5 block">Section</label>
              <select className="input-dark" value={form.section} onChange={e => setForm(f => ({ ...f, section: e.target.value }))}>
                {SECTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="metric-label mb-1.5 block">New Password <span className="text-mine-muted normal-case">(leave blank to keep current)</span></label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mine-muted" />
                <input className="input-dark pl-10 pr-10" type={showPass ? 'text' : 'password'}
                  placeholder="Min 6 characters" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-mine-muted hover:text-mine-dim">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button onClick={handleSave} className="btn-primary flex items-center gap-2">
              <Save className="w-4 h-4" /> Save Changes
            </button>
            <button onClick={handleCancel} className="btn-ghost flex items-center gap-2">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Full Name"   value={currentUser.name}     icon={User} />
          <Field label="Badge ID"    value={currentUser.badge}    icon={Badge} />
          <Field label="Username"    value={currentUser.username} icon={User} />
          <Field label="Phone"       value={currentUser.phone}    icon={Phone} />
          <Field label="Shift"       value={currentUser.shift}    icon={Clock} />
          <Field label="Section"     value={currentUser.section}  icon={MapPin} />
          <Field label="Joined"      value={currentUser.joined}   icon={Calendar} />
          <Field label="Last Login"  value={loginTime}            icon={Activity} />
          {currentUser.nodeId && <Field label="Linked Node" value={`Node ${currentUser.nodeId}`} icon={Activity} />}
        </div>
      )}

      {/* Session info */}
      <div className="card border border-mine-border/40">
        <div className="section-title mb-3">
          <Activity className="w-3.5 h-3.5 text-mine-cyan" /> Current Session
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="bg-mine-deeper rounded-lg p-3">
            <div className="metric-label mb-1">Role</div>
            <div className={`font-bold ${meta.color}`}>{meta.label}</div>
          </div>
          <div className="bg-mine-deeper rounded-lg p-3">
            <div className="metric-label mb-1">Login Time</div>
            <div className="font-mono text-xs text-mine-dim">{loginTime}</div>
          </div>
          <div className="bg-mine-deeper rounded-lg p-3">
            <div className="metric-label mb-1">Section</div>
            <div className="text-mine-text font-semibold">{currentUser.section}</div>
          </div>
          <div className="bg-mine-deeper rounded-lg p-3">
            <div className="metric-label mb-1">Shift</div>
            <div className="text-mine-text font-semibold">{currentUser.shift}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
