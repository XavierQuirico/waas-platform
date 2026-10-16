import { getBillingStatusDisplayCopy, canShowBillingStatusPayPalCta, type BillingVisualState, type BillingStatusVariant } from '@/lib/portal/billing-state';

const VARIANT_STYLES: Record<BillingStatusVariant, { border: string; bg: string; labelColor: string }> = {
  green: {
    border: '1px solid rgba(34,197,94,0.2)',
    bg: 'rgba(34,197,94,0.07)',
    labelColor: '#4ade80',
  },
  amber: {
    border: '1px solid rgba(251,191,36,0.25)',
    bg: 'rgba(251,191,36,0.08)',
    labelColor: '#fbbf24',
  },
  red: {
    border: '1px solid rgba(239,68,68,0.25)',
    bg: 'rgba(239,68,68,0.08)',
    labelColor: '#f87171',
  },
  neutral: {
    border: '1px solid rgba(128,128,128,0.15)',
    bg: 'rgba(128,128,128,0.06)',
    labelColor: 'var(--text-2)',
  },
};

interface BillingStatusBannerProps {
  state: BillingVisualState;
  gracePeriodUntil?: Date | null;
  showPayPal?: boolean;
}

export function BillingStatusBanner({ state, gracePeriodUntil, showPayPal = false }: BillingStatusBannerProps) {
  const copy = getBillingStatusDisplayCopy(state, { showPayPal });
  const vs = VARIANT_STYLES[copy.variant];
  const showPayPalCta = canShowBillingStatusPayPalCta(state, showPayPal);

  if (state === 'active') return null;

  const graceDateStr =
    state === 'grace' && gracePeriodUntil
      ? gracePeriodUntil.toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' })
      : null;

  return (
    <div
      style={{
        borderRadius: 10,
        border: vs.border,
        background: vs.bg,
        padding: '14px 16px',
        marginBottom: 16,
      }}
    >
      <p
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: vs.labelColor,
          margin: '0 0 4px',
          fontFamily: 'var(--font-display)',
        }}
      >
        {copy.label}
      </p>
      <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0, fontFamily: 'var(--font-body)' }}>
        {copy.description}
        {graceDateStr && (
          <>
            {' '}Fecha límite: <strong style={{ color: 'var(--text-2)' }}>{graceDateStr}</strong>.
          </>
        )}
      </p>
      {(state === 'grace' || state === 'suspended' || state === 'r01_active') && (
        showPayPalCta ? (
          <a
            href="https://www.paypal.com/myaccount/autopay"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              marginTop: 10,
              fontSize: 12,
              fontWeight: 500,
              color: vs.labelColor,
              fontFamily: 'var(--font-body)',
              textDecoration: 'underline',
            }}
          >
            Administrar en PayPal →
          </a>
        ) : (
          <a
            href="/soporte"
            style={{
              display: 'inline-block',
              marginTop: 10,
              fontSize: 12,
              fontWeight: 500,
              color: vs.labelColor,
              fontFamily: 'var(--font-body)',
              textDecoration: 'underline',
            }}
          >
            Contactar soporte →
          </a>
        )
      )}
    </div>
  );
}
