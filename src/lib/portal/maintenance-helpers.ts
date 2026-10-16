export function formatTierLabel(tier: string): string {
  switch (tier) {
    case 'care': return 'Care';
    case 'care_plus': return 'Care Plus';
    case 'care_pro': return 'Care Pro';
    case 'custom': return 'Plan personalizado';
    default: return tier;
  }
}

export function formatTierChanges(tier: string): string | null {
  switch (tier) {
    case 'care': return '1 cambio menor/mes';
    case 'care_plus': return '2 cambios menores/mes';
    case 'care_pro': return '4 cambios menores/mes';
    default: return null;
  }
}

export function formatBillingMethod(method: string): string {
  if (method === 'paypal_subscription') return 'PayPal (automático)';
  return 'Manual';
}

export function formatContractStatus(status: string): string {
  if (status === 'active') return 'Activo';
  if (status === 'paused') return 'Pausado';
  return 'Cancelado';
}

export function formatMoneyCents(cents: number): string {
  const dollars = Math.floor(cents / 100);
  const remainder = cents % 100;
  if (remainder === 0) return `$${dollars} USD`;
  return `$${(cents / 100).toFixed(2)} USD`;
}
