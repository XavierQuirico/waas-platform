'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { TicketQuotePanel } from './TicketQuotePanel';
import { TicketPaymentPanel } from './TicketPaymentPanel';

export type TicketRow = {
  id: string;
  ticketNumber: string;
  addonCatalogId: string | null;
  addonCode: string | null;
  addonName: string | null;
  addonType: string;
  title: string;
  description: string;
  priceAmount: number;
  priceCurrency: string;
  billingDecision: string | null;
  quoteStatus: string;
  quoteRevision: number;
  quotedPriceCents: number | null;
  quoteScope: string | null;
  quoteEstimatedBusinessDays: number | null;
  quoteExpiresAt: string | null;
  quoteAcceptanceSource: string | null;
  status: string;
  createdBy: string;
  slaHours: number;
  dueAt: string | null;
  createdAt: string;
  approvedAt: string | null;
  paymentRequestedAt: string | null;
  paidAt: string | null;
  paidAmountCents: number | null;
  paidCurrency: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  startedAt: string | null;
  completedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  paypalOrderId: string | null;
  paypalOrderQuoteRevision: number | null;
  paypalOrderAmountCents: number | null;
  projectId: string;
  plan: string | null;
  clientId: string;
  productionUrl: string | null;
  domainTarget: string | null;
  clientName: string | null;
  businessName: string | null;
};

export type TicketProjectOption = {
  id: string;
  clientId: string;
  clientName: string;
  businessName: string;
  plan: string | null;
  productionUrl: string | null;
  domainTarget: string | null;
  label: string;
};

export type TicketAddonOption = {
  id: string;
  code: string;
  name: string;
  description: string;
  priceCents: number;
  category: string;
};

type Actions = {
  approveTicket: (ticketId: string) => Promise<{ ok: boolean }>;
  rejectTicket: (ticketId: string, reason: string) => Promise<{ ok: boolean }>;
  startWork: (ticketId: string) => Promise<{ ok: boolean }>;
  completeTicket: (ticketId: string) => Promise<{ ok: boolean }>;
  createTicket: (formData: FormData) => Promise<{ ok: boolean }>;
  sendTicketQuote: (
    ticketId: string,
    input: {
      quoteScope: string;
      priceCents: number;
      validityDays?: number;
      estimatedBusinessDays?: number;
      internalNote?: string;
    },
  ) => Promise<{ ok: boolean; newRevision?: number }>;
  recordTicketQuoteAcceptance: (
    ticketId: string,
    input: {
      acceptanceSource: 'whatsapp' | 'phone' | 'in_person' | 'other';
      expectedQuoteRevision: number;
      quoteScope?: string;
      priceCents?: number;
      validityDays?: number;
      estimatedBusinessDays?: number;
    },
  ) => Promise<{ ok: boolean }>;
  recordManualTicketPayment: (
    ticketId: string,
    input: {
      acceptanceSource: 'whatsapp' | 'phone' | 'in_person' | 'other';
      expectedQuoteRevision: number;
      paidAmountCents: number;
      paidCurrency: 'USD';
      paidAt: Date;
      paymentMethod: 'bank_transfer' | 'cash' | 'paypal_external' | 'other';
      paymentReference?: string;
      confirmExplicit: true;
      quoteScope?: string;
      priceCents?: number;
      validityDays?: number;
    },
  ) => Promise<{ ok: boolean }>;
  reconcileTicketPayPalPayment: (ticketId: string) => Promise<{
    ok: boolean;
    alreadyPaid?: boolean;
    status?: string;
    message?: string;
  }>;
};

const ADDON_LABELS: Record<string, string> = {
  QUICK_FIX: 'Arreglo rapido',
  NEW_BLOCK: 'Nuevo bloque',
  EXTRA_PAGE: 'Pagina extra',
  MOTION_ANIMATION: 'Animacion',
  COPYWRITING: 'Copywriting',
  SEO_BASICO: 'SEO Basico',
  INTEGRACION_BASICA: 'Integracion basica',
  INTEGRACION_AVANZADA: 'Integracion avanzada',
  CUSTOM: 'Personalizado',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  PENDING_APPROVAL: 'Pend. aprobacion',
  APPROVED: 'Aprobado',
  PAYMENT_PENDING: 'Pend. pago',
  PAID: 'Pagado',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completado',
  REJECTED: 'Rechazado',
  CANCELLED: 'Cancelado',
};

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'badge-neutral',
  PENDING_APPROVAL: 'badge-amber',
  APPROVED: 'badge-blue',
  PAYMENT_PENDING: 'badge-amber',
  PAID: 'badge-blue',
  IN_PROGRESS: 'badge-blue',
  COMPLETED: 'badge-green',
  REJECTED: 'badge-red',
  CANCELLED: 'badge-red',
};

const INCLUDED_BILLING_DECISIONS = new Set([
  'included_setup',
  'included_allowance',
  'included_warranty',
]);

function formatUSD(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(date: string | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('es-DO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getSLAHours(ticket: TicketRow): number {
  const reference = ticket.dueAt
    ? new Date(ticket.dueAt).getTime()
    : new Date(ticket.createdAt).getTime() + ticket.slaHours * 60 * 60 * 1000;
  return Math.round((reference - Date.now()) / (1000 * 60 * 60));
}

function SLAPill({ ticket }: { ticket: TicketRow }) {
  if (['COMPLETED', 'REJECTED', 'CANCELLED'].includes(ticket.status)) return null;

  const hours = getSLAHours(ticket);
  const cls = hours < 0 ? 'badge-red' : hours < 12 ? 'badge-amber' : 'badge-neutral';
  const label = hours < 0 ? `SLA +${Math.abs(hours)}h` : hours < 1 ? '<1h restante' : `${hours}h restantes`;
  return <span className={`${cls} badge-pill`}>{label}</span>;
}

function TicketDrawer({
  ticket,
  onClose,
  actions,
}: {
  ticket: TicketRow | null;
  onClose: () => void;
  actions: Actions;
}) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();

  if (!ticket) return null;

  const run = (action: () => Promise<unknown>, success = 'Accion completada.') => {
    setMessage('');
    startTransition(async () => {
      try {
        await action();
        setMessage(success);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'No se pudo completar la accion.');
      }
    });
  };

  const QUOTE_ACTIONS = {
    sendTicketQuote: actions.sendTicketQuote,
    recordTicketQuoteAcceptance: actions.recordTicketQuoteAcceptance,
  };
  const PAYMENT_ACTIONS = {
    recordManualTicketPayment: actions.recordManualTicketPayment,
    reconcileTicketPayPalPayment: actions.reconcileTicketPayPalPayment,
  };

  const actionPanel = {
    PENDING_APPROVAL: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Razon de rechazo (requerida si rechazas)..."
          rows={3}
          style={fieldStyle}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={buttonStyle('green')} disabled={isPending} onClick={() => run(() => actions.approveTicket(ticket.id), 'Ticket aprobado.')}>
            Aprobar ticket
          </button>
          <button style={buttonStyle('danger')} disabled={isPending} onClick={() => run(() => actions.rejectTicket(ticket.id, note), 'Ticket rechazado.')}>
            Rechazar
          </button>
        </div>
      </div>
    ),
    APPROVED: INCLUDED_BILLING_DECISIONS.has(ticket.billingDecision ?? '') ? (
      <button style={buttonStyle('primary')} disabled={isPending} onClick={() => run(() => actions.startWork(ticket.id), 'Trabajo iniciado.')}>
        Iniciar trabajo incluido
      </button>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <TicketQuotePanel ticket={ticket} actions={QUOTE_ACTIONS} />
        <TicketPaymentPanel ticket={ticket} actions={PAYMENT_ACTIONS} />
      </div>
    ),
    PAYMENT_PENDING: (
      <TicketPaymentPanel ticket={ticket} actions={PAYMENT_ACTIONS} />
    ),
    PAID: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <TicketPaymentPanel ticket={ticket} actions={PAYMENT_ACTIONS} />
        <button style={buttonStyle('primary')} disabled={isPending} onClick={() => run(() => actions.startWork(ticket.id), 'Trabajo iniciado.')}>
          Iniciar trabajo
        </button>
      </div>
    ),
    IN_PROGRESS: (
      <button style={buttonStyle('green')} disabled={isPending} onClick={() => run(() => actions.completeTicket(ticket.id), 'Ticket completado.')}>
        Marcar como completado
      </button>
    ),
  }[ticket.status];

  const timeline = [
    { title: 'Ticket creado', time: ticket.createdAt },
    ticket.approvedAt && { title: 'Aprobado por Xavier', time: ticket.approvedAt },
    ticket.paymentRequestedAt && { title: 'Pago solicitado', time: ticket.paymentRequestedAt },
    ticket.paidAt && { title: 'Pago recibido', time: ticket.paidAt },
    ticket.startedAt && { title: 'Trabajo iniciado', time: ticket.startedAt },
    ticket.completedAt && { title: 'Completado', time: ticket.completedAt },
    ticket.rejectedAt && { title: 'Rechazado', time: ticket.rejectedAt },
  ].filter(Boolean) as Array<{ title: string; time: string }>;

  return (
    <div style={drawerBackdropStyle}>
      <aside style={drawerStyle}>
        <div style={{ padding: 24, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: "'Inter Tight', sans-serif", marginBottom: 4 }}>
                {ticket.ticketNumber}
              </div>
              <div style={{ fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>
                {ticket.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 2 }}>
                {ticket.businessName ?? ticket.clientName ?? '-'} - {ticket.plan ?? 'Sin plan'}
              </div>
            </div>
            <button onClick={onClose} style={iconButtonStyle}>x</button>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className={`${STATUS_BADGE[ticket.status] ?? 'badge-neutral'} badge-pill`}>
              {STATUS_LABELS[ticket.status] ?? ticket.status}
            </span>
            <span style={{ fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 700, fontSize: 20, color: 'var(--amber)', marginLeft: 8 }}>
              {formatUSD(ticket.priceAmount)}
            </span>
            <SLAPill ticket={ticket} />
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <section>
            <div style={eyebrowStyle}>Descripcion</div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, margin: 0 }}>{ticket.description || '-'}</p>
          </section>
          {[
            ['Add-on', ticket.addonName ?? ADDON_LABELS[ticket.addonType] ?? ticket.addonType],
            ['Código catálogo', ticket.addonCode ?? 'Sin vínculo'],
            ['Creado por', ticket.createdBy === 'ADMIN' ? 'Xavier' : 'Cliente'],
            ['Fecha', formatDate(ticket.createdAt)],
            ['Proyecto', ticket.businessName ?? ticket.clientName ?? '-'],
            ['PayPal Order', ticket.paypalOrderId ?? '-'],
            ['Rechazo', ticket.rejectionReason ?? '-'],
          ].map(([key, value]) => (
            <div key={key} style={detailRowStyle}>
              <span style={{ color: 'var(--text-3)' }}>{key}</span>
              <span style={{ color: 'var(--text)', fontWeight: 500, textAlign: 'right' }}>{value}</span>
            </div>
          ))}
          <Divider label="Timeline" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {timeline.map((event) => (
              <div key={`${event.title}-${event.time}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
                <span style={{ color: 'var(--text)' }}>{event.title}</span>
                <span style={{ color: 'var(--text-3)' }}>{formatDate(event.time)}</span>
              </div>
            ))}
          </div>
          {actionPanel && (
            <>
              <Divider label="Acciones" />
              {actionPanel}
              {message && <div style={{ fontSize: 12, color: message.startsWith('No ') ? 'var(--red)' : 'var(--text-2)' }}>{message}</div>}
            </>
          )}
        </div>
      </aside>
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

export default function TicketsPageClient({
  initialRows,
  projects,
  addons,
  approveTicket,
  rejectTicket,
  startWork,
  completeTicket,
  createTicket,
  sendTicketQuote,
  recordTicketQuoteAcceptance,
  recordManualTicketPayment,
  reconcileTicketPayPalPayment,
}: {
  initialRows: TicketRow[];
  projects: TicketProjectOption[];
  addons: TicketAddonOption[];
  approveTicket: Actions['approveTicket'];
  rejectTicket: Actions['rejectTicket'];
  startWork: Actions['startWork'];
  completeTicket: Actions['completeTicket'];
  createTicket: Actions['createTicket'];
  sendTicketQuote: Actions['sendTicketQuote'];
  recordTicketQuoteAcceptance: Actions['recordTicketQuoteAcceptance'];
  recordManualTicketPayment: Actions['recordManualTicketPayment'];
  reconcileTicketPayPalPayment: Actions['reconcileTicketPayPalPayment'];
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<TicketRow | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [formMessage, setFormMessage] = useState('');
  const [isPending, startTransition] = useTransition();
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedAddonId, setSelectedAddonId] = useState('');
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketPrice, setTicketPrice] = useState('');

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return initialRows.filter((ticket) => {
      const haystack = [
        ticket.ticketNumber,
        ticket.title,
        ticket.description,
        ticket.clientName,
        ticket.businessName,
        ticket.addonName ?? ADDON_LABELS[ticket.addonType],
      ].join(' ').toLowerCase();
      return (!needle || haystack.includes(needle)) && (!statusFilter || ticket.status === statusFilter);
    });
  }, [initialRows, search, statusFilter]);

  const kpis = [
    { label: 'Pendientes aprobacion', value: initialRows.filter((ticket) => ticket.status === 'PENDING_APPROVAL').length, color: 'var(--amber)' },
    { label: 'En progreso', value: initialRows.filter((ticket) => ticket.status === 'IN_PROGRESS').length, color: '#6B9FFF' },
    { label: 'Completados este mes', value: initialRows.filter((ticket) => ticket.status === 'COMPLETED').length, color: 'var(--green)' },
  ];

  const clientOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    projects.forEach((project) => {
      if (project.clientId && !map.has(project.clientId)) {
        map.set(project.clientId, {
          id: project.clientId,
          label: project.clientName,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [projects]);

  const projectsForClient = useMemo(
    () => projects.filter((project) => project.clientId === selectedClientId),
    [projects, selectedClientId],
  );

  const selectedAddon = addons.find((addon) => addon.id === selectedAddonId);

  useEffect(() => {
    if (selectedClientId && projectsForClient.length === 1) {
      setSelectedProjectId(projectsForClient[0].id);
    }
    if (!selectedClientId) {
      setSelectedProjectId('');
    }
  }, [projectsForClient, selectedClientId]);

  function resetTicketForm() {
    setSelectedClientId('');
    setSelectedProjectId('');
    setSelectedAddonId('');
    setTicketTitle('');
    setTicketDescription('');
    setTicketPrice('');
    setFormMessage('');
  }

  function handleAddonSelect(addonId: string) {
    setSelectedAddonId(addonId);
    const addon = addons.find((item) => item.id === addonId);
    if (!addon) return;
    setTicketTitle(addon.name);
    setTicketDescription(addon.description);
    setTicketPrice(String(Math.round(addon.priceCents / 100)));
  }

  const submitTicket = (formData: FormData) => {
    setFormMessage('');
    startTransition(async () => {
      try {
        await createTicket(formData);
        setShowNewModal(false);
        router.refresh();
      } catch (error) {
        setFormMessage(error instanceof Error ? error.message : 'No se pudo crear el ticket.');
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '28px 32px 0', flexShrink: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 20 }}>
          {kpis.map((kpi) => (
            <div key={kpi.label} style={cardStyle}>
              <div style={{ fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 700, fontSize: 32, color: kpi.color, lineHeight: 1 }}>
                {kpi.value}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>{kpi.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 800, fontSize: 24, color: 'var(--text)', margin: 0 }}>
              Tickets & Add-ons
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>SLA estandar: 48 horas</p>
          </div>
          <button
            style={buttonStyle('primary')}
            onClick={() => {
              resetTicketForm();
              setShowNewModal(true);
            }}
          >
            + Nuevo ticket
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por cliente o descripcion..." style={fieldStyle} />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ ...fieldStyle, maxWidth: 220 }}>
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '0 32px 32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((ticket) => (
            <button key={ticket.id} onClick={() => setSelected(ticket)} className="ticket-card-row" style={rowStyle}>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontFamily: "'Inter Tight', sans-serif", color: 'var(--text-3)' }}>{ticket.ticketNumber}</span>
                  <span className={`${STATUS_BADGE[ticket.status] ?? 'badge-neutral'} badge-pill`}>{STATUS_LABELS[ticket.status] ?? ticket.status}</span>
                  <SLAPill ticket={ticket} />
                </div>
                <div style={{ fontFamily: "'Inter Tight', sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>
                  {ticket.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {ticket.businessName ?? ticket.clientName ?? '-'} - {ticket.addonName ?? ADDON_LABELS[ticket.addonType] ?? ticket.addonType}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--amber)' }}>
                  {formatUSD(ticket.priceAmount)}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
                  Por: {ticket.createdBy === 'ADMIN' ? 'Xavier' : 'Cliente'}
                </div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>No hay tickets con esos filtros.</div>}
        </div>
      </div>

      <TicketDrawer
        ticket={selected}
        onClose={() => setSelected(null)}
        actions={{
          approveTicket,
          rejectTicket,
          startWork,
          completeTicket,
          createTicket,
          sendTicketQuote,
          recordTicketQuoteAcceptance,
          recordManualTicketPayment,
          reconcileTicketPayPalPayment,
        }}
      />

      {showNewModal && (
        <div style={modalBackdropStyle}>
          <form action={submitTicket} style={modalStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: "'Clash Grotesk', sans-serif", fontSize: 18, margin: 0, color: 'var(--text)' }}>Nuevo Ticket</h2>
              <button type="button" onClick={() => setShowNewModal(false)} style={iconButtonStyle}>x</button>
            </div>
            <div style={{ padding: '10px 12px', background: 'rgba(255,140,0,0.08)', border: '1px solid rgba(255,140,0,0.18)', borderRadius: 10, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
              Los tickets solo se crean sobre proyectos activos. Primero el cliente, luego su sitio, luego el add-on real del catálogo.
            </div>
            <label style={labelStyle}>Cliente</label>
            <select
              required
              value={selectedClientId}
              onChange={(event) => {
                setSelectedClientId(event.target.value);
                setSelectedProjectId('');
              }}
              style={fieldStyle}
            >
              <option value="">Seleccionar cliente...</option>
              {clientOptions.map((client) => <option key={client.id} value={client.id}>{client.label}</option>)}
            </select>
            <label style={labelStyle}>Proyecto / sitio activo</label>
            <select
              name="projectId"
              required
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              disabled={!selectedClientId}
              style={{ ...fieldStyle, opacity: selectedClientId ? 1 : 0.55 }}
            >
              <option value="">{selectedClientId ? 'Seleccionar sitio...' : 'Selecciona un cliente primero'}</option>
              {projectsForClient.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.businessName} - {project.plan} - {project.productionUrl ?? project.domainTarget ?? 'sin URL'}
                </option>
              ))}
            </select>
            {selectedClientId && projectsForClient.length === 0 && (
              <div style={{ fontSize: 12, color: '#F87171', fontFamily: "'Inter Tight', sans-serif" }}>
                Este cliente no tiene proyectos activos. No se puede crear un ticket hasta publicar un sitio.
              </div>
            )}
            <label style={labelStyle}>Add-on del catálogo</label>
            <select
              name="addonCatalogId"
              required
              value={selectedAddonId}
              onChange={(event) => handleAddonSelect(event.target.value)}
              style={fieldStyle}
            >
              <option value="">Seleccionar add-on...</option>
              {addons.map((addon) => <option key={addon.id} value={addon.id}>{addon.code} - {addon.name} (${Math.round(addon.priceCents / 100)})</option>)}
            </select>
            {selectedAddon && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{selectedAddon.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{selectedAddon.description || 'Sin descripción registrada.'}</div>
                </div>
                <div style={{ fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 700, color: 'var(--amber)' }}>
                  ${Math.round(selectedAddon.priceCents / 100)}
                </div>
              </div>
            )}
            <input name="addonCode" type="hidden" value={selectedAddon?.code ?? ''} />
            <input name="addonName" type="hidden" value={selectedAddon?.name ?? ''} />
            <label style={labelStyle}>Titulo</label>
            <input name="title" required value={ticketTitle} onChange={(event) => setTicketTitle(event.target.value)} placeholder="Nombre corto del trabajo" style={fieldStyle} />
            <label style={labelStyle}>Descripcion</label>
            <textarea name="description" value={ticketDescription} onChange={(event) => setTicketDescription(event.target.value)} placeholder="Describe el trabajo..." rows={3} style={fieldStyle} />
            <label style={labelStyle}>Precio USD</label>
            <input name="price" required min="1" step="0.01" value={ticketPrice} onChange={(event) => setTicketPrice(event.target.value)} placeholder="99" type="number" style={fieldStyle} />
            {formMessage && <div style={{ fontSize: 12, color: 'var(--red)' }}>{formMessage}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" style={buttonStyle('secondary')} onClick={() => setShowNewModal(false)}>Cancelar</button>
              <button type="submit" style={buttonStyle('primary')} disabled={isPending}>Crear ticket</button>
            </div>
          </form>
        </div>
      )}

      <style>{`
        .ticket-card-row:hover {
          border-color: rgba(255,140,0,0.3) !important;
          background: var(--surface-2) !important;
        }
      `}</style>
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.22)' };
const rowStyle: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.15s', width: '100%', font: 'inherit' };
const fieldStyle: React.CSSProperties = { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '10px 12px', fontSize: 13, fontFamily: "'Inter Tight', sans-serif" };
const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 8 };
const eyebrowStyle: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' };
const detailRowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 16, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 12 };
const drawerBackdropStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', justifyContent: 'flex-end', zIndex: 50 };
const drawerStyle: React.CSSProperties = { width: '50%', minWidth: 420, maxWidth: 760, height: '100%', background: 'var(--bg)', boxShadow: '-10px 0 30px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column' };
const modalBackdropStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'grid', placeItems: 'center', zIndex: 60 };
const modalStyle: React.CSSProperties = { width: 'min(560px, calc(100vw - 32px))', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 20, display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 20px 50px rgba(0,0,0,0.45)' };
const iconButtonStyle: React.CSSProperties = { background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 18, padding: 8 };

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
  };
}
