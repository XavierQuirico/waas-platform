// Cola de proyectos - Vista principal de proyectos (Xavier)
// Tabs por fase operacional: Pre-venta / Onboarding / Produccion / Activos / Cerrados / Todos

import { db } from '@/db';
import { clients, projects, quotes } from '@/db/schema';
import { and, asc, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { ProjectsQueue } from './components/ProjectsQueue';
import type { ProjectStatus } from '@/lib/projects/state-machine';

type ProjectPlan = (typeof projects.$inferSelect)['plan'];
import {
  ACTIVE_STATES,
  CLOSED_STATES,
  ONBOARDING_STATES,
  PRODUCTION_STATES,
} from '@/lib/projects/state-machine';

// Grupos de estados por fase - PAYMENT_RECEIVED va en Onboarding (igual que el diseno)
const TAB_STATUSES: Record<string, ProjectStatus[]> = {
  preventa: ['DRAFT', 'REQUIRES_REVIEW', 'PROPOSAL_SENT', 'PROPOSAL_EXPIRED'],
  onboarding: ['PAYMENT_RECEIVED', ...ONBOARDING_STATES],
  produccion: PRODUCTION_STATES,
  activos: ACTIVE_STATES,
  cerrados: CLOSED_STATES,
  todos: [
    'DRAFT',
    'REQUIRES_REVIEW',
    'PROPOSAL_SENT',
    'PROPOSAL_EXPIRED',
    'PAYMENT_RECEIVED',
    'AWAITING_ASSETS',
    'ASSETS_SUBMITTED',
    'ASSETS_UNDER_REVIEW',
    'ASSETS_INCOMPLETE',
    'PRODUCTION_STARTED',
    'STAGING_REVIEW',
    'REVISIONS',
    'REVISIONS_DONE',
    'LIVE',
    'SUSPENDED',
    'CANCELLED',
    'CLOSED',
  ],
};

const VALID_TABS = Object.keys(TAB_STATUSES);
const VALID_PLANS = ['BASIC', 'PRO', 'BUSINESS', 'LEGACY'];

interface PageProps {
  searchParams: Promise<{ tab?: string; plan?: string }>;
}

export default async function ProyectosAdminPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab = VALID_TABS.includes(params.tab ?? '') ? (params.tab as string) : 'todos';
  const planFilter = VALID_PLANS.includes(params.plan ?? '') ? params.plan : undefined;

  const statuses = TAB_STATUSES[tab];

  const conditions = [inArray(projects.status, statuses)];
  if (planFilter) {
    conditions.push(eq(projects.plan, planFilter as ProjectPlan));
  }

  const [rows, allClients, allQuotes] = await Promise.all([
    db
      .select({
        id: projects.id,
        status: projects.status,
        plan: projects.plan,
        monthlyPriceCents: projects.monthlyPriceCents,
        portfolioFlag: sql<boolean>`false`.as('portfolio_flag'),
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        proposalSentAt: projects.proposalSentAt,
        proposalExpiresAt: projects.proposalExpiresAt,
        productionDeadlineAt: projects.productionDeadlineAt,
        stagingReviewDeadlineAt: projects.stagingReviewDeadlineAt,
        stagingUrl: projects.stagingUrl,
        productionUrl: projects.productionUrl,
        clientId: projects.clientId,
        clientName: clients.fullName,
        clientEmail: clients.email,
        clientWhatsapp: clients.whatsapp,
        businessName: clients.businessName,
      })
      .from(projects)
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(projects.createdAt),

    db
      .select({
        id: clients.id,
        fullName: clients.fullName,
        businessName: clients.businessName,
        email: clients.email,
        whatsapp: clients.whatsapp,
        currentUrl: clients.currentUrl,
      })
      .from(clients)
      .orderBy(asc(clients.fullName)),

    db
      .select({
        id: quotes.id,
        clientName: quotes.clientName,
        businessName: quotes.businessName,
        industry: quotes.niche,
        projectType: quotes.projectType,
        plan: quotes.subscriptionPlan,
        totalAmountProviderCents: sql<number>`round(${quotes.totalAmountProvider} * 100)`.as('amount_cents'),
        domainTarget: quotes.domainTarget,
        internalNotes: quotes.internalNotes,
        status: quotes.status,
      })
      .from(quotes)
      .where(notInArray(quotes.status, ['rejected', 'expired']))
      .orderBy(asc(quotes.createdAt)),
  ]);

  return (
    <ProjectsQueue
      projects={rows}
      currentTab={tab}
      currentPlan={planFilter}
      clients={allClients}
      quotes={allQuotes}
    />
  );
}
