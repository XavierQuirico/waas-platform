import { db } from '@/db';
import Link from 'next/link';
import { clients } from '@/db/schema/clients';
import { projects } from '@/db/schema/projects';
import { projectEvents } from '@/db/schema/project-events';
import { quotes } from '@/db/schema/quotes';
import { tickets } from '@/db/schema/tickets';

type PeriodKey = '30d' | '3m' | '6m' | '12m' | 'custom';

type PageProps = {
  searchParams?: Promise<{ period?: string }> | { period?: string };
};

type ChartPoint = {
  label: string;
  value: number;
  projected?: boolean;
};

const ACTIVE_STATUSES = [
  'LIVE',
  'STAGING_REVIEW',
  'REVISIONS',
  'REVISIONS_DONE',
  'PRODUCTION_STARTED',
  'AWAITING_ASSETS',
  'ASSETS_SUBMITTED',
  'ASSETS_UNDER_REVIEW',
  'PAYMENT_RECEIVED',
];

const PERIODS: { id: PeriodKey; label: string }[] = [
  { id: '30d', label: 'Ultimos 30 dias' },
  { id: '3m', label: '3 meses' },
  { id: '6m', label: '6 meses' },
  { id: '12m', label: '12 meses' },
  { id: 'custom', label: 'Personalizado' },
];

function money(amount: number) {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}

function cents(amount: number) {
  return amount / 100;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('es-DO', { month: 'short' }).replace('.', '');
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function Delta({ value, suffix = '%' }: { value: number; suffix?: string }) {
  const positive = value > 0;
  const negative = value < 0;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: 'Inter Tight',
        fontSize: 11,
        fontWeight: 700,
        color: positive ? 'var(--green)' : negative ? 'var(--red)' : 'var(--text-3)',
      }}
    >
      <span>{positive ? '↑' : negative ? '↓' : '–'}</span>
      {Math.abs(value).toFixed(value % 1 === 0 ? 0 : 1)}
      {suffix}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'Inter Tight',
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--text-3)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </div>
  );
}

function BigNum({ children, color = 'var(--text)' }: { children: React.ReactNode; color?: string }) {
  return (
    <div
      style={{
        fontFamily: 'Clash Grotesk',
        fontWeight: 800,
        fontSize: 32,
        color,
        lineHeight: 1,
      }}
    >
      {children}
    </div>
  );
}

function BentoCard({
  children,
  cols = 1,
  style,
}: {
  children: React.ReactNode;
  cols?: number;
  style?: React.CSSProperties;
}) {
  return (
    <section
      style={{
        gridColumn: `span ${cols}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.16)',
        ...style,
      }}
    >
      {children}
    </section>
  );
}

function LineChart({ data, color = '#FF8C00', height = 96 }: { data: ChartPoint[]; color?: string; height?: number }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const range = Math.max(max - min, 1);
  const points = data.map((d, i) => {
    const x = data.length === 1 ? 0 : (i / (data.length - 1)) * 100;
    const y = 92 - ((d.value - min) / range) * 76;
    return { ...d, x, y };
  });
  const realPath = points.filter((p) => !p.projected).map((p) => `${p.x},${p.y}`).join(' ');
  const projectedPath = points.filter((p, i) => p.projected || points[i + 1]?.projected).map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height, overflow: 'visible' }}>
      {[18, 50, 82].map((y) => (
        <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="0.6" />
      ))}
      <polyline points={realPath} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={projectedPath} fill="none" stroke="#6B9FFF" strokeWidth="1.8" strokeDasharray="4 4" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p) => (
        <circle key={`${p.label}-${p.x}`} cx={p.x} cy={p.y} r={p.projected ? 1.5 : 2.2} fill={p.projected ? '#6B9FFF' : color} />
      ))}
    </svg>
  );
}

function BarChart({ data, color = '#6B9FFF', height = 66 }: { data: ChartPoint[]; color?: string; height?: number }) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div style={{ display: 'flex', alignItems: 'end', gap: 8, height }}>
      {data.map((item) => (
        <div key={item.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
          <div
            title={`${item.label}: ${item.value}`}
            style={{
              width: '100%',
              minHeight: 4,
              height: `${Math.max((item.value / max) * (height - 22), 4)}px`,
              background: item.projected ? 'rgba(107,159,255,0.42)' : color,
              borderRadius: '5px 5px 2px 2px',
            }}
          />
          <span style={{ fontFamily: 'Inter Tight', fontSize: 9, color: 'var(--text-3)', textTransform: 'capitalize' }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function metadataNumber(metadata: unknown, keys: string[]) {
  if (!metadata || typeof metadata !== 'object') return 0;
  const source = metadata as Record<string, unknown>;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '') return Number(value) || 0;
  }
  return 0;
}

export default async function InsightsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const activePeriod = PERIODS.some((p) => p.id === params?.period) ? (params?.period as PeriodKey) : '30d';

  const [allClients, allProjects, allQuotes, allTickets, paymentEvents] = await Promise.all([
    db.select().from(clients),
    db
      .select({
        id: projects.id,
        clientId: projects.clientId,
        plan: projects.plan,
        monthlyPriceCents: projects.monthlyPriceCents,
        status: projects.status,
        productionStartedAt: projects.productionStartedAt,
        productionDeadlineAt: projects.productionDeadlineAt,
        stagingDeployedAt: projects.stagingDeployedAt,
        liveAt: projects.liveAt,
        createdAt: projects.createdAt,
      })
      .from(projects),
    db.select().from(quotes),
    db.select().from(tickets),
    db.select().from(projectEvents),
  ]);

  const liveProjects = allProjects.filter((project) => ACTIVE_STATUSES.includes(project.status));
  const mrr = liveProjects.reduce((sum, project) => sum + cents(project.monthlyPriceCents), 0);
  const activeClientIds = new Set(liveProjects.map((project) => project.clientId));
  const acceptedQuotes = allQuotes.filter((quote) => quote.status === 'accepted');
  const sentQuotes = allQuotes.filter((quote) => quote.status === 'sent');
  const paidTickets = allTickets.filter((ticket) => ticket.status === 'PAID' || ticket.paidAt);
  const conversionRate = acceptedQuotes.length + sentQuotes.length > 0
    ? Math.round((acceptedQuotes.length / (acceptedQuotes.length + sentQuotes.length)) * 100)
    : 0;

  const realPayments = paymentEvents.filter((event) => event.eventType === 'payment_received');
  const now = new Date();
  const historicalMonths = Array.from({ length: 6 }, (_, index) => addMonths(now, index - 5));
  const paymentByMonth = historicalMonths.map((date) => {
    const key = monthKey(date);
    const eventTotal = realPayments
      .filter((event) => monthKey(new Date(event.createdAt)) === key)
      .reduce((sum, event) => sum + metadataNumber(event.metadata, ['netAmount', 'amount', 'grossAmount']), 0);
    const acceptedTotal = acceptedQuotes
      .filter((quote) => monthKey(new Date(quote.createdAt)) === key)
      .reduce((sum, quote) => sum + quote.totalAmountProvider, 0);
    const ticketTotal = paidTickets
      .filter((ticket) => ticket.paidAt && monthKey(new Date(ticket.paidAt)) === key)
      .reduce((sum, ticket) => sum + cents(ticket.priceAmount), 0);

    return { label: monthLabel(date), value: Math.round(eventTotal + acceptedTotal + ticketTotal) };
  });
  paymentByMonth[paymentByMonth.length - 1].value = Math.max(paymentByMonth[paymentByMonth.length - 1].value, Math.round(mrr));

  const mrrByMonth = historicalMonths.map((date) => {
    const monthEnd = addMonths(date, 1);
    const value = liveProjects
      .filter((project) => new Date(project.createdAt).getTime() < monthEnd.getTime())
      .reduce((sum, project) => sum + cents(project.monthlyPriceCents), 0);
    return { label: monthLabel(date), value: Math.round(value) };
  });
  mrrByMonth[mrrByMonth.length - 1].value = Math.round(mrr);
  const previousMrr = mrrByMonth[mrrByMonth.length - 2]?.value ?? 0;
  const mrrDelta = previousMrr > 0 ? ((mrr - previousMrr) / previousMrr) * 100 : mrr > 0 ? 100 : 0;
  const projectionRate = clamp(mrrDelta / 100, 0, 0.15);
  const mrrProjection: ChartPoint[] = [
    ...mrrByMonth,
    { label: monthLabel(addMonths(now, 1)), value: Math.round(mrr * (1 + projectionRate)), projected: true },
    { label: monthLabel(addMonths(now, 2)), value: Math.round(mrr * (1 + projectionRate * 2)), projected: true },
    { label: monthLabel(addMonths(now, 3)), value: Math.round(mrr * (1 + projectionRate * 3)), projected: true },
  ];
  const dividerLeft = `${((mrrByMonth.length - 1) / (mrrProjection.length - 1)) * 100}%`;

  const planCounts = { BASIC: 0, PRO: 0, BUSINESS: 0, LEGACY: 0 } as Record<string, number>;
  for (const project of liveProjects) planCounts[project.plan] = (planCounts[project.plan] ?? 0) + 1;
  const totalPlans = Math.max(Object.values(planCounts).reduce((sum, value) => sum + value, 0), 1);

  const nicheCounts = allClients.reduce<Record<string, number>>((acc, client) => {
    acc[client.industry] = (acc[client.industry] ?? 0) + 1;
    return acc;
  }, {});
  const topNiches = Object.entries(nicheCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const projectsWithSla = liveProjects.filter((project) => project.productionStartedAt && project.productionDeadlineAt);
  const slaOk = projectsWithSla.filter((project) => {
    const done = project.stagingDeployedAt ?? project.liveAt ?? now;
    return new Date(done).getTime() <= new Date(project.productionDeadlineAt!).getTime();
  }).length;
  const slaPct = projectsWithSla.length ? Math.round((slaOk / projectsWithSla.length) * 100) : 100;
  const stalledStatus = Object.entries(
    liveProjects.reduce<Record<string, number>>((acc, project) => {
      acc[project.status] = (acc[project.status] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'LIVE';

  const setupRevenue = acceptedQuotes.reduce((sum, quote) => sum + quote.totalAmountProvider, 0);
  const ticketRevenue = paidTickets.reduce((sum, ticket) => sum + cents(ticket.priceAmount), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '28px 32px 0', flexShrink: 0 }}>
        <h1 style={{ fontFamily: 'Clash Grotesk', fontWeight: 800, fontSize: 24, color: 'var(--text)', marginBottom: 18 }}>
          Insights & Analytics
        </h1>
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {PERIODS.map((period) => {
            const selected = period.id === activePeriod;
            return (
              <Link
                key={period.id}
                href={`/admin/insights?period=${period.id}`}
                prefetch={false}
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: `1px solid ${selected ? 'var(--amber)' : 'var(--border)'}`,
                  background: selected ? 'rgba(255,140,0,0.1)' : 'var(--surface)',
                  color: selected ? 'var(--amber)' : 'var(--text-3)',
                  fontFamily: 'Inter Tight',
                  fontWeight: 700,
                  fontSize: 12,
                  textDecoration: 'none',
                }}
              >
                {period.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 32px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
          <BentoCard cols={3} style={{ background: 'linear-gradient(135deg, rgba(255,140,0,0.1), rgba(255,140,0,0.02) 58%, var(--surface))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <Label>MRR Historico + Proyeccion 3 meses</Label>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <BigNum color="var(--amber)">{money(mrr)}</BigNum>
                  <Delta value={mrrDelta} />
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'Inter Tight', fontSize: 10, color: 'var(--text-3)' }}>Churn rate</div>
                <div style={{ fontFamily: 'Clash Grotesk', fontWeight: 800, fontSize: 22, color: 'var(--green)' }}>0%</div>
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <LineChart data={mrrProjection} />
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: dividerLeft, borderLeft: '1px solid rgba(249,249,249,0.16)' }}>
                <span style={{ position: 'absolute', top: 4, left: 6, fontFamily: 'Inter Tight', fontSize: 9, color: '#6B9FFF', whiteSpace: 'nowrap' }}>
                  Proyeccion →
                </span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${mrrProjection.length}, 1fr)`, gap: 8 }}>
              {mrrProjection.map((point) => (
                <div key={point.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Inter Tight', fontSize: 9, color: point.projected ? '#6B9FFF' : 'var(--text-3)', textTransform: 'capitalize' }}>{point.label}</div>
                  <div style={{ fontFamily: 'Clash Grotesk', fontSize: 12, fontWeight: 800, color: point.projected ? '#6B9FFF' : 'var(--text)' }}>{money(point.value)}</div>
                </div>
              ))}
            </div>
          </BentoCard>

          <BentoCard style={{ background: 'rgba(93,214,156,0.05)', borderColor: 'rgba(93,214,156,0.18)' }}>
            <Label>Break-even</Label>
            <div style={{ fontFamily: 'Clash Grotesk', fontWeight: 800, fontSize: 18, color: 'var(--green)', lineHeight: 1.2 }}>
              {mrr >= 120 ? 'Sobre break-even ✓' : 'Bajo break-even'}
            </div>
            <div style={{ fontFamily: 'Inter Tight', fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
              Gastos fijos: ~{money(120)}/mes<br />
              Cojin: {money(mrr - 120)}/mes
            </div>
          </BentoCard>

          <BentoCard>
            <Label>MRR Neto</Label>
            <BigNum color="var(--amber)">{money(mrr)}</BigNum>
            <Delta value={mrrDelta} />
          </BentoCard>

          <BentoCard>
            <Label>Ingresos Totales</Label>
            <BigNum>{money(mrr + setupRevenue + ticketRevenue)}</BigNum>
            <Delta value={12.4} />
            <div style={{ fontFamily: 'Inter Tight', fontSize: 11, color: 'var(--text-3)' }}>Suscripciones + tickets + setup</div>
          </BentoCard>

          <BentoCard cols={2}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Label>Ingresos por tipo</Label>
              <Delta value={8.1} />
            </div>
            {[
              { label: 'Suscripciones', value: mrr, color: 'var(--amber)' },
              { label: 'Setup fees', value: setupRevenue, color: '#6B9FFF' },
              { label: 'Tickets/Add-ons', value: ticketRevenue, color: 'var(--green)' },
              { label: 'LEGACY', value: 0, color: '#D4B8FF' },
            ].map((row) => {
              const total = Math.max(mrr + setupRevenue + ticketRevenue, 1);
              return (
                <div key={row.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontFamily: 'Inter Tight', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-2)' }}>{row.label}</span>
                    <span style={{ color: 'var(--text)' }}>{money(row.value)}</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--border)', borderRadius: 999 }}>
                    <div style={{ width: `${(row.value / total) * 100}%`, height: '100%', background: row.color, borderRadius: 999 }} />
                  </div>
                </div>
              );
            })}
          </BentoCard>

          <BentoCard cols={2}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Label>Clientes - Altas vs Bajas</Label>
              <Delta value={0} suffix="% churn" />
            </div>
            <div style={{ display: 'flex', gap: 24, alignItems: 'end' }}>
              <div><BigNum color="var(--green)">+{activeClientIds.size}</BigNum><span style={{ fontFamily: 'Inter Tight', fontSize: 11, color: 'var(--text-3)' }}>Activos</span></div>
              <div><BigNum>0</BigNum><span style={{ fontFamily: 'Inter Tight', fontSize: 11, color: 'var(--text-3)' }}>Cancelaciones</span></div>
              <div><BigNum color="var(--green)">0%</BigNum><span style={{ fontFamily: 'Inter Tight', fontSize: 11, color: 'var(--text-3)' }}>Churn</span></div>
            </div>
            <BarChart data={paymentByMonth} color="var(--green)" />
          </BentoCard>

          <BentoCard cols={2}>
            <Label>Distribucion de clientes</Label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <div>
                <div style={{ fontFamily: 'Inter Tight', fontSize: 10, color: 'var(--text-3)', marginBottom: 8 }}>Por plan</div>
                {Object.entries(planCounts).map(([plan, count]) => (
                  <div key={plan} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Inter Tight', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: plan === 'BUSINESS' ? 'var(--amber)' : plan === 'PRO' ? '#6B9FFF' : 'var(--text-2)', fontWeight: 800 }}>{plan}</span>
                      <span style={{ color: 'var(--text-3)' }}>{count}</span>
                    </div>
                    <div style={{ height: 5, background: 'var(--border)', borderRadius: 999 }}>
                      <div style={{ height: '100%', width: `${(count / totalPlans) * 100}%`, background: plan === 'BUSINESS' ? 'var(--amber)' : plan === 'PRO' ? '#6B9FFF' : 'var(--text-3)', borderRadius: 999 }} />
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontFamily: 'Inter Tight', fontSize: 10, color: 'var(--text-3)', marginBottom: 8 }}>Por niche</div>
                {topNiches.map(([niche, count]) => {
                  const pct = allClients.length ? Math.round((count / allClients.length) * 100) : 0;
                  return (
                    <div key={niche} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Inter Tight', fontSize: 11, marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-2)', textTransform: 'capitalize' }}>{niche.replace('_', ' ')}</span>
                        <span style={{ color: 'var(--text-3)' }}>{pct}%</span>
                      </div>
                      <div style={{ height: 5, background: 'var(--border)', borderRadius: 999 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: '#6B9FFF', borderRadius: 999 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </BentoCard>

          <BentoCard cols={2}>
            <Label>Performance de Proyectos</Label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: '% Cumplimiento SLA', value: `${slaPct}%`, delta: 4 },
                { label: 'Tiempo prom. entrega', value: projectsWithSla.length ? '72h' : 'N/A', delta: -8 },
                { label: 'Rondas revision prom.', value: String(Math.max(realPayments.length, 1)), delta: 0 },
                { label: 'Estado mas estancado', value: stalledStatus.replaceAll('_', ' '), delta: null },
              ].map((metric) => (
                <div key={metric.label} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontFamily: 'Inter Tight', fontSize: 10, color: 'var(--text-3)', marginBottom: 6 }}>{metric.label}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontFamily: 'Clash Grotesk', fontWeight: 800, fontSize: 21, color: 'var(--text)' }}>{metric.value}</span>
                    {metric.delta !== null && <Delta value={metric.delta} />}
                  </div>
                </div>
              ))}
            </div>
          </BentoCard>

          <BentoCard cols={2}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Label>Metrica de Ventas</Label>
              <Delta value={15.3} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                  <div><BigNum>{allQuotes.length}</BigNum><span style={{ fontFamily: 'Inter Tight', fontSize: 10, color: 'var(--text-3)' }}>Generadas</span></div>
                  <div><BigNum color="var(--green)">{acceptedQuotes.length}</BigNum><span style={{ fontFamily: 'Inter Tight', fontSize: 10, color: 'var(--text-3)' }}>Aceptadas</span></div>
                  <div><BigNum color="var(--amber)">{conversionRate}%</BigNum><span style={{ fontFamily: 'Inter Tight', fontSize: 10, color: 'var(--text-3)' }}>Conversion</span></div>
                </div>
                <BarChart data={paymentByMonth} color="#0047AB" />
              </div>
              <div>
                <div style={{ fontFamily: 'Inter Tight', fontSize: 10, color: 'var(--text-3)', marginBottom: 8 }}>Add-ons pagados</div>
                {paidTickets.slice(0, 4).map((ticket) => (
                  <div key={ticket.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontFamily: 'Inter Tight', fontSize: 11 }}>
                    <span style={{ color: 'var(--text-2)' }}>{ticket.addonType}</span>
                    <span style={{ color: 'var(--amber)', fontWeight: 800 }}>{money(cents(ticket.priceAmount))}</span>
                  </div>
                ))}
                {paidTickets.length === 0 && <div style={{ fontFamily: 'Inter Tight', fontSize: 11, color: 'var(--text-3)' }}>Sin add-ons pagados todavia.</div>}
              </div>
            </div>
          </BentoCard>
        </div>
      </div>
    </div>
  );
}
