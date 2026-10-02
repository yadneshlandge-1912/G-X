/**
 * GXLogo — GuardianX brand logo component
 *
 * A shield with three LoRa radio wave arcs and a signal dot.
 * The shield represents mine protection; the arcs represent
 * the LoRa wireless network connecting miners to the surface.
 *
 * Props:
 *   size   : number (px) — width and height of the logo square (default 32)
 *   pulse  : bool — if true, the outermost arc pulses (default false)
 *   className : additional CSS classes
 */
import React from 'react';

export default function GXLogo({ size = 32, pulse = false, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="GuardianX logo"
    >
      <defs>
        <linearGradient id="gx-shield" x1="32" y1="4" x2="32" y2="61" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#1E293B"/>
          <stop offset="100%" stopColor="#0F172A"/>
        </linearGradient>
        <linearGradient id="gx-border" x1="8" y1="4" x2="56" y2="61" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#FBBF24"/>
          <stop offset="100%" stopColor="#D97706"/>
        </linearGradient>
        <linearGradient id="gx-inner" x1="32" y1="9" x2="32" y2="57" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#F59E0B" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0"/>
        </linearGradient>
        <filter id="gx-glow">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Shield body */}
      <path
        d="M32 4 L56 14 L56 34 C56 47 44 57 32 61 C20 57 8 47 8 34 L8 14 Z"
        fill="url(#gx-shield)"
        stroke="url(#gx-border)"
        strokeWidth="1.8"
      />

      {/* Inner shield shimmer */}
      <path
        d="M32 9 L52 18 L52 34 C52 45 42 53 32 57 C22 53 12 45 12 34 L12 18 Z"
        fill="url(#gx-inner)"
      />

      {/* Signal dot — centre of arcs */}
      <circle cx="32" cy="41" r="2.8" fill="#F59E0B" filter="url(#gx-glow)"/>

      {/* Arc 1 — small / innermost */}
      <path
        d="M25.5 37 Q32 31 38.5 37"
        stroke="#F59E0B"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
        filter="url(#gx-glow)"
      />

      {/* Arc 2 — medium */}
      <path
        d="M20 32 Q32 22.5 44 32"
        stroke="#F59E0B"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.65"
      />

      {/* Arc 3 — large / outermost */}
      <path
        d="M14.5 27 Q32 14 49.5 27"
        stroke="#F59E0B"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity={pulse ? undefined : "0.3"}
        style={pulse ? { animation: 'gxArcPulse 2s ease-in-out infinite', opacity: 0.3 } : {}}
      />

      {/* "GX" text mark — tiny, inside shield bottom */}
      <text
        x="32"
        y="57"
        textAnchor="middle"
        fontSize="7"
        fontWeight="900"
        fontFamily="'JetBrains Mono', monospace"
        fill="#F59E0B"
        opacity="0.7"
        letterSpacing="0.5"
      >
        G-X
      </text>
    </svg>
  );
}
