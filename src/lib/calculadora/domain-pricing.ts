// Última revisión de precios: abril 2026 (Namecheap)
export const DOMAIN_PRICES: Record<string, number> = {
  // Globales comunes
  'com':    13.98,
  'net':    13.98,
  'org':    14.98,
  'io':     44.98,
  'co':     28.98,
  'app':    19.98,
  'dev':    15.98,
  'biz':    14.98,
  'info':   10.98,
  'online': 35.98,
  // LatAm / RD
  'do':     55.00,  // INTENIC (ccTLD República Dominicana)
  'com.do': 55.00,
  'mx':     38.98,
  'com.mx': 38.98,
};

export const DEFAULT_DOMAIN_PRICE = 13.98; // fallback para TLDs desconocidos (~precio .com)

export function getDomainPrice(domainTarget: string): number {
  if (!domainTarget) return DEFAULT_DOMAIN_PRICE;

  const lower = domainTarget.toLowerCase().trim();

  // Manejar SLDs compuestos: "ejemplo.com.do" → "com.do"
  const parts = lower.split('.');
  if (parts.length >= 3) {
    const tld2 = parts.slice(-2).join('.'); // "com.do"
    if (DOMAIN_PRICES[tld2] !== undefined) return DOMAIN_PRICES[tld2];
  }

  // TLD simple: "ejemplo.com" → "com"
  const tld = parts[parts.length - 1];
  return DOMAIN_PRICES[tld] ?? DEFAULT_DOMAIN_PRICE;
}
