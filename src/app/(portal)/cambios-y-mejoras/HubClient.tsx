'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { HubData, HubTicketRow } from './actions';
import type { ClientTicketStatus } from '@/lib/tickets/billing';
import { ChangeRequestComposer } from './ChangeRequestComposer';

// ─── Status badge colors ───────────────────────────────────
const STATUS_COLORS: Record<ClientTicketStatus, string> = {
  draft: 'bg-neutral-500/10 text-neutral-400 border-neutral-400/20',
  submitted: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
  included: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  quote_requested: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
  quote_needs_info: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
  quote_priced: 'bg-purple-400/10 text-purple-400 border-purple-400/20',
  ready_to_pay: 'bg-orange-400/10 text-orange-400 border-orange-400/20',
  quote_declined: 'bg-neutral-500/10 text-neutral-400 border-neutral-400/20',
  quote_expired: 'bg-red-400/10 text-red-400 border-red-400/20',
  payment_pending: 'bg-orange-400/10 text-orange-400 border-orange-400/20',
  paid: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  in_progress: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  delivered: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  cancelled: 'bg-neutral-500/10 text-neutral-400 border-neutral-400/20',
  rejected: 'bg-neutral-500/10 text-neutral-400 border-neutral-400/20',
};

// ─── Helpers ───────────────────────────────────────────────
function formatDate(d: Date) {
  return new Date(d).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDomain(url: string | null) {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 40);
  }
}

// ─── Project selector ─────────────────────────────────────
function ProjectSelector({ hubData }: { hubData: HubData }) {
  const router = useRouter();
  if (hubData.projects.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 mb-6">
      <span className="text-xs text-white/40 font-inter-tight">Sitio:</span>
      <select
        className="bg-[#181920] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/80 font-inter-tight focus:outline-none focus:border-white/25 cursor-pointer"
        value={hubData.selectedProject?.id ?? ''}
        onChange={(e) => {
          const params = new URLSearchParams({ proyecto: e.target.value });
          router.push(`/cambios-y-mejoras?${params.toString()}`);
        }}
      >
        {hubData.projects.map((p) => (
          <option key={p.id} value={p.id}>
            {formatDomain(p.productionUrl) ?? p.plan}{' '}
            {p.status === 'LIVE' ? '✓' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────
function EmptyTickets() {
  return (
    <div className="text-center py-12">
      <p className="text-white/35 text-sm font-inter-tight mb-2">
        Aún no tienes solicitudes de cambio.
      </p>
      <p className="text-white/25 text-xs font-inter-tight">
        Describe lo que necesitas y te enviamos una cotización.
      </p>
    </div>
  );
}

// ─── Ticket row ───────────────────────────────────────────
function TicketRow({ ticket }: { ticket: HubTicketRow }) {
  const colorClass =
    STATUS_COLORS[ticket.clientStatus] ??
    'bg-neutral-500/10 text-neutral-400 border-neutral-400/20';

  const showPrice =
    ticket.priceAmount > 0 &&
    ['quote_priced', 'ready_to_pay', 'payment_pending', 'paid', 'delivered'].includes(ticket.clientStatus);

  return (
    <Link
      href={`/cambios-y-mejoras/${ticket.ticketNumber}`}
      className="group flex items-start justify-between gap-4 px-4 py-4 rounded-xl bg-white/[0.025] border border-white/[0.06] hover:bg-white/[0.045] hover:border-white/[0.10] transition-all duration-150"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-white/30 font-inter-tight tabular-nums">
            {ticket.ticketNumber}
          </span>
          {ticket.addonPublicName && (
            <span className="text-xs text-white/25 font-inter-tight">·</span>
          )}
          {ticket.addonPublicName && (
            <span className="text-xs text-white/30 font-inter-tight truncate">
              {ticket.addonPublicName}
            </span>
          )}
        </div>
        <p className="text-sm text-white/80 font-inter-tight leading-snug truncate mb-2">
          {ticket.title}
        </p>
        <p className="text-xs text-white/30 font-inter-tight">
          {formatDate(ticket.createdAt)}
        </p>
      </div>

      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-inter-tight border ${colorClass}`}
        >
          {ticket.clientStatusLabel}
        </span>
        {showPrice && (
          <span className="text-sm font-inter-tight text-white/60 tabular-nums">
            ${(ticket.priceAmount / 100).toFixed(0)} USD
          </span>
        )}
        <svg
          className="w-3.5 h-3.5 text-white/20 group-hover:text-white/40 transition-colors mt-auto"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </Link>
  );
}

// ─── Ticket list ──────────────────────────────────────────
function TicketList({ tickets }: { tickets: HubTicketRow[] }) {
  if (tickets.length === 0) return <EmptyTickets />;

  // paid es activo: el trabajo está pagado pero puede no haber comenzado aún
  const closed: ClientTicketStatus[] = ['delivered', 'cancelled', 'rejected', 'quote_expired', 'quote_declined'];
  const active = tickets.filter((t) => !closed.includes(t.clientStatus));
  const done = tickets.filter((t) => closed.includes(t.clientStatus));

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <div>
          <h3 className="text-xs font-inter-tight text-white/35 uppercase tracking-widest mb-3 px-1">
            En proceso
          </h3>
          <div className="space-y-2">
            {active.map((t) => (
              <TicketRow key={t.id} ticket={t} />
            ))}
          </div>
        </div>
      )}

      {done.length > 0 && (
        <div>
          <h3 className="text-xs font-inter-tight text-white/25 uppercase tracking-widest mb-3 px-1">
            Historial
          </h3>
          <div className="space-y-2 opacity-70">
            {done.map((t) => (
              <TicketRow key={t.id} ticket={t} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CTA según estado del proyecto ───────────────────────

function SuspendedBanner() {
  return (
    <div className="rounded-2xl bg-amber-400/[0.06] border border-amber-400/20 p-5 mb-6">
      <p className="text-sm font-clash-grotesk font-semibold text-amber-300/90 mb-1">
        Sitio suspendido
      </p>
      <p className="text-xs text-white/45 font-inter-tight leading-relaxed mb-3">
        Tu sitio está suspendido por un pago pendiente. Reactiva tu suscripción para poder enviar
        solicitudes de cambio.
      </p>
      <Link
        href="/facturacion"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/[0.06] border border-white/[0.10] text-sm text-white/75 font-inter-tight hover:bg-white/[0.10] hover:text-white/90 transition-all duration-150"
      >
        Ir a Facturación
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
          <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </div>
  );
}

function NotLiveBanner() {
  return (
    <div className="rounded-2xl bg-white/[0.025] border border-white/[0.06] p-5 mb-6">
      <p className="text-sm font-clash-grotesk font-semibold text-white/75 mb-1">
        Solicitudes no disponibles aún
      </p>
      <p className="text-xs text-white/40 font-inter-tight leading-relaxed mb-3">
        Las solicitudes de cambio estarán disponibles una vez que tu sitio esté publicado.
        Mientras tanto, contáctanos si tienes urgencias.
      </p>
      <Link
        href="/soporte"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/[0.06] border border-white/[0.10] text-sm text-white/75 font-inter-tight hover:bg-white/[0.10] hover:text-white/90 transition-all duration-150"
      >
        Ir a Soporte
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
          <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </div>
  );
}

// ─── Hub principal ────────────────────────────────────────
interface HubClientProps {
  hubData: HubData;
}

export function HubClient({ hubData }: HubClientProps) {
  const domainLabel = hubData.selectedProject
    ? formatDomain(hubData.selectedProject.productionUrl)
    : null;

  const noProject =
    hubData.projects.length === 0 || !hubData.selectedProject;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-clash-grotesk font-bold text-white/90 mb-1">
          Cambios y mejoras
        </h1>
        {domainLabel && (
          <p className="text-sm text-white/35 font-inter-tight">
            {domainLabel}
          </p>
        )}
      </div>

      {/* Project selector — solo si tiene varios proyectos */}
      <ProjectSelector hubData={hubData} />

      {noProject ? (
        <div className="text-center py-16">
          <p className="text-white/35 text-sm font-inter-tight">
            No tienes proyectos activos aún.
          </p>
        </div>
      ) : (
        <>
          {/* Nueva solicitud — gating por estado del proyecto */}
          {hubData.selectedProject!.status === 'LIVE' ? (
            <ChangeRequestComposer
              projectId={hubData.selectedProject!.id}
              projectPlan={hubData.selectedProject!.plan}
              productionUrl={hubData.selectedProject!.productionUrl}
            />
          ) : hubData.selectedProject!.status === 'SUSPENDED' ? (
            <SuspendedBanner />
          ) : (
            <NotLiveBanner />
          )}

          {/* Lista de solicitudes */}
          <div>
            <h2 className="text-xs font-inter-tight text-white/35 uppercase tracking-widest mb-4 px-1">
              Tus solicitudes
            </h2>
            <TicketList tickets={hubData.tickets} />
          </div>
        </>
      )}
    </div>
  );
}
