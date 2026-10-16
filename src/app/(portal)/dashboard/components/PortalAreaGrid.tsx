import Link from 'next/link';
import type { NavItem } from '@/lib/portal/nav';

const AREA_DESCRIPTIONS: Record<string, string> = {
  proyecto: 'Fases, materiales, preview y revisiones.',
  misitio: 'URL, estado operativo y detalles del sitio.',
  cambios: 'Solicita ajustes o nuevas capacidades.',
  incidencias: 'Reporta si algo no funciona bien.',
  facturacion: 'Plan, pagos y estado de facturación.',
  mantenimiento: 'Soporte legacy, ajustes y cuidado del sitio.',
  soporte: 'Habla directamente con Xavier.',
};

function NavIcon({ name }: { name: string }) {
  const props = {
    width: 15,
    height: 15,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'var(--amber)',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (name) {
    case 'folder':
      return (
        <svg {...props}>
          <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
        </svg>
      );
    case 'globe':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          <line x1="2" x2="22" y1="12" y2="12" />
        </svg>
      );
    case 'ticket':
      return (
        <svg {...props}>
          <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
          <path d="M13 5v2" />
          <path d="M13 17v2" />
          <path d="M13 11v2" />
        </svg>
      );
    case 'alert':
      return (
        <svg {...props}>
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" x2="12" y1="9" y2="13" />
          <line x1="12" x2="12.01" y1="17" y2="17" />
        </svg>
      );
    case 'creditcard':
      return (
        <svg {...props}>
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <line x1="2" x2="22" y1="10" y2="10" />
        </svg>
      );
    case 'wrench':
      return (
        <svg {...props}>
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
    case 'lifebuoy':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="4" />
          <line x1="4.93" x2="9.17" y1="4.93" y2="9.17" />
          <line x1="14.83" x2="19.07" y1="14.83" y2="19.07" />
          <line x1="14.83" x2="19.07" y1="9.17" y2="4.93" />
          <line x1="4.93" x2="9.17" y1="19.07" y2="14.83" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
  }
}

interface PortalAreaGridProps {
  areas: NavItem[];
}

export function PortalAreaGrid({ areas }: PortalAreaGridProps) {
  if (areas.length === 0) return null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
        gap: 10,
      }}
    >
      {areas.map((area) => (
        <Link
          key={area.id}
          href={area.href}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            background: 'var(--surface)',
            borderRadius: 10,
            padding: 14,
            textDecoration: 'none',
            boxShadow: '0 1px 4px rgba(0,0,0,0.14)',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: 'rgba(255,140,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <NavIcon name={area.icon} />
          </div>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text)',
                marginBottom: 2,
                fontFamily: 'var(--font-body)',
              }}
            >
              {area.label}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-3)',
                lineHeight: 1.4,
                fontFamily: 'var(--font-body)',
              }}
            >
              {AREA_DESCRIPTIONS[area.id] ?? ''}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
