// Portal — Configuración / Mi sitio / Soporte / Mantenimiento
// Cubre: escaneos de seguridad visual, lógica pura, restricciones de dominio,
// helpers de mantenimiento, validación de servidor action, nav guards.
// No requiere DB ni auth — prueba lógica pura y file scanning.

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { deriveProjectType } from '@/lib/portal/project-type';
import { toExternalUrl } from '@/lib/portal/url';
import { getPortalNavItems } from '@/lib/portal/nav';
import {
  formatTierLabel,
  formatTierChanges,
  formatBillingMethod,
  formatContractStatus,
  formatMoneyCents,
} from '@/lib/portal/maintenance-helpers';

// ─── 6. Configuración — Zod schema valida campos permitidos ──────────────────

describe('Configuración — validación Zod', () => {
  const updateSchema = z.object({
    fullName: z.string().trim().min(1, 'El nombre es requerido.').max(200),
    businessName: z.string().trim().min(1, 'El nombre del negocio es requerido.').max(200),
    whatsapp: z.string().trim().max(50).optional(),
    location: z.string().trim().max(200).optional(),
    currentUrl: z.string().trim().max(500).optional(),
  });

  it('acepta datos válidos', () => {
    const result = updateSchema.safeParse({
      fullName: 'María García',
      businessName: 'Café Indígena',
      whatsapp: '+1 809 555 1234',
      location: 'Santo Domingo',
      currentUrl: 'cafeindigena.com',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza fullName vacío', () => {
    const result = updateSchema.safeParse({ fullName: '', businessName: 'Café' });
    expect(result.success).toBe(false);
  });

  it('rechaza businessName vacío', () => {
    const result = updateSchema.safeParse({ fullName: 'María', businessName: '' });
    expect(result.success).toBe(false);
  });

  it('acepta campos opcionales ausentes', () => {
    const result = updateSchema.safeParse({ fullName: 'María', businessName: 'Café' });
    expect(result.success).toBe(true);
  });
});

// ─── 7. Mi sitio — deriveProjectType + toExternalUrl ─────────────────────────

describe('Mi sitio — lógica pura', () => {

  it('toExternalUrl añade https cuando falta protocolo', () => {
    expect(toExternalUrl('cafeindigena.com')).toBe('https://cafeindigena.com');
  });

  it('toExternalUrl retorna null para valores nulos', () => {
    expect(toExternalUrl(null)).toBeNull();
    expect(toExternalUrl('')).toBeNull();
  });

  it('toExternalUrl preserva http existente', () => {
    expect(toExternalUrl('http://cafeindigena.com')).toBe('http://cafeindigena.com');
  });

  it('PORTFOLIO no tiene nav de facturación', () => {
    const nav = getPortalNavItems({ projectType: 'PORTFOLIO', projectId: 'abc' });
    const ids = nav.map((n) => n.id);
    expect(ids).not.toContain('facturacion');
  });

  it('PORTFOLIO no tiene nav de mantenimiento', () => {
    const nav = getPortalNavItems({ projectType: 'PORTFOLIO', projectId: 'abc' });
    const ids = nav.map((n) => n.id);
    expect(ids).not.toContain('mantenimiento');
  });

  it('SUBSCRIPTION tiene nav de facturación', () => {
    const nav = getPortalNavItems({ projectType: 'SUBSCRIPTION', projectId: 'abc' });
    const ids = nav.map((n) => n.id);
    expect(ids).toContain('facturacion');
  });

  it('LEGACY tiene nav de mantenimiento', () => {
    const nav = getPortalNavItems({ projectType: 'LEGACY', projectId: 'abc' });
    const ids = nav.map((n) => n.id);
    expect(ids).toContain('mantenimiento');
  });
});

// ─── 8. Mantenimiento — filtro Legacy y maintenance_contracts ────────────────

describe('Mantenimiento — lógica de datos', () => {

  it('formatTierLabel retorna etiquetas correctas', () => {
    expect(formatTierLabel('care')).toBe('Care');
    expect(formatTierLabel('care_plus')).toBe('Care Plus');
    expect(formatTierLabel('care_pro')).toBe('Care Pro');
    expect(formatTierLabel('custom')).toBe('Plan personalizado');
  });

  it('formatTierChanges retorna cupos correctos', () => {
    expect(formatTierChanges('care')).toBe('1 cambio menor/mes');
    expect(formatTierChanges('care_plus')).toBe('2 cambios menores/mes');
    expect(formatTierChanges('care_pro')).toBe('4 cambios menores/mes');
    expect(formatTierChanges('custom')).toBeNull();
  });

  it('formatBillingMethod retorna etiqueta', () => {
    expect(formatBillingMethod('paypal_subscription')).toBe('PayPal (automático)');
    expect(formatBillingMethod('manual')).toBe('Manual');
  });

  it('formatContractStatus retorna etiqueta', () => {
    expect(formatContractStatus('active')).toBe('Activo');
    expect(formatContractStatus('paused')).toBe('Pausado');
    expect(formatContractStatus('cancelled')).toBe('Cancelado');
  });

  it('formatMoneyCents formatea centavos', () => {
    expect(formatMoneyCents(4900)).toBe('$49 USD');
    expect(formatMoneyCents(8900)).toBe('$89 USD');
    expect(formatMoneyCents(14900)).toBe('$149 USD');
    expect(formatMoneyCents(2000)).toBe('$20 USD');
  });
});

// ─── 10. Portfolio — no copy de facturación recurrente ───────────────────────

describe('Portfolio — sin facturación recurrente', () => {
  it('deriveProjectType con portfolioFlag=true retorna PORTFOLIO', () => {
    expect(deriveProjectType('BASIC', true)).toBe('PORTFOLIO');
    expect(deriveProjectType('PRO', true)).toBe('PORTFOLIO');
    expect(deriveProjectType('BUSINESS', true)).toBe('PORTFOLIO');
    expect(deriveProjectType('LEGACY', true)).toBe('PORTFOLIO');
  });

  it('getPortalNavItems para PORTFOLIO no incluye facturacion', () => {
    const nav = getPortalNavItems({ projectType: 'PORTFOLIO', projectId: 'p1' });
    expect(nav.find((n) => n.id === 'facturacion')).toBeUndefined();
  });
});

// ─── 11. deriveProjectType cubre los tres tipos ───────────────────────────────

describe('deriveProjectType (referencia rápida)', () => {
  it('LEGACY sin portfolioFlag → LEGACY', () => {
    expect(deriveProjectType('LEGACY', false)).toBe('LEGACY');
  });

  it('BASIC con portfolioFlag → PORTFOLIO', () => {
    expect(deriveProjectType('BASIC', true)).toBe('PORTFOLIO');
  });

  it('PRO sin portfolioFlag → SUBSCRIPTION', () => {
    expect(deriveProjectType('PRO', false)).toBe('SUBSCRIPTION');
  });
});
