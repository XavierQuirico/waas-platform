import { getBillingProjectLabel } from '@/lib/portal/billing-state';
import type { BillingProject } from './data';

interface BillingProjectSelectorProps {
  allProjects: BillingProject[];
  selectedProjectId: string;
}

// Badge de plan por tipo — solo color del label del plan, nunca del nombre del
// proyecto ni de códigos internos. Tintes coherentes con el sistema dark.
type PlanBadgeKey = 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY' | 'PORTFOLIO';

const PLAN_BADGE: Record<PlanBadgeKey, { label: string; background: string; color: string }> = {
  BASIC: { label: 'Basic', background: 'rgba(107,159,255,0.14)', color: '#6B9FFF' },
  PRO: { label: 'Pro', background: 'rgba(212,184,255,0.14)', color: '#D4B8FF' },
  BUSINESS: { label: 'Business', background: 'rgba(93,214,156,0.14)', color: '#5DD69C' },
  LEGACY: { label: 'Legacy', background: 'rgba(148,163,184,0.14)', color: '#94A3B8' },
  PORTFOLIO: { label: 'Portfolio', background: 'rgba(255,140,0,0.14)', color: '#FF8C00' },
};

function getPlanBadge(project: BillingProject): { label: string; background: string; color: string } {
  if (project.projectType === 'LEGACY') return PLAN_BADGE.LEGACY;
  if (project.projectType === 'PORTFOLIO') return PLAN_BADGE.PORTFOLIO;
  const key = project.plan as PlanBadgeKey;
  return PLAN_BADGE[key] ?? PLAN_BADGE.BASIC;
}

const card: React.CSSProperties = {
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'var(--surface)',
  padding: '20px 24px',
  marginBottom: 16,
};

export function BillingProjectSelector({ allProjects, selectedProjectId }: BillingProjectSelectorProps) {
  if (allProjects.length <= 1) return null;

  const total = allProjects.length;

  return (
    <div style={card}>
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-3)',
          fontFamily: 'var(--font-body)',
          margin: '0 0 10px',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        Proyectos ({total})
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {allProjects.map((p, i) => {
          const isSelected = p.id === selectedProjectId;
          const label = getBillingProjectLabel({
            index: i,
            total,
            productionUrl: p.productionUrl,
            stagingUrl: p.stagingUrl,
            domainTarget: p.domainTarget,
          });
          const planBadge = getPlanBadge(p);
          return (
            <a
              key={p.id}
              href={`/facturacion?p=${p.id}`}
              aria-current={isSelected ? 'true' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '11px 13px',
                borderRadius: 9,
                border: isSelected
                  ? '1px solid rgba(255,255,255,0.16)'
                  : '1px solid rgba(255,255,255,0.05)',
                background: isSelected ? 'rgba(255,255,255,0.06)' : 'transparent',
                textDecoration: 'none',
                transition: 'background 0.12s, border-color 0.12s',
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: isSelected ? 600 : 400,
                  color: isSelected ? 'var(--text)' : 'var(--text-2)',
                  fontFamily: 'var(--font-body)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                }}
              >
                {label}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  padding: '2px 9px',
                  borderRadius: 100,
                  background: planBadge.background,
                  color: planBadge.color,
                  fontFamily: 'var(--font-body)',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {planBadge.label}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
