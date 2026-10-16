'use client';

// Banner de estado del proyecto en el portal del cliente
// 6 estados distintos con UX apropiado para cada uno
// Refactorizado a Emil Kowalski Premium UI / Brandbook Tokens

import Link from 'next/link';
import type { ProjectStatus } from '@/lib/projects/state-machine';
import { DashboardCard } from '@/components/ui/DashboardCard';
import { whatsappUrl } from '@/lib/config/contact';

interface ProjectStatusBannerProps {
  projectId: string;
  status: ProjectStatus;
  plan: string;
  deadlineLabel: string | null;
  stagingUrl: string | null;
  stagingReviewDeadline: string | null;
  liveUrl: string | null;
}

export function ProjectStatusBanner({
  projectId,
  status,
  deadlineLabel,
  stagingUrl,
  stagingReviewDeadline,
  liveUrl,
}: ProjectStatusBannerProps) {
  // Animación base de entrada Emil Kowalski
  const animateInClasses = "animate-in zoom-in-95 fade-in duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]";
  
  // Micro-interacción estandar de botones
  const buttonActiveClasses = "active:scale-95 transition-all duration-300";

  switch (status) {
    case 'DRAFT':
    case 'PROPOSAL_SENT':
    case 'REQUIRES_REVIEW':
      return (
        <DashboardCard className={`border-brand-amber/20 bg-brand-amber/10 ${animateInClasses}`}>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-amber/10 text-brand-amber">
              <span className="text-lg">📋</span>
            </div>
            <div>
              <h2 className="font-medium text-brand-amber font-headline">Propuesta en preparación</h2>
              <p className="mt-1 text-sm text-brand-secondary font-body">
                Xavier está preparando tu propuesta personalizada. Recibirás un email
                con los detalles en las próximas horas.
              </p>
              <p className="mt-2 text-xs text-brand-muted font-body">
                ¿Tienes preguntas? Escríbele por{' '}
                <a href={whatsappUrl()} className={`underline text-brand-secondary hover:text-brand-primary ${buttonActiveClasses}`}>
                  WhatsApp
                </a>
                .
              </p>
            </div>
          </div>
        </DashboardCard>
      );

    case 'PROPOSAL_EXPIRED':
      return (
        <DashboardCard className={animateInClasses}>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-surface-2 text-brand-muted">
              <span className="text-lg">⏰</span>
            </div>
            <div>
              <h2 className="font-medium text-brand-secondary font-headline">Tu propuesta expiró</h2>
              <p className="mt-1 text-sm text-brand-muted font-body">
                La propuesta que te enviamos ya no está activa. Si aún te interesa,
                escríbele a Xavier para recibir una nueva.
              </p>
              <a
                href={whatsappUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className={`mt-3 inline-block rounded-lg border border-brand-subtle bg-brand-surface-2 px-5 py-2.5 text-sm font-medium text-brand-secondary hover:bg-brand-surface-2/80 hover:text-brand-primary ${buttonActiveClasses}`}
              >
                Contactar a Xavier →
              </a>
            </div>
          </div>
        </DashboardCard>
      );

    case 'PAYMENT_RECEIVED':
      return (
        <DashboardCard className={`border-brand-cobalt/20 bg-brand-cobalt/10 ${animateInClasses}`}>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-cobalt/20 text-brand-cobalt">
              <span className="text-lg">✓</span>
            </div>
            <div>
              <h2 className="font-medium text-brand-cobalt font-headline">Pago recibido — preparando tu proyecto</h2>
              <p className="mt-1 text-sm text-brand-secondary font-body">
                Tu pago fue procesado. Xavier está configurando tu proyecto y en breve
                recibirás acceso para subir tus materiales.
              </p>
              <p className="mt-2 text-xs text-brand-muted font-body">
                Tiempo estimado: menos de 24 horas hábiles.
              </p>
            </div>
          </div>
        </DashboardCard>
      );

    case 'AWAITING_ASSETS':
      return (
        <div className={`space-y-4 ${animateInClasses}`}>
          <DashboardCard className="border-brand-amber/20 bg-brand-amber/10">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-amber/20 text-brand-amber">
                <span className="text-lg">⚡</span>
              </div>
              <div>
                <h2 className="font-medium text-brand-amber font-headline">
                  Sube tus materiales para arrancar
                </h2>
                <p className="mt-1 text-sm text-brand-secondary font-body">
                  Necesito tu logo, fotos y colores para construir tu sitio. Sin ellos no puedo empezar.
                </p>
                <Link
                  href="/onboarding/assets"
                  className={`mt-4 inline-block rounded-lg bg-brand-amber px-5 py-2.5 text-sm font-medium text-black font-headline hover:bg-brand-amber/90 ${buttonActiveClasses}`}
                >
                  Ver qué necesito subir →
                </Link>
              </div>
            </div>
          </DashboardCard>

          <DashboardCard>
            <h3 className="text-sm font-medium text-brand-secondary font-headline">
              ¿Por qué esperamos tus materiales antes de empezar?
            </h3>
            <p className="mt-2 text-sm text-brand-muted font-body">
              Tu sitio se construirá con tu identidad real — tu logo, tus fotos, tu
              paleta. Empezar sin ellos significaría hacerlo dos veces.
            </p>
            <p className="mt-2 text-sm text-brand-muted font-body">
              Una vez que confirme que todo está listo, tu contador de{' '}
              <strong className="text-brand-secondary">72 horas hábiles</strong> arranca
              y no se detiene hasta que tu sitio esté listo.
            </p>
            {/* Progreso visual mejorado */}
            <div className="mt-4 flex items-center gap-3 text-xs text-brand-muted">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-brand-amber animate-pulse" />
                <span className="font-medium text-brand-secondary">Materiales</span>
              </div>
              <div className="h-px flex-1 bg-brand-subtle" />
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-brand-subtle" />
                <span>Producción</span>
              </div>
              <div className="h-px flex-1 bg-brand-subtle" />
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-brand-subtle" />
                <span>Listo</span>
              </div>
            </div>
          </DashboardCard>
        </div>
      );

    case 'ASSETS_SUBMITTED':
    case 'ASSETS_UNDER_REVIEW':
      return (
        <DashboardCard className={`border-brand-cobalt/20 bg-brand-cobalt/10 ${animateInClasses}`}>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-cobalt/20 text-brand-cobalt">
              <span className="text-lg">✓</span>
            </div>
            <div>
              <h2 className="font-medium text-brand-cobalt font-headline">Materiales recibidos</h2>
              <p className="mt-1 text-sm text-brand-secondary font-body">
                Xavier está revisando todo. Recibirás un email cuando confirmemos
                que todo está listo.
              </p>
              <p className="mt-2 text-xs text-brand-muted font-body">
                Tiempo estimado: menos de 24 horas hábiles.
              </p>
            </div>
          </div>
        </DashboardCard>
      );

    case 'ASSETS_INCOMPLETE':
      return (
        <DashboardCard className={`border-brand-amber/20 bg-brand-amber/10 ${animateInClasses}`}>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-amber/20 text-brand-amber">
              <span className="text-lg">⚠</span>
            </div>
            <div>
              <h2 className="font-medium text-brand-amber font-headline">
                Necesito algunos ajustes
              </h2>
              <p className="mt-1 text-sm text-brand-secondary font-body">
                Revisé tus materiales y hay algunas cosas que necesito que me
                envíes nuevamente. Te dejé comentarios específicos en cada item.
              </p>
              <Link
                href="/onboarding/assets"
                className={`mt-4 inline-block rounded-lg bg-brand-amber px-5 py-2.5 text-sm font-medium text-black font-headline hover:bg-brand-amber/90 shadow-[0_0_15px_rgba(255,140,0,0.3)] ${buttonActiveClasses}`}
              >
                Ver qué necesita ajuste →
              </Link>
            </div>
          </div>
        </DashboardCard>
      );

    case 'PRODUCTION_STARTED':
      return (
        <DashboardCard className={`border-brand-cobalt/20 bg-brand-cobalt/10 ${animateInClasses}`}>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-cobalt/20 text-brand-cobalt">
              <span className="text-lg">🔨</span>
            </div>
            <div className="flex-1">
              <h2 className="font-medium text-brand-cobalt font-headline">Tu sitio está en producción</h2>
              {deadlineLabel ? (
                <p className="mt-1 text-sm text-brand-secondary font-body">
                  Preview estimado para el{' '}
                  <strong className="text-brand-primary">{deadlineLabel}</strong>.
                  El plazo de entrega es de 72 horas hábiles.
                </p>
              ) : (
                <p className="mt-1 text-sm text-brand-secondary font-body">
                  Recibirás tu primer preview en un máximo de{' '}
                  <strong className="text-brand-primary">72 horas hábiles</strong>.
                </p>
              )}
            </div>
          </div>
        </DashboardCard>
      );

    case 'STAGING_REVIEW':
      return (
        <DashboardCard className={`border-brand-deepViolet/20 bg-brand-deepViolet/10 ${animateInClasses}`}>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-deepViolet/20 text-brand-deepViolet">
              <span className="text-lg">👀</span>
            </div>
            <div>
              <h2 className="font-medium text-brand-deepViolet font-headline">
                Tu preview está listo — revísalo y dime qué cambiamos
              </h2>
              <p className="mt-1 text-sm text-brand-secondary font-body">
                Visita el preview, anota cualquier cambio y envíame tu feedback directamente desde el portal.
              </p>
              {stagingReviewDeadline && (
                <p className="mt-1 text-xs text-brand-muted font-body">
                  Tienes hasta el <strong className="text-brand-secondary">{stagingReviewDeadline}</strong> para enviar tus comentarios (72 horas hábiles).
                </p>
              )}
              <div className="mt-4 flex gap-3">
                {stagingUrl && (
                  <a
                    href={stagingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-block rounded-lg bg-brand-deepViolet px-5 py-2.5 text-sm font-medium text-white font-headline hover:bg-brand-deepViolet/90 shadow-[0_0_15px_rgba(91,45,142,0.5)] ${buttonActiveClasses}`}
                  >
                    Ver preview →
                  </a>
                )}
                <Link
                  href={`/proyecto/${projectId}/staging`}
                  className={`inline-block rounded-lg border border-brand-deepViolet/30 px-5 py-2.5 text-sm font-medium text-brand-deepViolet font-headline hover:bg-brand-deepViolet/10 hover:border-brand-deepViolet/50 ${buttonActiveClasses}`}
                >
                  Enviar feedback
                </Link>
              </div>
            </div>
          </div>
        </DashboardCard>
      );

    case 'REVISIONS':
      return (
        <DashboardCard className={`border-brand-deepViolet/20 bg-brand-deepViolet/10 ${animateInClasses}`}>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-deepViolet/20 text-brand-deepViolet">
              <span className="text-lg">🔧</span>
            </div>
            <div>
              <h2 className="font-medium text-brand-deepViolet font-headline">Aplicando tus cambios...</h2>
              <p className="mt-1 text-sm text-brand-secondary font-body">
                Xavier está aplicando los ajustes que solicitaste. Te avisaremos cuando
                el nuevo preview esté listo para revisión.
              </p>
            </div>
          </div>
        </DashboardCard>
      );

    case 'REVISIONS_DONE':
      return (
        <DashboardCard className={`border-brand-deepViolet/20 bg-brand-deepViolet/10 ${animateInClasses}`}>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-deepViolet/20 text-brand-deepViolet">
              <span className="text-lg">✓</span>
            </div>
            <div>
              <h2 className="font-medium text-brand-deepViolet font-headline">Revisiones listas — preparando nuevo preview</h2>
              <p className="mt-1 text-sm text-brand-secondary font-body">
                Xavier terminó de aplicar tus cambios. En breve recibirás un nuevo
                preview para aprobación final.
              </p>
            </div>
          </div>
        </DashboardCard>
      );

    case 'LIVE':
      // The vivid green from our brandbook is mapped to text-success-500
      return (
        <DashboardCard className={`border-success-500/20 bg-success-500/10 ${animateInClasses}`}>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-500/20">
              <span className="w-4 h-4 rounded-full bg-success-500 animate-[pulse_2s_ease-in-out_infinite]" />
            </div>
            <div className="flex-1">
              <h2 className="font-medium text-success-500 font-headline">Tu sitio está en vivo.</h2>
              {liveUrl && (
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-1 block text-sm text-success-600 underline hover:text-success-500 ${buttonActiveClasses}`}
                >
                  {liveUrl}
                </a>
              )}
              <p className="mt-2 text-sm text-brand-secondary font-body">
                ¿Necesitas un cambio o tienes algún problema? Puedes reportarlo desde el portal
                o escribirle a Xavier por{' '}
                <a href={whatsappUrl()} className={`font-medium underline text-brand-secondary hover:text-brand-primary ${buttonActiveClasses}`}>
                  WhatsApp
                </a>
                .
              </p>
              <Link
                href={`/proyecto/${projectId}/incidencias`}
                className={`mt-3 inline-block rounded-lg border border-success-500/30 px-4 py-2 text-sm font-medium text-success-500 font-headline hover:bg-success-500/10 hover:border-success-500/50 ${buttonActiveClasses}`}
              >
                Ver incidencias →
              </Link>
            </div>
          </div>
        </DashboardCard>
      );

    case 'SUSPENDED':
      return (
        <DashboardCard className={`border-error-500/20 bg-error-500/10 ${animateInClasses}`}>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-error-500/20 text-error-500">
              <span className="text-lg">⚠</span>
            </div>
            <div>
              <h2 className="font-medium text-error-500 font-headline">
                Tu suscripción tiene un problema de pago
              </h2>
              <p className="mt-1 text-sm text-brand-secondary font-body">
                Actualiza tu método de pago para restablecer el acceso a tu sitio.
                Tienes 3 días de gracia antes de la suspensión total.
              </p>
              <a
                href="/facturacion"
                className={`mt-4 inline-block rounded-lg bg-error-500 px-5 py-2.5 text-sm font-medium text-white font-headline hover:bg-error-600 shadow-[0_0_15px_rgba(239,68,68,0.3)] ${buttonActiveClasses}`}
              >
                Ir a Facturación →
              </a>
            </div>
          </div>
        </DashboardCard>
      );

    default:
      return (
        <DashboardCard className={animateInClasses}>
          <p className="text-sm text-brand-muted font-body">
            Estado: {status}. Xavier está trabajando en tu proyecto.
          </p>
        </DashboardCard>
      );
  }
}
