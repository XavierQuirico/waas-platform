import { whatsappUrl } from '@/lib/config/contact';
// Página de confirmación post-submit del intake
// Maneja tres casos según searchParams:
//   (sin params)            → flujo LEGACY/DRAFT: Xavier revisará y enviará propuesta
//   ?status=PAYMENT_RECEIVED → pago completado, acceso al portal
//   ?status=PENDING          → pago pendiente de confirmación
//   ?error=...               → error en el proceso, reintento disponible

type SearchParams = Promise<{ status?: string; error?: string }>;

export default async function ConfirmadoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const status = params.status;
  const hasError = !!params.error;

  if (status === 'PAYMENT_RECEIVED') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-8 w-8 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">¡Pago recibido!</h1>
          <p className="mt-3 text-gray-500">
            Tu suscripción está activa. Ya puedes acceder al portal para subir tus materiales.
          </p>
          <a
            href="/dashboard"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Ir al portal →
          </a>
        </div>
      </div>
    );
  }

  if (status === 'PENDING') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
            <svg
              className="h-8 w-8 text-yellow-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Pago pendiente</h1>
          <p className="mt-3 text-gray-500">
            Tu pago está siendo procesado. Recibirás una confirmación por email en breve.
            Si ya tienes acceso, puedes entrar al portal.
          </p>
          <a
            href="/dashboard"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Ir al portal →
          </a>
          <p className="mt-4 text-xs text-gray-400">
            Si tienes dudas, escríbele a Xavier por WhatsApp.
          </p>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-8 w-8 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Hubo un problema</h1>
          <p className="mt-3 text-gray-500">
            No pudimos completar el proceso. Por favor intenta de nuevo o contacta a Xavier por WhatsApp.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <a
              href="/empezar"
              className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Intentar de nuevo
            </a>
            <a
              href={whatsappUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300"
            >
              Contactar por WhatsApp
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Caso por defecto: flujo LEGACY / DRAFT
  // Xavier revisará la solicitud y enviará la propuesta por email
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="max-w-md text-center">
        {/* Icono */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <svg
            className="h-8 w-8 text-gray-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold text-gray-900">
          ¡Recibido!
        </h1>

        <p className="mt-3 text-gray-500">
          Xavier revisará tu información y te enviará una propuesta personalizada
          por email y WhatsApp en menos de <strong className="text-gray-700">24 horas</strong>.
        </p>

        <div className="mt-6 rounded-lg border border-gray-100 bg-gray-50 p-4 text-left text-sm text-gray-600">
          <p className="font-medium text-gray-700">¿Qué sigue?</p>
          <ol className="mt-2 space-y-1.5 text-gray-500">
            <li>1. Xavier revisa tu solicitud (hoy)</li>
            <li>2. Recibes una propuesta personalizada por email</li>
            <li>3. Aceptas y pagas para arrancar</li>
            <li>4. Subes tus materiales en el portal</li>
            <li>5. Tu sitio está listo en 72 horas hábiles</li>
          </ol>
        </div>

        <p className="mt-6 text-xs text-gray-400">
          Si tienes preguntas mientras tanto, puedes escribirle directamente
          a Xavier por WhatsApp.
        </p>

        <a
          href={whatsappUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center justify-center rounded-lg border border-gray-200 px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300"
        >
          Contactar por WhatsApp
        </a>
      </div>
    </div>
  );
}
