'use client';
import { useEffect, useRef } from 'react';
import { animateCounter } from '@/lib/gsap';

interface KpiCardProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  description?: string;
  /** @deprecated Use accentColor instead. Kept for backward compatibility. */
  accent?: boolean;
  /** CSS color value applied to the numeric value. Defaults to var(--text). */
  accentColor?: string;
  trend?: { value: number; positive: boolean };
}

export function KpiCard({
  label,
  value,
  prefix = '',
  suffix = '',
  description,
  accent = false,
  accentColor,
  trend,
}: KpiCardProps) {
  const valueRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (valueRef.current && typeof value === 'number') {
      animateCounter(valueRef.current, value, suffix);
    }
  }, [value, suffix]);

  // Resolve the value color: explicit accentColor > legacy accent flag > design token default
  const valueColor = accentColor ?? (accent ? '#d5ff02' : 'var(--text)');

  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: 12,
        padding: '18px 22px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
      }}
    >
      {/* Label — uppercase, 10px, Inter Tight, text-3 */}
      <p
        className="font-body"
        style={{
          fontSize: 10,
          color: 'var(--text-3)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          margin: 0,
        }}
      >
        {label}
      </p>

      {/* Value row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
        {prefix && (
          <span
            className="font-headline"
            style={{ fontSize: 16, fontWeight: 700, color: valueColor, marginBottom: 2 }}
          >
            {prefix}
          </span>
        )}
        <span
          ref={valueRef}
          className="font-headline"
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: valueColor,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          {value}{suffix}
        </span>
      </div>

      {/* Delta chip */}
      {trend && (
        <div style={{ marginTop: 4 }}>
          <span
            className={`badge-pill ${trend.positive ? 'badge-green' : 'badge-red'}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}
          >
            {trend.positive ? '↑' : '↓'} {trend.value}%
          </span>
          <span
            className="font-body"
            style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 5 }}
          >
            vs mes anterior
          </span>
        </div>
      )}

      {/* Optional description / sub-label */}
      {description && (
        <p
          className="font-body"
          style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}
        >
          {description}
        </p>
      )}
    </div>
  );
}
