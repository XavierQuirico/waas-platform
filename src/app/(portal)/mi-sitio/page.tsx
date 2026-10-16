import 'server-only';
import Link from 'next/link';
import { requirePortalClient } from '@/lib/portal/context';
import { db } from '@/db';
import { projects } from '@/db/schema/projects';
import { eq, desc } from 'drizzle-orm';
import { deriveProjectType } from '@/lib/portal/project-type';
import { toExternalUrl } from '@/lib/portal/url';
import { getPortalNavItems } from '@/lib/portal/nav';
import type { Metadata } from 'next';
import type { ProjectType } from '@/lib/portal/project-type';

export const metadata: Metadata = {
  title: 'Mi sitio — Quirico Studios',
};

interface Props {
  searchParams: Promise<{ p?: string }>;
}

const PLAN_LABELS: Record<string, string> = {
  BASIC: 'Plan Basic',
  PRO: 'Plan Pro',
  BUSINESS: 'Plan Business',
  LEGACY: 'Proyecto Legacy',
};

function resolvePlanLabel(plan: string, portfolioFlag: boolean): string {
  if (portfolioFlag) return 'Portfolio';
  return PLAN_LABELS[plan] ?? plan;
}

function resolveStatusLabel(status: string): string {
  switch (status) {
    case 'LIVE': return 'Publicado';
    case 'CLOSED': return 'Entregado';
    case 'SUSPENDED': return 'Suspendido';
    case 'STAGING_REVIEW': return 'Preview listo';
    case 'PRODUCTION_STARTED': return 'En construcción';
    case 'REVISIONS': return 'En revisiones';
    case 'REVISIONS_DONE': return 'Revisiones listas';
    case 'AWAITING_ASSETS': return 'Materiales pendientes';
    case 'ASSETS_INCOMPLETE': return 'Necesita correcciones';
    case 'ASSETS_SUBMITTED':
    case 'ASSETS_UNDER_REVIEW': return 'En revisión';
    default: return 'En activación';
  }
}

function resolveHostingLabel(
  hostingProvider: string | null | undefined,
  projectType: ProjectType,
): string {
  if (hostingProvider === 'external') return 'Hosting externo';
  if (hostingProvider === 'vercel') {
    if (projectType === 'SUBSCRIPTION') return 'Gestionado por Xavier';
    if (projectType === 'PORTFOLIO') return 'Configurado por Xavier';
  }
  return 'Según entrega del proyecto';
}

function resolveStatusColor(status: string): string {
  switch (status) {
    case 'LIVE':
    case 'CLOSED': return '#5DD69C';
    case 'SUSPENDED': return '#F87171';
    case 'STAGING_REVIEW':
    case 'REVISIONS':
    case 'REVISIONS_DONE': return '#6B9FFF';
    case 'PRODUCTION_STARTED':
    case 'ASSETS_SUBMITTED':
    case 'ASSETS_UNDER_REVIEW': return '#D4B8FF';
    case 'AWAITING_ASSETS':
    case 'ASSETS_INCOMPLETE': return '#FF8C00';
    default: return 'var(--text-3)';
  }
}

const card = {
  background: 'var(--surface)',
  borderRadius: 12,
  padding: 24,
  border: '1px solid rgba(255,255,255,0.08)',
  marginBottom: 16,
} as const;

const ctaBase = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '9px 16px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.14)',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--text-2)',
  fontFamily: 'var(--font-body)',
  textDecoration: 'none',
  background: 'var(--surface-2)',
} as const;

const ctaPrimary = {
  ...ctaBase,
  background: 'rgba(93,214,156,0.12)',
  color: '#5DD69C',
  border: '1px solid rgba(93,214,156,0.2)',
  fontWeight: 600,
} as const;

export default async function MiSitioPage({ searchParams }: Props) {
  const ctx = await requirePortalClient();
  const { p: requestedId } = await searchParams;

  const rawProjects = await db
    .select({
      id: projects.id,
      plan: projects.plan,
      portfolioFlag: projects.portfolioFlag,
      status: projects.status,
      productionUrl: projects.productionUrl,
      stagingUrl: projects.stagingUrl,
      domainTarget: projects.domainTarget,
      liveAt: projects.liveAt,
      createdAt: projects.createdAt,
      hostingProvider: projects.hostingProvider,
      hostingPanelUrl: projects.hostingPanelUrl,
    })
    .from(projects)
    .where(eq(projects.clientId, ctx.client.id))
    .orderBy(desc(projects.createdAt));

  if (!rawProjects.length) {
    return (
      <div style={{ maxWidth: 700 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--text)', margin: 0 }}>
            Mi sitio
          </h1>
          <p style={{ marginTop: 6, fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-body)' }}>
            Estado operativo de tu sitio web.
          </p>
        </div>
        <div style={{ ...card, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-body)', marginBottom: 16 }}>
            Tu sitio aparecerá aquí cuando Xavier active tu proyecto.
          </p>
          <a
            href="/soporte"
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.14)',
              fontSize: 13,
              color: 'var(--text-2)',
              fontFamily: 'var(--font-body)',
              textDecoration: 'none',
            }}
          >
            Ir a soporte
          </a>
        </div>
      </div>
    );
  }

  // Validate ownership of ?p; fall back to most recent
  let selected = rawProjects[0];
  if (requestedId) {
    const match = rawProjects.find((p) => p.id === requestedId);
    if (match) selected = match;
  }

  const plan = selected.plan as 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY';
  const projectType: ProjectType = deriveProjectType(plan, selected.portfolioFlag);
  const productionUrl = toExternalUrl(selected.productionUrl);
  const stagingUrl = toExternalUrl(selected.stagingUrl);
  const domainTarget = toExternalUrl(selected.domainTarget);
  const hostingPanelUrl = toExternalUrl(selected.hostingPanelUrl);
  const displayDomain = (productionUrl ?? domainTarget ?? stagingUrl)?.replace(/^https?:\/\//, '');

  const navItems = getPortalNavItems({ projectType, projectId: selected.id });
  const navIds = new Set(navItems.map((n) => n.id));

  const badgeColor = resolveStatusColor(selected.status);

  return (
    <div style={{ maxWidth: 700 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--text)', margin: 0 }}>
            Mi sitio
          </h1>
          <p style={{ marginTop: 6, fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-body)' }}>
            Estado operativo de tu{rawProjects.length > 1 ? 's sitios' : ' sitio'} web.
          </p>
        </div>
      </div>

      {/* Project selector — only shown when more than one project */}
      {rawProjects.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {rawProjects.map((p, i) => {
            const isSelected = p.id === selected.id;
            return (
              <a
                key={p.id}
                href={`/mi-sitio?p=${p.id}`}
                style={{
                  padding: '6px 14px',
                  borderRadius: 100,
                  border: `1px solid ${isSelected ? '#FF8C00' : 'rgba(128,128,128,0.2)'}`,
                  background: isSelected ? 'rgba(255,140,0,0.1)' : 'transparent',
                  color: isSelected ? '#FF8C00' : 'var(--text-2)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                {resolvePlanLabel(p.plan, p.portfolioFlag)} {i + 1}
              </a>
            );
          })}
        </div>
      )}

      {/* Site card */}
      <div style={card}>
        {/* Header: badges + URL */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 18,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '3px 10px',
                borderRadius: 100,
                background: `${badgeColor}22`,
                color: badgeColor,
                fontFamily: 'var(--font-body)',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {resolveStatusLabel(selected.status)}
            </span>
            <span
              style={{
                display: 'inline-block',
                padding: '3px 10px',
                borderRadius: 100,
                background: 'rgba(255,140,0,0.08)',
                color: '#FF8C00',
                fontFamily: 'var(--font-body)',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {resolvePlanLabel(plan, selected.portfolioFlag)}
            </span>
          </div>

          {productionUrl ? (
            <a
              href={productionUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(93,214,156,0.12)',
                color: '#5DD69C',
                padding: '8px 14px',
                borderRadius: 8,
                textDecoration: 'none',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: 12,
                flexShrink: 0,
              }}
            >
              {displayDomain}
            </a>
          ) : (
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-3)',
                background: 'var(--surface-2)',
                padding: '8px 14px',
                borderRadius: 8,
                fontFamily: 'var(--font-body)',
              }}
            >
              URL disponible al publicar
            </div>
          )}
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 0 18px' }} />

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {productionUrl && (
            <a href={productionUrl} target="_blank" rel="noopener noreferrer" style={ctaPrimary}>
              Ver sitio
            </a>
          )}
          <a href={`/proyecto/${selected.id}`} style={ctaBase}>
            Ver proyecto
          </a>
          {navIds.has('cambios') && (
            <Link href="/cambios-y-mejoras" style={ctaBase}>
              Cambios y mejoras
            </Link>
          )}
          {navIds.has('incidencias') && (
            <a href={`/proyecto/${selected.id}/incidencias`} style={ctaBase}>
              Incidencias
            </a>
          )}
          {navIds.has('facturacion') && (
            <a href="/facturacion" style={ctaBase}>
              Facturación
            </a>
          )}
          {navIds.has('mantenimiento') && (
            <a href="/mantenimiento" style={ctaBase}>
              Mantenimiento
            </a>
          )}
        </div>

        {/* Meta grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: 10,
          }}
        >
          <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, fontFamily: 'var(--font-body)' }}>
              Tipo
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
              {projectType === 'SUBSCRIPTION' ? 'Suscripción' : projectType === 'LEGACY' ? 'Legacy' : 'Portfolio'}
            </div>
          </div>

          {selected.liveAt && (
            <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, fontFamily: 'var(--font-body)' }}>
                Publicado
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                {new Date(selected.liveAt).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
          )}

          {displayDomain && (
            <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, fontFamily: 'var(--font-body)' }}>
                Dominio
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-display)', wordBreak: 'break-all' }}>
                {displayDomain}
              </div>
            </div>
          )}

          <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, fontFamily: 'var(--font-body)' }}>
              Hosting
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
              {hostingPanelUrl && selected.hostingProvider === 'external' ? (
                <a
                  href={hostingPanelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#6B9FFF', textDecoration: 'none' }}
                >
                  {resolveHostingLabel(selected.hostingProvider, projectType)}
                </a>
              ) : (
                resolveHostingLabel(selected.hostingProvider, projectType)
              )}
            </div>
          </div>
        </div>

        {/* Portfolio notice — no recurring billing copy */}
        {projectType === 'PORTFOLIO' && (
          <div
            style={{
              marginTop: 18,
              padding: '12px 16px',
              background: 'rgba(212,184,255,0.07)',
              borderRadius: 10,
              fontSize: 12,
              color: 'var(--text-2)',
              border: '1px solid rgba(212,184,255,0.15)',
              fontFamily: 'var(--font-body)',
            }}
          >
            Este proyecto es de tipo Portfolio. No tiene cargo mensual activo. Si necesitas cambios,
            contacta a{' '}
            <a href="/soporte" style={{ color: '#FF8C00', textDecoration: 'none' }}>
              soporte
            </a>
            .
          </div>
        )}

        {/* Legacy notice */}
        {projectType === 'LEGACY' && (
          <div
            style={{
              marginTop: 18,
              padding: '12px 16px',
              background: 'rgba(255,140,0,0.06)',
              borderRadius: 10,
              fontSize: 12,
              color: 'var(--text-2)',
              border: '1px solid rgba(255,140,0,0.12)',
              fontFamily: 'var(--font-body)',
            }}
          >
            Proyecto con pago único. Cambios adicionales o mantenimiento se gestionan por separado.
          </div>
        )}
      </div>
    </div>
  );
}
