'use server';

import { db } from '@/db';
import { incidents } from '@/db/schema';
import { requireClientProject } from '@/lib/portal/context';
import { inngest } from '@/inngest/client';
import { desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Project statuses where incident reporting is allowed
const INCIDENT_ALLOWED_STATUSES = new Set([
  'PRODUCTION_STARTED',
  'STAGING_REVIEW',
  'REVISIONS',
  'REVISIONS_DONE',
  'LIVE',
  'SUSPENDED',
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(v: string) {
  return UUID_RE.test(v);
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isSafeRelativePath(value: string) {
  return (
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.startsWith('/\\') &&
    value.length <= 500
  );
}

function isValidAffectedUrl(value: string) {
  if (value.length > 500) return false;
  if (isSafeRelativePath(value)) return true;
  return isHttpUrl(value);
}

function isValidEvidenceUrl(value: string) {
  if (value.length > 500) return false;
  return isHttpUrl(value);
}

const reportInputSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(5).max(200),
  severity: z.enum(['P1', 'P2', 'P3']),
  description: z.string().max(2000).optional(),
  affectedUrl: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() || undefined : v ?? undefined),
    z.string().max(500).optional(),
  ),
  evidenceUrl: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() || undefined : v ?? undefined),
    z.string().max(500).optional(),
  ),
});

export type ReportIncidentInput = z.infer<typeof reportInputSchema>;

export type ClientIncident = {
  id: string;
  title: string;
  description: string | null;
  affectedUrl: string | null;
  evidenceUrl: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  severity: 'P1' | 'P2' | 'P3';
  reportedBy: 'CLIENT' | 'ADMIN' | 'SYSTEM';
  resolvedAt: string | null;
  resolvedNote: string | null;
  createdAt: string;
};

export type IncidentPageData = {
  siteStatus: 'operational' | 'degraded';
  productionUrl: string | null;
  projectStatus: string;
  canReport: boolean;
  blockedReason: string | null;
  incidents: ClientIncident[];
};

export async function getClientIncidentPageData(projectId: string): Promise<IncidentPageData> {
  if (!isValidUUID(projectId)) throw new Error('projectId inválido.');

  const ctx = await requireClientProject(projectId);
  const project = ctx.project;

  const canReport = INCIDENT_ALLOWED_STATUSES.has(project.status);
  const blockedReason = canReport
    ? null
    : 'Las incidencias están disponibles cuando tu sitio tiene algo en revisión o en producción.';

  const rows = await db
    .select({
      id: incidents.id,
      title: incidents.title,
      description: incidents.description,
      affectedUrl: incidents.affectedUrl,
      evidenceUrl: incidents.evidenceUrl,
      status: incidents.status,
      severity: incidents.severity,
      reportedBy: incidents.reportedBy,
      resolvedAt: incidents.resolvedAt,
      resolvedNote: incidents.resolvedNote,
      createdAt: incidents.createdAt,
    })
    .from(incidents)
    .where(eq(incidents.projectId, projectId))
    .orderBy(desc(incidents.createdAt))
    .limit(50);

  const hasActive = rows.some((r) => r.status === 'OPEN' || r.status === 'IN_PROGRESS');

  return {
    siteStatus: hasActive ? 'degraded' : 'operational',
    productionUrl: project.productionUrl ?? null,
    projectStatus: project.status,
    canReport,
    blockedReason,
    incidents: rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description ?? null,
      affectedUrl: r.affectedUrl ?? null,
      evidenceUrl: r.evidenceUrl ?? null,
      status: r.status as ClientIncident['status'],
      severity: (r.severity ?? 'P3') as ClientIncident['severity'],
      reportedBy: r.reportedBy as ClientIncident['reportedBy'],
      resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
      resolvedNote: r.resolvedNote ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function reportClientIncident(
  input: ReportIncidentInput,
): Promise<{ ok: boolean; incidentId: string }> {
  const parsed = reportInputSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? 'Datos inválidos.';
    throw new Error(msg);
  }

  const { projectId, title, severity, description, affectedUrl, evidenceUrl } = parsed.data;

  const ctx = await requireClientProject(projectId);
  if (ctx.isPreviewMode) throw new Error('No puedes reportar incidencias en modo preview.');

  if (!INCIDENT_ALLOWED_STATUSES.has(ctx.project.status)) {
    throw new Error('Las incidencias no están disponibles para este proyecto en este momento.');
  }

  // Validate URLs if provided
  if (affectedUrl && !isValidAffectedUrl(affectedUrl)) {
    throw new Error('La URL afectada no es válida.');
  }
  if (evidenceUrl && !isValidEvidenceUrl(evidenceUrl)) {
    throw new Error('La URL de evidencia no es válida.');
  }

  const cleanDesc = description?.trim() || null;
  const cleanAffectedUrl = affectedUrl ?? null;
  const cleanEvidenceUrl = evidenceUrl ?? null;

  const [incident] = await db
    .insert(incidents)
    .values({
      projectId,
      title,
      description: cleanDesc,
      affectedUrl: cleanAffectedUrl,
      evidenceUrl: cleanEvidenceUrl,
      severity,
      status: 'OPEN',
      reportedBy: 'CLIENT',
    })
    .returning({ id: incidents.id });

  await inngest.send({
    name: 'waas/incident.reported',
    data: {
      projectId,
      incidentId: incident.id,
      title,
      severity,
    },
  });

  revalidatePath(`/proyecto/${projectId}/incidencias`);

  return { ok: true, incidentId: incident.id };
}

