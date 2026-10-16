import Link from 'next/link';

/**
 * Portal not-found boundary (DOC-02 §0.4).
 *
 * Renders INSIDE the portal shell — the layout's single <main> wraps this
 * content — so an invalid/unavailable route (e.g. `notFound()` from
 * /proyecto/[projectId] when the project doesn't belong to the client) shows a
 * human, on-brand message instead of Next's bare default 404 or an empty shell.
 *
 * Intentionally presentational and data-free: no auth/DB work beyond the layout.
 */
export default function PortalNotFound() {
  return (
    <div
      style={{
        maxWidth: 520,
        margin: '0 auto',
        textAlign: 'center',
        padding: '48px 0',
        fontFamily: 'var(--font-body)',
      }}
    >
      <p
        style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-3)',
          margin: 0,
        }}
      >
        Página no encontrada
      </p>

      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 26,
          color: 'var(--text)',
          letterSpacing: '-0.02em',
          margin: '12px 0 8px',
          lineHeight: 1.15,
        }}
      >
        Esta página no existe
      </h1>

      <p style={{ fontSize: 14, color: 'var(--text-3)', margin: '0 0 24px', lineHeight: 1.5 }}>
        Puede que el enlace haya cambiado o que esta sección no esté disponible para tu cuenta.
        Vuelve a tu inicio y desde ahí encontrarás todo lo de tu proyecto.
      </p>

      <Link
        href="/dashboard"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: '#FF8C00',
          color: '#121212',
          padding: '11px 20px',
          borderRadius: 9,
          textDecoration: 'none',
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        Volver al inicio →
      </Link>
    </div>
  );
}
