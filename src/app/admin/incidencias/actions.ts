'use server';

import { auth } from '@clerk/nextjs/server';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { admins, clients, incidents, projects } from '@/db/schema';
import { inngest } from '@/inngest/client';

type IncidentSeverity = 'P1' | 'P2' | 'P3';

const ADMIN_CLERK_USER_ID = process.env.ADMIN_CLERK_USER_ID;

async function assertAdmin() {
  const { userId } = await auth();
  if (!userId || userId !== ADMIN_CLERK_USER_ID) {
    throw new Error('No autorizado.');
  }

  const [adminRecord] = await db
    .select({ id: admins.id })
    .from(admins)
    .where(eq(admins.clerkUserId, userId))
    .limit(1);

  if (!adminRecord) {
    throw new Error('No autorizado.');
  }
}

function serializeDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

export async function getAdminIncidentData() {
  await assertAdmin();

  const incidentRows = await db
    .select({
      id: incidents.id,
      projectId: incidents.projectId,
      title: incidents.title,
      description: incidents.description,
      affectedUrl: incidents.affectedUrl,
      evidenceUrl: incidents.evidenceUrl,
      status: incidents.status,
      severity: incidents.severity,
      reportedBy: incidents.reportedBy,
      resolvedAt: incidents.resolvedAt,
      resolvedNote: incidents.resolvedNote,
      notifyClientOnResolve: incidents.notifyClientOnResolve,
      createdAt: incidents.createdAt,
      updatedAt: incidents.updatedAt,
      businessName: clients.businessName,
      clientName: clients.fullName,
      clientEmail: clients.email,
      productionUrl: projects.productionUrl,
      stagingUrl: projects.stagingUrl,
    })
    .from(incidents)
    .innerJoin(projects, eq(incidents.projectId, projects.id))
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(inArray(incidents.status, ['OPEN', 'IN_PROGRESS', 'RESOLVED']))
    .orderBy(desc(incidents.createdAt))
    .limit(100);

  const projectRows = await db
    .select({
      id: projects.id,
      clientId: clients.id,
      businessName: clients.businessName,
      clientName: clients.fullName,
      productionUrl: projects.productionUrl,
      stagingUrl: projects.stagingUrl,
      domainTarget: projects.domainTarget,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(inArray(projects.status, ['PRODUCTION_STARTED', 'STAGING_REVIEW', 'REVISIONS', 'REVISIONS_DONE', 'LIVE', 'SUSPENDED']))
    .orderBy(clients.businessName);

  return {
    incidents: incidentRows.map((incident) => ({
      ...incident,
      resolvedAt: serializeDate(incident.resolvedAt),
      createdAt: incident.createdAt.toISOString(),
      updatedAt: incident.updatedAt.toISOString(),
    })),
    projects: projectRows,
  };
}

export async function takeIncident(incidentId: string) {
  await assertAdmin();

  const [updated] = await db
    .update(incidents)
    .set({ status: 'IN_PROGRESS', updatedAt: new Date() })
    .where(and(eq(incidents.id, incidentId), eq(incidents.status, 'OPEN')))
    .returning();

  if (!updated) {
    throw new Error('Incidencia no encontrada o ya tomada.');
  }

  return { incidentId: updated.id };
}

export async function resolveIncident(incidentId: string, resolvedNote: string, notifyClient: boolean) {
  await assertAdmin();

  const [updated] = await db
    .update(incidents)
    .set({
      status: 'RESOLVED',
      resolvedAt: new Date(),
      resolvedNote: resolvedNote.trim() || 'Resuelto por administrador.',
      notifyClientOnResolve: notifyClient,
      updatedAt: new Date(),
    })
    .where(eq(incidents.id, incidentId))
    .returning();

  if (!updated) {
    throw new Error('Incidencia no encontrada.');
  }

  await inngest.send({
    name: 'waas/incident.resolved',
    data: {
      projectId: updated.projectId,
      incidentId: updated.id,
      autoResolved: false,
    },
  });

  return { incidentId: updated.id };
}

export async function createIncident(input: {
  projectId: string;
  title: string;
  severity: IncidentSeverity;
  description?: string;
  affectedUrl?: string;
  evidenceUrl?: string;
}) {
  await assertAdmin();

  const title = input.title.trim();
  const description = input.description?.trim();
  const affectedUrl = input.affectedUrl?.trim();
  const evidenceUrl = input.evidenceUrl?.trim();

  if (title.length < 5 || title.length > 200) {
    throw new Error('El título debe tener entre 5 y 200 caracteres.');
  }

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .limit(1);

  if (!project) {
    throw new Error('Proyecto no encontrado.');
  }

  const [incident] = await db
    .insert(incidents)
    .values({
      projectId: input.projectId,
      title,
      description: description || null,
      affectedUrl: affectedUrl || null,
      evidenceUrl: evidenceUrl || null,
      severity: input.severity,
      status: 'OPEN',
      reportedBy: 'ADMIN',
    })
    .returning();

  await inngest.send({
    name: 'waas/incident.reported',
    data: {
      projectId: input.projectId,
      incidentId: incident.id,
      title,
    },
  });

  return { incidentId: incident.id };
}
