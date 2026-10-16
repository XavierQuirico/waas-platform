// ============================================================
// Enlace del cliente del wizard anónimo con la cuenta recién creada
//
// Antes, quien llenaba el wizard sin sesión y luego se registraba quedaba como
// "sin asignar" y volvía en bucle a la pantalla de activación. Estas pruebas
// fijan el comportamiento correcto y sus límites de seguridad.
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  updates: [] as Array<Record<string, unknown>>,
}));
const verifiedEmail = vi.hoisted(() => vi.fn());

vi.mock('@/lib/portal/verified-email', () => ({
  getVerifiedPrimaryEmail: verifiedEmail,
}));
vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn(), currentUser: vi.fn() }));
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({ limit: async () => state.selectQueue.shift() ?? [] }),
      }),
    })),
    update: vi.fn(() => ({
      set: (values: Record<string, unknown>) => {
        state.updates.push(values);
        return { where: async () => undefined };
      },
    })),
  },
}));

import { linkPendingClientForUser } from '@/lib/portal/link-pending-client';
import { resolveUserRole } from '@/lib/routing/auth-destination';

const pendingClient = { id: 'client-1', fullName: 'Ana Prueba', clerkUserId: 'pending_abc' };

describe('linkPendingClientForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.selectQueue = [];
    state.updates = [];
  });

  it('enlaza el cliente pendiente cuando existe uno con el email verificado', async () => {
    verifiedEmail.mockResolvedValue('ana@example.com');
    state.selectQueue = [[pendingClient]];

    const result = await linkPendingClientForUser('user_new');

    expect(result).toEqual({ status: 'linked', client: { id: 'client-1', fullName: 'Ana Prueba' } });
    expect(state.updates).toEqual([{ clerkUserId: 'user_new' }]);
  });

  it('no hace nada si la cuenta no tiene un email verificado', async () => {
    verifiedEmail.mockResolvedValue(null);

    expect(await linkPendingClientForUser('user_new')).toEqual({ status: 'none' });
    expect(state.updates).toHaveLength(0);
  });

  it('devuelve none cuando no hay cliente con ese email', async () => {
    verifiedEmail.mockResolvedValue('nadie@example.com');
    state.selectQueue = [[]];

    expect(await linkPendingClientForUser('user_new')).toEqual({ status: 'none' });
  });

  it('marca conflicto si el email ya pertenece a otra cuenta real, sin modificarla', async () => {
    verifiedEmail.mockResolvedValue('ana@example.com');
    state.selectQueue = [[{ ...pendingClient, clerkUserId: 'user_other_real' }]];

    expect(await linkPendingClientForUser('user_new')).toEqual({ status: 'conflict' });
    expect(state.updates).toHaveLength(0);
  });

  it('es idempotente: si el cliente ya pertenece a esta cuenta no reescribe nada', async () => {
    verifiedEmail.mockResolvedValue('ana@example.com');
    state.selectQueue = [[{ ...pendingClient, clerkUserId: 'user_new' }]];

    const result = await linkPendingClientForUser('user_new');

    expect(result.status).toBe('linked');
    expect(state.updates).toHaveLength(0);
  });
});

describe('resolveUserRole tras el registro', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.selectQueue = [];
    state.updates = [];
  });

  it('un usuario nuevo con un cliente pendiente pasa a ser "client" (ya no cae en el bucle)', async () => {
    verifiedEmail.mockResolvedValue('ana@example.com');
    // admins → [], clients por clerkUserId → [], cliente pendiente por email → [pendingClient]
    state.selectQueue = [[], [], [pendingClient]];

    expect(await resolveUserRole('user_new')).toBe('client');
    expect(state.updates).toEqual([{ clerkUserId: 'user_new' }]);
  });

  it('un usuario sin ninguna solicitud previa sigue como "unassigned"', async () => {
    verifiedEmail.mockResolvedValue('nuevo@example.com');
    state.selectQueue = [[], [], []];

    expect(await resolveUserRole('user_new')).toBe('unassigned');
  });

  it('un usuario con email sin verificar no puede reclamar solicitudes ajenas', async () => {
    verifiedEmail.mockResolvedValue(null);
    state.selectQueue = [[], []];

    expect(await resolveUserRole('user_new')).toBe('unassigned');
    expect(state.updates).toHaveLength(0);
  });

  it('un cliente ya enlazado se resuelve sin tocar el email', async () => {
    state.selectQueue = [[], [{ id: 'client-1' }]];

    expect(await resolveUserRole('user_existing')).toBe('client');
    expect(verifiedEmail).not.toHaveBeenCalled();
  });
});
