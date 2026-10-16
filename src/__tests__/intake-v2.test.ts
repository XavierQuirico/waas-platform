// ============================================================
// Tests unitarios — Intake V2
// Cubre: schema V2, Groq server action, snapshot fields
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  step1SchemaV2,
  step2SchemaV2,
  step3SchemaV2,
  step4SchemaV2,
  step5SchemaV2,
  intakeSubmitSchemaV2,
  checkClerkUserHasClientInputSchema,
} from '@/lib/intake/schema';

// ─── Schema V2 tests ──────────────────────────────────────

describe('step1SchemaV2', () => {
  const base = {
    firstName: 'María',
    lastName: 'García',
    email: 'test@example.com',
    whatsapp: '+18095551234',
    businessName: 'Mi Negocio',
    industry: 'salud' as const,
  };

  it('acepta datos válidos con firstName y lastName separados', () => {
    expect(step1SchemaV2.safeParse(base).success).toBe(true);
  });

  it('requiere firstName', () => {
    const { firstName: _f, ...rest } = base;
    expect(step1SchemaV2.safeParse(rest).success).toBe(false);
  });

  it('requiere lastName', () => {
    const { lastName: _l, ...rest } = base;
    expect(step1SchemaV2.safeParse(rest).success).toBe(false);
  });

  it('falla con firstName vacío', () => {
    expect(step1SchemaV2.safeParse({ ...base, firstName: '' }).success).toBe(false);
  });

  it('falla con lastName vacío', () => {
    expect(step1SchemaV2.safeParse({ ...base, lastName: '' }).success).toBe(false);
  });

  it('falla con email inválido', () => {
    expect(step1SchemaV2.safeParse({ ...base, email: 'no-es-email' }).success).toBe(false);
  });
});

describe('step2SchemaV2', () => {
  const base = {
    whatYouOffer: 'Servicios de consultoría en salud',
    hasExistingSite: false,
    primaryProblems: ['professional_presence'] as string[],
  };

  it('acepta primaryProblems multiselect', () => {
    expect(
      step2SchemaV2.safeParse({
        ...base,
        primaryProblems: ['professional_presence', 'more_contacts'],
      }).success
    ).toBe(true);
  });

  it('falla si primaryProblems está vacío', () => {
    expect(step2SchemaV2.safeParse({ ...base, primaryProblems: [] }).success).toBe(false);
  });

  it('acepta primaryProblemsOther opcional', () => {
    expect(
      step2SchemaV2.safeParse({ ...base, primaryProblemsOther: 'Otro detalle' }).success
    ).toBe(true);
  });

  it('acepta hasExistingSite=true con currentUrl vacío', () => {
    expect(
      step2SchemaV2.safeParse({ ...base, hasExistingSite: true, currentUrl: '' }).success
    ).toBe(true);
  });
});

describe('step3SchemaV2', () => {
  it('acepta primaryGoals multiselect', () => {
    expect(
      step3SchemaV2.safeParse({ primaryGoals: ['contacts', 'booking'] }).success
    ).toBe(true);
  });

  it('falla si primaryGoals está vacío', () => {
    expect(step3SchemaV2.safeParse({ primaryGoals: [] }).success).toBe(false);
  });

  it('acepta full_ownership como goal', () => {
    expect(
      step3SchemaV2.safeParse({ primaryGoals: ['full_ownership'] }).success
    ).toBe(true);
  });
});

describe('step4SchemaV2', () => {
  it('falla si freeformBrief tiene menos de 20 caracteres', () => {
    expect(step4SchemaV2.safeParse({ freeformBrief: 'Muy corto' }).success).toBe(false);
  });

  it('acepta freeformBrief con al menos 20 caracteres', () => {
    expect(
      step4SchemaV2.safeParse({
        freeformBrief: 'Este es un brief con suficiente contenido para pasar.',
      }).success
    ).toBe(true);
  });
});

describe('step5SchemaV2', () => {
  const base = {
    brandIdentityStatus: 'has_logo_and_style' as const,
    copyStatus: 'ready' as const,
    photosStatus: 'ready' as const,
    domainStatus: 'has_domain' as const,
  };

  it('acepta sin currentAccessStatus', () => {
    expect(step5SchemaV2.safeParse(base).success).toBe(true);
  });

  it('acepta currentAccessStatus opcional', () => {
    expect(
      step5SchemaV2.safeParse({ ...base, currentAccessStatus: 'has_access' }).success
    ).toBe(true);
  });
});

describe('intakeSubmitSchemaV2', () => {
  it('acepta selectedPlanIntent null', () => {
    expect(
      intakeSubmitSchemaV2.safeParse(validV2Payload({ selectedPlanIntent: null })).success
    ).toBe(true);
  });

  it('acepta selectedPlanIntent BASIC', () => {
    expect(
      intakeSubmitSchemaV2.safeParse(validV2Payload({ selectedPlanIntent: 'BASIC' })).success
    ).toBe(true);
  });

  it('acepta selectedPlanIntent PRO', () => {
    expect(
      intakeSubmitSchemaV2.safeParse(validV2Payload({ selectedPlanIntent: 'PRO' })).success
    ).toBe(true);
  });

  it('acepta selectedPlanIntent BUSINESS', () => {
    expect(
      intakeSubmitSchemaV2.safeParse(validV2Payload({ selectedPlanIntent: 'BUSINESS' })).success
    ).toBe(true);
  });

  it('acepta selectedPlanIntent LEGACY', () => {
    expect(
      intakeSubmitSchemaV2.safeParse(validV2Payload({ selectedPlanIntent: 'LEGACY' })).success
    ).toBe(true);
  });

  it('acepta sin selectedPlanIntent', () => {
    expect(intakeSubmitSchemaV2.safeParse(validV2Payload()).success).toBe(true);
  });

  it('acepta clerkUserId opcional', () => {
    expect(
      intakeSubmitSchemaV2.safeParse(
        validV2Payload({ clerkUserId: 'user_clerk123' })
      ).success
    ).toBe(true);
  });

  it('falla sin firstName', () => {
    const payload = validV2Payload();
    delete (payload as Record<string, unknown>).firstName;
    expect(intakeSubmitSchemaV2.safeParse(payload).success).toBe(false);
  });

  it('falla sin lastName', () => {
    const payload = validV2Payload();
    delete (payload as Record<string, unknown>).lastName;
    expect(intakeSubmitSchemaV2.safeParse(payload).success).toBe(false);
  });
});

// ─── Groq server action ───────────────────────────────────

describe('interpretIntakeWithGroq', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('sin GROQ_API_KEY devuelve fallback success', async () => {
    vi.stubEnv('GROQ_API_KEY', '');
    const { interpretIntakeWithGroq } = await import(
      '@/app/(public)/empezar/actions/interpretIntakeWithGroq'
    );
    const result = await interpretIntakeWithGroq(groqInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.source).toBe('fallback');
      expect(result.data).toBeDefined();
    }
  });

  it('fallback no expone precios ni planes definitivos en humanSummary', async () => {
    vi.stubEnv('GROQ_API_KEY', '');
    const { interpretIntakeWithGroq } = await import(
      '@/app/(public)/empezar/actions/interpretIntakeWithGroq'
    );
    const result = await interpretIntakeWithGroq(groqInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.humanSummary).not.toMatch(/\$\d+/);
      expect(result.data.humanSummary).not.toMatch(/\bBASIC\b|\bPRO\b|\bBUSINESS\b|\bLEGACY\b/);
    }
  });

  it('full_ownership en goals produce suggestsLegacy en fallback', async () => {
    vi.stubEnv('GROQ_API_KEY', '');
    const { interpretIntakeWithGroq } = await import(
      '@/app/(public)/empezar/actions/interpretIntakeWithGroq'
    );
    const result = await interpretIntakeWithGroq(
      groqInput({ primaryGoals: ['full_ownership'] })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.planSignals.suggestsLegacy).toBe(true);
    }
  });

  it('goals de pagos/catálogo producen suggestsBusiness en fallback', async () => {
    vi.stubEnv('GROQ_API_KEY', '');
    const { interpretIntakeWithGroq } = await import(
      '@/app/(public)/empezar/actions/interpretIntakeWithGroq'
    );
    const result = await interpretIntakeWithGroq(
      groqInput({ primaryGoals: ['online_payments', 'catalog'] })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.planSignals.suggestsBusiness).toBe(true);
    }
  });

  it('no lanza excepción cuando Groq responde error HTTP', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key-invalid');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      })
    );
    const { interpretIntakeWithGroq } = await import(
      '@/app/(public)/empezar/actions/interpretIntakeWithGroq'
    );
    const result = await interpretIntakeWithGroq(groqInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.source).toBe('fallback');
    }
  });

  it('no lanza excepción cuando Groq devuelve JSON inválido', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: '{"invalid_schema": true}' } }],
          }),
      })
    );
    const { interpretIntakeWithGroq } = await import(
      '@/app/(public)/empezar/actions/interpretIntakeWithGroq'
    );
    const result = await interpretIntakeWithGroq(groqInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.source).toBe('fallback');
    }
  });
});

// ─── checkClerkUserHasClient — contrato de seguridad ─────

describe('checkClerkUserHasClient — contrato de seguridad', () => {
  it('el schema de input es vacío — no acepta clerkUserId del cliente', () => {
    const keys = Object.keys(checkClerkUserHasClientInputSchema.shape);
    expect(keys).not.toContain('clerkUserId');
    expect(keys.length).toBe(0);
  });

  it('Zod strip: clerkUserId enviado por cliente queda fuera del resultado', () => {
    const result = checkClerkUserHasClientInputSchema.safeParse({
      clerkUserId: 'user_malicious_arbitrary',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect('clerkUserId' in result.data).toBe(false);
    }
  });

  it('schema vacío acepta objeto vacío sin errores', () => {
    expect(checkClerkUserHasClientInputSchema.safeParse({}).success).toBe(true);
  });

  it('schema vacío acepta objeto vacío sin campos — no requiere nada del cliente', () => {
    const result = checkClerkUserHasClientInputSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data).length).toBe(0);
    }
  });
});

// ─── Helpers ─────────────────────────────────────────────

function validV2Payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    firstName: 'María',
    lastName: 'García',
    email: 'test@example.com',
    whatsapp: '+18095551234',
    businessName: 'Mi Negocio',
    industry: 'salud',
    whatYouOffer: 'Servicios de consultoría en salud',
    hasExistingSite: false,
    currentUrl: '',
    primaryProblems: ['professional_presence'],
    primaryGoals: ['contacts'],
    freeformBrief: 'Quiero un sitio profesional para mi clínica estética en Santo Domingo.',
    brandIdentityStatus: 'has_logo_and_style',
    copyStatus: 'ready',
    photosStatus: 'ready',
    domainStatus: 'has_domain',
    termsAccepted: true,
    termsVersion: '1.0',
    ...overrides,
  };
}

function groqInput(
  overrides: Partial<{
    freeformBrief: string;
    primaryProblems: string[];
    primaryGoals: string[];
    businessName: string;
    industry: string;
    hasExistingSite: boolean;
  }> = {}
) {
  return {
    freeformBrief: 'Tengo una clínica estética y quiero mostrar mis servicios en línea.',
    primaryProblems: ['professional_presence'],
    primaryGoals: ['contacts', 'services_brand'],
    businessName: 'Clínica Estética Test',
    industry: 'salud',
    hasExistingSite: false,
    ...overrides,
  };
}
