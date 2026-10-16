'use server';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { clients, projects } from '@/db/schema';
import { and, eq, inArray, desc } from 'drizzle-orm';
import { PENDING_PROJECT_STATUSES, ACTIVE_PROJECT_STATUSES } from './client-link-logic';
import { linkPendingClientForUser } from './link-pending-client';
import { deriveProjectType } from './project-type';
import type { ProjectType } from './project-type';
import { PortalProjectNotFoundError } from './errors';

export type PortalContext = {
  client: { id: string; fullName: string };
  isPreviewMode: boolean;
  userId: string;
};

import type { ProjectStatus } from '@/lib/projects/state-machine';

export type PortalProjectContext = PortalContext & {
  project: {
    id: string;
    plan: 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY';
    portfolioFlag: boolean;
    projectType: ProjectType;
    status: ProjectStatus;
    postLaunchWarrantyEndsAt: Date | null;
    paymentGracePeriodUntil: Date | null;
    suspendedAt: Date | null;
    reactivationFeeActive: boolean;
    clientId: string;
    stagingUrl: string | null;
    productionUrl: string | null;
    liveAt: Date | null;
  };
};

export type PortalShellData = PortalContext & {
  project: {
    id: string;
    plan: 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY';
    portfolioFlag: boolean;
    projectType: ProjectType;
    status: ProjectStatus;
    stagingUrl: string | null;
    productionUrl: string | null;
    liveAt: Date | null;
  } | null;
};

/**
 * Resolves the authenticated portal context.
 *
 * - Default: real Clerk session (both production and development).
 * - Preview mode: only active in development AND when PORTAL_DEV_PREVIEW_CLIENT_ID is set.
 *   The env var must point to a valid clients.id.
 *   Without the env var there is no bypass whatsoever.
 */
export async function getPortalContext(): Promise<PortalContext> {
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.PORTAL_DEV_PREVIEW_CLIENT_ID
  ) {
    const previewId = process.env.PORTAL_DEV_PREVIEW_CLIENT_ID;
    const [client] = await db
      .select({ id: clients.id, fullName: clients.fullName })
      .from(clients)
      .where(eq(clients.id, previewId))
      .limit(1);

    if (!client) {
      throw new Error(
        `PORTAL_DEV_PREVIEW_CLIENT_ID "${previewId}" no existe en la base de datos. ` +
          'Verifica que el ID sea válido.',
      );
    }

    return { client, isPreviewMode: true, userId: `preview:${client.id}` };
  }

  const { userId } = await auth();
  if (!userId) redirect('/acceder?redirect_url=%2Fdashboard');

  const [client] = await db
    .select({ id: clients.id, fullName: clients.fullName })
    .from(clients)
    .where(eq(clients.clerkUserId, userId))
    .limit(1);

  if (!client) redirect('/portal/activar');

  return { client, isPreviewMode: false, userId };
}

export async function requirePortalClient(): Promise<PortalContext> {
  return getPortalContext();
}

/**
 * Returns portal context + the client's primary project (most recent) for shell navigation.
 * Returns project: null if the client has no projects — shell renders safe limited nav.
 */
export async function getPortalShellData(): Promise<PortalShellData> {
  const ctx = await getPortalContext();

  const [project] = await db
    .select({
      id: projects.id,
      plan: projects.plan,
      portfolioFlag: projects.portfolioFlag,
      status: projects.status,
      stagingUrl: projects.stagingUrl,
      productionUrl: projects.productionUrl,
      liveAt: projects.liveAt,
    })
    .from(projects)
    .where(eq(projects.clientId, ctx.client.id))
    .orderBy(desc(projects.createdAt))
    .limit(1);

  if (!project) {
    return { ...ctx, project: null };
  }

  const plan = project.plan as 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY';
  const projectType = deriveProjectType(plan, project.portfolioFlag);

  return {
    ...ctx,
    project: {
      id: project.id,
      plan,
      portfolioFlag: project.portfolioFlag,
      projectType,
      status: project.status as ProjectStatus,
      stagingUrl: project.stagingUrl ?? null,
      productionUrl: project.productionUrl ?? null,
      liveAt: project.liveAt ?? null,
    },
  };
}

export type PortalContextOptional = {
  userId: string;
  client: { id: string; fullName: string } | null;
  hasPendingRequest: boolean;
  hasActiveProject: boolean;
  accountConflict: boolean;
  isPreviewMode: boolean;
};

/**
 * Resolves optional portal context for the /portal landing page.
 *
 * On first visit after Clerk sign-up:
 * - Looks up client by clerkUserId first.
 * - If not found, uses Clerk's verified primary email to find a pending_ client
 *   created during the anonymous wizard flow and links them to the real Clerk user.
 * - Returns accountConflict=true if the email is already linked to a different real user.
 *
 * Priority for /portal routing: conflict > hasActiveProject > hasPendingRequest > empty
 */
export async function getPortalContextOptional(): Promise<PortalContextOptional | null> {
  const { userId } = await auth();
  if (!userId) return null;

  // 1. Try by clerkUserId (the fast path — most requests hit this)
  let [client] = await db
    .select({ id: clients.id, fullName: clients.fullName })
    .from(clients)
    .where(eq(clients.clerkUserId, userId))
    .limit(1);

  // 2. If not found, attempt email-based linking (post-sign-up flow)
  if (!client) {
    // Solo un email verificado por Clerk puede probar que la cuenta es dueña del cliente.
    const link = await linkPendingClientForUser(userId);

    if (link.status === 'conflict') {
      return {
        userId,
        client: null,
        hasPendingRequest: false,
        hasActiveProject: false,
        accountConflict: true,
        isPreviewMode: false,
      };
    }

    if (link.status === 'linked') {
      client = link.client;
    }
  }

  if (!client) {
    return {
      userId,
      client: null,
      hasPendingRequest: false,
      hasActiveProject: false,
      accountConflict: false,
      isPreviewMode: false,
    };
  }

  // 3. Check project states — active takes priority over pending
  const [activeProject] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.clientId, client.id),
        inArray(projects.status, [...ACTIVE_PROJECT_STATUSES]),
      ),
    )
    .limit(1);

  const [pendingProject] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.clientId, client.id),
        inArray(projects.status, [...PENDING_PROJECT_STATUSES]),
      ),
    )
    .limit(1);

  return {
    userId,
    client,
    hasPendingRequest: !!pendingProject,
    hasActiveProject: !!activeProject,
    accountConflict: false,
    isPreviewMode: false,
  };
}

/**
 * Resolves portal context AND validates that projectId belongs to the authenticated client.
 * This check is enforced even in preview mode — preview cannot access arbitrary projects.
 */
export async function requireClientProject(
  projectId: string,
): Promise<PortalProjectContext> {
  const ctx = await getPortalContext();

  const [project] = await db
    .select({
      id: projects.id,
      plan: projects.plan,
      portfolioFlag: projects.portfolioFlag,
      status: projects.status,
      postLaunchWarrantyEndsAt: projects.postLaunchWarrantyEndsAt,
      paymentGracePeriodUntil: projects.paymentGracePeriodUntil,
      suspendedAt: projects.suspendedAt,
      reactivationFeeActive: projects.reactivationFeeActive,
      clientId: projects.clientId,
      stagingUrl: projects.stagingUrl,
      productionUrl: projects.productionUrl,
      liveAt: projects.liveAt,
    })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.clientId, ctx.client.id)))
    .limit(1);

  // Distinguishable from real DB/runtime errors: only THIS becomes a 404.
  if (!project) throw new PortalProjectNotFoundError();

  const plan = project.plan as 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY';
  const projectType = deriveProjectType(plan, project.portfolioFlag);

  return {
    ...ctx,
    project: {
      id: project.id,
      plan,
      portfolioFlag: project.portfolioFlag,
      projectType,
      status: project.status as ProjectStatus,
      postLaunchWarrantyEndsAt: project.postLaunchWarrantyEndsAt ?? null,
      paymentGracePeriodUntil: project.paymentGracePeriodUntil ?? null,
      suspendedAt: project.suspendedAt ?? null,
      reactivationFeeActive: project.reactivationFeeActive,
      clientId: project.clientId,
      stagingUrl: project.stagingUrl ?? null,
      productionUrl: project.productionUrl ?? null,
      liveAt: project.liveAt ?? null,
    },
  };
}
