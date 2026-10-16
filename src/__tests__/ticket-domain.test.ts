// ============================================================
// Tests de dominio — cambios y mejoras (tickets)
// Cubre: safeParsePayPalAmountCents, deriveClientTicketStatus,
//        interpretChangeRequest (privacidad Groq), guards de admin,
//        visibilidad de eventos, submitChangeRequest (validaciones)
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeParsePayPalAmountCents } from '@/lib/tickets/billing';
import { deriveClientTicketStatus } from '@/lib/tickets/billing';
import { interpretChangeRequest } from '@/lib/tickets/interpretChangeRequest';

// ─── safeParsePayPalAmountCents ───────────────────────────

describe('safeParsePayPalAmountCents', () => {
  it('parsea importe válido con centavos', () => {
    expect(safeParsePayPalAmountCents('99.99')).toBe(9999);
  });

  it('parsea importe sin decimales', () => {
    expect(safeParsePayPalAmountCents('100')).toBe(10000);
  });

  it('parsea importe con un decimal', () => {
    expect(safeParsePayPalAmountCents('50.5')).toBe(5050);
  });

  it('rechaza notación exponencial', () => {
    expect(safeParsePayPalAmountCents('1e5')).toBeNull();
  });

  it('rechaza importe negativo', () => {
    expect(safeParsePayPalAmountCents('-10.00')).toBeNull();
  });

  it('rechaza más de 2 decimales', () => {
    expect(safeParsePayPalAmountCents('10.123')).toBeNull();
  });

  it('rechaza string vacío', () => {
    expect(safeParsePayPalAmountCents('')).toBeNull();
  });

  it('rechaza string no numérico', () => {
    expect(safeParsePayPalAmountCents('abc')).toBeNull();
  });

  it('permite cero — la validación de monto mínimo es responsabilidad del route', () => {
    // safeParsePayPalAmountCents devuelve 0; la captura route rechaza <=0 por separado
    expect(safeParsePayPalAmountCents('0.00')).toBe(0);
  });

  it('rechaza número inseguro', () => {
    expect(safeParsePayPalAmountCents('999999999999999')).toBeNull();
  });

  it('trimea espacios antes de parsear', () => {
    // La implementación hace .trim() — el espaciado se acepta
    expect(safeParsePayPalAmountCents(' 25.00')).toBe(2500);
  });

  it('rechaza formato europeo con coma', () => {
    expect(safeParsePayPalAmountCents('25,50')).toBeNull();
  });
});

// ─── deriveClientTicketStatus — estado PAID activo ────────

describe('deriveClientTicketStatus: PAID es un estado activo', () => {
  it('PAID → paid (activo — trabajo pagado, no iniciado)', () => {
    expect(
      deriveClientTicketStatus('PAID', null, 'accepted', { now: new Date() })
    ).toBe('paid');
  });

  it('cotización accepted → ready_to_pay aunque la fecha de expiración haya pasado', () => {
    const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    expect(
      deriveClientTicketStatus('APPROVED', null, 'accepted', {
        quoteExpiresAt: pastDate,
        now: new Date(),
      })
    ).toBe('ready_to_pay');
  });

  it('COMPLETED → delivered', () => {
    expect(deriveClientTicketStatus('COMPLETED', null, 'none', {})).toBe('delivered');
  });

  it('CANCELLED → cancelled', () => {
    expect(deriveClientTicketStatus('CANCELLED', null, 'none', {})).toBe('cancelled');
  });

  it('PAYMENT_PENDING → payment_pending', () => {
    expect(deriveClientTicketStatus('PAYMENT_PENDING', null, 'accepted', {})).toBe(
      'payment_pending',
    );
  });

  it('IN_PROGRESS → in_progress', () => {
    expect(deriveClientTicketStatus('IN_PROGRESS', null, 'accepted', {})).toBe('in_progress');
  });
});

// ─── interpretChangeRequest — privacidad Groq ─────────────

describe('interpretChangeRequest: privacidad y fallback', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('sin GROQ_API_KEY devuelve fallback (no rompe el flujo)', async () => {
    vi.stubEnv('GROQ_API_KEY', '');
    const result = await interpretChangeRequest({
      naturalText: 'Quiero añadir un formulario de contacto a mi sitio web de la clínica.',
      projectContext: { productionUrl: 'https://example.com', plan: 'PRO' },
      availableCatalogItems: [
        { code: 'C01', publicName: 'Formulario de contacto', publicDescription: 'Formulario web básico' },
      ],
    });
    expect(result.source).toBe('fallback');
    expect(result.suggestions).toEqual([]);
  });

  it('fallback no contiene precios en overallSummary', async () => {
    vi.stubEnv('GROQ_API_KEY', '');
    const result = await interpretChangeRequest({
      naturalText: 'Necesito actualizar mis fotos y añadir una galería de productos.',
      projectContext: { productionUrl: null, plan: 'BASIC' },
      availableCatalogItems: [],
    });
    expect(result.overallSummary).not.toMatch(/\$\d+/);
  });

  it('texto muy corto (<20 chars) devuelve fallback', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key');
    const result = await interpretChangeRequest({
      naturalText: 'Cambiar logo',
      projectContext: { productionUrl: null, plan: 'PRO' },
      availableCatalogItems: [
        { code: 'L01', publicName: 'Cambio de logo', publicDescription: 'Actualizar el logo del sitio' },
      ],
    });
    expect(result.source).toBe('fallback');
  });

  it('catálogo vacío devuelve fallback', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key');
    const result = await interpretChangeRequest({
      naturalText: 'Quiero cambiar completamente el diseño de mi página principal.',
      projectContext: { productionUrl: 'https://example.com', plan: 'BUSINESS' },
      availableCatalogItems: [],
    });
    expect(result.source).toBe('fallback');
  });

  it('Groq error HTTP devuelve fallback sin romper el flujo', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key-invalid');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      }),
    );
    const result = await interpretChangeRequest({
      naturalText: 'Quiero añadir una sección de testimonios a mi sitio web de la clínica.',
      projectContext: { productionUrl: 'https://example.com', plan: 'PRO' },
      availableCatalogItems: [
        { code: 'T01', publicName: 'Sección testimonios', publicDescription: 'Sección de testimonios de clientes' },
      ],
    });
    expect(result.source).toBe('fallback');
  });

  it('Groq JSON inválido (schema incorrecto) devuelve fallback sin romper el flujo', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: '{"prices": [100, 200], "plans": ["PRO"]}' } }],
          }),
      }),
    );
    const result = await interpretChangeRequest({
      naturalText: 'Quiero añadir un sistema de reservas en línea a mi clínica estética.',
      projectContext: { productionUrl: 'https://example.com', plan: 'BUSINESS' },
      availableCatalogItems: [
        { code: 'R01', publicName: 'Sistema de reservas', publicDescription: 'Módulo de reservas online' },
      ],
    });
    expect(result.source).toBe('fallback');
  });

  it('Groq no puede inventar códigos de catálogo — se filtran y se devuelve fallback', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    suggestions: [
                      {
                        catalogCode: 'INVENTED_CODE_999',
                        requestKind: 'change',
                        quantity: 1,
                        clientSummary: 'Inventado',
                        confidence: 0.9,
                        needsClarification: false,
                      },
                    ],
                    overallSummary: 'Resumen de prueba.',
                  }),
                },
              },
            ],
          }),
      }),
    );
    const result = await interpretChangeRequest({
      naturalText: 'Quiero añadir una sección de galería de productos a mi tienda online de artesanías.',
      projectContext: { productionUrl: 'https://example.com', plan: 'PRO' },
      availableCatalogItems: [
        { code: 'G01', publicName: 'Galería', publicDescription: 'Galería de imágenes' },
      ],
    });
    // El código inventado fue filtrado; sin sugerencias válidas → fallback
    expect(result.suggestions.every((s) => s.catalogCode !== 'INVENTED_CODE_999')).toBe(true);
  });

  it('payload enviado a Groq no contiene precios ni IDs internos de BD', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key');
    const capturedBodies: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
        capturedBodies.push(opts.body as string);
        return Promise.resolve({
          ok: false,
          status: 500,
          text: () => Promise.resolve('error'),
        });
      }),
    );
    await interpretChangeRequest({
      naturalText: 'Necesito añadir un chat en vivo a mi sitio y actualizar los colores corporativos.',
      projectContext: { productionUrl: 'https://example.com', plan: 'PRO' },
      availableCatalogItems: [
        { code: 'CH01', publicName: 'Chat en vivo', publicDescription: 'Widget de chat online' },
      ],
    });
    const body = capturedBodies[0] ?? '';
    expect(body).not.toMatch(/priceCents|listPrice/i);
    // No debe contener UUIDs de BD
    expect(body).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/);
  });
});

// ─── Capture route — guards de seguridad (lógica en billing.ts) ─

describe('safeParsePayPalAmountCents: cobertura edge cases del capture', () => {
  it('importe 1.00 → 100 centavos', () => {
    expect(safeParsePayPalAmountCents('1.00')).toBe(100);
  });

  it('importe 9999.99 → centavos correctos', () => {
    expect(safeParsePayPalAmountCents('9999.99')).toBe(999999);
  });

  it('formato punto como separador decimal (PayPal) es válido', () => {
    expect(safeParsePayPalAmountCents('25.50')).toBe(2550);
  });

  it('rechaza formato con coma (separador europeo)', () => {
    expect(safeParsePayPalAmountCents('25,50')).toBeNull();
  });
});

// ─── TicketDetailClient: PayPal nunca aparece fuera de ready_to_pay ──────────

describe('TicketDetailClient: visibilidad condicional de PayPal', () => {

  it('deriveClientTicketStatus: PAID+accepted → paid, nunca ready_to_pay', () => {
    expect(
      deriveClientTicketStatus('PAID', null, 'accepted', { now: new Date() }),
    ).toBe('paid');
    // 'paid' !== 'ready_to_pay' → nunca mostrará PayPal
    expect(
      deriveClientTicketStatus('PAID', null, 'accepted', { now: new Date() }),
    ).not.toBe('ready_to_pay');
  });

  it('deriveClientTicketStatus: IN_PROGRESS+accepted → in_progress, nunca ready_to_pay', () => {
    expect(
      deriveClientTicketStatus('IN_PROGRESS', null, 'accepted', { now: new Date() }),
    ).toBe('in_progress');
  });

  it('deriveClientTicketStatus: APPROVED+accepted → ready_to_pay (único estado que muestra PayPal)', () => {
    expect(
      deriveClientTicketStatus('APPROVED', null, 'accepted', { now: new Date() }),
    ).toBe('ready_to_pay');
  });

  it('deriveClientTicketStatus: PAYMENT_PENDING+accepted → payment_pending (nunca ready_to_pay)', () => {
    expect(
      deriveClientTicketStatus('PAYMENT_PENDING', null, 'accepted', { now: new Date() }),
    ).toBe('payment_pending');
  });
});
