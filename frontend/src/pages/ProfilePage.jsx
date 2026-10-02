import React, { useState } from 'react';
import {
  User, Edit3, Save, X, Phone, Calendar, MapPin,
  HardHat, ShieldCheck, Siren, Settings2, Badge,
  Clock, Activity, Lock, Eye, EyeOff, CheckCircle2,
} from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const ROLE_META = {
  miner:      { label: 'Miner',        Icon: HardHat,     color: 'text-mine-accent',  bg: 'bg-amber-900/30',  border: 'border-mine-accent/30' },
  supervisor: { label: 'Supervisor',   Icon: ShieldCheck,  color: 'text-mine-blue',    bg: 'bg-blue-900/30',   border: 'border-mine-blue/30' },
  rescue:     { label: 'Rescue Team',  Icon: Siren,        color: 'text-red-400',      bg: 'bg-red-900/30',    border: 'border-red-700/30' },
  admin:      { label: 'Admin',        Icon: Settings2,    color: 'text-mine-purple',  bg: 'bg-purple-900/30', border: 'border-purple-700/30' },
};
const SHIFTS   = ['Morning', 'Evening', 'Night', 'On-Call', 'All'];
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

function EditButton({ onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="btn-ghost flex items-center gap-2 flex-shrink-0 relative overflow-hidden"
      style={{
        padding: '0.5rem 1.125rem',
        transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered ? 'var(--shadow-card-hover)' : 'none',
      }}
    >
      <span className="absolute inset-0 pointer-events-none" style={{
        background: 'linear-gradient(105deg, transparent 30%, rgba(245,158,11,0.1) 50%, transparent 70%)',
        transform: hovered ? 'translateX(100%)' : 'translateX(-100%)',
        transition: 'transform 0.5s ease',
      }} />
      <Edit3 className="w-3.5 h-3.5 relative z-10" style={{
        color: 'var(--accent-amber)',
        transform: hovered ? 'rotate(-14deg) scale(1.2)' : 'rotate(0deg) scale(1)',
        transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      }} />
      <span className="relative z-10 text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
        Edit Profile
      </span>
    </button>
  );
}

function SaveButton({ onClick, saving, justSaved }) {
  const [ripple, setRipple] = useState(null);
  function handleClick(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    setRipple({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setTimeout(() => setRipple(null), 700);
    onClick();
  }
  return (
    <button
      onClick={handleClick}
      disabled={saving || justSaved}
      className="relative overflow-hidden flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-sm text-white select-none"
      style={{
        background: justSaved
          ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
          : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        boxShadow: justSaved
          ? '0 0 0 1px rgba(16,185,129,0.5), 0 4px 20px rgba(16,185,129,0.4)'
          : '0 0 0 1px rgba(245,158,11,0.4), 0 4px 20px rgba(245,158,11,0.35)',
        transition: 'all 0.4s cubic-bezier(0.16,1,0.3,1)',
        transform: saving ? 'scale(0.96)' : 'scale(1)',
        minWidth: '9rem',
      }}
    >
      {ripple && (
        <span className="absolute rounded-full pointer-events-none" style={{
          left: ripple.x - 50, top: ripple.y - 50,
          width: 100, height: 100,
          background: 'rgba(255,255,255,0.28)',
          animation: 'profileRipple 0.65s ease-out forwards',
        }} />
      )}
      {!justSaved && (
        <span className="absolute inset-0 pointer-events-none" style={{
          background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.2) 50%, transparent 65%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 2.2s linear infinite',
        }} />
      )}
      <span className="relative z-10 flex-shrink-0" style={{
        transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        transform: justSaved ? 'scale(1.2)' : 'scale(1)',
      }}>
        {justSaved
          ? <CheckCircle2 className="w-4 h-4" style={{ animation: 'profileCheckIn 0.35s cubic-bezier(0.34,1.56,0.64,1)' }} />
          : saving
          ? <Save className="w-4 h-4" style={{ animation: 'profileSpin 0.9s linear infinite' }} />
          : <Save className="w-4 h-4" />}
      </span>
      <span className="relative z-10">
        {justSaved ? 'Saved!' : saving ? 'Saving…' : 'Save Changes'}
      </span>
    </button>
  );
}

function CancelButton({ onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="btn-ghost flex items-center gap-2"
      style={{ transition: 'all 0.2s ease', transform: hovered ? 'translateX(-3px)' : 'translateX(0)' }}
    >
      <X className="w-4 h-4" style={{
        transform: hovered ? 'rotate(90deg)' : 'rotate(0deg)',
        transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        color: hovered ? '#ef4444' : 'currentColor',
      }} />
      Cancel
    </button>
  );
}

export default function ProfilePage() {
  const currentUser   = useAuthStore(s => s.currentUser);
  const updateProfile = useAuthStore(s => s.updateProfile);
  const [editing,   setEditing]   = useState(false);
  const [showPass,  setShowPass]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [form, setForm] = useState({
    name:     currentUser?.name     || '',
    phone:    currentUser?.phone    || '',
    shift:    currentUser?.shift    || '',
    section:  currentUser?.section  || '',
    password: '',
  });

  if (!currentUser) return null;
  const meta = ROLE_META[currentUser.role] || ROLE_META.supervisor;

  async function handleSave() {
    setSaving(true);
    await new Promise(r => setTimeout(r, 650));
    const updates = { name: form.name, phone: form.phone, shift: form.shift, section: form.section };
    if (form.password.length >= 6) updates.password = form.password;
    updateProfile(updates);
    setSaving(false);
    setJustSaved(true);
    setTimeout(() => { setJustSaved(false); setEditing(false); }, 1600);
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <User className="w-5 h-5 text-mine-accent" />
          <h1 className="font-bold text-lg">My Profile</h1>
        </div>
        {justSaved && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm animate-scale-in"
            style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }}>
            <CheckCircle2 className="w-4 h-4" /> Profile saved!
          </div>
        )}
      </div>

      <div className={`card border ${meta.border} flex items-center gap-5`}>
        <div className="relative flex-shrink-0">
          <div className={`w-16 h-16 rounded-2xl text-4xl flex items-center justify-center ${meta.bg} border ${meta.border}`}>
            {currentUser.avatar || '??'}
          </div>
          {editing && (
            <div className="absolute -inset-1.5 rounded-2xl pointer-events-none"
              style={{ border: '1px solid var(--accent-amber)', opacity: 0.35, animation: 'ping 2s cubic-bezier(0,0,0.2,1) infinite' }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xl font-black text-ink-100">{currentUser.name}</div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border ${meta.bg} ${meta.border} ${meta.color}`}>
              <meta.Icon className="w-3.5 h-3.5" />{meta.label}
            </span>
            <span className="badge-info">{currentUser.badge}</span>
            <span className="text-mine-muted text-xs font-mono">@{currentUser.username}</span>
          </div>
        </div>
        {!editing && <EditButton onClick={() => setEditing(true)} />}
      </div>

      {editing ? (
        <div className="card space-y-4 animate-scale-in">
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-mine-muted hover:text-mine-dim transition-colors">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <SaveButton onClick={handleSave} saving={saving} justSaved={justSaved} />
            {!justSaved && <CancelButton onClick={handleCancel} />}
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

      <style>{`
        @keyframes profileRipple {
          0%   { transform: scale(0); opacity: 1; }
          100% { transform: scale(4.5); opacity: 0; }
        }
        @keyframes profileCheckIn {
          0%   { transform: scale(0) rotate(-25deg); opacity: 0; }
          60%  { transform: scale(1.3) rotate(5deg);  opacity: 1; }
          100% { transform: scale(1)   rotate(0deg);  opacity: 1; }
        }
        @keyframes profileSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
