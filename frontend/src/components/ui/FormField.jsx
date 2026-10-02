/**
 * FormField — Animated form input with floating label.
 *
 * Features:
 *  - Floating label that rises on focus/fill
 *  - Amber glow focus ring
 *  - Smooth border colour transition
 *  - Error state (red border + shake animation)
 *  - Icon support (left side)
 *  - Works for: input | select | textarea
 */
import React, { useState, useId } from 'react';

export default function FormField({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  icon: Icon,
  as = 'input',  // 'input' | 'select' | 'textarea'
  rows = 3,
  children,       // for <select> options
  disabled = false,
  required = false,
  className = '',
  ...props
}) {
  const [focused, setFocused] = useState(false);
  const id = useId();
  const filled = value !== '' && value !== undefined && value !== null;
  const floatUp = focused || filled;

  const borderColor = error
    ? '#ef4444'
    : focused
    ? '#f59e0b'
    : 'rgba(255,255,255,0.1)';

  const boxShadow = error
    ? '0 0 0 3px rgba(239,68,68,0.15)'
    : focused
    ? '0 0 0 3px rgba(245,158,11,0.15), 0 0 16px rgba(245,158,11,0.08)'
    : '0 1px 3px rgba(0,0,0,0.15)';

  const sharedStyle = {
    width: '100%',
    background: focused ? 'rgba(12,18,34,0.95)' : 'rgba(6,10,20,0.75)',
    border: `1px solid ${borderColor}`,
    borderRadius: '0.625rem',
    padding: label ? `1.4rem 0.875rem 0.4rem ${Icon ? '2.5rem' : '0.875rem'}` : `0.6rem 0.875rem 0.6rem ${Icon ? '2.5rem' : '0.875rem'}`,
    color: '#e2e8f0',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    lineHeight: '1.5',
    boxShadow,
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
    opacity: disabled ? 0.45 : 1,
    cursor: disabled ? 'not-allowed' : 'auto',
  };

  const labelStyle = {
    position: 'absolute',
    left: Icon ? '2.5rem' : '0.875rem',
    top: floatUp ? '0.35rem' : '50%',
    transform: floatUp ? 'translateY(0) scale(0.78)' : 'translateY(-50%) scale(1)',
    transformOrigin: 'left top',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: error ? '#f87171' : focused ? '#f59e0b' : '#475569',
    pointerEvents: 'none',
    transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)',
    letterSpacing: floatUp ? '0.04em' : '0',
    textTransform: floatUp ? 'uppercase' : 'none',
    whiteSpace: 'nowrap',
  };

  // Adjust label top for textarea
  const textareaLabelStyle = {
    ...labelStyle,
    top: floatUp ? '0.35rem' : '0.875rem',
    transform: floatUp ? 'translateY(0) scale(0.78)' : 'translateY(0) scale(1)',
  };

  return (
    <div className={`relative ${className}`} style={{ animation: error ? 'formShake 0.4s ease' : 'none' }}>
      {/* Left icon */}
      {Icon && (
        <div style={{
          position: 'absolute',
          left: '0.75rem',
          top: '50%',
          transform: 'translateY(-50%)',
          color: focused ? '#f59e0b' : '#475569',
          transition: 'color 0.2s ease',
          pointerEvents: 'none',
          zIndex: 1,
        }}>
          <Icon style={{ width:'1rem', height:'1rem' }} />
        </div>
      )}

      {/* Floating label */}
      {label && (
        <label
          htmlFor={id}
          style={as === 'textarea' ? textareaLabelStyle : labelStyle}
        >
          {label}{required && <span style={{ color:'#ef4444', marginLeft:2 }}>*</span>}
        </label>
      )}

      {/* Input / Select / Textarea */}
      {as === 'select' ? (
        <>
          <select
            id={id}
            value={value}
            onChange={onChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={disabled}
            style={{
              ...sharedStyle,
              cursor: disabled ? 'not-allowed' : 'pointer',
              paddingRight: '2rem',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2364748b' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 0.75rem center',
            }}
            {...props}
          >
            {children}
          </select>
        </>
      ) : as === 'textarea' ? (
        <textarea
          id={id}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          rows={rows}
          disabled={disabled}
          placeholder={!label && placeholder ? placeholder : ''}
          style={{ ...sharedStyle, resize: 'none', paddingTop: label ? '1.4rem' : '0.75rem' }}
          {...props}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled}
          placeholder={!label && placeholder ? placeholder : ''}
          style={sharedStyle}
          {...props}
        />
      )}

      {/* Error message */}
      {error && (
        <div style={{
          fontSize: '0.7rem',
          color: '#f87171',
          marginTop: '0.25rem',
          paddingLeft: '0.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          animation: 'fadeInDown 0.2s ease',
        }}>
          ⚠ {error}
        </div>
      )}
    </div>
  );
}
