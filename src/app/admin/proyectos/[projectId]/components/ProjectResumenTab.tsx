import { ArrowRight, Paperclip, Mail, StickyNote, AlertCircle, CheckCircle2, CreditCard } from 'lucide-react';
import type { ProjectEvent } from '@/db/schema';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return `hace ${Math.floor(diff / 86400)}d`;
}

function formatDate(date: Date | null): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('es-DO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Santo_Domingo',
  }).format(new Date(date));
}

const EVENT_ICONS: Record<string, React.ElementType> = {
  status_changed:              ArrowRight,
  asset_uploaded:              Paperclip,
  asset_approved:              CheckCircle2,
  asset_rejected:              AlertCircle,
  assets_submitted_for_review: Paperclip,
  production_started:          CheckCircle2,
  staging_deployed:            ArrowRight,
  staging_feedback_submitted:  StickyNote,
  revision_completed:          CheckCircle2,
  proposal_sent:               Mail,
  proposal_expired:            AlertCircle,
  comment_added:               StickyNote,
  email_sent:                  Mail,
  payment_received:            CreditCard,
};

const EVENT_LABELS: Record<string, string> = {
  status_changed:              'Estado cambiado',
  asset_uploaded:              'Asset subido',
  asset_approved:              'Asset aprobado',
  asset_rejected:              'Asset rechazado',
  assets_submitted_for_review: 'Assets enviados a revisión',
  production_started:          'Producción iniciada',
  staging_deployed:            'Staging desplegado',
  staging_feedback_submitted:  'Feedback de staging enviado',
  revision_completed:          'Revisión completada',
  proposal_sent:               'Propuesta enviada',
  proposal_expired:            'Propuesta expirada',
  comment_added:               'Comentario agregado',
  email_sent:                  'Email enviado',
  payment_received:            'Pago recibido',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProjectResumenTabProps {
  project: {
    id: string;
    plan: string;
    monthlyPriceCents: number;
    createdAt: Date;
    productionDeadlineAt: Date | null;
    stagingUrl: string | null;
    productionUrl: string | null;
    internalNotes: string | null;
  };
  client: {
    fullName: string;
    email: string;
    whatsapp: string | null;
    businessName: string;
  };
  events: ProjectEvent[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProjectResumenTab({ project, client, events }: ProjectResumenTabProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

      {/* Timeline — 2/3 del ancho */}
      <div className="lg:col-span-2">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Historial de actividad</h2>

        {events.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 py-8 text-center">
            <p className="text-sm text-gray-400">Sin actividad registrada aún.</p>
          </div>
        ) : (
          <div className="space-y-0">
            {events.map((event, i) => {
              const Icon = EVENT_ICONS[event.eventType] ?? ArrowRight;
              const label = EVENT_LABELS[event.eventType] ?? event.eventType;
              const desc =
                event.fromStatus && event.toStatus
                  ? `${label}: ${event.fromStatus} → ${event.toStatus}`
                  : label;

              return (
                <div key={event.id} className="flex gap-3">
                  {/* Línea vertical */}
                  <div className="flex flex-col items-center">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white">
                      <Icon size={12} strokeWidth={1.5} className="text-gray-500" />
                    </div>
                    {i < events.length - 1 && (
                      <div className="w-px flex-1 bg-gray-100 my-0.5" style={{ minHeight: 16 }} />
                    )}
                  </div>

                  {/* Contenido */}
                  <div className="pb-4 pt-1">
                    <p className="text-sm text-gray-700">{desc}</p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {event.actorType === 'admin' ? 'Xavier' : event.actorType === 'system' ? 'Sistema' : 'Cliente'}
                      {' · '}
                      {timeAgo(event.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info panel — 1/3 */}
      <div className="space-y-4">
        {/* Datos del cliente */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Cliente</h3>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-gray-400">Nombre</dt>
              <dd className="text-gray-800">{client.fullName}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Email</dt>
              <dd>
                <a href={`mailto:${client.email}`} className="text-blue-600 hover:underline">
                  {client.email}
                </a>
              </dd>
            </div>
            {client.whatsapp && (
              <div>
                <dt className="text-xs text-gray-400">WhatsApp</dt>
                <dd className="text-gray-800">{client.whatsapp}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-gray-400">Negocio</dt>
              <dd className="text-gray-800">{client.businessName}</dd>
            </div>
          </dl>
        </div>

        {/* Datos del proyecto */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Proyecto</h3>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-gray-400">Plan</dt>
              <dd className="text-gray-800">
                {project.plan} · ${(project.monthlyPriceCents / 100).toFixed(0)}/mes
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Creado</dt>
              <dd className="text-gray-800">{formatDate(project.createdAt)}</dd>
            </div>
            {project.productionDeadlineAt && (
              <div>
                <dt className="text-xs text-gray-400">Deadline producción</dt>
                <dd className="text-gray-800">{formatDate(project.productionDeadlineAt)}</dd>
              </div>
            )}
            {project.stagingUrl && (
              <div>
                <dt className="text-xs text-gray-400">URL Staging</dt>
                <dd>
                  <a href={project.stagingUrl} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-blue-600 hover:underline">
                    {project.stagingUrl}
                  </a>
                </dd>
              </div>
            )}
            {project.productionUrl && (
              <div>
                <dt className="text-xs text-gray-400">URL Producción</dt>
                <dd>
                  <a href={project.productionUrl} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-green-600 hover:underline">
                    {project.productionUrl}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Nota rápida */}
        {project.internalNotes && (
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-600">Nota interna</h3>
            <p className="text-sm text-amber-800 line-clamp-3">{project.internalNotes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
