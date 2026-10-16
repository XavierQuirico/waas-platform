import { db } from '@/db';
import Link from 'next/link';
import { clients } from '@/db/schema/clients';
import { projects } from '@/db/schema/projects';
import { projectEvents } from '@/db/schema/project-events';
import { tickets } from '@/db/schema/tickets';
import { ManualPaymentLauncher } from './components/ManualPaymentModal';
import { PAYPAL_FEE_RATE, paypalGrossUp } from '@/lib/calculadora/formulas';

type FacTab = 'overview' | 'cobros' | 'proximos' | 'suscripciones';

type PageProps = {
  searchParams?: Promise<{ tab?: string }> | { tab?: string };
};

type PaymentRow = {
  id: string;
  projectId: string;
  client: string;
  plan: string;
  type: string;
  gross: number;
  net: number;
  method: string;
  manual: boolean;
  date: Date;
  ref: string;
};

type BillingProject = {
  id: string;
  clientId: string;
  plan: typeof projects.$inferSelect['plan'];
  monthlyPriceCents: number;
  setupFeeCents: number;
  paypalOrderId: string | null;
  paypalSubscriptionId: string | null;
  status: typeof projects.$inferSelect['status'];
  createdAt: Date;
};

const TABS: { key: FacTab; label: string }[] = [{ key: 'overview', label: 'Overview' }, { key: 'cobros', label: 'Cobros recibidos' }, { key: 'proximos', label: 'Proximos cobros' }, { key: 'suscripciones', label: 'Suscripciones activas' }];
const ACTIVE_STATUSES = ['LIVE', 'STAGING_REVIEW', 'REVISIONS', 'REVISIONS_DONE', 'PRODUCTION_STARTED', 'AWAITING_ASSETS', 'ASSETS_SUBMITTED', 'ASSETS_UNDER_REVIEW', 'PAYMENT_RECEIVED'];

function money(amount: number, decimals = 0) {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
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

function metaString(metadata: unknown, key: string, fallback = '') {
  if (!metadata || typeof metadata !== 'object') return fallback;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function metaNumber(metadata: unknown, keys: string[], fallback = 0) {
  if (!metadata || typeof metadata !== 'object') return fallback;
  const source = metadata as Record<string, unknown>;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim()) return Number(value) || fallback;
  }
  return fallback;
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'Inter Tight' }}>{children}</div>;
}

function Amount({ children, color = 'var(--text)', size = 24 }: { children: React.ReactNode; color?: string; size?: number }) {
  return <span style={{ fontFamily: 'Clash Grotesk', fontWeight: 800, fontSize: size, color, lineHeight: 1 }}>{children}</span>;
}

function Card({ children, cols = 1, style }: { children: React.ReactNode; cols?: number; style?: React.CSSProperties }) {
  return (
    <section
      style={{
        gridColumn: `span ${cols}`,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
        ...style,
      }}
    >
      {children}
    </section>
  );
}

function MiniLine({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  const min = Math.min(...data.map((item) => item.value), 0);
  const range = Math.max(max - min, 1);
  const points = data.map((item, index) => `${data.length === 1 ? 0 : (index / (data.length - 1)) * 100},${88 - ((item.value - min) / range) * 72}`).join(' ');

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: 64 }}>
      {[24, 54, 84].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="0.6" />)}
      <polyline points={points} fill="none" stroke="#FF8C00" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MonthColumns({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${data.length}, 1fr)`, alignItems: 'end', gap: 8, height: 86 }}>
      {data.map((item, index) => {
        const current = index === data.length - 1;
        return (
          <div key={item.label} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'end', alignItems: 'center', gap: 5, height: '100%' }}>
            <div style={{ width: '100%', minHeight: 5, height: `${Math.max((item.value / max) * 52, 5)}px`, background: current ? 'var(--amber)' : 'rgba(255,140,0,0.32)', borderRadius: '5px 5px 2px 2px' }} />
            <span style={{ fontFamily: 'Inter Tight', fontSize: 9, color: current ? 'var(--amber)' : 'var(--text-3)', textTransform: 'capitalize' }}>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default async function FacturacionPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab = TABS.some((item) => item.key === params?.tab) ? (params?.tab as FacTab) : 'overview';

  const [allClients, allProjects, allTickets, allEvents] = await Promise.all([
    db.select().from(clients),
    db
      .select({
        id: projects.id,
        clientId: projects.clientId,
        plan: projects.plan,
        monthlyPriceCents: projects.monthlyPriceCents,
        setupFeeCents: projects.setupFeeCents,
        paypalOrderId: projects.paypalOrderId,
        paypalSubscriptionId: projects.paypalSubscriptionId,
        status: projects.status,
        createdAt: projects.createdAt,
        paymentGracePeriodUntil: projects.paymentGracePeriodUntil,
      })
      .from(projects),
    db.select().from(tickets),
    db.select().from(projectEvents),
  ]);

  const clientById = new Map(allClients.map((client) => [client.id, client]));
  const liveProjects = allProjects.filter((project) => ACTIVE_STATUSES.includes(project.status));
  const mrr = liveProjects.reduce((sum, project) => sum + cents(project.monthlyPriceCents), 0);
  const paidTickets = allTickets.filter((ticket) => ticket.status === 'PAID' || ticket.paidAt);
  const ticketRevenue = paidTickets.reduce((sum, ticket) => sum + cents(ticket.priceAmount), 0);

  const paymentRows: PaymentRow[] = allEvents
    .filter((event) => event.eventType === 'payment_received')
    .map((event) => {
      const project = allProjects.find((item) => item.id === event.projectId);
      const client = project ? clientById.get(project.clientId) : undefined;
      const fallbackNet = project ? cents(project.monthlyPriceCents) : 0;
      const net = metaNumber(event.metadata, ['netAmount', 'amount'], fallbackNet);
      const gross = metaNumber(event.metadata, ['grossAmount'], net ? paypalGrossUp(net) : 0);
      const manual = metaString(event.metadata, 'source') === 'manual';
      return {
        id: event.id,
        projectId: event.projectId,
        client: client?.fullName ?? 'Cliente sin nombre',
        plan: project?.plan ?? 'LEGACY',
        type: metaString(event.metadata, 'paymentType', 'Plan de suscripcion'),
        gross,
        net,
        method: metaString(event.metadata, 'method', manual ? 'Manual' : 'PayPal'),
        manual,
        date: new Date(metaString(event.metadata, 'paidAt') || event.createdAt),
        ref: metaString(event.metadata, 'reference', project?.paypalSubscriptionId ?? project?.paypalOrderId ?? '—'),
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const months = Array.from({ length: 6 }, (_, index) => addMonths(new Date(), index - 5));
  const mrrByMonth = months.map((date) => {
    const value = liveProjects
      .filter((project) => new Date(project.createdAt) <= addMonths(date, 1))
      .reduce((sum, project) => sum + cents(project.monthlyPriceCents), 0);
    return { label: monthLabel(date), value: Math.round(value) };
  });
  mrrByMonth[mrrByMonth.length - 1].value = Math.round(mrr);

  const now = new Date();
  const monthTitle = new Intl.DateTimeFormat('es-DO', { month: 'long', year: 'numeric', timeZone: 'America/Santo_Domingo' }).format(now);
  const previousMrr = mrrByMonth[mrrByMonth.length - 2]?.value ?? 0;
  const mrrDelta = previousMrr > 0 ? ((mrr - previousMrr) / previousMrr) * 100 : null;
  const cancellationsThisMonth = allEvents.filter(
    (event) => event.toStatus === 'CANCELLED' && monthKey(new Date(event.createdAt)) === monthKey(now),
  ).length;
  const projectsInGrace = allProjects.filter(
    (project) => project.paymentGracePeriodUntil && new Date(project.paymentGracePeriodUntil) > now,
  ).length;

  const totalMes = mrr + ticketRevenue + paymentRows
    .filter((payment) => monthKey(payment.date) === monthKey(new Date()))
    .reduce((sum, payment) => sum + payment.net, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '28px 32px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h1 style={{ fontFamily: 'Clash Grotesk', fontWeight: 700, fontSize: 22, color: 'var(--text)', lineHeight: 1 }}>
            Facturación & MRR
          </h1>
          <ManualPaymentLauncher />
        </div>
        <nav style={{ display: 'flex', gap: 2 }}>
          {TABS.map((item) => (
            <Link
              key={item.key}
              href={`/admin/facturacion?tab=${item.key}`}
              prefetch={false}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                background: tab === item.key ? 'rgba(255,140,0,0.12)' : 'transparent',
                color: tab === item.key ? 'var(--amber)' : 'var(--text-3)',
                fontFamily: 'Inter Tight',
                fontSize: 13,
                fontWeight: tab === item.key ? 700 : 500,
                textDecoration: 'none',
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 32px 32px' }}>
        {tab === 'overview' && <OverviewTab mrr={mrr} totalMes={totalMes} months={mrrByMonth} liveProjects={liveProjects} ticketRevenue={ticketRevenue} monthTitle={monthTitle} mrrDelta={mrrDelta} cancellations={cancellationsThisMonth} projectsInGrace={projectsInGrace} />}
        {tab === 'cobros' && <CobrosTab payments={paymentRows} />}
        {tab === 'proximos' && <ProximosTab projects={liveProjects} clients={clientById} />}
        {tab === 'suscripciones' && <SuscripcionesTab projects={liveProjects} clients={clientById} />}
      </div>

    </div>
  );
}

function OverviewTab({
  mrr,
  totalMes,
  months,
  liveProjects,
  ticketRevenue,
  monthTitle,
  mrrDelta,
  cancellations,
  projectsInGrace,
}: {
  mrr: number;
  totalMes: number;
  months: { label: string; value: number }[];
  liveProjects: BillingProject[];
  ticketRevenue: number;
  monthTitle: string;
  mrrDelta: number | null;
  cancellations: number;
  projectsInGrace: number;
}) {
  const planRows = ['BASIC', 'PRO', 'BUSINESS', 'LEGACY'].map((plan) => {
    const rows = liveProjects.filter((project) => project.plan === plan);
    return { plan, clients: rows.length, subtotal: rows.reduce((sum, project) => sum + cents(project.monthlyPriceCents), 0) };
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
      <Card cols={2} style={{ background: 'linear-gradient(140deg, rgba(255,140,0,0.14), rgba(255,140,0,0.03))' }}>
        <Label>MRR neto — {monthTitle}</Label>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginTop: 10, gap: 16 }}>
          <div>
            <Amount color="var(--amber)" size={44}>{money(mrr)}</Amount>
            {mrrDelta !== null && (
              <div style={{ fontFamily: 'Inter Tight', fontSize: 12, color: mrrDelta >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 6, fontWeight: 800 }}>
                {mrrDelta >= 0 ? '↑' : '↓'} {Math.abs(mrrDelta).toFixed(1)}% vs mes anterior
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'Inter Tight', fontSize: 11, color: 'var(--text-3)' }}>Total bruto mes</div>
            <Amount size={22}>{money(totalMes)}</Amount>
            <div style={{ fontFamily: 'Inter Tight', fontSize: 10, color: 'var(--text-3)' }}>incl. setup + tickets</div>
          </div>
        </div>
        <MiniLine data={months} />
        <MonthColumns data={months} />
      </Card>

      <Card>
        <Label>MRR por Plan</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
          {planRows.map((row) => {
            const pct = mrr > 0 ? (row.subtotal / mrr) * 100 : 0;
            return (
              <div key={row.plan}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontFamily: 'Inter Tight', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-2)', fontWeight: 700 }}>{row.plan} x{row.clients}</span>
                  <Amount size={14}>{money(row.subtotal)}</Amount>
                </div>
                <div style={{ height: 5, background: 'rgba(128,128,128,0.12)', borderRadius: 999 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: row.plan === 'BUSINESS' ? '#FFB347' : row.plan === 'PRO' ? '#FF8C00' : 'rgba(128,128,128,0.5)', borderRadius: 999 }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <Label>Ingresos únicos — {monthTitle}</Label>
        {[
          { icon: '🏗', label: 'Setup fees', value: Math.max(totalMes - mrr - ticketRevenue, 0), color: '#6B9FFF' },
          { icon: '🎫', label: 'Tickets / Add-ons', value: ticketRevenue, color: 'var(--green)' },
          { icon: '📦', label: 'LEGACY', value: 0, color: 'var(--text-3)' },
        ].map((row) => (
          <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(128,128,128,0.1)' }}>
            <span>{row.icon}</span>
            <span style={{ flex: 1, fontFamily: 'Inter Tight', fontSize: 12, color: 'var(--text-2)' }}>{row.label}</span>
            <Amount size={15} color={row.color}>{row.value > 0 ? money(row.value) : '—'}</Amount>
          </div>
        ))}
      </Card>

      {[
        { icon: '📈', label: 'Suscripciones activas', value: String(liveProjects.length), sub: 'Proyectos con cobro recurrente', color: 'var(--green)' },
        { icon: '🧊', label: 'Cancelaciones', value: String(cancellations), sub: cancellations === 0 ? 'Sin bajas este mes' : 'Registradas este mes', color: cancellations === 0 ? 'var(--green)' : 'var(--red)' },
        { icon: '✅', label: 'Pagos fallidos', value: String(projectsInGrace), sub: projectsInGrace === 0 ? 'Todo al corriente' : 'Proyectos en periodo de gracia', color: projectsInGrace === 0 ? 'var(--green)' : 'var(--red)' },
        { icon: '💸', label: 'Comisión PayPal', value: money(mrr * PAYPAL_FEE_RATE), sub: `${(PAYPAL_FEE_RATE * 100).toFixed(1)}% + $0.30 por cobro (estimado)`, color: 'var(--red)' },
      ].map((tile) => (
        <Card key={tile.label} style={{ background: tile.color === 'var(--red)' ? 'rgba(192,57,43,0.06)' : 'rgba(93,214,156,0.08)' }}>
          <Label>{tile.icon} {tile.label}</Label>
          <div style={{ marginTop: 8 }}><Amount size={28} color={tile.color}>{tile.value}</Amount></div>
          <div style={{ fontFamily: 'Inter Tight', fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>{tile.sub}</div>
        </Card>
      ))}
    </div>
  );
}

function CobrosTab({ payments }: { payments: PaymentRow[] }) {
  const th: React.CSSProperties = { padding: '12px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Inter Tight' };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.22)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Cliente', 'Tipo', 'Bruto', 'Neto Xavier', 'Metodo', 'Fecha', 'Ref.'].map((header) => (
              <th key={header} style={th}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {payments.map((payment, index) => (
            <tr key={payment.id} style={{ borderBottom: index < payments.length - 1 ? '1px solid rgba(128,128,128,0.08)' : 'none' }}>
              <td style={{ padding: '14px 16px', fontFamily: 'Inter Tight', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{payment.client}</td>
              <td style={{ padding: '14px 16px', fontSize: 12, color: 'var(--text-2)' }}>{payment.type}</td>
              <td style={{ padding: '14px 16px' }}><Amount size={14} color="var(--amber)">{money(payment.gross, 2)}</Amount></td>
              <td style={{ padding: '14px 16px' }}><Amount size={14} color="var(--green)">{money(payment.net, 2)}</Amount></td>
              <td style={{ padding: '14px 16px' }}>
                <span style={{ fontSize: 11, background: 'var(--surface-2)', color: 'var(--text-2)', padding: '3px 8px', borderRadius: 6 }}>{payment.method}</span>
                {payment.manual && <span style={{ marginLeft: 4, fontSize: 10, background: 'rgba(255,140,0,0.1)', color: 'var(--amber)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>Manual</span>}
              </td>
              <td style={{ padding: '14px 16px', fontSize: 12, color: 'var(--text-3)' }}>{payment.date.toISOString().slice(0, 10)}</td>
              <td style={{ padding: '14px 16px', fontSize: 11, color: 'var(--text-3)', fontFamily: 'Inter Tight' }}>{payment.ref}</td>
            </tr>
          ))}
          {payments.length === 0 && (
            <tr><td colSpan={7} style={{ padding: 24, fontFamily: 'Inter Tight', fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>Sin cobros registrados.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ProximosTab({ projects: rows, clients: clientById }: { projects: BillingProject[]; clients: Map<string, typeof clients.$inferSelect> }) {
  const sorted = [...rows].sort((a, b) => Number(new Date(a.createdAt)) - Number(new Date(b.createdAt)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sorted.map((project) => {
        const client = clientById.get(project.clientId);
        const next = addMonths(new Date(project.createdAt), 1);
        const risk = project.status === 'SUSPENDED';
        const whatsappHref = client?.whatsapp ? `https://wa.me/${client.whatsapp.replace(/\D/g, '')}` : '#';
        return (
          <div key={project.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'var(--surface)', border: `1px solid ${risk ? 'rgba(239,68,68,0.28)' : 'var(--border)'}`, borderRadius: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Inter Tight', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{client?.fullName ?? 'Cliente sin nombre'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Proximo cobro: {next.toISOString().slice(0, 10)}</div>
            </div>
            <span className="badge-pill badge-pro">{project.plan}</span>
            <Amount size={16} color="var(--amber)">{money(paypalGrossUp(cents(project.monthlyPriceCents)), 2)}</Amount>
            {risk && <a href={whatsappHref} style={{ background: 'rgba(37,211,102,0.16)', border: '1px solid rgba(37,211,102,0.3)', color: '#5DD69C', borderRadius: 8, padding: '5px 9px', fontFamily: 'Inter Tight', fontSize: 11, fontWeight: 800, textDecoration: 'none' }}>WhatsApp riesgo</a>}
          </div>
        );
      })}
    </div>
  );
}

function SuscripcionesTab({ projects: rows, clients: clientById }: { projects: BillingProject[]; clients: Map<string, typeof clients.$inferSelect> }) {
  const th: React.CSSProperties = { padding: '12px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Inter Tight' };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.22)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Cliente', 'Plan', 'Precio bruto', 'Neto Xavier', 'Inicio', 'Estado PayPal', ''].map((header) => (
              <th key={header} style={th}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((project, index) => {
            const client = clientById.get(project.clientId);
            return (
              <tr key={project.id} style={{ borderBottom: index < rows.length - 1 ? '1px solid rgba(128,128,128,0.08)' : 'none' }}>
                <td style={{ padding: '14px 16px', fontFamily: 'Inter Tight', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{client?.fullName ?? 'Cliente sin nombre'}</td>
                <td style={{ padding: '14px 16px' }}><span className="badge-pill badge-pro">{project.plan}</span></td>
                <td style={{ padding: '14px 16px' }}><Amount size={13} color="var(--amber)">{money(paypalGrossUp(cents(project.monthlyPriceCents)), 2)}/mes</Amount></td>
                <td style={{ padding: '14px 16px' }}><Amount size={13} color="var(--green)">{money(cents(project.monthlyPriceCents), 2)}/mes</Amount></td>
                <td style={{ padding: '14px 16px', fontSize: 12, color: 'var(--text-3)' }}>{new Date(project.createdAt).toISOString().slice(0, 10)}</td>
                <td style={{ padding: '14px 16px' }}><span className="badge-green badge-pill">ACTIVE</span></td>
                <td style={{ padding: '14px 16px' }}><button type="button" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--red)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, fontFamily: 'Inter Tight' }}>Cancelar</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
