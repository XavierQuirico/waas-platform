// ============================================================
// Enlace de un cliente "pendiente" con la cuenta recién creada
//
// El wizard público crea el cliente antes de que exista una cuenta de usuario
// (clerkUserId = pending_*). Cuando la persona se registra, se enlaza por el
// email verificado de su cuenta. Este módulo NO es una server action: nunca
// debe poder invocarse directamente desde el navegador.
// ============================================================

import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { clients } from '@/db/schema';
import { resolveClientLink } from './client-link-logic';
import { getVerifiedPrimaryEmail } from './verified-email';

export type LinkPendingClientResult =
  | { status: 'linked'; client: { id: string; fullName: string } }
  | { status: 'conflict' }
  | { status: 'none' };

/**
 * Busca un cliente por el email verificado de la cuenta y, si todavía está
 * pendiente, lo enlaza a `userId`.
 *
 * - 'linked'   → el cliente ya pertenece (o ahora pertenece) a esta cuenta.
 * - 'conflict' → ese email ya pertenece a otra cuenta real.
 * - 'none'     → no hay email verificado o no existe un cliente con ese email.
 */
export async function linkPendingClientForUser(userId: string): Promise<LinkPendingClientResult> {
  const verifiedEmail = await getVerifiedPrimaryEmail();
  if (!verifiedEmail) return { status: 'none' };

  const [clientByEmail] = await db
    .select({ id: clients.id, fullName: clients.fullName, clerkUserId: clients.clerkUserId })
    .from(clients)
    .where(eq(sql`lower(${clients.email})`, verifiedEmail.toLowerCase()))
    .limit(1);

  if (!clientByEmail) return { status: 'none' };

  const decision = resolveClientLink(clientByEmail.clerkUserId, userId);
  if (decision === 'conflict') return { status: 'conflict' };

  if (decision === 'update_clerk_id') {
    await db.update(clients).set({ clerkUserId: userId }).where(eq(clients.id, clientByEmail.id));
  }

  return { status: 'linked', client: { id: clientByEmail.id, fullName: clientByEmail.fullName } };
}
