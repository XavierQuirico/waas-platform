// ============================================================
// Calculator Catalog Adapter
// Source of truth: commercial catalog seed / catalog loader output.
// Exposes catalog capabilities to the calculator without importing legacy data.
// ============================================================

import seed from '@/db/seeds/catalog-defaults.json';
import type { CatalogComponent, SubscriptionPlan } from './types';
import type {
  CalculatorCatalogResult,
  CatalogCalculatorItem,
  CatalogPricingMode,
} from '@/lib/catalog/types';

type SeedCapability = {
  code: string;
  internalName: string;
  publicName: string;
  internalCategory: string;
  pricingMode: CatalogPricingMode;
  priceCents: number;
  visibleInCalculator: boolean;
  adminNotes?: string | null;
};

type CatalogComponentWithAvailability = CatalogComponent & {
  availability?: CatalogCalculatorItem['availability'];
  reason?: string;
  sourceCode: string;
};

export const SUBSCRIPTION_PLANS = {
  basic: {
    id: 'basic',
    name: 'BASIC',
    monthlyPrice: 49,
    setupFee: 50,
    description: 'Sitios de una pagina, marcas personales',
  },
  pro: {
    id: 'pro',
    name: 'PRO',
    monthlyPrice: 89,
    setupFee: 50,
    description: 'Booking, negocios de servicios',
  },
  business: {
    id: 'business',
    name: 'BUSINESS',
    monthlyPrice: 139,
    setupFee: 50,
    description: 'Catalogos, inventario',
  },
} as const;

export const ENTRY_POINT_TABLE = [
  {
    type: 'Sitio corporativo / servicios (similar a Plan BUSINESS, mas paginas)',
    estimate: 1500,
    notes: 'Sin e-commerce real, sin area de miembros',
  },
  {
    type: 'Portal con listados dinamicos (agente inmobiliario, directorio)',
    estimate: 2500,
    notes: 'Requiere modulo de listados + busqueda basica',
  },
  {
    type: 'E-commerce con checkout real integrado',
    estimate: 3500,
    notes: 'Carrito + pagos + inventario basico',
  },
  {
    type: 'Portal masivo con busqueda avanzada y gran volumen de datos',
    estimate: 5000,
    notes: 'Muchos filtros, muchos registros, alto volumen',
  },
  {
    type: 'Web App con dashboard / logica de usuario personalizada',
    estimate: 6000,
    notes: 'Login, roles, datos dinamicos por usuario',
  },
];

const SECTION_BY_PREFIX: Array<[RegExp, number]> = [
  [/^B0[1-7]$/, 2],
  [/^D/, 1],
  [/^C0[1-4][AB]?$/, 5],
  [/^CA/, 11],
  [/^WA/, 3],
  [/^I|^T|^CM|^XI/, 7],
  [/^CE/, 4],
  [/^EC/, 6],
  [/^E0[1-9]/, 4],
  [/^EM/, 10],
  [/^LM/, 9],
  [/^M|^R/, 9],
];

export const SECTION_NAMES: Record<number, string> = {
  1: 'Diseno y estructura',
  2: 'Contacto y comunicacion',
  3: 'WhatsApp y pedidos',
  4: 'Catalogo y ventas',
  5: 'Contenido dinamico',
  6: 'E-commerce y sistemas avanzados',
  7: 'Integraciones',
  8: 'SEO y performance',
  9: 'Mantenimiento y servicio',
  10: 'Email corporativo',
  11: 'Contenido',
};

const AI_FEATURE_TO_CODE: Record<string, string> = {
  contact_form_simple: 'B05',
  whatsapp_button: 'WA01',
  whatsapp_order: 'WA02',
  multistep_form: 'CM02',
  lead_popup: 'T02',
  booking_advanced: 'I02',
  // Legacy booking extras map to I02 (advanced booking absorbed BX variants)
  booking_extra_calendar: 'I02',
  booking_multiple_types: 'I02',
  booking_payments: 'EC01',
  booking_email_reminders: 'I02',
  booking_google_calendar: 'I02',
  catalog_static_20: 'I04',
  catalog_21_50: 'I04',
  catalog_import: 'I04',
  catalog_update_small: 'E01',
  catalog_update_medium: 'E02',
  catalog_extra_categories: 'CE01',
  catalog_filters: 'CE02',
  catalog_availability: 'CE04',
  // Checkout/pagos map to EC01 (checkout integrado activo)
  checkout_paypalme: 'EC01',
  checkout_paypal: 'EC01',
  checkout_payment: 'EC01',
  // Blog: C02A = section/blog, C02B = recurring publication
  blog_module: 'C02A',
  blog_section: 'C02A',
  blog_publication: 'C02B',
  content_publication: 'C02B',
  // Members/login/portal → EC05
  members_area_basic: 'EC05',
  members_area: 'EC05',
  login: 'EC05',
  portal: 'EC05',
  seo_schema_markup: 'C03',
  seo_multilang: 'C04',
  content_copywriting_3p: 'C01',
  integration_crm: 'I01',
  integration_gmaps_basic: 'T01',
};

const CODE_ALIASES = new Map<string, string>(
  Object.entries(AI_FEATURE_TO_CODE).map(([legacyId, code]) => [legacyId, code])
);

function normalizeComponentId(id: string): string {
  return CODE_ALIASES.get(id) ?? id;
}

function sectionForCode(code: string): number {
  return SECTION_BY_PREFIX.find(([pattern]) => pattern.test(code))?.[1] ?? 7;
}

function priceFor(pricingMode: CatalogPricingMode, priceCents: number): CatalogComponent['price'] {
  if (pricingMode === 'included') return 'included';
  if (pricingMode === 'quote') return 'quote';
  return Math.round(priceCents / 100);
}

function seedToComponent(cap: SeedCapability): CatalogComponentWithAvailability {
  const section = sectionForCode(cap.code);
  return {
    id: cap.code,
    sourceCode: cap.code,
    section,
    sectionName: SECTION_NAMES[section] ?? 'Catalogo comercial',
    name: cap.publicName || cap.internalName,
    price: priceFor(cap.pricingMode, cap.priceCents),
    notes: cap.adminNotes ?? undefined,
  };
}

function calculatorItemToComponent(
  item: CatalogCalculatorItem,
  availability: CatalogCalculatorItem['availability']
): CatalogComponentWithAvailability {
  const section = sectionForCode(item.code);
  const price =
    availability === 'included' ? 'included' :
    availability === 'quote' || item.priceCents == null ? 'quote' :
    Math.round(item.priceCents / 100);

  return {
    id: item.code,
    sourceCode: item.code,
    section,
    sectionName: SECTION_NAMES[section] ?? item.category,
    name: item.name,
    price,
    notes: item.reason,
    availability,
    reason: item.reason,
  };
}

function getSeedCapabilities(): SeedCapability[] {
  return (seed.capabilities as SeedCapability[])
    .filter((cap) => cap.visibleInCalculator);
}

export function getCalculatorCatalogComponents(): CatalogComponentWithAvailability[] {
  return getSeedCapabilities().map(seedToComponent);
}

export function getCalculatorComponentsFromBreakdown(
  breakdown: CalculatorCatalogResult | null | undefined
): CatalogComponentWithAvailability[] {
  if (!breakdown) return getCalculatorCatalogComponents();

  return [
    ...breakdown.included.map((item) => calculatorItemToComponent(item, 'included')),
    ...breakdown.paid.map((item) => calculatorItemToComponent(item, 'paid')),
    ...breakdown.quoteRequired.map((item) => calculatorItemToComponent(item, 'quote')),
    ...breakdown.unavailable.map((item) => calculatorItemToComponent(item, 'unavailable')),
  ].sort((a, b) => a.section - b.section || a.name.localeCompare(b.name));
}

export function getComponentById(id: string): CatalogComponentWithAvailability | undefined {
  const normalized = normalizeComponentId(id);
  return getCalculatorCatalogComponents().find((component) => component.id === normalized);
}

export function getComponentsBySection(section: number): CatalogComponentWithAvailability[] {
  return getCalculatorCatalogComponents().filter((component) => component.section === section);
}

export function getComponentsWithPrice(): Array<CatalogComponentWithAvailability & { price: number }> {
  return getCalculatorCatalogComponents().filter(
    (component): component is CatalogComponentWithAvailability & { price: number } =>
      typeof component.price === 'number'
  );
}

export function getComponentName(id: string): string {
  return getComponentById(id)?.name ?? id;
}

export function getAvailableComponentIds(): string[] {
  return getCalculatorCatalogComponents().map((component) => component.id);
}

export function getAiCatalogSummary(limit = 60): string {
  return getCalculatorCatalogComponents()
    .filter((component) => typeof component.price === 'number')
    .slice(0, limit)
    .map((component) => `"${component.id}": ${component.name}`)
    .join('\n');
}

export function toCatalogCode(id: string): string {
  return normalizeComponentId(id);
}

export function toCommercialPlan(plan: SubscriptionPlan | undefined) {
  return plan?.toUpperCase() as 'BASIC' | 'PRO' | 'BUSINESS' | undefined;
}
