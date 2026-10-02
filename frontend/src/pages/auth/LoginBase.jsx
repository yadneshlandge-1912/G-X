/**
 * LoginBase — shared login form shell used by all four role login pages.
 * Each role passes its own accent color, icon, title, demo hint.
 */
import React, { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, AlertCircle, User, Lock, Loader2, Sun, Moon } from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';

export default function LoginBase({ role, title, subtitle, emoji, accent, demo, hint }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);

  const login       = useAuthStore(s => s.login);
  const authError   = useAuthStore(s => s.authError);
  const clearError  = useAuthStore(s => s.clearAuthError);
  const setStep     = useAuthStore(s => s.setAuthStep);
  const theme       = useAuthStore(s => s.theme);
  const toggleTheme = useAuthStore(s => s.toggleTheme);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 500));
    login(username.trim(), password);
    setLoading(false);
  }

  const accentBorder = `1px solid ${accent}33`;
  const accentBg     = `${accent}0d`;
  const accentGlow   = `0 0 32px ${accent}22`;
  const valid        = username.trim() && password;

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-6 relative overflow-hidden transition-colors duration-200">
      {/* Background */}
      <div className="absolute inset-0 bg-grid-sm pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 60% 40% at 50% 0%, ${accent}12 0%, transparent 55%)` }} />

      <div className="relative z-10 w-full max-w-[420px] animate-fade-up">

        {/* Top bar: Back + Theme */}
        <div className="flex items-center justify-between mb-7">
          <button onClick={() => { clearError(); setStep('role_pick'); }}
            className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-200 transition-colors group">
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            All roles
          </button>
          <button onClick={toggleTheme} className="btn-icon" title="Toggle theme">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Card */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', boxShadow: `var(--shadow-dropdown), ${accentGlow}` }}>

          {/* Header */}
          <div className="px-8 pt-8 pb-6" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                style={{ background: accentBg, border: accentBorder }}>
                {emoji}
              </div>
              <div>
                <div className="text-xl font-bold text-ink-100">{title}</div>
                <div className="text-sm text-ink-500 mt-0.5">{subtitle}</div>
              </div>
            </div>

            {/* Demo hint */}
            <div className="flex items-start gap-2.5 rounded-xl p-3 text-xs"
              style={{ background: accentBg, border: accentBorder }}>
              <span className="text-base mt-0.5 flex-shrink-0">💡</span>
              <div>
                <span className="font-semibold" style={{ color: accent }}>Demo credentials — </span>
                <span className="text-ink-400">{demo}</span>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">

            {authError && (
              <div className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm text-red-300 animate-fade-in"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                {authError}
              </div>
            )}

            {/* Username */}
            <div className="space-y-1.5">
              <label className="label block">{hint || 'Username'}</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-600 pointer-events-none" />
                <input className="input pl-10" placeholder="Enter your username"
                  value={username} autoFocus
                  onChange={e => { setUsername(e.target.value); clearError(); }} />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="label block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-600 pointer-events-none" />
                <input className="input pl-10 pr-11"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); clearError(); }} />
                <button type="button" tabIndex={-1}
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-600 hover:text-ink-400 transition-colors">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button type="submit" disabled={!valid || loading}
              className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 mt-2"
              style={valid && !loading ? {
                background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)`,
                color: '#ffffff',
                boxShadow: `0 0 0 1px ${accent}44, 0 4px 20px ${accent}30`,
              } : {
                background: 'var(--bg-card-nested)',
                color: 'var(--text-faint)',
                cursor: 'not-allowed',
              }}>
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
                : `Sign in as ${title}`}
            </button>
          </form>

          <div className="px-8 py-3 text-center text-[11px] text-ink-500"
            style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-card-nested)' }}>
            Authorised personnel only · Activity monitored
          </div>
        </div>
      </div>
    </div>
  );
}
