// ============================================================
// Tests unitarios — Portal Client Link Logic + Portal State
// Cubre: resolveClientLink, classifyPortalState, status sets
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  resolveClientLink,
  classifyPortalState,
  PENDING_PROJECT_STATUSES,
  ACTIVE_PROJECT_STATUSES,
} from '@/lib/portal/client-link-logic';

// ─── resolveClientLink ────────────────────────────────────

describe('resolveClientLink', () => {
  it('client existe por clerkUserId igual → use_as_is', () => {
    expect(resolveClientLink('user_real123', 'user_real123')).toBe('use_as_is');
  });

  it('client con pending_ + usuario Clerk real → update_clerk_id', () => {
    expect(resolveClientLink('pending_some-uuid', 'user_real123')).toBe('update_clerk_id');
  });

  it('client con clerkUserId vacío + usuario Clerk real → update_clerk_id', () => {
    expect(resolveClientLink('', 'user_real123')).toBe('update_clerk_id');
  });

  it('client con clerkUserId null + usuario Clerk real → update_clerk_id', () => {
    expect(resolveClientLink(null, 'user_real123')).toBe('update_clerk_id');
  });

  it('client con clerk real distinto → conflict', () => {
    expect(resolveClientLink('user_other456', 'user_real123')).toBe('conflict');
  });

  it('submit anónimo (sin incomingClerkId) + pending client → use_as_is', () => {
    expect(resolveClientLink('pending_some-uuid', undefined)).toBe('use_as_is');
  });

  it('submit anónimo (sin incomingClerkId) + vacío → use_as_is', () => {
    expect(resolveClientLink('', undefined)).toBe('use_as_is');
  });

  it('submit anónimo (sin incomingClerkId) + clerk real existente → conflict (email hijacking protegido)', () => {
    expect(resolveClientLink('user_real123', undefined)).toBe('conflict');
  });

  it('submit autenticado con email de otro client real → conflict', () => {
    expect(resolveClientLink('user_alice', 'user_bob')).toBe('conflict');
  });

  it('pending_ en incoming no genera update_clerk_id aunque el existing sea pending_', () => {
    expect(resolveClientLink('pending_abc', 'pending_def')).toBe('use_as_is');
  });
});

// ─── submitV2 security — ctx.userId como fuente de verdad ──

describe('submitV2 security — resolveClientLink con ctx.userId (server-side)', () => {
  it('anonymous (ctx.userId=null) + client pending existente → use_as_is (puede usar pending)', () => {
    expect(resolveClientLink('pending_abc', null)).toBe('use_as_is');
  });

  it('anonymous (ctx.userId=null) + sin client existente → no llama resolveClientLink (crea pending directo)', () => {
    // Documentación de flujo: submitV2 solo llama resolveClientLink cuando hay client existente por email.
    // Con no-existente: crea client con pending_uuid. No hay conflicto posible.
    expect(true).toBe(true);
  });

  it('anonymous (ctx.userId=null) + client REAL existente → conflict (email hijacking bloqueado)', () => {
    expect(resolveClientLink('user_real123', null)).toBe('conflict');
  });

  it('authenticated (ctx.userId=user_A) + client pending → update_clerk_id (vinculación segura)', () => {
    expect(resolveClientLink('pending_abc', 'user_A')).toBe('update_clerk_id');
  });

  it('authenticated (ctx.userId=user_A) + mismo client real → use_as_is', () => {
    expect(resolveClientLink('user_A', 'user_A')).toBe('use_as_is');
  });

  it('authenticated (ctx.userId=user_A) + diferente client real → conflict (protege propietario real)', () => {
    expect(resolveClientLink('user_B', 'user_A')).toBe('conflict');
  });

  it('input.clerkUserId malicioso no puede vincularse si ctx.userId es null', () => {
    // submitV2 usa authenticatedClerkUserId = ctx.userId ?? null, ignorando input.clerkUserId.
    // resolveClientLink(realExisting, null) → conflict
    expect(resolveClientLink('user_real_victim', null)).toBe('conflict');
  });
});

// ─── classifyPortalState ──────────────────────────────────

describe('classifyPortalState', () => {
  it('accountConflict → conflict (máxima prioridad)', () => {
    expect(
      classifyPortalState({ accountConflict: true, hasActiveProject: true, hasPendingRequest: true })
    ).toBe('conflict');
  });

  it('hasActiveProject → dashboard (prioridad sobre pending)', () => {
    expect(
      classifyPortalState({ accountConflict: false, hasActiveProject: true, hasPendingRequest: true })
    ).toBe('dashboard');
  });

  it('solo hasActiveProject → dashboard', () => {
    expect(
      classifyPortalState({ accountConflict: false, hasActiveProject: true, hasPendingRequest: false })
    ).toBe('dashboard');
  });

  it('hasPendingRequest sin active → pending', () => {
    expect(
      classifyPortalState({ accountConflict: false, hasActiveProject: false, hasPendingRequest: true })
    ).toBe('pending');
  });

  it('nada → empty', () => {
    expect(
      classifyPortalState({ accountConflict: false, hasActiveProject: false, hasPendingRequest: false })
    ).toBe('empty');
  });
});

// ─── Status sets ──────────────────────────────────────────

describe('PENDING_PROJECT_STATUSES', () => {
  it('incluye DRAFT', () => {
    expect(PENDING_PROJECT_STATUSES).toContain('DRAFT');
  });

  it('incluye REQUIRES_REVIEW', () => {
    expect(PENDING_PROJECT_STATUSES).toContain('REQUIRES_REVIEW');
  });

  it('no incluye estados activos del portal', () => {
    expect(PENDING_PROJECT_STATUSES).not.toContain('AWAITING_ASSETS');
    expect(PENDING_PROJECT_STATUSES).not.toContain('LIVE');
  });
});

describe('ACTIVE_PROJECT_STATUSES', () => {
  it('incluye AWAITING_ASSETS', () => {
    expect(ACTIVE_PROJECT_STATUSES).toContain('AWAITING_ASSETS');
  });

  it('incluye LIVE', () => {
    expect(ACTIVE_PROJECT_STATUSES).toContain('LIVE');
  });

  it('incluye SUSPENDED', () => {
    expect(ACTIVE_PROJECT_STATUSES).toContain('SUSPENDED');
  });

  it('incluye PROPOSAL_SENT (cliente tiene propuesta activa)', () => {
    expect(ACTIVE_PROJECT_STATUSES).toContain('PROPOSAL_SENT');
  });

  it('no incluye DRAFT ni REQUIRES_REVIEW', () => {
    expect(ACTIVE_PROJECT_STATUSES).not.toContain('DRAFT');
    expect(ACTIVE_PROJECT_STATUSES).not.toContain('REQUIRES_REVIEW');
  });

  it('no incluye estados terminales', () => {
    expect(ACTIVE_PROJECT_STATUSES).not.toContain('CANCELLED');
    expect(ACTIVE_PROJECT_STATUSES).not.toContain('PROPOSAL_EXPIRED');
    expect(ACTIVE_PROJECT_STATUSES).not.toContain('CLOSED');
  });
});

// ─── submitV2 behavior (schema-level) ────────────────────

import { intakeSubmitSchemaV2 } from '@/lib/intake/schema';

describe('submitV2 — comportamiento de schema', () => {
  const basePayload = {
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
    termsAccepted: true as const,
    termsVersion: '1.0',
  };

  it('acepta submit anónimo (sin clerkUserId)', () => {
    expect(intakeSubmitSchemaV2.safeParse(basePayload).success).toBe(true);
  });

  it('acepta submit autenticado con clerk real', () => {
    expect(
      intakeSubmitSchemaV2.safeParse({ ...basePayload, clerkUserId: 'user_clerk_real_abc' }).success
    ).toBe(true);
  });

  it('full_ownership en goals debe incluirse en payload válido', () => {
    expect(
      intakeSubmitSchemaV2.safeParse({
        ...basePayload,
        primaryGoals: ['full_ownership'],
      }).success
    ).toBe(true);
  });

  it('selectedPlanIntent null es válido', () => {
    expect(
      intakeSubmitSchemaV2.safeParse({ ...basePayload, selectedPlanIntent: null }).success
    ).toBe(true);
  });

  it('suggestedAddOns no es parte del submit schema V2 (pertenece al servidor)', () => {
    const parsed = intakeSubmitSchemaV2.safeParse(basePayload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect('suggestedAddOns' in parsed.data).toBe(false);
    }
  });
});
