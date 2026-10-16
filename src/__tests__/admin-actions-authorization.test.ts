// ============================================================
// Autorización de server actions administrativas
//
// Las server actions son endpoints POST públicos: el layout del admin NO se
// ejecuta cuando se invocan. Cada acción debe verificar sesión y rol por sí
// misma. Estas pruebas ejecutan las acciones sin sesión y con un usuario que
// no es admin, y comprueban que no tocan base de datos, correo ni red.
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const sendEmail = vi.hoisted(() => vi.fn());
const inngestSend = vi.hoisted(() => vi.fn());
const dbInsert = vi.hoisted(() => vi.fn());
const dbUpdate = vi.hoisted(() => vi.fn());
const dbDelete = vi.hoisted(() => vi.fn());

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));

// La consulta de la tabla `admins` devuelve vacío: ningún usuario es admin salvo
// el definido por ADMIN_CLERK_USER_ID (ver setup.ts).
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({ where: () => ({ limit: async () => [] }) }),
    })),
    insert: dbInsert,
    update: dbUpdate,
    delete: dbDelete,
  },
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendEmail };
  },
}));

vi.mock('@/inngest/client', () => ({ inngest: { send: inngestSend } }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));

import { auth } from '@clerk/nextjs/server';
import {
  getManualPaymentOptions,
  registerManualPayment,
} from '@/app/admin/facturacion/actions';
import {
  calculateQuoteAction,
  saveQuoteAction,
  updateQuoteStatusAction,
} from '@/app/admin/calculadora/actions/calculate';
import { createProjectFromProposalAction } from '@/app/admin/calculadora/actions/createProject';
import { sendProposalEmailAction } from '@/app/admin/calculadora/actions/sendProposalEmail';
import {
  getCatalogAISummaryAction,
  getCatalogBreakdownAction,
} from '@/app/admin/calculadora/actions/getCatalogBreakdown';
import { analyzeClientBriefAction } from '@/app/admin/calculadora/actions/analyzeWithAI';
import { getExchangeRate } from '@/app/admin/calculadora/actions/getExchangeRate';
import { isAdmin, requireAdmin } from '@/lib/admin/auth';

const mockedAuth = vi.mocked(auth);

function signInAs(userId: string | null) {
  mockedAuth.mockResolvedValue({ userId } as never);
}

const arg = {} as never;

const sessions: Array<[string, string | null]> = [
  ['sin sesión', null],
  ['un usuario autenticado que no es admin', 'user_regular_client'],
];

describe.each(sessions)('acciones de admin con %s', (_label, userId) => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInAs(userId);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getManualPaymentOptions rechaza y no lee clientes', async () => {
    await expect(getManualPaymentOptions()).rejects.toThrow('No autorizado');
  });

  it('registerManualPayment rechaza y no registra pagos ni dispara eventos', async () => {
    const form = new FormData();
    form.set('projectId', 'any-project');
    form.set(
      'lineItems',
      JSON.stringify([{ type: 'setup_fee', label: 'Setup', amountCents: 10000 }]),
    );

    await expect(registerManualPayment(form)).rejects.toThrow('No autorizado');
    expect(dbInsert).not.toHaveBeenCalled();
    expect(dbUpdate).not.toHaveBeenCalled();
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it('calculateQuoteAction devuelve error de autorización', async () => {
    const result = await calculateQuoteAction(arg, arg, '');
    expect(result).toEqual({ success: false, error: 'No autorizado.' });
  });

  it('saveQuoteAction no guarda cotizaciones', async () => {
    const result = await saveQuoteAction(arg, arg, arg);
    expect(result).toEqual({ success: false, error: 'No autorizado.' });
    expect(dbInsert).not.toHaveBeenCalled();
  });

  it('updateQuoteStatusAction no cambia el estado', async () => {
    const result = await updateQuoteStatusAction('quote-id', 'accepted');
    expect(result).toEqual({ success: false, error: 'No autorizado.' });
    expect(dbUpdate).not.toHaveBeenCalled();
  });

  it('createProjectFromProposalAction no crea clientes ni proyectos', async () => {
    const result = await createProjectFromProposalAction(arg, arg);
    expect(result).toEqual({ success: false, error: 'No autorizado.' });
    expect(dbInsert).not.toHaveBeenCalled();
  });

  it('sendProposalEmailAction no envía correo (sin relay abierto)', async () => {
    const result = await sendProposalEmailAction('victim@example.com', arg);
    expect(result).toEqual({ error: 'No autorizado.' });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('las acciones del catálogo de la calculadora rechazan', async () => {
    expect(await getCatalogBreakdownAction('PRO')).toEqual({
      success: false,
      error: 'No autorizado.',
    });
    expect(await getCatalogAISummaryAction('PRO')).toEqual({
      success: false,
      error: 'No autorizado.',
    });
  });

  it('analyzeClientBriefAction no consume la API de IA', async () => {
    const result = await analyzeClientBriefAction(arg);
    expect(result).toEqual({ success: false, error: 'No autorizado.' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('getExchangeRate no realiza la petición externa', async () => {
    expect(await getExchangeRate()).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('guardas compartidas de admin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('isAdmin reconoce al administrador configurado por entorno', async () => {
    signInAs('test_admin_id');
    expect(await isAdmin()).toBe(true);
    await expect(requireAdmin()).resolves.toMatchObject({ userId: 'test_admin_id' });
  });

  it('isAdmin rechaza a un usuario ausente de la tabla admins', async () => {
    signInAs('someone_else');
    expect(await isAdmin()).toBe(false);
    await expect(requireAdmin()).rejects.toThrow('No autorizado');
  });

  it('un administrador sí puede ejecutar las acciones protegidas', async () => {
    signInAs('test_admin_id');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ rates: { DOP: 60 }, time_last_update_utc: 'now' }),
      })),
    );

    expect(await getExchangeRate()).toEqual({ rate: 60, updatedAt: 'now' });
    vi.unstubAllGlobals();
  });
});

// ─── Red de seguridad: ningún archivo 'use server' del admin sin guarda ─────

function collectFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('contrato: todo archivo con server actions del admin verifica el rol', () => {
  const adminRoot = path.join(process.cwd(), 'src', 'app', 'admin');
  const GUARD = /requireAdmin\(|isAdmin\(|assertAdmin\(|ADMIN_CLERK_USER_ID/;

  const filesWithActions = collectFiles(adminRoot).filter((file) =>
    /['"]use server['"]/.test(fs.readFileSync(file, 'utf8')),
  );

  it('encuentra archivos con server actions que revisar', () => {
    expect(filesWithActions.length).toBeGreaterThan(10);
  });

  it.each(filesWithActions.map((file) => [path.relative(process.cwd(), file), file]))(
    '%s contiene una guarda de rol',
    (_relative, file) => {
      expect(fs.readFileSync(file, 'utf8')).toMatch(GUARD);
    },
  );
});
