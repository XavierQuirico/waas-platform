import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadClient() {
  vi.resetModules();
  return (await import('@/inngest/client')).inngest;
}

describe('cliente de Inngest', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('con INNGEST_DISABLED=true no envía eventos y no falla', async () => {
    vi.stubEnv('INNGEST_DISABLED', 'true');
    const inngest = await loadClient();

    await expect(inngest.send({ name: 'waas/payment.received', data: { projectId: 'p1' } })).resolves.toEqual({
      ids: [],
    });
  });

  it('con INNGEST_DISABLED=true sigue permitiendo registrar funciones', async () => {
    vi.stubEnv('INNGEST_DISABLED', 'true');
    const inngest = await loadClient();

    const fn = inngest.createFunction({ id: 'test-fn' }, { event: 'waas/test' }, async () => 'ok');
    expect(fn).toBeDefined();
  });

  it('sin la opción conserva el cliente real', async () => {
    vi.stubEnv('INNGEST_DISABLED', '');
    const inngest = await loadClient();

    // El cliente real intenta enviar de verdad: sin clave de eventos el resultado NO es el no-op.
    const outcome = await inngest
      .send({ name: 'waas/test', data: {} })
      .then((result) => result)
      .catch(() => 'rejected');
    expect(outcome).not.toEqual({ ids: [] });
  });
});
