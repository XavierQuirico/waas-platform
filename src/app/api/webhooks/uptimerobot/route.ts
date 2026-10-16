// Webhook endpoint para UptimeRobot (alertas de caída/subida)
// Recibe POST con monitorID, monitorURL, alertType, etc.
//
// Autenticación: secreto compartido en UPTIMEROBOT_WEBHOOK_SECRET.
// UptimeRobot no firma sus peticiones, así que el secreto se incluye en la URL
// del contacto de alerta (?secret=...) o en la cabecera x-webhook-secret.
// Sin secreto configurado el endpoint rechaza todo (falla cerrado).

import { db } from '@/db';
import { incidents, projects } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { inngest } from '@/inngest/client';
import { NextRequest } from 'next/server';
import { safeEqual } from '@/lib/security/safe-compare';

const MAX_FIELD_LENGTH = 2000;

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function clamp(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, MAX_FIELD_LENGTH) : '';
}

async function readPayload(req: NextRequest): Promise<Record<string, unknown>> {
  const contentType = req.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/json')) {
      const parsed: unknown = await req.json();
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    }
    const form = await req.formData();
    return Object.fromEntries(form.entries());
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.UPTIMEROBOT_WEBHOOK_SECRET;
  const providedSecret =
    req.headers.get('x-webhook-secret') ?? req.nextUrl.searchParams.get('secret');

  if (!expectedSecret || !safeEqual(providedSecret, expectedSecret)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const payload = await readPayload(req);

    // UptimeRobot puede enviar form-data o JSON
    const monitorURL = clamp(payload.monitorURL);
    const alertType = clamp(typeof payload.alertType === 'number' ? String(payload.alertType) : payload.alertType);
    const alertDetails = clamp(payload.alertDetails);
    const monitorFriendlyName = clamp(payload.monitorFriendlyName);

    if (!monitorURL) {
      return jsonResponse({ error: 'Missing monitorURL' }, 400);
    }

    // alertType: 1 = down, 2 = up
    const isDown = alertType === '1';
    const isUp = alertType === '2';

    // Buscar proyecto por productionUrl
    const [project] = await db
      .select({ id: projects.id, status: projects.status })
      .from(projects)
      .where(eq(projects.productionUrl, monitorURL))
      .limit(1);

    if (!project) {
      return jsonResponse({ error: 'Project not found for URL' }, 404);
    }

    if (isDown) {
      // Crear incidencia automática
      const [incident] = await db
        .insert(incidents)
        .values({
          projectId: project.id,
          title: `Sitio caído: ${monitorFriendlyName || monitorURL}`,
          description: alertDetails || `UptimeRobot detectó que el sitio ${monitorURL} no responde.`,
          status: 'OPEN',
          reportedBy: 'SYSTEM',
        })
        .returning({ id: incidents.id });

      await inngest.send({
        name: 'waas/site.down',
        data: { projectId: project.id, incidentId: incident.id, monitorURL },
      });

      return jsonResponse({ ok: true, action: 'incident_created', incidentId: incident.id }, 200);
    }

    if (isUp) {
      // Auto-resolver incidencias SYSTEM abiertas para este proyecto
      const openIncidents = await db
        .select({ id: incidents.id })
        .from(incidents)
        .where(
          and(
            eq(incidents.projectId, project.id),
            eq(incidents.reportedBy, 'SYSTEM'),
            eq(incidents.status, 'OPEN')
          )
        );

      for (const inc of openIncidents) {
        await db
          .update(incidents)
          .set({
            status: 'RESOLVED',
            resolvedAt: new Date(),
            resolvedNote: 'Auto-resuelto: UptimeRobot confirma que el sitio está de vuelta online.',
            updatedAt: new Date(),
          })
          .where(eq(incidents.id, inc.id));

        await inngest.send({
          name: 'waas/incident.resolved',
          data: { projectId: project.id, incidentId: inc.id, autoResolved: true },
        });
      }

      return jsonResponse({ ok: true, action: 'incidents_resolved', count: openIncidents.length }, 200);
    }

    return jsonResponse({ ok: true, action: 'ignored' }, 200);
  } catch (error) {
    console.error('UptimeRobot webhook error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}
