import 'server-only';

import { db } from '@/db';
import { projects } from '@/db/schema/projects';
import { projectEvents } from '@/db/schema/project-events';
import { tickets } from '@/db/schema/tickets';
import { maintenanceContracts } from '@/db/schema/maintenance-contracts';
import { eq, desc, and } from 'drizzle-orm';
import { deriveProjectType } from '@/lib/portal/project-type';
import { getPaymentEventAmountCents } from '@/lib/portal/billing-state';
import { deriveClientTicketStatus } from '@/lib/tickets/billing';
import type { ProjectType } from '@/lib/portal/project-type';
import type { ClientTicketStatus } from '@/lib/tickets/billing';

export interface BillingProject {
  id: string;
  plan: 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY';
  portfolioFlag: boolean;
  projectType: ProjectType;
  status: string;
  monthlyPriceCents: number;
  setupFeeCents: number;
  paypalSubscriptionId: string | null;
  paymentGracePeriodUntil: Date | null;
  suspendedAt: Date | null;
  reactivationFeeActive: boolean;
  liveAt: Date | null;
  createdAt: Date;
  productionUrl: string | null;
  stagingUrl: string | null;
  domainTarget: string | null;
}

export interface BillingTicketRow {
  id: string;
  ticketNumber: string;
  title: string;
  priceAmount: number;
  priceCurrency: string;
  clientStatus: ClientTicketStatus;
  paypalOrderId: string | null;
}

export interface BillingPaymentEvent {
  id: string;
  createdAt: Date;
  method: string | null;
  totalAmountCents: number | null;
  paymentType: string | null;
}

export interface BillingMaintenanceContract {
  id: string;
  tier: string;
  monthlyPriceCents: number;
  hostingIncluded: boolean;
  hostingPriceCents: number;
  billingMethod: string;
  status: string;
  nextBillingAt: Date | null;
  startedAt: Date;
}

export interface ClientBillingPageData {
  allProjects: BillingProject[];
  selectedProject: BillingProject;
  tickets: BillingTicketRow[];
  paymentEvents: BillingPaymentEvent[];
  maintenanceContracts: BillingMaintenanceContract[];
}

function toProject(
  p: {
    id: string;
    plan: string;
    portfolioFlag: boolean;
    status: string;
    monthlyPriceCents: number;
    setupFeeCents: number;
    paypalSubscriptionId: string | null;
    paymentGracePeriodUntil: Date | null;
    suspendedAt: Date | null;
    reactivationFeeActive: boolean;
    liveAt: Date | null;
    createdAt: Date;
    productionUrl: string | null;
    stagingUrl: string | null;
    domainTarget: string | null;
  },
): BillingProject {
  const plan = p.plan as 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY';
  return {
    ...p,
    plan,
    projectType: deriveProjectType(plan, p.portfolioFlag),
    paypalSubscriptionId: p.paypalSubscriptionId ?? null,
    paymentGracePeriodUntil: p.paymentGracePeriodUntil ?? null,
    suspendedAt: p.suspendedAt ?? null,
    liveAt: p.liveAt ?? null,
    productionUrl: p.productionUrl ?? null,
    stagingUrl: p.stagingUrl ?? null,
    domainTarget: p.domainTarget ?? null,
  };
}

export async function getClientBillingPageData(
  clientId: string,
  requestedProjectId?: string,
): Promise<ClientBillingPageData | null> {
  const rawProjects = await db
    .select({
      id: projects.id,
      plan: projects.plan,
      portfolioFlag: projects.portfolioFlag,
      status: projects.status,
      monthlyPriceCents: projects.monthlyPriceCents,
      setupFeeCents: projects.setupFeeCents,
      paypalSubscriptionId: projects.paypalSubscriptionId,
      paymentGracePeriodUntil: projects.paymentGracePeriodUntil,
      suspendedAt: projects.suspendedAt,
      reactivationFeeActive: projects.reactivationFeeActive,
      liveAt: projects.liveAt,
      createdAt: projects.createdAt,
      productionUrl: projects.productionUrl,
      stagingUrl: projects.stagingUrl,
      domainTarget: projects.domainTarget,
    })
    .from(projects)
    .where(eq(projects.clientId, clientId))
    .orderBy(desc(projects.createdAt));

  if (!rawProjects.length) return null;

  const allProjects = rawProjects.map(toProject);

  // Select project: validate ownership of requestedProjectId; else most recent (index 0)
  let selected = allProjects[0];
  if (requestedProjectId) {
    const match = allProjects.find((p) => p.id === requestedProjectId);
    if (match) selected = match;
    // If not found for this client, silently fall back to most recent — never trust arbitrary param
  }

  const rawTickets = await db
    .select({
      id: tickets.id,
      ticketNumber: tickets.ticketNumber,
      title: tickets.title,
      priceAmount: tickets.priceAmount,
      priceCurrency: tickets.priceCurrency,
      status: tickets.status,
      billingDecision: tickets.billingDecision,
      quoteStatus: tickets.quoteStatus,
      paypalOrderId: tickets.paypalOrderId,
    })
    .from(tickets)
    .where(eq(tickets.projectId, selected.id))
    .orderBy(desc(tickets.createdAt));

  const billingTickets: BillingTicketRow[] = rawTickets
    .map((t) => {
      const clientStatus = deriveClientTicketStatus(
        t.status as Parameters<typeof deriveClientTicketStatus>[0],
        (t.billingDecision ?? null) as Parameters<typeof deriveClientTicketStatus>[1],
        t.quoteStatus as Parameters<typeof deriveClientTicketStatus>[2],
      );
      return {
        id: t.id,
        ticketNumber: t.ticketNumber,
        title: t.title,
        priceAmount: t.priceAmount,
        priceCurrency: t.priceCurrency,
        clientStatus,
        paypalOrderId: t.paypalOrderId,
      };
    })
    .filter((t) => {
      if (t.clientStatus === 'draft') return false;
      if (t.clientStatus === 'included') return false;
      const hasPrice = t.priceAmount > 0;
      const isInFlow = (['payment_pending', 'paid', 'in_progress', 'delivered'] as ClientTicketStatus[]).includes(
        t.clientStatus,
      );
      const hasQuoteActivity = (['quote_requested', 'quote_needs_info', 'quote_priced', 'quote_declined'] as ClientTicketStatus[]).includes(
        t.clientStatus,
      );
      return hasPrice || isInFlow || hasQuoteActivity;
    });

  const rawEvents = await db
    .select({
      id: projectEvents.id,
      createdAt: projectEvents.createdAt,
      metadata: projectEvents.metadata,
    })
    .from(projectEvents)
    .where(
      and(
        eq(projectEvents.projectId, selected.id),
        eq(projectEvents.eventType, 'payment_received'),
      ),
    )
    .orderBy(desc(projectEvents.createdAt))
    .limit(20);

  const paymentEvents: BillingPaymentEvent[] = rawEvents.map((e) => {
    const meta = (e.metadata as Record<string, unknown> | null) ?? {};
    return {
      id: e.id,
      createdAt: e.createdAt,
      method: typeof meta.method === 'string' ? meta.method : null,
      totalAmountCents: getPaymentEventAmountCents(meta),
      paymentType: typeof meta.paymentType === 'string' ? meta.paymentType : null,
    };
  });

  let maintenanceContractList: BillingMaintenanceContract[] = [];
  if (selected.projectType === 'LEGACY') {
    const rawContracts = await db
      .select({
        id: maintenanceContracts.id,
        tier: maintenanceContracts.tier,
        monthlyPriceCents: maintenanceContracts.monthlyPriceCents,
        hostingIncluded: maintenanceContracts.hostingIncluded,
        hostingPriceCents: maintenanceContracts.hostingPriceCents,
        billingMethod: maintenanceContracts.billingMethod,
        status: maintenanceContracts.status,
        nextBillingAt: maintenanceContracts.nextBillingAt,
        startedAt: maintenanceContracts.startedAt,
      })
      .from(maintenanceContracts)
      .where(
        and(
          eq(maintenanceContracts.clientId, clientId),
          eq(maintenanceContracts.projectId, selected.id),
        ),
      )
      .orderBy(desc(maintenanceContracts.startedAt));

    maintenanceContractList = rawContracts.map((c) => ({
      id: c.id,
      tier: c.tier,
      monthlyPriceCents: c.monthlyPriceCents,
      hostingIncluded: c.hostingIncluded,
      hostingPriceCents: c.hostingPriceCents,
      billingMethod: c.billingMethod,
      status: c.status,
      nextBillingAt: c.nextBillingAt ?? null,
      startedAt: c.startedAt,
    }));
  }

  return {
    allProjects,
    selectedProject: selected,
    tickets: billingTickets,
    paymentEvents,
    maintenanceContracts: maintenanceContractList,
  };
}
