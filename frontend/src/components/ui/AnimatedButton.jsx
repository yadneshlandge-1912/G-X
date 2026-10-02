/**
 * AnimatedButton — Drop-in replacement for all plain <button> elements.
 *
 * Features:
 *  - Ripple effect on click (material-style)
 *  - Lift + glow on hover
 *  - Loading spinner state
 *  - Icon support (left or right)
 *  - Variants: primary | ghost | danger | success | warning
 */
import React, { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: {
    base: 'text-black font-bold',
    bg:   'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)',
    hoverBg: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)',
    glow: 'rgba(245,158,11,0.45)',
    ripple: 'rgba(255,255,255,0.35)',
    border: 'transparent',
  },
  ghost: {
    base: 'font-semibold',
    bg:   'transparent',
    hoverBg: 'rgba(148,163,184,0.09)',
    glow: 'rgba(148,163,184,0.2)',
    ripple: 'rgba(148,163,184,0.3)',
    border: 'rgba(255,255,255,0.1)',
  },
  danger: {
    base: 'text-white font-bold',
    bg:   'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)',
    hoverBg: 'linear-gradient(135deg, #f87171 0%, #ef4444 50%, #dc2626 100%)',
    glow: 'rgba(239,68,68,0.5)',
    ripple: 'rgba(255,255,255,0.3)',
    border: 'transparent',
  },
  success: {
    base: 'text-white font-bold',
    bg:   'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
    hoverBg: 'linear-gradient(135deg, #34d399 0%, #10b981 50%, #059669 100%)',
    glow: 'rgba(16,185,129,0.45)',
    ripple: 'rgba(255,255,255,0.3)',
    border: 'transparent',
  },
  warning: {
    base: 'text-black font-bold',
    bg:   'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)',
    hoverBg: 'linear-gradient(135deg, #fb923c 0%, #f97316 50%, #ea580c 100%)',
    glow: 'rgba(249,115,22,0.45)',
    ripple: 'rgba(255,255,255,0.3)',
    border: 'transparent',
  },
};

export default function AnimatedButton({
  children,
  variant = 'primary',
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  disabled = false,
  onClick,
  className = '',
  style = {},
  size = 'md',  // sm | md | lg
  pulse = false,
  type = 'button',
  ...props
}) {
  const btnRef    = useRef(null);
  const [ripples, setRipples] = useState([]);
  const [hovered, setHovered] = useState(false);
  const v = VARIANTS[variant] || VARIANTS.primary;

  const SIZE = {
    sm: { padding:'0.35rem 0.75rem', fontSize:'0.75rem',  gap:'0.375rem', iconSize:'w-3 h-3' },
    md: { padding:'0.5rem 1.1rem',   fontSize:'0.875rem', gap:'0.5rem',   iconSize:'w-4 h-4' },
    lg: { padding:'0.65rem 1.5rem',  fontSize:'1rem',     gap:'0.625rem', iconSize:'w-5 h-5' },
  }[size];

  function addRipple(e) {
    const btn  = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const x    = e.clientX - rect.left;
    const y    = e.clientY - rect.top;
    const size = Math.max(rect.width, rect.height) * 2;
    const id   = Date.now();
    setRipples(r => [...r, { id, x, y, size }]);
    setTimeout(() => setRipples(r => r.filter(rp => rp.id !== id)), 600);
  }

  function handleClick(e) {
    addRipple(e);
    if (onClick && !disabled && !loading) onClick(e);
  }

  const isDisabled = disabled || loading;

  return (
    <button
      ref={btnRef}
      type={type}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={isDisabled}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SIZE.gap,
        padding: SIZE.padding,
        fontSize: SIZE.fontSize,
        fontWeight: 600,
        borderRadius: '0.625rem',
        border: `1px solid ${v.border}`,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.42 : 1,
        position: 'relative',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        outline: 'none',
        letterSpacing: '0.01em',
        background: hovered && !isDisabled ? v.hoverBg : v.bg,
        boxShadow: hovered && !isDisabled
          ? `0 4px 20px ${v.glow}, 0 8px 32px ${v.glow.replace('0.45','0.2')}, 0 0 0 1px ${v.glow.replace('0.45','0.4')}`
          : `0 1px 3px rgba(0,0,0,0.12), 0 2px 8px ${v.glow.replace('0.45','0.15')}`,
        transform: hovered && !isDisabled ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'all 0.22s cubic-bezier(0.16,1,0.3,1)',
        animation: pulse && !isDisabled ? `btnPulse_${variant} 2s ease-in-out infinite` : 'none',
        color: variant==='ghost' ? (hovered?'#e2e8f0':'#94a3b8') : undefined,
        ...style,
      }}
      {...props}
    >
      {/* Left icon or spinner */}
      {loading
        ? <Loader2 className={`${SIZE.iconSize} animate-spin flex-shrink-0`} />
        : Icon && <Icon className={`${SIZE.iconSize} flex-shrink-0`} />
      }

      {/* Label */}
      <span className={v.base}>{children}</span>

      {/* Right icon */}
      {!loading && IconRight && <IconRight className={`${SIZE.iconSize} flex-shrink-0`} />}

      {/* Ripple effects */}
      {ripples.map(rp => (
        <span
          key={rp.id}
          style={{
            position: 'absolute',
            left: rp.x - rp.size / 2,
            top:  rp.y - rp.size / 2,
            width: rp.size,
            height: rp.size,
            borderRadius: '50%',
            background: v.ripple,
            transform: 'scale(0)',
            animation: 'rippleExpand 0.6s cubic-bezier(0.16,1,0.3,1) forwards',
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Shine overlay */}
      <span style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%)',
        backgroundSize: '200% 100%',
        backgroundPosition: hovered ? '-200% 0' : '200% 0',
        transition: 'background-position 0.5s ease',
        borderRadius: 'inherit',
        pointerEvents: 'none',
      }} />
    </button>
  );
}
