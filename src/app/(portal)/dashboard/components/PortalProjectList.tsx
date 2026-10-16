import Link from 'next/link';
import type { PortalDashboardVisualState } from '@/lib/portal/dashboard-state';
import { getPortalProjectHostLabel } from '@/lib/portal/project-display';

const STATE_LABEL: Record<PortalDashboardVisualState, string> = {
  active: 'Publicado',
  building: 'En construcción',
  preview: 'Preview listo',
  materials: 'Materiales pendientes',
  review: 'En revisión',
  limited: 'En activación',
};

const STATE_BADGE: Record<PortalDashboardVisualState, { background: string; color: string }> = {
  active: { background: 'rgba(93,214,156,0.12)', color: '#5DD69C' },
  building: { background: 'rgba(212,184,255,0.1)', color: '#D4B8FF' },
  preview: { background: 'rgba(107,159,255,0.1)', color: '#6B9FFF' },
  materials: { background: 'rgba(255,140,0,0.12)', color: '#FF8C00' },
  review: { background: 'rgba(212,184,255,0.1)', color: '#D4B8FF' },
  limited: { background: 'rgba(128,128,128,0.1)', color: 'var(--text-3)' },
};

export interface ProjectCardItem {
  id: string;
  displayName: string;
  typeLabel: string;
  visualState: PortalDashboardVisualState;
  productionUrl: string | null;
  href: string;
}

interface PortalProjectListProps {
  projects: ProjectCardItem[];
}

export function PortalProjectList({ projects }: PortalProjectListProps) {
  if (projects.length === 0) {
    return (
      <p
        style={{
          fontSize: 12,
          color: 'var(--text-3)',
          fontFamily: 'var(--font-body)',
          lineHeight: 1.5,
        }}
      >
        Todavía no tienes proyectos activos. Xavier activará tu portal una vez revisada tu solicitud.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {projects.map((project) => {
        const badge = STATE_BADGE[project.visualState];
        // Avoid echoing the domain twice: only show the production host below
        // the title when the title isn't already that same host.
        const prodHost = getPortalProjectHostLabel(project.productionUrl);
        const showProdHost =
          project.visualState === 'active' &&
          !!prodHost &&
          prodHost !== project.displayName.toLowerCase();
        return (
          <Link
            key={project.id}
            href={project.href}
            aria-label={`${project.displayName} — ${STATE_LABEL[project.visualState]}`}
            style={{
              display: 'block',
              background: 'var(--surface-2)',
              borderRadius: 10,
              padding: '12px 14px',
              textDecoration: 'none',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                <div
                  aria-hidden="true"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    background: 'rgba(255,140,0,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--amber)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    <line x1="2" x2="22" y1="12" y2="12" />
                  </svg>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text)',
                      fontFamily: 'var(--font-body)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {project.displayName}
                  </div>
                  {showProdHost && (
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--amber)',
                        marginTop: 1,
                        fontFamily: 'var(--font-body)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {prodHost}
                    </div>
                  )}
                </div>
              </div>
              <span
                style={{
                  fontSize: 9,
                  padding: '1px 7px',
                  borderRadius: 100,
                  fontFamily: 'var(--font-body)',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  marginLeft: 8,
                  ...badge,
                }}
              >
                {STATE_LABEL[project.visualState]}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  padding: '2px 9px',
                  borderRadius: 100,
                  fontFamily: 'var(--font-body)',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  background: 'rgba(128,128,128,0.1)',
                  color: 'var(--text-3)',
                }}
              >
                {project.typeLabel}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--amber)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Ver detalle →
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
