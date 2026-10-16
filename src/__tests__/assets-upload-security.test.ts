// ============================================================
// Subidas a R2 — validaciones de servidor
//
// La URL firmada de R2 no limita el tamaño ni el contenido, así que el
// servidor valida clave de material, índice, tipo, estado del proyecto y,
// al confirmar, que el objeto exista y respete el tamaño máximo.
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  insertedValues: [] as unknown[],
}));
const r2Send = vi.hoisted(() => vi.fn());

vi.mock('@/lib/r2-client', () => ({ r2Client: { send: r2Send } }));
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(async () => 'https://signed.example/upload'),
}));
vi.mock('@/inngest/client', () => ({ inngest: { send: vi.fn() } }));
vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({ limit: async () => state.selectQueue.shift() ?? [] }),
      }),
    })),
    insert: vi.fn(() => ({
      values: (values: unknown) => {
        state.insertedValues.push(values);
        return {
          onConflictDoUpdate: () => ({ returning: async () => [{ id: 'asset-1' }] }),
        };
      },
    })),
    update: vi.fn(() => ({
      set: () => ({
        where: () => ({ returning: async () => [{ id: 'asset-1', status: 'uploaded' }] }),
      }),
    })),
  },
}));

import { assetsRouter } from '@/server/routers/assets';

const PROJECT_ID = '3f9d8c1e-6a52-4a7b-9d0e-1b2c3d4e5f60';
const ASSET_ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

const caller = () => assetsRouter.createCaller({ userId: 'user_client_1' });

function ownedProject(status = 'AWAITING_ASSETS') {
  return [
    [{ id: 'client-1' }],
    [{ id: PROJECT_ID, plan: 'PRO', portfolioFlag: false, status }],
  ];
}

const validUpload = {
  projectId: PROJECT_ID,
  assetKey: 'logo' as const,
  mimeType: 'image/png',
  fileSize: 1024,
  fileIndex: 0,
};

describe('assets.getUploadUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.selectQueue = [];
    state.insertedValues = [];
  });

  it('rechaza claves de material que no existen en el catálogo', async () => {
    await expect(
      caller().getUploadUrl({ ...validUpload, assetKey: '../../etc/passwd' as never }),
    ).rejects.toThrow();
    expect(state.insertedValues).toHaveLength(0);
  });

  it('rechaza índices fuera de rango o no enteros', async () => {
    await expect(caller().getUploadUrl({ ...validUpload, fileIndex: 5000 })).rejects.toThrow();
    await expect(caller().getUploadUrl({ ...validUpload, fileIndex: 1.5 })).rejects.toThrow();
    await expect(caller().getUploadUrl({ ...validUpload, fileSize: 12.5 })).rejects.toThrow();
  });

  it('rechaza tipos de archivo no permitidos', async () => {
    state.selectQueue = ownedProject();
    await expect(
      caller().getUploadUrl({ ...validUpload, mimeType: 'text/html' }),
    ).rejects.toThrow('Tipo de archivo no permitido');
    expect(state.insertedValues).toHaveLength(0);
  });

  it('rechaza archivos de más de 50 MB', async () => {
    state.selectQueue = ownedProject();
    await expect(
      caller().getUploadUrl({ ...validUpload, fileSize: 51 * 1024 * 1024 }),
    ).rejects.toThrow('tamaño máximo');
  });

  it('no permite subir en un estado de proyecto que no admite materiales', async () => {
    state.selectQueue = ownedProject('LIVE');
    await expect(caller().getUploadUrl(validUpload)).rejects.toThrow('estado actual');
  });

  it('no permite reemplazar un material ya aprobado', async () => {
    state.selectQueue = [...ownedProject(), [{ status: 'approved' }]];
    await expect(caller().getUploadUrl(validUpload)).rejects.toThrow('ya fue aprobado');
    expect(state.insertedValues).toHaveLength(0);
  });

  it('genera una clave con extensión de tabla fija y nunca con el MIME del cliente', async () => {
    state.selectQueue = [...ownedProject(), []];
    const result = await caller().getUploadUrl({ ...validUpload, mimeType: 'image/jpeg' });

    expect(result.uploadUrl).toBe('https://signed.example/upload');
    expect(result.r2Key).toMatch(
      new RegExp(`^projects/${PROJECT_ID}/assets/logo/[0-9a-f-]{36}\\.jpg$`),
    );
  });

  it('rechaza a un usuario que no es dueño del proyecto', async () => {
    state.selectQueue = [[{ id: 'client-1' }], []];
    await expect(caller().getUploadUrl(validUpload)).rejects.toThrow('No autorizado');
  });
});

describe('assets.confirmUpload', () => {
  const input = { assetId: ASSET_ID, r2Key: 'projects/p/assets/logo/u.png', originalName: 'logo.png' };

  function confirmContext(overrides: { assetStatus?: string; projectStatus?: string } = {}) {
    state.selectQueue = [
      [{ id: 'client-1' }],
      [{ projectId: PROJECT_ID, r2Key: input.r2Key, status: overrides.assetStatus ?? 'pending' }],
      [{ id: PROJECT_ID, status: overrides.projectStatus ?? 'AWAITING_ASSETS' }],
    ];
  }

  beforeEach(() => {
    vi.clearAllMocks();
    state.selectQueue = [];
  });

  it('rechaza confirmar un archivo que nunca llegó a R2', async () => {
    confirmContext();
    r2Send.mockRejectedValueOnce(new Error('NotFound'));

    await expect(caller().confirmUpload(input)).rejects.toThrow('no se subió correctamente');
  });

  it('elimina y rechaza un objeto que excede el tamaño máximo', async () => {
    confirmContext();
    r2Send
      .mockResolvedValueOnce({ ContentLength: 80 * 1024 * 1024 }) // HeadObject
      .mockResolvedValueOnce({}); // DeleteObject

    await expect(caller().confirmUpload(input)).rejects.toThrow('tamaño máximo');
    expect(r2Send).toHaveBeenCalledTimes(2);
    expect(r2Send.mock.calls[1][0].constructor.name).toBe('DeleteObjectCommand');
  });

  it('confirma cuando el objeto existe y respeta el tamaño', async () => {
    confirmContext();
    r2Send.mockResolvedValueOnce({ ContentLength: 2048 });

    const result = await caller().confirmUpload(input);
    expect(result.asset).toMatchObject({ status: 'uploaded' });
  });

  it('no confirma un material ya aprobado', async () => {
    confirmContext({ assetStatus: 'approved' });
    await expect(caller().confirmUpload(input)).rejects.toThrow('ya fue aprobado');
    expect(r2Send).not.toHaveBeenCalled();
  });

  it('no confirma cuando el proyecto ya no admite materiales', async () => {
    confirmContext({ projectStatus: 'LIVE' });
    await expect(caller().confirmUpload(input)).rejects.toThrow('estado actual');
  });

  it('rechaza una r2Key distinta a la registrada', async () => {
    confirmContext();
    await expect(
      caller().confirmUpload({ ...input, r2Key: 'projects/otro/assets/logo/x.png' }),
    ).rejects.toThrow('No se pudo confirmar');
  });
});
