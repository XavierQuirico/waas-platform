import 'server-only';
import { requirePortalClient } from '@/lib/portal/context';
import { db } from '@/db';
import { projects } from '@/db/schema/projects';
import { eq, desc } from 'drizzle-orm';
import { clients } from '@/db/schema';
import { deriveProjectType } from '@/lib/portal/project-type';
import { getPortalNavItems } from '@/lib/portal/nav';
import { SoporteContact } from './SoporteContact';
import type { Metadata } from 'next';
import { whatsappUrl } from '@/lib/config/contact';

export const metadata: Metadata = {
  title: 'Soporte — Quirico Studios',
};

export default async function SoportePage() {
  const ctx = await requirePortalClient();

  // Read client for prefill context
  const [client] = await db
    .select({
      id: clients.id,
      fullName: clients.fullName,
      businessName: clients.businessName,
    })
    .from(clients)
    .where(eq(clients.id, ctx.client.id))
    .limit(1);

  // Read ALL projects ordered by createdAt desc for multi-project routing
  const allProjects = await db
    .select({
      id: projects.id,
      plan: projects.plan,
      portfolioFlag: projects.portfolioFlag,
      status: projects.status,
    })
    .from(projects)
    .where(eq(projects.clientId, ctx.client.id))
    .orderBy(desc(projects.createdAt));

  const primaryProject = allProjects[0] ?? null;

  const clientName = client?.fullName ?? ctx.client.fullName;
  const businessName = client?.businessName ?? '';

  const plan = primaryProject?.plan as 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY' | undefined;
  const projectType = plan ? deriveProjectType(plan, primaryProject?.portfolioFlag ?? false) : null;
  const projectId = primaryProject?.id ?? null;

  // Build nav ID sets per project — show route if at least one project supports it
  const navIdsByProject = new Map<string, Set<string>>();
  for (const proj of allProjects) {
    const pt = deriveProjectType(
      proj.plan as 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY',
      proj.portfolioFlag ?? false,
    );
    const navSet = new Set(getPortalNavItems({ projectType: pt, projectId: proj.id }).map((n) => n.id));
    navIdsByProject.set(proj.id, navSet);
  }

  const allNavIds = new Set<string>();
  for (const navSet of navIdsByProject.values()) {
    for (const id of navSet) allNavIds.add(id);
  }

  const incidenciasProject = allProjects.find((proj) => navIdsByProject.get(proj.id)?.has('incidencias'));

  const projectContext = allProjects.length > 1
    ? 'Tengo varios proyectos en el portal.'
    : (projectType ? `Plan: ${projectType === 'SUBSCRIPTION' ? (plan ?? '') : projectType}.` : null);

  const routeItems: Array<{ label: string; hint: string; href: string }> = [];

  if (projectId) {
    routeItems.push({ label: 'Ver materiales o avance del proyecto', hint: 'Ve a Proyecto', href: `/proyecto/${projectId}` });
  }
  if (allNavIds.has('incidencias') && incidenciasProject) {
    routeItems.push({ label: 'Algo no funciona en mi sitio', hint: 'Usa Incidencias', href: `/proyecto/${incidenciasProject.id}/incidencias` });
  }
  if (allNavIds.has('cambios')) {
    routeItems.push({ label: 'Quiero cambiar o agregar algo', hint: 'Usa Cambios y mejoras', href: '/cambios-y-mejoras' });
  }
  if (allNavIds.has('facturacion')) {
    routeItems.push({ label: 'Ver pagos o recibos', hint: 'Ve a Facturación', href: '/facturacion' });
  }
  if (allNavIds.has('mantenimiento')) {
    routeItems.push({ label: 'Mantenimiento de mi sitio', hint: 'Ve a Mantenimiento', href: '/mantenimiento' });
  }

  const card = {
    background: 'var(--surface)',
    borderRadius: 12,
    padding: 24,
    border: '1px solid rgba(255,255,255,0.08)',
    marginBottom: 16,
  } as const;

  return (
    <div style={{ maxWidth: 620 }}>
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 22,
            color: 'var(--text)',
            margin: 0,
          }}
        >
          Soporte
        </h1>
        <p
          style={{
            marginTop: 6,
            fontSize: 13,
            color: 'var(--text-3)',
            fontFamily: 'var(--font-body)',
          }}
        >
          {projectId
            ? 'Si necesitas ayuda o no sabes dónde hacer algo, puedes contactar a Xavier desde aquí.'
            : 'Mientras Xavier configura tu portal, puedes escribirle directamente.'}
        </p>
      </div>

      {/* Interactive contact card with topic selector */}
      <SoporteContact
        clientName={clientName}
        businessName={businessName}
        projectContext={projectContext}
      />

      {/* Smart routing guide */}
      {routeItems.length > 0 && (
        <div style={card}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text)',
              fontFamily: 'var(--font-display)',
              marginBottom: 4,
            }}
          >
            ¿Qué necesitas hacer?
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14, fontFamily: 'var(--font-body)' }}>
            Algunos temas tienen su propio espacio en el portal.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {routeItems.map((r) => (
              <a
                key={r.href}
                href={r.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '11px 14px',
                  borderRadius: 9,
                  background: 'var(--surface-2)',
                  textDecoration: 'none',
                  transition: 'background 0.15s',
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: 'rgba(255,140,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: 14,
                  }}
                >
                  →
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-body)' }}>
                    {r.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1, fontFamily: 'var(--font-body)' }}>
                    {r.hint}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* No project empty state */}
      {!projectId && (
        <div
          style={{
            ...card,
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-body)', marginBottom: 16 }}>
            Tu portal aún no tiene un proyecto activo. Xavier está preparando todo — mientras tanto,
            puedes escribirle directamente por WhatsApp o email.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href={whatsappUrl(`Hola, soy ${clientName}. Tengo una consulta sobre mi portal.`)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                background: '#25D366',
                color: '#fff',
                padding: '10px 18px',
                borderRadius: 9,
                textDecoration: 'none',
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              WhatsApp
            </a>
            <a
              href="mailto:hola@quiricostudios.com"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'var(--surface-2)',
                color: 'var(--text-2)',
                padding: '10px 16px',
                borderRadius: 9,
                textDecoration: 'none',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              hola@quiricostudios.com
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
