// Pure helpers for canonical catalog protection.
// No DB, no auth. Import and test independently.

export const CORE_BASE_CODES = new Set([
  'B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'WA01',
]);

export const QUOTE_ENGINE_CODES = new Set([
  'EC01', 'EC03', 'EC04', 'EC05', 'EC07',
]);

export const LEGACY_MAINTENANCE_CODES = new Set([
  'LM01', 'LM02', 'LM03', 'LM04', 'LM05',
]);

// Capacidades admin-only/internal que nunca deben ser visibles en portal cliente.
// EM01/EM02 = email corporativo (gestión admin, no tarjetas de portal).
// EC01/EC03/EC04/EC05/EC07 = módulos internos legacy/e-commerce/cotización (no exponer en portal).
export const ADMIN_ONLY_PORTAL_BLOCKED_CODES = new Set([
  'EM01', 'EM02',
  'EC01', 'EC03', 'EC04', 'EC05', 'EC07',
]);

export type ProtectionLevel = 'canonical' | 'manual';

export function getCatalogProtectionLevel(source: string): ProtectionLevel {
  return source === 'manual' ? 'manual' : 'canonical';
}

// Returns true if priceCents/listPriceCents may be edited from admin UI.
// Only pricingMode=fixed items that are not core-base or quote-engine are editable.
export function isCatalogPriceEditable(item: {
  code: string;
  pricingMode: string;
}): boolean {
  if (item.pricingMode !== 'fixed') return false;
  if (CORE_BASE_CODES.has(item.code)) return false;
  if (QUOTE_ENGINE_CODES.has(item.code)) return false;
  return true;
}

// Returns true if visibleInPortal may be toggled from admin UI.
// Core-base, legacy-maintenance, and admin-only/internal codes must stay at their canonical values.
export function isCatalogPortalVisibilityEditable(code: string): boolean {
  if (CORE_BASE_CODES.has(code)) return false;
  if (LEGACY_MAINTENANCE_CODES.has(code)) return false;
  if (ADMIN_ONLY_PORTAL_BLOCKED_CODES.has(code)) return false;
  return true;
}

type PriceChangeInput = {
  priceCents?: number;
  listPriceCents?: number;
};

// Validates an operational price change from admin UI.
// Returns null if valid, otherwise returns an error message string.
export function validateOperationalPriceChange(
  item: { code: string; pricingMode: string },
  input: PriceChangeInput,
): string | null {
  if (!isCatalogPriceEditable(item)) {
    if (CORE_BASE_CODES.has(item.code)) {
      return 'Capacidad base protegida. Cambios requieren actualizacion del catalogo canonico.';
    }
    if (item.pricingMode === 'included') {
      return 'Esta capacidad esta incluida por regla del motor. Su precio no se edita desde admin.';
    }
    if (item.pricingMode === 'quote') {
      return 'Esta capacidad requiere cotizacion. No debe tener precio fijo desde admin.';
    }
    return 'Este precio no es editable desde admin.';
  }
  const cents = input.priceCents;
  if (cents !== undefined) {
    if (!Number.isInteger(cents) || cents < 0) {
      return 'El precio debe ser un numero entero mayor o igual a 0.';
    }
    if (cents === 0) {
      return 'El precio operativo debe ser mayor a $0.';
    }
  }
  const listCents = input.listPriceCents;
  // listPriceCents === 0 is the DB default sentinel for "no list price set" — skip comparison.
  if (listCents !== undefined && listCents !== 0) {
    if (!Number.isInteger(listCents) || listCents < 0) {
      return 'El precio de lista debe ser un numero entero mayor o igual a 0.';
    }
    if (cents !== undefined && listCents < cents) {
      return 'El precio de lista debe ser mayor o igual al precio operativo.';
    }
  }
  return null;
}
