'use client';

import { useState, useRef, useEffect } from 'react';
import { Settings, ExternalLink, ChevronDown } from 'lucide-react';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { PlanBadge, type Plan } from '@/components/admin/PlanBadge';
import { SLABadge } from '@/components/admin/SLABadge';
import { PROJECT_STATUS_LABELS, type ProjectStatus } from '@/lib/projects/state-machine';

// Mensajes WhatsApp precompuestos por estado
function getWAMessage(
  status: ProjectStatus,
  firstName: string,
  stagingUrl: string | null,
  portalLink: string
): string {
  const messages: Partial<Record<ProjectStatus, string>> = {
    AWAITING_ASSETS: `Hola ${firstName}, soy Xavier. Ya activé tu proyecto WaaS. Para comenzar, necesito que subas tus materiales desde tu portal: ${portalLink}. ¿Tienes alguna duda?`,
    ASSETS_INCOMPLETE: `Hola ${firstName}, revisé tus materiales y hay ajustes necesarios. Los detalles están en tu portal: ${portalLink}. ¿Puedes revisarlo hoy?`,
    STAGING_REVIEW: `Hola ${firstName}, tu preview está listo: ${stagingUrl ?? ''}. Tienes 72h para enviarme feedback desde el portal: ${portalLink}.`,
    REVISIONS: `Hola ${firstName}, recibí tu feedback. Estoy aplicando los cambios, te aviso cuando el nuevo preview esté listo.`,
    PROPOSAL_SENT: `Hola ${firstName}, te envié una propuesta por email. ¿La recibiste?`,
    PROPOSAL_EXPIRED: `Hola ${firstName}, tu propuesta expiró pero puedo generarte una nueva. ¿Te parece si la actualizamos?`,
    SUSPENDED: `Hola ${firstName}, tu sitio está suspendido por un problema de pago. ¿Pudiste actualizar tu método de pago? ${portalLink}`,
  };
  return messages[status] ?? `Hola ${firstName}, soy Xavier. ¿En qué puedo ayudarte?`;
}

interface ProjectDetailHeaderProps {
  projectId: string;
  businessName: string;
  clientName: string;
  clientEmail: string;
  clientWhatsapp: string | null;
  status: ProjectStatus;
  statusLabel: string;
  plan: Plan;
  monthlyPriceCents: number;
  slaHours: number | null;
  stagingUrl: string | null;
  productionUrl: string | null;
  allowedTransitions: ProjectStatus[];
}

export function ProjectDetailHeader({
  businessName,
  clientName,
  clientEmail,
  clientWhatsapp,
  status,
  statusLabel,
  plan,
  monthlyPriceCents,
  slaHours,
  stagingUrl,
  productionUrl,
  allowedTransitions,
}: ProjectDetailHeaderProps) {
  const [stateDropOpen, setStateDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const portalLink = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://waas.app'}/dashboard`;
  const firstName = clientName.split(' ')[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setStateDropOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const waLink = clientWhatsapp
    ? `https://wa.me/${clientWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
        getWAMessage(status, firstName, stagingUrl, portalLink)
      )}`
    : null;

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
      {/* Fila 1: nombre + badges + SLA + dropdown */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-gray-900">{businessName}</h1>
          <StatusBadge status={status} label={statusLabel} />
          <PlanBadge plan={plan} showPrice priceCents={monthlyPriceCents} />
          <SLABadge hoursRemaining={slaHours} showLabel />
        </div>

        {/* Dropdown cambiar estado */}
        {allowedTransitions.length > 0 && (
          <div className="relative" ref={dropRef}>
            <button
              type="button"
              onClick={() => setStateDropOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Settings size={14} strokeWidth={1.5} />
              Cambiar estado
              <ChevronDown size={13} strokeWidth={1.5} className={stateDropOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            {stateDropOpen && (
              <div className="absolute right-0 top-full z-30 mt-1 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-md">
                <p className="px-3 py-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Transiciones válidas
                </p>
                {allowedTransitions.map((target) => (
                  <button
                    key={target}
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => {
                      // La acción real de cambio de estado se implementa en el server via tRPC
                      // Por ahora cierra el dropdown — la integración tRPC se hace en F6
                      setStateDropOpen(false);
                    }}
                  >
                    → {PROJECT_STATUS_LABELS[target] ?? target}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fila 2: contacto + links */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-600">
        <span>{clientName}</span>
        <span className="text-gray-300">·</span>
        <a href={`mailto:${clientEmail}`} className="hover:text-gray-900">
          {clientEmail}
        </a>

        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 hover:bg-green-100"
          >
            WhatsApp <ExternalLink size={11} strokeWidth={1.5} />
          </a>
        )}

        {stagingUrl && (
          <a
            href={stagingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-purple-600 hover:underline"
          >
            Ver staging <ExternalLink size={11} strokeWidth={1.5} />
          </a>
        )}

        {status === 'LIVE' && productionUrl && (
          <a
            href={productionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-green-600 hover:underline"
          >
            Ver sitio en vivo <ExternalLink size={11} strokeWidth={1.5} />
          </a>
        )}
      </div>
    </div>
  );
}
