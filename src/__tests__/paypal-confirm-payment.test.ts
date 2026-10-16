// ============================================================
// POST /api/paypal/confirm-payment — endurecimiento
//
// El endpoint crea proyectos en estado PAYMENT_RECEIVED. Solo debe hacerlo
// cuando PayPal confirma una suscripción ACTIVE del plan esperado.
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.PAYPAL_PLAN_ID_BASIC = 'P-BASIC-TEST';
  process.env.PAYPAL_PLAN_ID_PRO = 'P-PRO-TEST';
  process.env.PAYPAL_PLAN_ID_BUSINESS = 'P-BUSINESS-TEST';
});

const state = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  inserts: [] as Array<{ table: unknown; values: unknown }>,
}));
const paypalFetch = vi.hoisted(() => vi.fn());
const inngestSend = vi.hoisted(() => vi.fn());

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/paypal/client', () => ({ paypalFetch }));
vi.mock('@/inngest/client', () => ({ inngest: { send: inngestSend } }));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({ limit: async () => state.selectQueue.shift() ?? [] }),
      }),
    })),
    insert: vi.fn((table: unknown) => ({
      values: (values: unknown) => {
        state.inserts.push({ table, values });
        return { returning: async () => [{ id: 'new-id' }], then: undefined };
      },
    })),
    update: vi.fn(() => ({ set: () => ({ where: async () => undefined }) })),
  },
}));

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { POST } from '@/app/api/paypal/confirm-payment/route';
import { projects } from '@/db/schema';

const validIntake = {
  fullName: 'Ana Prueba',
  email: 'ana@example.com',
  whatsapp: '+1 809 555 0100',
  businessName: 'Clínica Demo',
  industry: 'salud',
  location: 'Santo Domingo',
  materialStatus: 'tiene_todo',
  features: { needsBooking: true },
};

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/paypal/confirm-payment', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9, 10.0.0.1' },
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    subscriptionId: 'I-TESTSUB12345',
    plan: 'PRO',
    intakeSnapshot: validIntake,
    termsVersion: '1.0',
    ...overrides,
  };
}

function subscription(status: string, planId = 'P-PRO-TEST') {
  paypalFetch.mockResolvedValue({ id: 'I-TESTSUB12345', status, plan_id: planId });
}

describe('POST /api/paypal/confirm-payment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.selectQueue = [];
    state.inserts = [];
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
  });

  it('rechaza una suscripción que aún no fue aprobada (APPROVAL_PENDING)', async () => {
    subscription('APPROVAL_PENDING');
    const res = await POST(request(validBody()));

    expect(res.status).toBe(422);
    expect(state.inserts).toHaveLength(0);
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it('rechaza una suscripción de otro plan', async () => {
    subscription('ACTIVE', 'P-BASIC-TEST');
    const res = await POST(request(validBody({ plan: 'PRO' })));

    expect(res.status).toBe(422);
    expect(state.inserts).toHaveLength(0);
  });

  it('valida el identificador de suscripción antes de consultar a PayPal', async () => {
    const res = await POST(request(validBody({ subscriptionId: '../../v1/orders' })));

    expect(res.status).toBe(400);
    expect(paypalFetch).not.toHaveBeenCalled();
  });

  it('rechaza un snapshot de intake inválido sin consultar a PayPal', async () => {
    const res = await POST(
      request(validBody({ intakeSnapshot: { ...validIntake, email: 'no-es-un-correo' } })),
    );

    expect(res.status).toBe(400);
    expect(paypalFetch).not.toHaveBeenCalled();
  });

  it('crea el proyecto cuando la suscripción está ACTIVE y registra la hora del servidor', async () => {
    subscription('ACTIVE');
    state.selectQueue = [[], []]; // sin proyecto previo, sin cliente previo por email

    const before = Date.now();
    const res = await POST(
      request(validBody({ termsAcceptedAt: '1999-01-01T00:00:00.000Z' })),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ projectId: 'new-id' });

    const projectInsert = state.inserts.find((entry) => entry.table === projects);
    const values = projectInsert?.values as {
      status: string;
      termsAcceptedAt: Date;
      termsAcceptedIp: string;
    };
    expect(values.status).toBe('PAYMENT_RECEIVED');
    expect(values.termsAcceptedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(values.termsAcceptedIp).toBe('203.0.113.9');
    expect(inngestSend).toHaveBeenCalledWith({
      name: 'waas/payment.received',
      data: { projectId: 'new-id' },
    });
  });

  it('es idempotente: la misma suscripción devuelve el proyecto existente', async () => {
    subscription('ACTIVE');
    state.selectQueue = [[{ id: 'existing-project' }]];

    const res = await POST(request(validBody()));

    expect(await res.json()).toEqual({ projectId: 'existing-project' });
    expect(state.inserts).toHaveLength(0);
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it('no adjunta proyectos a un cliente con cuenta real si quien llama no tiene sesión', async () => {
    subscription('ACTIVE');
    state.selectQueue = [[], [{ id: 'victim-client', clerkUserId: 'user_real_account' }]];

    const res = await POST(request(validBody()));

    expect(res.status).toBe(409);
    expect(state.inserts).toHaveLength(0);
  });

  it('sí reutiliza un cliente pendiente (sin cuenta todavía) con el mismo correo', async () => {
    subscription('ACTIVE');
    state.selectQueue = [[], [{ id: 'pending-client', clerkUserId: 'pending_ana@example.com' }]];

    const res = await POST(request(validBody()));

    expect(res.status).toBe(200);
    const projectInsert = state.inserts.find((entry) => entry.table === projects);
    expect((projectInsert?.values as { clientId: string }).clientId).toBe('pending-client');
  });

  it('no filtra detalles internos cuando PayPal falla', async () => {
    paypalFetch.mockRejectedValue(new Error('PayPal 500: secreto-interno'));

    const res = await POST(request(validBody()));
    const payload = await res.json();

    expect(res.status).toBe(500);
    expect(JSON.stringify(payload)).not.toContain('secreto-interno');
  });
});
