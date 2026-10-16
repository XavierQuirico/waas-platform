// ============================================================
// Historial de Cotizaciones - /admin/cotizaciones
// Server wrapper with URL filters + drawer server actions
// ============================================================

import { db } from '@/db';
import { quotes } from '@/db/schema/quotes';
import { desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';

type QuoteStatus = (typeof quotes.$inferInsert)['status'];

type SearchParams = {
  q?: string;
  status?: string;
  plan?: string;
  quote?: string;
};

type QuoteRow = {
  id: string;
  client: string;
  business: string;
  projectType: string;
  niche: string;
  status: string;
  plan: string;
  monthlyTotal: number;
  setupTotal: number;
  totalAmountProvider: number;
  discount: number;
  created: string;
  sent: string | null;
  expires: string | null;
  addons: string[];
  calculationSnapshot: Record<string, unknown>;
};

const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  expired: 'Expirada',
  requires_review: 'Requiere revision',
};

const QUOTE_STATUS_BADGE: Record<string, string> = {
  draft: 'badge-neutral badge-pill',
  sent: 'badge-blue badge-pill',
  accepted: 'badge-green badge-pill',
  rejected: 'badge-red badge-pill',
  expired: 'badge-red badge-pill',
  requires_review: 'badge-amber badge-pill',
};

const PLAN_BADGE: Record<string, string> = {
  BASIC: 'badge-neutral badge-pill',
  PRO: 'badge-pro badge-pill',
  BUSINESS: 'badge-business badge-pill',
  LEGACY: 'badge-legacy badge-pill',
};

function formatUSD(amount: number) {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date | string | null) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('es-DO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getSetupTotal(snapshot: Record<string, unknown>): number {
  const candidates = [
    snapshot.setupTotal,
    snapshot.setupFee,
    snapshot.setupAmount,
    snapshot.setupTotalClient,
    snapshot?.totals && typeof snapshot.totals === 'object' ? (snapshot.totals as Record<string, unknown>).setupTotal : undefined,
  ];

  const value = candidates.find((candidate) => typeof candidate === 'number');
  return typeof value === 'number' ? value : 0;
}

function getAddons(snapshot: Record<string, unknown>): string[] {
  const addons = snapshot.addons ?? snapshot.selectedAddOns ?? snapshot.suggestedAddOns;
  return Array.isArray(addons) ? addons.map(String) : [];
}

async function setQuoteStatus(formData: FormData) {
  'use server';

  await requireAdmin();

  const quoteId = String(formData.get('quoteId') || '');
  const status = String(formData.get('status') || '');
  if (!quoteId || !Object.keys(QUOTE_STATUS_LABELS).includes(status)) {
    throw new Error('Cotizacion o estado invalido.');
  }

  const now = new Date();
  await db
    .update(quotes)
    .set({
      status: status as QuoteStatus,
      sentAt: status === 'sent' ? now : undefined,
      updatedAt: now,
    })
    .where(eq(quotes.id, quoteId));

  revalidatePath('/admin/cotizaciones');
}

function buildHref(params: SearchParams, patch: Partial<SearchParams>) {
  const query = new URLSearchParams();
  const next = { ...params, ...patch };
  Object.entries(next).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const qs = query.toString();
  return qs ? `/admin/cotizaciones?${qs}` : '/admin/cotizaciones';
}

function QuoteDrawer({ quote, params }: { quote: QuoteRow | undefined; params: SearchParams }) {
  if (!quote) return null;

  const action = {
    draft: (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href="/admin/calculadora" style={buttonStyle('secondary')}>Continuar en calculadora</Link>
        <form action={setQuoteStatus}>
          <input type="hidden" name="quoteId" value={quote.id} />
          <input type="hidden" name="status" value="sent" />
          <button style={buttonStyle('primary')}>Enviar propuesta</button>
        </form>
      </div>
    ),
    sent: (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <form action={setQuoteStatus}>
          <input type="hidden" name="quoteId" value={quote.id} />
          <input type="hidden" name="status" value="sent" />
          <button style={buttonStyle('secondary')}>Reenviar propuesta</button>
        </form>
        <form action={setQuoteStatus}>
          <input type="hidden" name="quoteId" value={quote.id} />
          <input type="hidden" name="status" value="accepted" />
          <button style={buttonStyle('green')}>Marcar aceptada</button>
        </form>
        <form action={setQuoteStatus}>
          <input type="hidden" name="quoteId" value={quote.id} />
          <input type="hidden" name="status" value="rejected" />
          <button style={buttonStyle('danger')}>Marcar rechazada</button>
        </form>
      </div>
    ),
    accepted: <Link href="/admin/proyectos" style={buttonStyle('primary')}>Ver proyectos</Link>,
    expired: <Link href="/admin/calculadora" style={buttonStyle('secondary')}>Generar nueva cotizacion</Link>,
    requires_review: <Link href="/admin/calculadora" style={buttonStyle('primary')}>Ir a calculadora con contexto</Link>,
    rejected: <Link href="/admin/calculadora" style={buttonStyle('secondary')}>Revisar cotizacion</Link>,
  }[quote.status];

  return (
    <div style={drawerBackdropStyle}>
      <aside style={drawerStyle}>
        <div style={{ padding: 24, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>{quote.client}</div>
              <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 2 }}>{quote.business}</div>
            </div>
            <Link href={buildHref(params, { quote: undefined })} style={iconButtonStyle}>x</Link>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className={QUOTE_STATUS_BADGE[quote.status] ?? 'badge-neutral badge-pill'}>{QUOTE_STATUS_LABELS[quote.status] ?? quote.status}</span>
            <span className={PLAN_BADGE[quote.plan] ?? 'badge-neutral badge-pill'}>{quote.plan}</span>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            ['Cotizacion', quote.id],
            ['Niche', quote.niche],
            ['Mensualidad al cliente', formatUSD(quote.monthlyTotal)],
            ['Setup al cliente', formatUSD(quote.setupTotal)],
            ['Ingreso neto mensual', formatUSD(quote.totalAmountProvider)],
            ['Descuento', quote.discount > 0 ? `${Math.round(quote.discount * 100)}%` : 'Sin descuento'],
            ['Equivalencia DOP', `RD$${(quote.monthlyTotal * 52.8).toFixed(0)}/mes`],
            ['Creada', quote.created],
            ['Enviada', quote.sent ?? '-'],
            ['Vence / Vencio', quote.expires ?? '-'],
          ].map(([key, value]) => (
            <div key={key} style={detailRowStyle}>
              <span style={{ color: 'var(--text-3)' }}>{key}</span>
              <span style={{ color: 'var(--text)', fontWeight: 500, textAlign: 'right' }}>{value}</span>
            </div>
          ))}

          {quote.addons.length > 0 && (
            <div>
              <div style={eyebrowStyle}>Add-ons</div>
              {quote.addons.map((addon) => <div key={addon} style={{ fontSize: 12, color: 'var(--text-2)', padding: '4px 0' }}>{addon}</div>)}
            </div>
          )}

          <Divider label="Acciones" />
          {action}
          <Divider label="Timeline" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <TimelineRow label="Cotizacion creada" date={quote.created} />
            {quote.sent && <TimelineRow label="Propuesta enviada al cliente" date={quote.sent} />}
            {quote.status === 'accepted' && <TimelineRow label="Propuesta aceptada" date={quote.expires ?? quote.created} />}
            {quote.status === 'expired' && <TimelineRow label="Propuesta expirada" date={quote.expires ?? quote.created} />}
          </div>
        </div>
      </aside>
    </div>
  );
}

function TimelineRow({ label, date }: { label: string; date: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
      <span style={{ color: 'var(--text)' }}>{label}</span>
      <span style={{ color: 'var(--text-3)' }}>{date}</span>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ height: 1, background: 'var(--border)', flex: 1 }} />
      <span style={eyebrowStyle}>{label}</span>
      <div style={{ height: 1, background: 'var(--border)', flex: 1 }} />
    </div>
  );
}

export default async function CotizacionesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const q = (params.q ?? '').trim().toLowerCase();
  const statusFilter = params.status ?? '';
  const planFilter = params.plan ?? '';

  const allQuotes = await db
    .select({
      id: quotes.id,
      clientName: quotes.clientName,
      businessName: quotes.businessName,
      projectType: quotes.projectType,
      niche: quotes.niche,
      status: quotes.status,
      totalAmountClient: quotes.totalAmountClient,
      totalAmountProvider: quotes.totalAmountProvider,
      discountPercent: quotes.discountPercent,
      calculationSnapshot: quotes.calculationSnapshot,
      subscriptionPlan: quotes.subscriptionPlan,
      createdAt: quotes.createdAt,
      validUntil: quotes.validUntil,
      sentAt: quotes.sentAt,
    })
    .from(quotes)
    .orderBy(desc(quotes.createdAt));

  const mapped: QuoteRow[] = allQuotes.map((quote) => {
    const snapshot = quote.calculationSnapshot as Record<string, unknown>;
    const plan = quote.subscriptionPlan ?? (quote.projectType === 'legacy' ? 'LEGACY' : 'BASIC');
    return {
      id: quote.id,
      client: quote.clientName,
      business: quote.businessName,
      projectType: quote.projectType,
      niche: quote.niche,
      status: quote.status,
      plan,
      monthlyTotal: quote.totalAmountClient,
      setupTotal: getSetupTotal(snapshot),
      totalAmountProvider: quote.totalAmountProvider,
      discount: quote.discountPercent,
      created: formatDate(quote.createdAt),
      sent: formatDate(quote.sentAt),
      expires: formatDate(quote.validUntil),
      addons: getAddons(snapshot),
      calculationSnapshot: snapshot,
    };
  });

  const filtered = mapped.filter((quote) => {
    const haystack = `${quote.client} ${quote.business} ${quote.niche}`.toLowerCase();
    return (!q || haystack.includes(q)) && (!statusFilter || quote.status === statusFilter) && (!planFilter || quote.plan === planFilter);
  });

  const sentCount = mapped.filter((quote) => quote.sent).length;
  const acceptedCount = mapped.filter((quote) => quote.status === 'accepted').length;
  const conversionRate = sentCount > 0 ? Math.round((acceptedCount / sentCount) * 100) : 0;
  const selected = mapped.find((quote) => quote.id === params.quote);

  const kpis = [
    { label: 'Total este mes', value: String(mapped.length), color: 'var(--text)' },
    { label: 'Enviadas', value: String(mapped.filter((quote) => quote.status === 'sent').length), color: '#6B9FFF' },
    { label: 'Aceptadas', value: String(acceptedCount), color: 'var(--green)' },
    { label: 'Tasa conversion', value: `${conversionRate}%`, color: 'var(--green)' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '28px 32px 0', flexShrink: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 20 }}>
          {kpis.map((kpi) => (
            <div key={kpi.label} style={cardStyle}>
              <div style={{ fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 700, fontSize: 28, color: kpi.color }}>{kpi.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{kpi.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h1 style={{ fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 800, fontSize: 24, color: 'var(--text)', margin: 0 }}>
            Historial de Cotizaciones
          </h1>
          <Link href="/admin/calculadora" style={buttonStyle('primary')}>+ Nueva cotizacion</Link>
        </div>
        <form action="/admin/cotizaciones" style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <input name="q" defaultValue={params.q ?? ''} placeholder="Buscar por cliente o negocio..." style={fieldStyle} />
          <select name="status" defaultValue={statusFilter} style={{ ...fieldStyle, maxWidth: 220 }}>
            <option value="">Todos los estados</option>
            {Object.entries(QUOTE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select name="plan" defaultValue={planFilter} style={{ ...fieldStyle, maxWidth: 190 }}>
            <option value="">Todos los planes</option>
            {['BASIC', 'PRO', 'BUSINESS', 'LEGACY'].map((plan) => <option key={plan} value={plan}>{plan}</option>)}
          </select>
          <button style={buttonStyle('secondary')}>Filtrar</button>
        </form>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 32px 32px' }}>
        {filtered.length === 0 ? (
          <div style={{ ...cardStyle, padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>No hay cotizaciones con esos filtros.</div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.22)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Cliente / Negocio', 'Plan', 'Mensualidad', 'Setup', 'Estado', 'Creada', 'Enviada', 'Vence'].map((header) => (
                    <th key={header} style={thStyle}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((quote, index) => (
                  <tr key={quote.id} style={{ borderBottom: index < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={tdStyle}>
                      <Link href={buildHref(params, { quote: quote.id })} style={{ textDecoration: 'none' }}>
                        <div style={{ fontFamily: "'Inter Tight', sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{quote.client}</div>
                        <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 2 }}>{quote.business}</div>
                      </Link>
                    </td>
                    <td style={tdStyle}><span className={PLAN_BADGE[quote.plan] ?? 'badge-neutral badge-pill'}>{quote.plan}</span></td>
                    <td style={{ ...tdStyle, fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 700, fontSize: 14, color: 'var(--amber)' }}>{formatUSD(quote.monthlyTotal)}</td>
                    <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text-2)' }}>{formatUSD(quote.setupTotal)}</td>
                    <td style={tdStyle}><span className={QUOTE_STATUS_BADGE[quote.status] ?? 'badge-neutral badge-pill'}>{QUOTE_STATUS_LABELS[quote.status] ?? quote.status}</span></td>
                    <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text-3)' }}>{quote.created}</td>
                    <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text-3)' }}>{quote.sent}</td>
                    <td style={{ ...tdStyle, fontSize: 12, color: quote.expires !== '-' && new Date(quote.expires) < new Date() ? 'var(--red)' : 'var(--text-3)' }}>{quote.expires}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <QuoteDrawer quote={selected} params={params} />
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--text-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontFamily: "'Inter Tight', sans-serif",
};

const tdStyle: React.CSSProperties = {
  padding: '14px 16px',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '16px 20px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.22)',
};

const fieldStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text)',
  padding: '10px 12px',
  fontSize: 13,
  fontFamily: "'Inter Tight', sans-serif",
};

const detailRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  padding: '8px 0',
  borderBottom: '1px solid var(--border)',
  fontSize: 12,
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--text-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

const drawerBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  justifyContent: 'flex-end',
  zIndex: 50,
};

const drawerStyle: React.CSSProperties = {
  width: '50%',
  minWidth: 420,
  maxWidth: 760,
  height: '100%',
  background: 'var(--bg)',
  boxShadow: '-10px 0 30px rgba(0,0,0,0.35)',
  display: 'flex',
  flexDirection: 'column',
};

const iconButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-3)',
  cursor: 'pointer',
  fontSize: 18,
  padding: 8,
  textDecoration: 'none',
};

function buttonStyle(variant: 'primary' | 'secondary' | 'green' | 'danger'): React.CSSProperties {
  const variants = {
    primary: { background: 'rgba(255,140,0,0.14)', border: '1px solid rgba(255,140,0,0.35)', color: 'var(--amber)' },
    secondary: { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)' },
    green: { background: 'rgba(93,214,156,0.14)', border: '1px solid rgba(93,214,156,0.35)', color: 'var(--green)' },
    danger: { background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.35)', color: 'var(--red)' },
  }[variant];

  return {
    ...variants,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    padding: '9px 14px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: "'Inter Tight', sans-serif",
    textDecoration: 'none',
  };
}
