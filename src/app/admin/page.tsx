import { db } from '@/db';
import { projects, clients, projectEvents, incidents, tickets } from '@/db/schema';
import { inArray, sql, lt, isNotNull, and, ne, eq } from 'drizzle-orm';
import Link from 'next/link';
import { headers } from 'next/headers';
import { ActivityFeed } from './_components/ActivityFeed';
import { getHostContext, adminHref } from '@/lib/routing/host-context';
import { CheckCircle2, Clock, Globe, TrendingUp as IconTrendingUp } from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(): string {
  return new Intl.DateTimeFormat('es-DO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Santo_Domingo',
  }).format(new Date());
}

function hoursUntil(date: Date): number {
  return Math.max(0, Math.floor((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60)));
}

function slaLevel(hours: number): 'critical' | 'warning' | 'ok' {
  if (hours < 12) return 'critical';
  if (hours < 36) return 'warning';
  return 'ok';
}

// ─── Status badge mapping ────────────────────────────────────────────────────

const STATUS_BADGE_CLASS: Record<string, string> = {
  DRAFT:                'badge-neutral',
  PROPOSAL_SENT:        'badge-blue',
  REQUIRES_REVIEW:      'badge-amber',
  PROPOSAL_EXPIRED:     'badge-red',
  PAYMENT_RECEIVED:     'badge-green',
  AWAITING_ASSETS:      'badge-amber',
  ASSETS_SUBMITTED:     'badge-amber',
  ASSETS_UNDER_REVIEW:  'badge-violet',
  ASSETS_INCOMPLETE:    'badge-red',
  PRODUCTION_STARTED:   'badge-violet',
  STAGING_REVIEW:       'badge-violet',
  REVISIONS:            'badge-amber',
  REVISIONS_DONE:       'badge-green',
  LIVE:                 'badge-green',
  CANCELLED:            'badge-red',
  CLOSED:               'badge-neutral',
  SUSPENDED:            'badge-red',
  OPEN:                 'badge-red',
  IN_PROGRESS:          'badge-blue',
  COMPLETED:            'badge-green',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT:                'Borrador',
  PROPOSAL_SENT:        'Propuesta enviada',
  REQUIRES_REVIEW:      'En revisión',
  PROPOSAL_EXPIRED:     'Propuesta expirada',
  PAYMENT_RECEIVED:     'Pago recibido',
  AWAITING_ASSETS:      'Esperando materiales',
  ASSETS_SUBMITTED:     'Materiales enviados',
  ASSETS_UNDER_REVIEW:  'En revisión',
  ASSETS_INCOMPLETE:    'Incompleto',
  PRODUCTION_STARTED:   'En producción',
  STAGING_REVIEW:       'Revisión staging',
  REVISIONS:            'Revisiones',
  REVISIONS_DONE:       'Revisiones listas',
  LIVE:                 'En vivo',
  CANCELLED:            'Cancelado',
  CLOSED:               'Cerrado',
  SUSPENDED:            'Suspendido',
};

type RangeKey = '3M' | '6M' | '1Y' | 'TODO';
const MRR_RANGE_MONTHS: Record<RangeKey, number> = {
  '3M': 3,
  '6M': 6,
  '1Y': 12,
  TODO: 12,
};

const MRR_RANGE_LABELS: Record<RangeKey, string> = {
  '3M': '3 meses',
  '6M': '6 meses',
  '1Y': '12 meses',
  TODO: 'historial completo',
};

function isRangeKey(value: unknown): value is RangeKey {
  return value === '3M' || value === '6M' || value === '1Y' || value === 'TODO';
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat('es-DO', {
    month: 'short',
    timeZone: 'America/Santo_Domingo',
  }).format(date).replace('.', '');
}

function money(value: number): string {
  return `$${value.toLocaleString('en-US')}`;
}

function compactMoney(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value}`;
}

function queryHref(base: string, params: Record<string, string>, patch: Record<string, string>) {
  const next = new URLSearchParams({ ...params, ...patch });
  return `${base}?${next.toString()}`;
}

function lineChartPath(data: number[], width: number, height: number, padY = 8) {
  const values = data.length > 0 ? data : [0];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const denominator = Math.max(values.length - 1, 1);
  const points = values.map((value, index) => [
    (index / denominator) * width,
    padY + (1 - (value - min) / range) * (height - padY * 2),
  ]);
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point[0].toFixed(1)} ${point[1].toFixed(1)}`).join(' ');
  const area = `${path} L ${points[points.length - 1][0].toFixed(1)} ${height} L ${points[0][0].toFixed(1)} ${height} Z`;
  return { points, path, area };
}

function InlineLineChart({
  data,
  color = '#FF8C00',
  height = 100,
  id,
}: {
  data: number[];
  color?: string;
  height?: number;
  id: string;
}) {
  const width = 500;
  const chart = lineChartPath(data, width, height);
  const last = chart.points[chart.points.length - 1] ?? [0, height];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height, display: 'block' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="85%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={chart.area} fill={`url(#${id})`} />
      <path d={chart.path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="4" fill={color} />
      <circle cx={last[0]} cy={last[1]} r="7" fill={color} opacity="0.2" />
    </svg>
  );
}

function SLAPill({
  label,
  tone = 'warning',
  pulse = false,
}: {
  label: string;
  tone?: 'critical' | 'warning' | 'neutral';
  pulse?: boolean;
}) {
  const styles = {
    critical: { background: 'rgba(239,68,68,0.18)', color: 'var(--red)' },
    warning: { background: 'rgba(255,140,0,0.14)', color: '#FF8C00' },
    neutral: { background: 'rgba(128,128,128,0.1)', color: 'var(--text-3)' },
  }[tone];

  return (
    <span
      className={pulse ? 'sla-pulse' : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 100,
        fontSize: 10,
        fontWeight: 700,
        fontFamily: "'Inter Tight', sans-serif",
        letterSpacing: '0.03em',
        ...styles,
      }}
    >
      {label}
    </span>
  );
}

// ─── Data fetching ──────────────────────────────────────────────────────────

async function getMRRData() {
  const [result] = await db
    .select({
      totalCents: sql<number>`cast(coalesce(sum(${projects.monthlyPriceCents}), 0) as int)`,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(projects)
    .where(eq(projects.status, 'LIVE' as const));

  return {
    mrr: Math.round((result?.totalCents ?? 0) / 100),
    liveCount: result?.count ?? 0,
  };
}

async function getMrrHistory() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    return {
      key: monthKey(date),
      label: monthLabel(date),
      value: 0,
    };
  });

  const rows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${projectEvents.createdAt}), 'YYYY-MM')`,
      totalCents: sql<number>`cast(coalesce(sum(${projects.monthlyPriceCents}), 0) as int)`,
    })
    .from(projectEvents)
    .innerJoin(projects, eq(projectEvents.projectId, projects.id))
    .where(
      and(
        eq(projectEvents.eventType, 'payment_received' as const),
        sql`${projectEvents.createdAt} >= ${start}`
      )
    )
    .groupBy(sql`date_trunc('month', ${projectEvents.createdAt})`)
    .orderBy(sql`date_trunc('month', ${projectEvents.createdAt}) ASC`);

  const totals = new Map(rows.map((row) => [row.month, Math.round((row.totalCents ?? 0) / 100)]));
  return months.map((month) => ({
    ...month,
    value: totals.get(month.key) ?? 0,
  }));
}

async function getUrgentItems() {
  const now = new Date();
  const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);

  const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const [slaProjects, staleDrafts, urgentIncidents] = await Promise.all([
    db
      .select({
        id: projects.id,
        status: projects.status,
        productionDeadlineAt: projects.productionDeadlineAt,
        stagingReviewDeadlineAt: projects.stagingReviewDeadlineAt,
        businessName: clients.businessName,
      })
      .from(projects)
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(
        and(
          inArray(projects.status, ['PRODUCTION_STARTED', 'STAGING_REVIEW', 'REVISIONS']),
          isNotNull(projects.productionDeadlineAt),
        ),
      ),
    db
      .select({
        id: projects.id,
        status: projects.status,
        createdAt: projects.createdAt,
        businessName: clients.businessName,
      })
      .from(projects)
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(
        and(
          inArray(projects.status, ['DRAFT', 'REQUIRES_REVIEW']),
          lt(projects.createdAt, seventyTwoHoursAgo),
        ),
      ),
    db
      .select({
        id: incidents.id,
        title: incidents.title,
        severity: incidents.severity,
        createdAt: incidents.createdAt,
      })
      .from(incidents)
      .where(
        and(
          ne(incidents.status, 'RESOLVED'),
          lt(incidents.createdAt, fourHoursAgo),
        ),
      )
      .catch(() => []),
  ]);

  type AlertItem = {
    id: string;
    label: string;
    sub: string;
    badge: string;
    badgeClass: string;
    href: string;
    hoursInfo: string;
    priority: number;
    severity: 'critical' | 'warning' | 'info';
    pulse: boolean;
  };

  const items: AlertItem[] = [];

  for (const p of slaProjects) {
    const deadline = p.productionDeadlineAt ?? p.stagingReviewDeadlineAt;
    if (!deadline) continue;
    const hours = hoursUntil(deadline);
    const level = slaLevel(hours);
    items.push({
      id: p.id,
      label: p.businessName,
      sub: `${STATUS_LABEL[p.status] ?? p.status} · vence en ${hours}h`,
      badge: 'SLA',
      badgeClass: level === 'critical' ? 'badge-red badge-pill' : 'badge-amber badge-pill',
      href: `/admin/proyectos/${p.id}`,
      hoursInfo: `${hours}h`,
      priority: level === 'critical' ? 1 : 3,
      severity: level === 'critical' ? 'critical' : 'warning',
      pulse: level === 'critical',
    });
  }

  for (const inc of urgentIncidents) {
    const hours = Math.floor((now.getTime() - new Date(inc.createdAt).getTime()) / (1000 * 60 * 60));
    const isP1 = inc.severity === 'P1';
    items.push({
      id: inc.id,
      label: `Incidencia sin respuesta`,
      sub: `"${inc.title}" · ${hours}h abierta`,
      badge: inc.severity,
      badgeClass: isP1 ? 'badge-red badge-pill' : 'badge-amber badge-pill',
      href: `/admin/incidencias`,
      hoursInfo: `${hours}h`,
      priority: isP1 ? 1 : 2,
      severity: isP1 ? 'critical' : 'warning',
      pulse: isP1,
    });
  }

  for (const p of staleDrafts) {
    const days = Math.floor((now.getTime() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    items.push({
      id: p.id,
      label: p.businessName,
      sub: `Propuesta sin enviar · ${days} días`,
      badge: 'DRAFT',
      badgeClass: 'badge-neutral badge-pill',
      href: `/admin/proyectos/${p.id}`,
      hoursInfo: `${days}d`,
      priority: 5,
      severity: 'info',
      pulse: false,
    });
  }

  items.sort((a, b) => a.priority - b.priority);
  return items;
}

async function getRecentActivity() {
  const rows = await db
    .select({
      id: projectEvents.id,
      eventType: projectEvents.eventType,
      actorType: projectEvents.actorType,
      fromStatus: projectEvents.fromStatus,
      toStatus: projectEvents.toStatus,
      createdAt: projectEvents.createdAt,
      projectId: projectEvents.projectId,
      businessName: clients.businessName,
    })
    .from(projectEvents)
    .innerJoin(projects, eq(projectEvents.projectId, projects.id))
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .orderBy(sql`${projectEvents.createdAt} DESC`)
    .limit(10);

  return rows;
}

async function getLiveProjectsByPlan() {
  const rows = await db
    .select({
      plan: projects.plan,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(projects)
    .where(eq(projects.status, 'LIVE' as const))
    .groupBy(projects.plan);
  const byPlan: Record<string, number> = {};
  for (const row of rows) byPlan[row.plan] = row.count;
  return byPlan;
}

async function getLiveSitesWithUrl() {
  return await db
    .select({
      id: projects.id,
      productionUrl: projects.productionUrl,
      businessName: clients.businessName,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(and(eq(projects.status, 'LIVE' as const), isNotNull(projects.productionUrl)))
    .limit(10);
}

async function getCurrentMonthRevenue() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [[subResult], [setupResult], [ticketResult], [legacyResult], [prevSub]] = await Promise.all([
    db
      .select({ total: sql<number>`cast(coalesce(sum(${projects.monthlyPriceCents}), 0) as int)` })
      .from(projectEvents)
      .innerJoin(projects, eq(projectEvents.projectId, projects.id))
      .where(and(
        eq(projectEvents.eventType, 'payment_received' as const),
        sql`${projectEvents.createdAt} >= ${monthStart}`,
      )),
    db
      .select({ total: sql<number>`cast(coalesce(sum(${projects.setupFeeCents}), 0) as int)` })
      .from(projects)
      .where(and(isNotNull(projects.paypalOrderId), sql`${projects.createdAt} >= ${monthStart}`)),
    db
      .select({ total: sql<number>`cast(coalesce(sum(${tickets.priceAmount}), 0) as int)` })
      .from(tickets)
      .where(and(
        eq(tickets.status, 'PAID' as const),
        isNotNull(tickets.paidAt),
        sql`${tickets.paidAt} >= ${monthStart}`,
      )),
    db
      .select({ total: sql<number>`cast(coalesce(sum(${projects.monthlyPriceCents}), 0) as int)` })
      .from(projects)
      .where(and(eq(projects.status, 'LIVE' as const), eq(projects.plan, 'LEGACY' as const))),
    db
      .select({ total: sql<number>`cast(coalesce(sum(${projects.monthlyPriceCents}), 0) as int)` })
      .from(projectEvents)
      .innerJoin(projects, eq(projectEvents.projectId, projects.id))
      .where(and(
        eq(projectEvents.eventType, 'payment_received' as const),
        sql`${projectEvents.createdAt} >= ${prevMonthStart}`,
        sql`${projectEvents.createdAt} < ${monthStart}`,
      )),
  ]);

  const subs = Math.round((subResult?.total ?? 0) / 100);
  const setup = Math.round((setupResult?.total ?? 0) / 100);
  const ticketFees = Math.round((ticketResult?.total ?? 0) / 100);
  const legacy = Math.round((legacyResult?.total ?? 0) / 100);
  const total = subs + setup + ticketFees + legacy;

  const prevTotal = Math.round((prevSub?.total ?? 0) / 100);
  const deltaVal = prevTotal > 0 ? (((total - prevTotal) / prevTotal) * 100) : 0;

  return { subs, setup, ticketFees, legacy, total, delta: deltaVal };
}

async function getActiveProjectsWithActor() {
  const ADMIN_STATUSES = new Set([
    'ASSETS_UNDER_REVIEW', 'PRODUCTION_STARTED', 'REVISIONS', 'ASSETS_INCOMPLETE',
  ]);

  const rows = await db
    .select({
      id: projects.id,
      status: projects.status,
      plan: projects.plan,
      productionDeadlineAt: projects.productionDeadlineAt,
      stagingReviewDeadlineAt: projects.stagingReviewDeadlineAt,
      updatedAt: projects.updatedAt,
      businessName: clients.businessName,
      clientFullName: clients.fullName,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(
      inArray(projects.status, [
        'ASSETS_SUBMITTED', 'ASSETS_UNDER_REVIEW', 'ASSETS_INCOMPLETE',
        'PRODUCTION_STARTED', 'STAGING_REVIEW', 'REVISIONS', 'REVISIONS_DONE',
        'AWAITING_ASSETS', 'PAYMENT_RECEIVED',
      ])
    )
    .orderBy(sql`${projects.updatedAt} DESC`)
    .limit(8);

  return rows.map((p) => ({ ...p, isAdminTurn: ADMIN_STATUSES.has(p.status) }));
}

async function getTicketsSummary() {
  return await db
    .select({
      id: tickets.id,
      title: tickets.title,
      addonType: tickets.addonType,
      priceAmount: tickets.priceAmount,
      businessName: clients.businessName,
    })
    .from(tickets)
    .innerJoin(projects, eq(tickets.projectId, projects.id))
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(eq(tickets.status, 'PENDING_APPROVAL' as const))
    .limit(5);
}

async function getIncidentsSummary() {
  return await db
    .select()
    .from(incidents)
    .where(ne(incidents.status, 'RESOLVED'))
    .limit(5)
    .catch(() => [] as typeof incidents.$inferSelect[]);
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const params = (await searchParams) ?? {};
  const selectedRange = isRangeKey(params.range) ? params.range : '6M';

  const hdrs = await headers();
  const hostCtx = getHostContext(hdrs.get('host') ?? '');
  const h = (path: string) => adminHref(path, hostCtx);

  const [
    { mrr, liveCount },
    urgentItems,
    activeProjectsWithActor,
    recentActivity,
    mrrHistory,
    liveProjectsByPlan,
    liveSitesWithUrl,
    monthlyRevenue,
    pendingTickets,
    openIncidents,
  ] = await Promise.all([
    getMRRData(),
    getUrgentItems(),
    getActiveProjectsWithActor(),
    getRecentActivity(),
    getMrrHistory(),
    getLiveProjectsByPlan(),
    getLiveSitesWithUrl(),
    getCurrentMonthRevenue(),
    getTicketsSummary(),
    getIncidentsSummary(),
  ]);

  const dateLabel = formatDate();
  const criticalCount = urgentItems.filter((i) => i.severity === 'critical').length;
  const rangeMonths = MRR_RANGE_MONTHS[selectedRange];
  const selectedMrrHistory = mrrHistory.slice(-rangeMonths);
  const mrrValues = selectedMrrHistory.map((p) => p.value);
  const mrrPeriodTotal = mrrValues.reduce((s, v) => s + v, 0);
  const lastMrr = mrrValues[mrrValues.length - 1] ?? mrr;
  const previousMrr = mrrValues[mrrValues.length - 2] ?? lastMrr;
  const mrrDelta = previousMrr > 0 ? ((lastMrr - previousMrr) / previousMrr) * 100 : 0;
  const queryParams = { range: selectedRange, activity: 'todos' };

  const rawMonthLabel = new Intl.DateTimeFormat('es-DO', {
    month: 'long', year: 'numeric', timeZone: 'America/Santo_Domingo',
  }).format(new Date());
  const currentMonthLabel = rawMonthLabel.charAt(0).toUpperCase() + rawMonthLabel.slice(1);
  const rawMonthShort = new Intl.DateTimeFormat('es-DO', {
    month: 'long', timeZone: 'America/Santo_Domingo',
  }).format(new Date());
  const currentMonthShort = rawMonthShort.charAt(0).toUpperCase() + rawMonthShort.slice(1);

  const Lbl = ({ children }: { children: import('react').ReactNode }) => (
    <p
      style={{
        fontFamily: "'Inter Tight', sans-serif",
        fontSize: 10,
        fontWeight: 600,
        color: 'var(--text-3)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
      }}
    >
      {children}
    </p>
  );

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <style>{`
        @keyframes slaPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.34); } 50% { box-shadow: 0 0 0 5px rgba(239,68,68,0); } }
        .sla-pulse { animation: slaPulse 1.5s ease-in-out infinite; }
        @keyframes pulseBorder { 0%, 100% { outline-color: rgba(239,68,68,0.5); } 50% { outline-color: rgba(239,68,68,0.15); } }
        .pulse-border { animation: pulseBorder 1.5s ease-in-out infinite; }
        .bento-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .hover-lift { transition: box-shadow 0.18s ease, transform 0.18s ease; }
        .hover-lift:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.38) !important; transform: translateY(-1px); }
        .hover-row { transition: background 0.12s ease; }
        .hover-row:hover { background: rgba(128,128,128,0.15) !important; }
        .bento-span-2 { grid-column: span 2; }
        @media (max-width: 959px) { .bento-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 599px) { .bento-grid { grid-template-columns: 1fr; } .bento-span-2 { grid-column: span 1 !important; } }
      `}</style>

      <div>
        <p style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 11, fontWeight: 500, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
          {dateLabel}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 800, fontSize: 26, color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1 }}>
            Bienvenido, Xavier
          </h1>
          <IconTrendingUp size={18} strokeWidth={2.5} style={{ color: 'var(--amber)' }} />
        </div>
      </div>

      <div className="bento-grid">
        <div className="hover-lift" style={{ background: 'linear-gradient(140deg, rgba(255,140,0,0.14) 0%, rgba(255,140,0,0.04) 100%)', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', gap: 9, minHeight: 132, transition: 'box-shadow 0.18s ease, transform 0.18s ease' }}
        >
          <Lbl>MRR {currentMonthLabel}</Lbl>
          <span style={{ fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 800, fontSize: 34, color: 'var(--amber)', letterSpacing: '-0.03em', lineHeight: 1 }}>
            {money(mrr)}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: mrrDelta >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {mrrDelta >= 0 ? '+' : ''}{mrrDelta.toFixed(1)}% vs mes anterior
          </span>
          <InlineLineChart data={mrrValues.slice(-6)} id="kpiMrrSpark" height={52} />
        </div>

        <div className="hover-lift" style={{ background: 'linear-gradient(140deg, rgba(93,214,156,0.12) 0%, rgba(93,214,156,0.03) 100%)', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', gap: 9, minHeight: 132, transition: 'box-shadow 0.18s ease, transform 0.18s ease' }}
        >
          <Lbl>Clientes Activos</Lbl>
          <span style={{ fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 800, fontSize: 34, color: 'var(--green)', letterSpacing: '-0.03em', lineHeight: 1 }}>
            {liveCount}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Proyectos en vivo</span>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 2 }}>
            {(['BASIC', 'PRO', 'BUSINESS', 'LEGACY'] as const).map((plan) => {
              const count = liveProjectsByPlan[plan] ?? 0;
              if (!count) return null;
              const PS: Record<string, { bg: string; color: string }> = {
                BASIC: { bg: 'var(--surface-2)', color: 'rgba(249,249,249,0.5)' },
                PRO: { bg: 'rgba(255,140,0,0.12)', color: '#FF8C00' },
                BUSINESS: { bg: 'rgba(255,140,0,0.18)', color: '#FFB347' },
                LEGACY: { bg: 'rgba(91,45,142,0.18)', color: '#D4B8FF' },
              };
              return (
                <span key={plan} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 100, background: PS[plan].bg, color: PS[plan].color }}>
                  {plan} x{count}
                </span>
              );
            })}
          </div>
        </div>

        <Link href={h('/admin/sitios')} className="hover-lift" style={{ background: 'linear-gradient(140deg, rgba(0,71,171,0.14) 0%, rgba(0,71,171,0.04) 100%)', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', gap: 9, minHeight: 132, textDecoration: 'none', transition: 'box-shadow 0.18s ease, transform 0.18s ease' }}
        >
          <Lbl>Sitios en Produccion</Lbl>
          <span style={{ fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 800, fontSize: 34, color: '#6B9FFF', letterSpacing: '-0.03em', lineHeight: 1 }}>
            {liveSitesWithUrl.length}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Con URL activa</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
            {liveSitesWithUrl.slice(0, 2).map((site) => (
              <div key={site.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                <span style={{ color: '#6B9FFF', background: 'rgba(0,71,171,0.12)', padding: '2px 7px', borderRadius: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>
                  {site.productionUrl?.replace('https://', '').replace('http://', '')}
                </span>
                <Globe size={11} style={{ color: '#6B9FFF', flexShrink: 0 }} />
              </div>
            ))}
            {liveSitesWithUrl.length > 2 && (
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>+{liveSitesWithUrl.length - 2} sitios mas -&gt;</span>
            )}
          </div>
        </Link>

        <div
          className={criticalCount > 0 ? 'pulse-border' : ''}
          style={{
            background: urgentItems.length > 0
              ? 'linear-gradient(140deg, rgba(239,68,68,0.14) 0%, rgba(239,68,68,0.04) 100%)'
              : 'linear-gradient(140deg, rgba(93,214,156,0.08) 0%, rgba(93,214,156,0.02) 100%)',
            borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.28)',
            display: 'flex', flexDirection: 'column', gap: 9, minHeight: 132,
            outline: criticalCount > 0 ? '2px solid rgba(239,68,68,0.5)' : 'none',
            outlineOffset: -1,
          }}
        >
          <Lbl>Alertas Urgentes</Lbl>
          {urgentItems.length === 0 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--green)', marginTop: 4 }}>
                <CheckCircle2 size={16} />
                <span style={{ fontFamily: "'Inter Tight', sans-serif", fontWeight: 600, fontSize: 13 }}>Todo en orden</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Sin incidencias activas</span>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {urgentItems.slice(0, 3).map((item) => (
                <Link key={item.id} href={h(item.href)} style={{
                  display: 'flex', gap: 7, padding: '7px 9px', textDecoration: 'none',
                  background: item.severity === 'critical' ? 'rgba(239,68,68,0.12)' : 'rgba(255,140,0,0.1)',
                  borderRadius: 8,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: item.severity === 'critical' ? 'var(--red)' : '#FF8C00', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.label}
                    </div>
                    {item.sub && <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>{item.sub}</div>}
                    <SLAPill label={item.hoursInfo} tone={item.severity === 'critical' ? 'critical' : 'warning'} pulse={item.pulse} />
                  </div>
                </Link>
              ))}
              {urgentItems.length > 3 && (
                <Link href={h('/admin/incidencias')} style={{ fontSize: 10, color: 'var(--red)', textDecoration: 'none' }}>
                  +{urgentItems.length - 3} mas -&gt; Ver todas
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bento-grid">
        <div className="bento-span-2" style={{ background: 'var(--surface)', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Lbl>Proyectos Activos</Lbl>
            <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(255,140,0,0.12)', color: 'var(--amber)', borderRadius: 100, padding: '2px 8px' }}>
              {activeProjectsWithActor.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {activeProjectsWithActor.slice(0, 4).map((p) => {
              const deadline = p.productionDeadlineAt ?? p.stagingReviewDeadlineAt;
              const hours = deadline ? hoursUntil(deadline) : null;
              const level = hours !== null ? slaLevel(hours) : null;
              const slaStyle = level === 'critical'
                ? { bg: 'rgba(239,68,68,0.2)', color: 'var(--red)' }
                : level === 'warning'
                  ? { bg: 'rgba(255,140,0,0.2)', color: '#FF8C00' }
                  : { bg: 'var(--surface-2)', color: 'var(--text-3)' };
              return (
                <Link key={p.id} href={h(`/admin/proyectos/${p.id}`)}
                  className="hover-row"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(128,128,128,0.06)', borderRadius: 9, textDecoration: 'none', transition: 'background 0.12s' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.businessName}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>{p.clientFullName}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
                    {hours !== null && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 100, background: slaStyle.bg, color: slaStyle.color, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={9} /> {hours}h
                      </span>
                    )}
                    <span className={`${STATUS_BADGE_CLASS[p.status] ?? 'badge-neutral'} badge-pill`}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 100, background: p.isAdminTurn ? 'rgba(255,140,0,0.12)' : 'var(--surface-2)', color: p.isAdminTurn ? '#FF8C00' : 'rgba(249,249,249,0.35)', fontFamily: "'Inter Tight', sans-serif" }}>
                      {p.isAdminTurn ? 'Xavier' : 'Cliente'}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
          {activeProjectsWithActor.length > 4 && (
            <Link href={h('/admin/proyectos')} style={{ fontSize: 11, color: 'var(--text-3)', paddingTop: 4, textDecoration: 'none' }}>
              Ver todos ({activeProjectsWithActor.length}) -&gt;
            </Link>
          )}
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(() => {
            const revenueRows = [
              { label: 'Suscripciones', amount: monthlyRevenue.subs, color: '#FF8C00' },
              { label: 'Setup fees', amount: monthlyRevenue.setup, color: '#6B9FFF' },
              { label: 'Tickets', amount: monthlyRevenue.ticketFees, color: 'var(--green)' },
              { label: 'LEGACY', amount: monthlyRevenue.legacy, color: '#D4B8FF' },
            ];
            const segments = revenueRows.filter((r) => r.amount > 0).map((r) => ({ ...r, pct: monthlyRevenue.total > 0 ? (r.amount / monthlyRevenue.total) * 100 : 0 }));
            return (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Lbl>Ingresos - {currentMonthShort}</Lbl>
                  <span style={{ fontSize: 10, color: monthlyRevenue.delta >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                    {monthlyRevenue.delta >= 0 ? '+' : ''}{monthlyRevenue.delta.toFixed(1)}%
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 800, fontSize: 30, color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                    {money(monthlyRevenue.total)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>este mes</span>
                </div>
                {segments.length > 0 && (
                  <div style={{ display: 'flex', height: 6, borderRadius: 100, overflow: 'hidden', gap: 1 }}>
                    {segments.map((s) => <div key={s.label} style={{ width: `${s.pct}%`, background: s.color, borderRadius: 100 }} />)}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {revenueRows.map((r, i) => (
                    <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0', borderBottom: i < revenueRows.length - 1 ? '1px solid rgba(128,128,128,0.1)' : 'none' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: r.amount > 0 ? r.color : 'rgba(255,255,255,0.12)', flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 12, color: r.amount === 0 ? 'var(--text-3)' : 'var(--text-2)' }}>{r.label}</span>
                      {r.amount === 0 ? (
                        <span style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>Sin ingresos</span>
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', fontFamily: "'Inter Tight', sans-serif", fontVariantNumeric: 'tabular-nums' }}>
                          {money(r.amount)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Tickets pendientes</span>
              <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(255,140,0,0.12)', color: 'var(--amber)', borderRadius: 100, padding: '1px 8px' }}>{pendingTickets.length}</span>
            </div>
            {pendingTickets.length === 0 ? (
              <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Sin tickets pendientes</p>
            ) : pendingTickets.slice(0, 2).map((t) => (
              <Link key={t.id} href={h('/admin/tickets')} className="hover-row" style={{ display: 'flex', gap: 8, padding: '7px 9px', background: 'rgba(128,128,128,0.06)', borderRadius: 8, marginBottom: 4, textDecoration: 'none' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.businessName}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--amber)', flexShrink: 0, fontFamily: "'Clash Grotesk', sans-serif" }}>
                  {money(Math.round(t.priceAmount / 100))}
                </span>
              </Link>
            ))}
          </div>
          <div style={{ height: 1, background: 'rgba(128,128,128,0.15)', margin: '2px 0' }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Incidencias abiertas</span>
              <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(239,68,68,0.12)', color: 'var(--red)', borderRadius: 100, padding: '1px 8px' }}>{openIncidents.length}</span>
            </div>
            {openIncidents.length === 0 ? (
              <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Sin incidencias activas</p>
            ) : openIncidents.slice(0, 3).map((inc) => {
              const sevColor = ({ P1: 'var(--red)', P2: '#FF8C00', P3: '#6B9FFF' } as Record<string, string>)[(inc).severity] ?? 'var(--text-3)';
              return (
                <Link key={inc.id} href={h('/admin/incidencias')}
                  className="hover-row"
                  style={{ display: 'flex', gap: 8, padding: '7px 9px', background: 'rgba(128,128,128,0.06)', borderRadius: 8, marginBottom: 4, textDecoration: 'none', alignItems: 'flex-start' }}
                >
                  <span style={{ fontSize: 9, fontWeight: 700, color: sevColor, background: `${sevColor}20`, padding: '2px 5px', borderRadius: 4, flexShrink: 0, marginTop: 1 }}>{(inc).severity}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(inc).title}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bento-grid">
        <div className="bento-span-2" style={{ background: 'linear-gradient(150deg, rgba(255,140,0,0.1) 0%, rgba(255,140,0,0.03) 60%, transparent 100%)', borderRadius: 14, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <Lbl>MRR Historico - {MRR_RANGE_LABELS[selectedRange]}</Lbl>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span style={{ fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 800, fontSize: 38, color: 'var(--amber)', letterSpacing: '-0.04em', lineHeight: 1 }}>
                  {money(mrrPeriodTotal)}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>recaudado</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>
                  Este mes: <strong style={{ color: 'var(--text)' }}>{money(mrr)}</strong>
                </span>
                {(() => {
                  const firstVal = mrrValues[0] ?? 0;
                  const growthDelta = firstVal > 0 ? (((lastMrr - firstVal) / firstVal) * 100).toFixed(1) : null;
                  return growthDelta !== null && Number(growthDelta) !== 0 ? (
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', background: 'rgba(93,214,156,0.12)', padding: '2px 8px', borderRadius: 100 }}>
                      +{growthDelta}% crecimiento
                    </span>
                  ) : null;
                })()}
                <span style={{ fontSize: 11, fontWeight: 700, color: mrrDelta >= 0 ? 'var(--green)' : 'var(--red)', background: mrrDelta >= 0 ? 'rgba(93,214,156,0.12)' : 'rgba(239,68,68,0.12)', padding: '2px 8px', borderRadius: 100 }}>
                  {mrrDelta >= 0 ? '+' : ''}{mrrDelta.toFixed(1)}% vs mes anterior
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', flexShrink: 0, gap: 2, background: 'rgba(128,128,128,0.1)', borderRadius: 8, padding: 3 }}>
              {(['3M', '6M', '1Y', 'TODO'] as const).map((range) => (
                <Link key={range} href={queryHref(h('/admin'), queryParams, { range })}
                  style={{ padding: '4px 10px', borderRadius: 6, fontFamily: "'Inter Tight', sans-serif", fontSize: 11, fontWeight: 700, background: selectedRange === range ? 'var(--amber)' : 'transparent', color: selectedRange === range ? '#121212' : 'var(--text-3)', textDecoration: 'none' }}
                >
                  {range}
                </Link>
              ))}
            </div>
          </div>
          <InlineLineChart data={mrrValues} id="mrrAreaGradAdmin" height={100} />
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${selectedMrrHistory.length || 1}, minmax(0, 1fr))`, gap: 0, borderTop: '1px solid rgba(128,128,128,0.12)', paddingTop: 8, marginTop: 8 }}>
            {selectedMrrHistory.map((point, index) => {
              const isLast = index === selectedMrrHistory.length - 1;
              const prevVal = selectedMrrHistory[index - 1]?.value ?? null;
              const barMax = Math.max(...mrrValues, 1);
              const barPct = (point.value / barMax) * 100;
              const delta = prevVal !== null && prevVal > 0 ? (((point.value - prevVal) / prevVal) * 100).toFixed(1) : null;
              const fs = selectedMrrHistory.length > 8 ? 8 : 9;
              const fsVal = selectedMrrHistory.length > 8 ? 9 : 11;
              return (
                <div key={point.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '0 1px' }}>
                  <div style={{ width: '100%', height: 30, display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ width: '100%', height: `${Math.max(barPct, 8)}%`, minHeight: 3, background: isLast ? '#FF8C00' : 'rgba(255,140,0,0.22)', borderRadius: '3px 3px 0 0', boxShadow: isLast ? '0 0 8px rgba(255,140,0,0.35)' : 'none' }} />
                  </div>
                  <span style={{ fontSize: fs, color: isLast ? 'var(--amber)' : 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: isLast ? 700 : 400 }}>{point.label}</span>
                  <span style={{ fontFamily: "'Clash Grotesk', sans-serif", fontSize: fsVal, fontWeight: isLast ? 800 : 600, color: isLast ? 'var(--amber)' : 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
                    {compactMoney(point.value)}
                  </span>
                  {delta !== null ? (
                    <span style={{ fontSize: 8, fontWeight: 700, color: Number(delta) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {Number(delta) >= 0 ? '+' : ''}{Math.abs(Number(delta))}%
                    </span>
                  ) : <span style={{ fontSize: 8, opacity: 0 }}>-</span>}
                </div>
              );
            })}
          </div>
        </div>

        <ActivityFeed recentActivity={recentActivity} />
      </div>
    </div>
  );
}
