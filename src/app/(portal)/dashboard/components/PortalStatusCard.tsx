import type { CSSProperties } from 'react';
import Link from 'next/link';
import type { PortalStatusConfig, PortalDashboardVisualState } from '@/lib/portal/dashboard-state';

const BADGE_STYLES: Record<string, { background: string; color: string; border: string }> = {
  neutral: { background: 'rgba(128,128,128,0.12)', color: 'var(--text-2)', border: '1px solid rgba(128,128,128,0.2)' },
  amber: { background: 'rgba(255,140,0,0.12)', color: '#FF8C00', border: '1px solid rgba(255,140,0,0.25)' },
  violet: { background: 'rgba(212,184,255,0.1)', color: '#D4B8FF', border: '1px solid rgba(212,184,255,0.25)' },
  blue: { background: 'rgba(107,159,255,0.1)', color: '#6B9FFF', border: '1px solid rgba(107,159,255,0.25)' },
  green: { background: 'rgba(93,214,156,0.1)', color: '#5DD69C', border: '1px solid rgba(93,214,156,0.25)' },
  red: { background: 'rgba(248,113,113,0.1)', color: '#F87171', border: '1px solid rgba(248,113,113,0.25)' },
};

function primaryBtnStyle(accentColor: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '9px 18px',
    borderRadius: 9,
    background: accentColor,
    color: '#121212',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: 12,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  };
}

const secondaryBtnStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '9px 18px',
  borderRadius: 9,
  background: 'var(--surface-2)',
  color: 'var(--text)',
  fontFamily: 'var(--font-body)',
  fontWeight: 600,
  fontSize: 12,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

interface PortalStatusCardProps {
  config: PortalStatusConfig;
  productionUrl: string | null;
  visualState: PortalDashboardVisualState;
}

export function PortalStatusCard({ config, productionUrl, visualState }: PortalStatusCardProps) {
  const badgeStyle = BADGE_STYLES[config.badgeType] ?? BADGE_STYLES.neutral;

  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${config.bgGrad} 0%, transparent 100%)`,
        borderRadius: 14,
        padding: 24,
        marginBottom: 22,
        boxShadow: '0 2px 12px rgba(0,0,0,0.22)',
        border: `1px solid ${config.accentColor}20`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 14,
        }}
      >
        <div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 10px',
              borderRadius: 100,
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
              fontSize: 10,
              letterSpacing: '0.06em',
              marginBottom: 10,
              ...badgeStyle,
            }}
          >
            {config.badgeLabel}
          </span>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 22,
              color: 'var(--text)',
              letterSpacing: '-0.02em',
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {config.title}
          </h2>
        </div>

        {visualState === 'active' && productionUrl && (
          <a
            href={productionUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              color: config.accentColor,
              textDecoration: 'none',
              padding: '6px 12px',
              background: `${config.accentColor}15`,
              borderRadius: 8,
              fontWeight: 600,
              flexShrink: 0,
              whiteSpace: 'nowrap',
              fontFamily: 'var(--font-body)',
            }}
          >
            ↗ {productionUrl.replace(/^https?:\/\//, '')}
          </a>
        )}
      </div>

      <p
        style={{
          fontSize: 13,
          color: 'var(--text-2)',
          lineHeight: 1.65,
          marginBottom: 18,
          maxWidth: 520,
          fontFamily: 'var(--font-body)',
        }}
      >
        {config.desc}
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {config.cta1 && (
          config.cta1.external ? (
            <a
              href={config.cta1.href}
              target="_blank"
              rel="noopener noreferrer"
              style={primaryBtnStyle(config.accentColor)}
            >
              {config.cta1.label}
            </a>
          ) : (
            <Link href={config.cta1.href} style={primaryBtnStyle(config.accentColor)}>
              {config.cta1.label}
            </Link>
          )
        )}
        {config.cta2 && (
          config.cta2.external ? (
            <a
              href={config.cta2.href}
              target="_blank"
              rel="noopener noreferrer"
              style={secondaryBtnStyle}
            >
              {config.cta2.label}
            </a>
          ) : (
            <Link href={config.cta2.href} style={secondaryBtnStyle}>
              {config.cta2.label}
            </Link>
          )
        )}
      </div>
    </div>
  );
}
