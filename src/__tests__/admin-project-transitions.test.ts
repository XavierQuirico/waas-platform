// ============================================================
// Transiciones de estado desde el admin
//
// Un proyecto solo se mueve por transiciones que la máquina de estados permite,
// y la escritura se condiciona al estado leído para que una operación
// concurrente no pise a otra.
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  updateResult: [{ id: 'project-1' }] as unknown[],
  updates: 0,
  events: 0,
}));
const inngestSend = vi.hoisted(() => vi.fn());

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/inngest/client', () => ({ inngest: { send: inngestSend } }));
vi.mock('@/lib/sla/business-hours', () => ({
  getHolidaysFromDB: vi.fn(async () => []),
  calculateStagingReviewDeadline: vi.fn(() => new Date('2030-01-01T00:00:00Z')),
  calculateProductionDeadline: vi.fn(() => new Date('2030-01-01T00:00:00Z')),
}));
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({ limit: async () => state.selectQueue.shift() ?? [] }),
      }),
    })),
    update: vi.fn(() => ({
      set: () => ({
        where: () => ({
          returning: async () => {
            state.updates += 1;
            return state.updateResult;
          },
        }),
      }),
    })),
    insert: vi.fn(() => ({
      values: async () => {
        state.events += 1;
      },
    })),
  },
}));

import { adminRouter } from '@/server/routers/admin';

const PROJECT_ID = '3f9d8c1e-6a52-4a7b-9d0e-1b2c3d4e5f60';
const caller = () => adminRouter.createCaller({ userId: 'test_admin_id' });

// assertAdmin consulta la tabla admins; luego cada procedimiento lee el estado.
function withStatus(status: string) {
  state.selectQueue = [[{ id: 'admin-row' }], [{ status }]];
}

describe('admin.deployToStaging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.updateResult = [{ id: PROJECT_ID }];
    state.updates = 0;
    state.events = 0;
  });

  it('despliega desde PRODUCTION_STARTED y registra el estado real de origen', async () => {
    withStatus('PRODUCTION_STARTED');
    const result = await caller().deployToStaging({
      projectId: PROJECT_ID,
      stagingUrl: 'https://staging.example.com',
    });

    expect(result.status).toBe('STAGING_REVIEW');
    expect(state.events).toBe(1);
    expect(inngestSend).toHaveBeenCalledWith(expect.objectContaining({ name: 'waas/staging.deployed' }));
  });

  it('rechaza desplegar a staging un proyecto que ya está publicado', async () => {
    withStatus('LIVE');
    await expect(
      caller().deployToStaging({ projectId: PROJECT_ID, stagingUrl: 'https://staging.example.com' }),
    ).rejects.toThrow('No se puede desplegar a staging');
    expect(state.updates).toBe(0);
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it('no escribe si otra operación cambió el estado mientras tanto', async () => {
    withStatus('PRODUCTION_STARTED');
    state.updateResult = []; // el UPDATE condicional no encontró el estado leído

    await expect(
      caller().deployToStaging({ projectId: PROJECT_ID, stagingUrl: 'https://staging.example.com' }),
    ).rejects.toThrow('cambió mientras se procesaba');
    expect(state.events).toBe(0);
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it('solo acepta URLs https', async () => {
    withStatus('PRODUCTION_STARTED');
    await expect(
      caller().deployToStaging({ projectId: PROJECT_ID, stagingUrl: 'http://staging.example.com' }),
    ).rejects.toThrow();
    await expect(
      caller().deployToStaging({ projectId: PROJECT_ID, stagingUrl: 'javascript:alert(1)' }),
    ).rejects.toThrow();
  });
});

describe('admin.markLive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.updateResult = [{ id: PROJECT_ID }];
    state.updates = 0;
    state.events = 0;
  });

  it('publica un proyecto que ya pasó la revisión', async () => {
    withStatus('STAGING_REVIEW');
    const result = await caller().markLive({
      projectId: PROJECT_ID,
      productionUrl: 'https://cliente.example.com',
    });

    expect(result.status).toBe('LIVE');
    expect(inngestSend).toHaveBeenCalledWith(expect.objectContaining({ name: 'waas/project.live' }));
  });

  it.each(['DRAFT', 'AWAITING_ASSETS', 'CANCELLED', 'CLOSED'])(
    'no publica un proyecto en estado %s',
    async (status) => {
      withStatus(status);
      await expect(
        caller().markLive({ projectId: PROJECT_ID, productionUrl: 'https://cliente.example.com' }),
      ).rejects.toThrow('No se puede publicar el sitio');
      expect(state.updates).toBe(0);
    },
  );
});

describe('admin.suspendProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.updateResult = [{ id: PROJECT_ID }];
    state.updates = 0;
  });

  it('suspende un sitio publicado', async () => {
    withStatus('LIVE');
    expect(await caller().suspendProject({ projectId: PROJECT_ID })).toEqual({ status: 'SUSPENDED' });
  });

  it.each(['PRODUCTION_STARTED', 'STAGING_REVIEW', 'DRAFT'])(
    'no suspende un proyecto que todavía no está publicado (%s)',
    async (status) => {
      withStatus(status);
      await expect(caller().suspendProject({ projectId: PROJECT_ID })).rejects.toThrow(
        'No se puede suspender el proyecto',
      );
      expect(state.updates).toBe(0);
    },
  );

  it('rechaza suspender un proyecto ya suspendido', async () => {
    withStatus('SUSPENDED');
    await expect(caller().suspendProject({ projectId: PROJECT_ID })).rejects.toThrow('ya está suspendido');
  });
});
