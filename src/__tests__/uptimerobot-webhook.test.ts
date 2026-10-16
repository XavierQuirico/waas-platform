import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  project: [] as unknown[],
  inserts: 0,
  updates: 0,
}));
const inngestSend = vi.hoisted(() => vi.fn());

vi.mock('@/inngest/client', () => ({ inngest: { send: inngestSend } }));
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: () => {
          const rows = state.project;
          const result = Promise.resolve(rows) as Promise<unknown[]> & { limit: () => Promise<unknown[]> };
          result.limit = async () => rows;
          return result;
        },
      }),
    })),
    insert: vi.fn(() => ({
      values: () => {
        state.inserts += 1;
        return { returning: async () => [{ id: 'incident-1' }] };
      },
    })),
    update: vi.fn(() => ({
      set: () => ({
        where: async () => {
          state.updates += 1;
        },
      }),
    })),
  },
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/webhooks/uptimerobot/route';

function webhook(options: { secret?: string; header?: string; body?: Record<string, string> }) {
  const url = new URL('http://localhost/api/webhooks/uptimerobot');
  if (options.secret) url.searchParams.set('secret', options.secret);
  const form = new URLSearchParams(
    options.body ?? { monitorURL: 'https://cliente.example.com', alertType: '1' },
  );
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      ...(options.header ? { 'x-webhook-secret': options.header } : {}),
    },
    body: form.toString(),
  });
}

describe('webhook de UptimeRobot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.project = [{ id: 'project-1', status: 'LIVE' }];
    state.inserts = 0;
    state.updates = 0;
    process.env.UPTIMEROBOT_WEBHOOK_SECRET = 'secreto-de-prueba';
  });

  afterEach(() => {
    delete process.env.UPTIMEROBOT_WEBHOOK_SECRET;
  });

  it('rechaza peticiones sin secreto y no crea incidencias ni eventos', async () => {
    const res = await POST(webhook({}));

    expect(res.status).toBe(401);
    expect(state.inserts).toBe(0);
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it('rechaza un secreto incorrecto', async () => {
    const res = await POST(webhook({ secret: 'otro-secreto' }));
    expect(res.status).toBe(401);
    expect(state.inserts).toBe(0);
  });

  it('falla cerrado cuando el servidor no tiene secreto configurado', async () => {
    delete process.env.UPTIMEROBOT_WEBHOOK_SECRET;
    const res = await POST(webhook({ secret: 'cualquiera' }));
    expect(res.status).toBe(401);
  });

  it('con el secreto correcto en la URL crea la incidencia y avisa', async () => {
    const res = await POST(webhook({ secret: 'secreto-de-prueba' }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ action: 'incident_created' });
    expect(inngestSend).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'waas/site.down' }),
    );
  });

  it('acepta el secreto también por cabecera', async () => {
    const res = await POST(webhook({ header: 'secreto-de-prueba', body: { monitorURL: 'https://cliente.example.com', alertType: '5' } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ action: 'ignored' });
  });

  it('devuelve 404 si la URL no pertenece a ningún proyecto', async () => {
    state.project = [];
    const res = await POST(webhook({ secret: 'secreto-de-prueba' }));
    expect(res.status).toBe(404);
  });
});
