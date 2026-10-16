// ============================================================
// Admin Auth Helper — WaaS
// Guard compartido para todas las server actions administrativas.
// No hardcodea identidades. Falla de forma segura.
// ============================================================

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { admins } from '@/db/schema';
import { eq } from 'drizzle-orm';

export interface AdminContext {
  userId: string;
  adminId: string;
}

async function resolveAdmin(): Promise<AdminContext | null> {
  const { userId } = await auth();
  if (!userId) return null;

  // Fallback de entorno para desarrollo — nunca hardcoded
  const envAdminId = process.env.ADMIN_CLERK_USER_ID;
  if (envAdminId && userId === envAdminId) {
    return { userId, adminId: `env:${userId}` };
  }

  const [admin] = await db
    .select({ id: admins.id })
    .from(admins)
    .where(eq(admins.clerkUserId, userId))
    .limit(1);

  return admin ? { userId, adminId: admin.id } : null;
}

/**
 * Verifica que el usuario autenticado sea administrador.
 * Lanza si no hay sesión o si el usuario no está en la tabla `admins`
 * (o no coincide con ADMIN_CLERK_USER_ID como fallback de entorno).
 *
 * Usar al inicio de cada server action administrativa.
 */
export async function requireAdmin(): Promise<AdminContext> {
  const admin = await resolveAdmin();
  if (!admin) {
    throw new Error('No autorizado.');
  }
  return admin;
}

/**
 * Variante que no lanza: para acciones cuyo contrato de retorno es un
 * resultado tipado (`{ success: false, error }`) en lugar de una excepción.
 */
export async function isAdmin(): Promise<boolean> {
  return (await resolveAdmin()) !== null;
}

export const UNAUTHORIZED_MESSAGE = 'No autorizado.';
