// ============================================================
// Email verificado de la cuenta Clerk
//
// Vincular un cliente "pendiente" a una cuenta real solo es seguro si el email
// que se usa para encontrar al cliente pertenece de verdad a quien está
// autenticado. Un email sin verificar, o escrito en un formulario, no lo prueba.
// ============================================================

import { currentUser } from '@clerk/nextjs/server';

type ClerkEmailLike = {
  id: string;
  emailAddress: string;
  verification?: { status?: string | null } | null;
};

type ClerkUserLike = {
  primaryEmailAddressId: string | null;
  emailAddresses: ClerkEmailLike[];
};

/** Devuelve el email principal solo si Clerk lo marca como verificado. */
export function pickVerifiedPrimaryEmail(user: ClerkUserLike | null | undefined): string | null {
  if (!user) return null;
  const primary = user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId);
  if (!primary || primary.verification?.status !== 'verified') return null;
  return primary.emailAddress;
}

export async function getVerifiedPrimaryEmail(): Promise<string | null> {
  return pickVerifiedPrimaryEmail(await currentUser());
}

export function emailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
