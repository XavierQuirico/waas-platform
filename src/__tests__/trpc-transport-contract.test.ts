// ============================================================
// Contrato de transporte tRPC (cliente <-> servidor)
//
// Los componentes del portal y del admin llaman a /api/trpc con fetch y el
// formato de superjson: el cuerpo va en `{ json: ... }` y la respuesta se lee de
// `result.data.json`. Estas pruebas ejercitan el manejador HTTP real con una
// Request real, no el router por separado, para detectar cualquier desajuste.
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ selectQueue: [] as unknown[][] }));

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn(), currentUser: vi.fn() }));
vi.mock('@/inngest/client', () => ({ inngest: { send: vi.fn() } }));
vi.mock('@/lib/r2-client', () => ({ r2Client: { send: vi.fn() } }));
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({ limit: async () => state.selectQueue.shift() ?? [] }),
      }),
    })),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { auth } from '@clerk/nextjs/server';
import { appRouter } from '@/server/routers';
import { createTRPCContext } from '@/server/trpc';

function handle(request: Request) {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req: request,
    router: appRouter,
    createContext: createTRPCContext,
  });
}

function post(path: string, body: unknown) {
  return handle(
    new Request(`http://localhost/api/trpc/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

describe('contrato de transporte tRPC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.selectQueue = [];
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
  });

  it('interpreta el cuerpo `{ json: ... }` como entrada del procedimiento', async () => {
    const res = await post('intake.submitV2', { json: { firstName: '' } });
    const body = await res.json();

    // El campo anidado se valida con su mensaje propio (no "Required" a nivel raíz).
    expect(res.status).toBe(400);
    const message: string = body.error.json.message;
    expect(message).toContain('Nombre requerido');
  });

  it('un cuerpo sin envoltorio ya no se interpreta como entrada válida', async () => {
    const res = await post('intake.submitV2', { firstName: '' });
    expect(res.status).toBe(400);
  });

  it('envuelve los errores como `error.json` (formato que leen los clientes)', async () => {
    const res = await post('intake.submitV2', { json: {} });
    const body = await res.json();

    expect(body.error.json).toMatchObject({ code: expect.anything() });
    expect(body.error.json.data.code).toBe('BAD_REQUEST');
  });

  it('un procedimiento protegido responde 401 sin sesión', async () => {
    const res = await post('assets.submitForReview', {
      json: { projectId: '3f9d8c1e-6a52-4a7b-9d0e-1b2c3d4e5f60' },
    });
    expect(res.status).toBe(401);
  });

  it('devuelve el resultado en `result.data.json`, como esperan los componentes', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user_1' } as never);
    state.selectQueue = [[{ id: 'client-1' }]];

    const input = encodeURIComponent(JSON.stringify({ json: {} }));
    const res = await handle(
      new Request(`http://localhost/api/trpc/intake.checkClerkUserHasClient?input=${input}`),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result.data.json).toEqual({ hasClient: true, clientId: 'client-1' });
  });

  it('valida la entrada anidada de un procedimiento protegido (como AssetChecklist)', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user_1' } as never);

    const res = await post('assets.getUploadUrl', {
      json: { projectId: 'no-es-uuid', assetKey: 'logo', mimeType: 'image/png', fileSize: 10 },
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.json.message).toContain('projectId');
  });
});
