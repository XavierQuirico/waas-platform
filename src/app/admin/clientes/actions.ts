'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { clients } from '@/db/schema';

type Niche =
  | 'salud'
  | 'legal'
  | 'fitness'
  | 'gastronomia'
  | 'inmobiliaria'
  | 'educacion'
  | 'marca_personal'
  | 'otro';

interface CreateClientInput {
  fullName: string;
  email: string;
  businessName: string;
  whatsapp: string;
  industry: Niche;
  currentUrl: string;
  location?: string;
}

interface UpdateClientInput extends CreateClientInput {
  id: string;
}

export async function createClientAction(
  input: CreateClientInput,
): Promise<{ clientId: string } | { error: string }> {
  const { userId } = await auth();
  if (!userId || userId !== process.env.ADMIN_CLERK_USER_ID) {
    return { error: 'No autorizado' };
  }

  try {
    const [client] = await db
      .insert(clients)
      .values({
        fullName: input.fullName,
        email: input.email,
        businessName: input.businessName,
        whatsapp: input.whatsapp,
        industry: input.industry,
        currentUrl: input.currentUrl,
        location: input.location ?? null,
      })
      .returning({ id: clients.id });

    revalidatePath('/admin/clientes');
    revalidatePath('/admin/proyectos');
    revalidatePath('/admin/sitios');
    return { clientId: client.id };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Error al crear cliente' };
  }
}

export async function updateClientAction(
  input: UpdateClientInput,
): Promise<{ client: UpdateClientInput } | { error: string }> {
  const { userId } = await auth();
  if (!userId || userId !== process.env.ADMIN_CLERK_USER_ID) {
    return { error: 'No autorizado' };
  }

  try {
    const [client] = await db
      .update(clients)
      .set({
        fullName: input.fullName,
        email: input.email,
        businessName: input.businessName,
        whatsapp: input.whatsapp,
        industry: input.industry,
        currentUrl: input.currentUrl,
        location: input.location ?? null,
        updatedAt: new Date(),
      })
      .where(eq(clients.id, input.id))
      .returning({
        id: clients.id,
        fullName: clients.fullName,
        email: clients.email,
        businessName: clients.businessName,
        whatsapp: clients.whatsapp,
        industry: clients.industry,
        currentUrl: clients.currentUrl,
        location: clients.location,
      });

    revalidatePath('/admin/clientes');
    revalidatePath('/admin/proyectos');
    revalidatePath('/admin/sitios');
    revalidatePath('/admin/tickets');
    revalidatePath('/admin/incidencias');
    return { client };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Error al actualizar cliente' };
  }
}
