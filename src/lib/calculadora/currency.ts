// ============================================================
// Helpers de formato de moneda — USD / DOP
// Los cálculos internos siempre en USD; solo la visualización cambia.
// ============================================================

export type Currency = 'USD' | 'DOP';

/**
 * Formatea un monto (siempre en USD internamente) según la moneda de display.
 * @param amount  Monto en USD
 * @param currency  'USD' o 'DOP'
 * @param rate  Tasa de cambio USD→DOP (requerida cuando currency === 'DOP')
 */
export function formatPrice(
  amount: number,
  currency: Currency = 'USD',
  rate?: number | null
): string {
  if (currency === 'DOP' && rate) {
    const dop = amount * rate;
    return `RD$${dop.toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
