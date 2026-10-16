// ============================================================
// tRPC Base — Context, Router, Procedures
// Auth: Clerk (server-side via @clerk/nextjs/server)
// ============================================================

import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { auth } from '@clerk/nextjs/server';
import { clientIpFromHeaders } from '@/lib/security/rate-limit';

// ─── Context ─────────────────────────────────────────────
export interface TRPCContext {
  userId: string | null;
  /** IP del cliente según el proxy; solo se usa para limitar abuso. */
  ip?: string;
}

export async function createTRPCContext(opts?: { req?: Request }): Promise<TRPCContext> {
  const { userId } = await auth();
  return { userId, ip: opts?.req ? clientIpFromHeaders(opts.req.headers) : undefined };
}

// ─── tRPC init ───────────────────────────────────────────
// superjson define el formato de transporte: las peticiones llevan el cuerpo en
// `{ json: ... }` y las respuestas devuelven `result.data.json`. Todos los
// clientes del portal y del admin usan ese formato; sin el transformer el
// servidor interpreta el cuerpo como crudo y rechaza esas llamadas.
const t = initTRPC.context<TRPCContext>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;

// ─── Protected procedure (requiere Clerk session) ────────
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});
