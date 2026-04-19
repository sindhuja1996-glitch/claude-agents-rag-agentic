'use client';

import { useEffect, useRef } from 'react';

// Animated RGB border that cycles hue
export function RGBBorder({
  children,
  active = true,
  speed = 4,
  borderWidth = 1,
  borderRadius = 12,
  style = {},
}: {
  children: React.ReactNode;
  active?: boolean;
  speed?: number;
  borderWidth?: number;
  borderRadius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        position: 'relative',
        borderRadius,
        padding: borderWidth,
        background: active
          ? `linear-gradient(#080C10, #080C10) padding-box,
             linear-gradient(var(--rgb-angle, 0deg), #ff0080, #ff8c00, #40e0d0, #7b2ff7, #ff0080) border-box`
          : undefined,
        border: active ? `${borderWidth}px solid transparent` : undefined,
        animation: active ? `rgbRotate ${speed}s linear infinite` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Neon glow text
export function NeonText({
  children,
  color = '#00FF9C',
  intensity = 1,
  className = '',
  style = {},
}: {
  children: React.ReactNode;
  color?: string;
  intensity?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const hex = color;
  return (
    <span
      className={className}
      style={{
        color: hex,
        textShadow: `
          0 0 ${7 * intensity}px ${hex}99,
          0 0 ${14 * intensity}px ${hex}66,
          0 0 ${28 * intensity}px ${hex}33
        `,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

// Scan-line overlay
export function ScanLine() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 100,
        background:
          'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
        mixBlendMode: 'overlay',
      }}
    />
  );
}

// RGB moving gradient bar (used as accent stripe)
export function RGBStripe({ height = 2, className = '' }: { height?: number; className?: string }) {
  return (
    <div
      className={className}
      style={{
        height,
        background:
          'linear-gradient(90deg, #ff0080, #ff8c00, #ffe600, #40e0d0, #7b2ff7, #ff0080)',
        backgroundSize: '200% 100%',
        animation: 'rgbSlide 3s linear infinite',
      }}
    />
  );
}

// Pulsing dot indicator
export function PulseDot({ color = '#00FF9C', size = 8 }: { color?: string; size?: number }) {
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: color,
          opacity: 0.4,
          animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
        }}
      />
      <div
        style={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 ${size}px ${color}`,
        }}
      />
    </div>
  );
}

// Glitch text effect
export function GlitchText({
  text,
  color = '#00FF9C',
  className = '',
}: {
  text: string;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={`glitch-text ${className}`}
      data-text={text}
      style={{ color, position: 'relative', display: 'inline-block' }}
    >
      {text}
    </span>
  );
}

// Corner brackets decoration
export function CornerBrackets({
  children,
  color = '#00FF9C',
  size = 10,
  style = {},
}: {
  children: React.ReactNode;
  color?: string;
  size?: number;
  style?: React.CSSProperties;
}) {
  const borderW = 1.5;
  const corner = {
    position: 'absolute' as const,
    width: size,
    height: size,
    borderColor: color,
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block', padding: size / 2, ...style }}>
      {/* TL */}
      <div style={{ ...corner, top: 0, left: 0, borderTopWidth: borderW, borderLeftWidth: borderW, borderStyle: 'solid', borderRight: 'none', borderBottom: 'none' }} />
      {/* TR */}
      <div style={{ ...corner, top: 0, right: 0, borderTopWidth: borderW, borderRightWidth: borderW, borderStyle: 'solid', borderLeft: 'none', borderBottom: 'none' }} />
      {/* BL */}
      <div style={{ ...corner, bottom: 0, left: 0, borderBottomWidth: borderW, borderLeftWidth: borderW, borderStyle: 'solid', borderRight: 'none', borderTop: 'none' }} />
      {/* BR */}
      <div style={{ ...corner, bottom: 0, right: 0, borderBottomWidth: borderW, borderRightWidth: borderW, borderStyle: 'solid', borderLeft: 'none', borderTop: 'none' }} />
      {children}
    </div>
  );
}
